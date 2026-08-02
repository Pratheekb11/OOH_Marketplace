"""Headless-browser rendering for sources that only assemble their inventory
client-side.

Plain HTTP is the fast path and is what the themediaant adapter uses; this
module exists for sites whose listings never appear in the served HTML, and for
re-discovering an API when the static payload changes shape.

The context is configured to look like an ordinary desktop Chrome session in
India - correct user agent, viewport, locale and timezone - and to browse at
human pace. That is about being a well-behaved client that a site can still
identify and rate-limit, not about defeating bot detection.
"""
from __future__ import annotations

import logging
import random
from contextlib import contextmanager

logger = logging.getLogger(__name__)

CHROME_UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/141.0.0.0 Safari/537.36"
)


@contextmanager
def browser_page(
    *,
    headless: bool = True,
    user_agent: str = CHROME_UA,
    locale: str = "en-IN",
    timezone: str = "Asia/Kolkata",
    storage_state: str | None = None,
):
    """Yield a Playwright page on a realistic desktop Chrome context."""
    from playwright.sync_api import sync_playwright  # imported lazily; optional dep

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=headless)
        context = browser.new_context(
            user_agent=user_agent,
            viewport={"width": 1440, "height": 900},
            locale=locale,
            timezone_id=timezone,
            storage_state=storage_state,
        )
        page = context.new_page()
        try:
            yield page
        finally:
            context.close()
            browser.close()


def human_pause(page, low: float = 700, high: float = 1800) -> None:
    page.wait_for_timeout(random.uniform(low, high))


def scroll_through(page, *, passes: int = 8, step: int = 3000) -> None:
    """Walk down the page so lazy-loaded images and rows actually render.

    Infinite-scroll galleries only attach their `src` once the row nears the
    viewport, so harvesting images without this returns placeholders.
    """
    for _ in range(passes):
        page.mouse.wheel(0, step)
        human_pause(page, 600, 1400)


def click_through(page, labels=("Load More", "Show More", "View More"), *, rounds: int = 50) -> int:
    """Press a 'load more' control until it stops appearing. Returns click count."""
    clicks = 0
    for _ in range(rounds):
        progressed = False
        for label in labels:
            try:
                button = page.get_by_role("button", name=label).first
                if button.is_visible(timeout=1200):
                    button.click()
                    clicks += 1
                    progressed = True
                    human_pause(page, 1200, 2400)
                    break
            except Exception:  # noqa: BLE001 - control absent on this page
                continue
        if not progressed:
            break
    return clicks


def render_html(url: str, *, wait_until: str = "networkidle", **kwargs) -> str:
    """Fetch a page's fully rendered HTML."""
    with browser_page(**kwargs) as page:
        page.goto(url, wait_until=wait_until, timeout=60000)
        scroll_through(page, passes=4)
        return page.content()
