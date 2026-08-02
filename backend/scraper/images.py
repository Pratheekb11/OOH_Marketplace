"""Download and vet the hoarding photos referenced by a scraped record.

Source pages are full of logos, social icons and spacer GIFs. Anything that
survives `looks_like_hoarding_photo` and decodes to a large enough bitmap is
kept; everything else is dropped before it reaches disk or the database.
"""
from __future__ import annotations

import hashlib
import io
import logging
import mimetypes
import re
from pathlib import Path
from urllib.parse import urlparse

from PIL import Image, UnidentifiedImageError

from scraper.fetch import Fetcher
from scraper.models import ScrapedImage

logger = logging.getLogger(__name__)

# Substrings that mark chrome rather than inventory photography.
JUNK_URL_PATTERNS = re.compile(
    r"(logo|icon|favicon|sprite|placeholder|avatar|banner-ad|spacer|blank|"
    r"whatsapp|facebook|twitter|instagram|linkedin|youtube|pixel|loader|spinner)",
    re.IGNORECASE,
)
# Sources often publish only a small preview; 300x125 is themediaant's own
# thumbnail size, so the floor has to sit below it or real photos are dropped.
MIN_IMAGE_PX = 200
MIN_IMAGE_BYTES = 3 * 1024
MAX_IMAGE_BYTES = 25 * 1024 * 1024


def looks_like_hoarding_photo(url: str) -> bool:
    if not url or url.startswith("data:"):
        return False
    path = urlparse(url).path.lower()
    if path.endswith(".svg"):
        return False
    return not JUNK_URL_PATTERNS.search(url)


def _extension_for(url: str, content: bytes) -> str:
    suffix = Path(urlparse(url).path).suffix.lower()
    if suffix in {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}:
        return suffix
    try:
        with Image.open(io.BytesIO(content)) as probe:
            return f".{(probe.format or 'jpg').lower()}"
    except (UnidentifiedImageError, OSError):
        return ".jpg"


def content_type_for(path: str) -> str:
    return mimetypes.guess_type(path)[0] or "application/octet-stream"


def download_images(
    images: list[ScrapedImage],
    fetcher: Fetcher,
    output_dir: str | Path,
    *,
    max_per_record: int = 8,
) -> list[ScrapedImage]:
    """Fetch, de-duplicate and persist images; returns only the ones kept."""
    directory = Path(output_dir)
    directory.mkdir(parents=True, exist_ok=True)

    kept: list[ScrapedImage] = []
    seen_digests: set[str] = set()

    for image in images:
        if len(kept) >= max_per_record:
            break
        # A trusted URL came from a field the adapter knows is the photo.
        if not image.trusted and not looks_like_hoarding_photo(image.url):
            continue

        try:
            content = fetcher.get_bytes(image.url)
        except Exception as exc:  # noqa: BLE001 - one bad image must not kill the run
            logger.warning("image download failed %s: %s", image.url, exc)
            continue

        if not MIN_IMAGE_BYTES <= len(content) <= MAX_IMAGE_BYTES:
            continue

        digest = hashlib.sha256(content).hexdigest()
        if digest in seen_digests:
            continue

        try:
            with Image.open(io.BytesIO(content)) as probe:
                probe.verify()
            with Image.open(io.BytesIO(content)) as probe:
                width_px, height_px = probe.size
        except (UnidentifiedImageError, OSError):
            logger.warning("not a decodable image: %s", image.url)
            continue

        if max(width_px, height_px) < MIN_IMAGE_PX:
            continue

        seen_digests.add(digest)
        path = directory / f"{digest[:16]}{_extension_for(image.url, content)}"
        path.write_bytes(content)

        kept.append(
            image.model_copy(
                update={
                    "local_path": str(path),
                    "sha256": digest,
                    "byte_size": len(content),
                    "width_px": width_px,
                    "height_px": height_px,
                }
            )
        )

    return kept
