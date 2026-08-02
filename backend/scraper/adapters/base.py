"""Adapter contract.

An adapter knows how to turn one source site into `ScrapedHoarding` records.
Everything shared - HTTP politeness, parsing heuristics, image handling,
output - lives outside the adapter so a new site is only the site-specific part.
"""
from __future__ import annotations

import json
from abc import ABC, abstractmethod
from collections.abc import Iterator

from bs4 import BeautifulSoup

from scraper.fetch import Fetcher
from scraper.models import ScrapedHoarding


class Adapter(ABC):
    #: Short slug used on the command line and stamped onto every record.
    name: str = "base"
    #: Extra request headers this source needs (e.g. an API that checks Origin).
    default_headers: dict[str, str] = {}

    def __init__(self, fetcher: Fetcher, **options) -> None:
        self.fetcher = fetcher
        self.options = options

    @abstractmethod
    def scrape(self) -> Iterator[ScrapedHoarding]:
        """Yield every record this adapter can reach for its configured query."""

    def expected_counts(self) -> dict[str, int]:
        """Per-category totals the source itself advertises, for verification.

        An empty mapping means the source publishes no counts to check against.
        """
        return {}


def next_data(html: str) -> dict:
    """Return the parsed `__NEXT_DATA__` blob from a Next.js page."""
    soup = BeautifulSoup(html, "lxml")
    tag = soup.find("script", id="__NEXT_DATA__")
    if not tag or not tag.string:
        raise ValueError("no __NEXT_DATA__ payload on page")
    return json.loads(tag.string)
