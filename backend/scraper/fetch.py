"""Polite HTTP layer for the scrapers.

Every network read in this package goes through `Fetcher`, which enforces
robots.txt, a per-host delay, bounded retries and an on-disk cache. The cache
matters during development: re-running a parser against a page you already
pulled costs the source site nothing.
"""
from __future__ import annotations

import hashlib
import logging
import threading
import time
import urllib.robotparser
from pathlib import Path
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

DEFAULT_USER_AGENT = (
    "AdSpaceMarketplaceBot/0.1 (+https://example.com/bot; contact: ops@example.com)"
)
RETRY_STATUS = {429, 500, 502, 503, 504}


class RobotsDisallowed(RuntimeError):
    """Raised when robots.txt forbids the URL and obey_robots is on."""


class Fetcher:
    def __init__(
        self,
        *,
        user_agent: str = DEFAULT_USER_AGENT,
        delay: float = 1.5,
        timeout: float = 20.0,
        cache_dir: str | Path | None = None,
        obey_robots: bool = True,
        max_retries: int = 3,
        headers: dict[str, str] | None = None,
    ) -> None:
        self.user_agent = user_agent
        self.delay = delay
        self.obey_robots = obey_robots
        self.max_retries = max_retries
        self.cache_dir = Path(cache_dir) if cache_dir else None
        if self.cache_dir:
            self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._client = httpx.Client(
            timeout=timeout,
            follow_redirects=True,
            headers={
                "User-Agent": user_agent,
                "Accept-Language": "en-IN,en;q=0.9",
                **(headers or {}),
            },
        )
        self._robots: dict[str, urllib.robotparser.RobotFileParser | None] = {}
        self._last_hit: dict[str, float] = {}
        # Guards the throttle and robots caches; detail fetches run threaded.
        self._lock = threading.Lock()

    # -- lifecycle -----------------------------------------------------
    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "Fetcher":
        return self

    def __exit__(self, *_exc) -> None:
        self.close()

    # -- politeness ----------------------------------------------------
    def _robots_for(self, url: str):
        host = urlparse(url).netloc
        if host not in self._robots:
            parser = urllib.robotparser.RobotFileParser()
            robots_url = f"{urlparse(url).scheme}://{host}/robots.txt"
            try:
                response = self._client.get(robots_url)
                if response.status_code < 400:
                    parser.parse(response.text.splitlines())
                else:
                    # No robots.txt published means nothing is disallowed.
                    parser.parse([])
            except httpx.HTTPError:
                logger.warning("robots.txt unreachable for %s; treating as open", host)
                parser = None
            self._robots[host] = parser
        return self._robots[host]

    def allowed(self, url: str) -> bool:
        if not self.obey_robots:
            return True
        parser = self._robots_for(url)
        if parser is None:
            return True
        return parser.can_fetch(self.user_agent, url)

    def _throttle(self, url: str) -> None:
        """Space out request *starts* per host.

        Holding the lock only while reserving the slot (never while sleeping)
        lets several requests be in flight at once while still capping the rate
        at one start per `delay` seconds.
        """
        host = urlparse(url).netloc
        with self._lock:
            now = time.monotonic()
            earliest = self._last_hit.get(host, 0.0) + self.delay
            start_at = max(now, earliest)
            self._last_hit[host] = start_at
        wait = start_at - time.monotonic()
        if wait > 0:
            time.sleep(wait)

    # -- cache ---------------------------------------------------------
    def _cache_path(self, url: str, suffix: str) -> Path | None:
        if not self.cache_dir:
            return None
        digest = hashlib.sha256(url.encode()).hexdigest()[:24]
        return self.cache_dir / f"{digest}{suffix}"

    # -- reads ---------------------------------------------------------
    def get_bytes(self, url: str, *, use_cache: bool = True) -> bytes:
        cache_path = self._cache_path(url, ".bin")
        if use_cache and cache_path and cache_path.exists():
            return cache_path.read_bytes()

        if not self.allowed(url):
            raise RobotsDisallowed(f"robots.txt disallows {url}")

        last_error: Exception | None = None
        for attempt in range(1, self.max_retries + 1):
            self._throttle(url)
            try:
                response = self._client.get(url)
            except httpx.HTTPError as exc:  # network-level failure
                last_error = exc
                logger.warning("fetch failed (%s/%s) %s: %s", attempt, self.max_retries, url, exc)
                time.sleep(min(2**attempt, 30))
                continue

            if response.status_code in RETRY_STATUS:
                wait = float(response.headers.get("Retry-After", min(2**attempt, 30)))
                logger.warning("HTTP %s from %s; backing off %.0fs", response.status_code, url, wait)
                last_error = httpx.HTTPStatusError(
                    f"HTTP {response.status_code}", request=response.request, response=response
                )
                time.sleep(wait)
                continue

            response.raise_for_status()
            content = response.content
            if cache_path:
                cache_path.write_bytes(content)
            return content

        raise RuntimeError(f"giving up on {url}") from last_error

    def get_text(self, url: str, *, use_cache: bool = True) -> str:
        raw = self.get_bytes(url, use_cache=use_cache)
        try:
            return raw.decode("utf-8")
        except UnicodeDecodeError:
            return raw.decode("utf-8", errors="replace")
