"""Adapter registry. Add a site here once its module exists."""
from scraper.adapters.base import Adapter, next_data
from scraper.adapters.themediaant import TheMediaAntAdapter

ADAPTERS: dict[str, type[Adapter]] = {
    TheMediaAntAdapter.name: TheMediaAntAdapter,
}

__all__ = ["Adapter", "ADAPTERS", "TheMediaAntAdapter", "next_data"]
