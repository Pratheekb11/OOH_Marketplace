"""Output sinks: newline-delimited JSON for machines, CSV for spreadsheets.

JSONL is the canonical artefact - it keeps nested images, extras and warnings,
and it is what `scraper.importer` reads. The CSV is a flattened convenience
view and is lossy by design.
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

from scraper.models import ScrapedHoarding

CSV_COLUMNS = [
    "source_site", "source_id", "source_url", "title", "space_type",
    "location", "city", "state", "pincode", "latitude", "longitude",
    "width_ft", "height_ft", "area_sqft", "size_raw",
    "price_per_day", "price_period", "price_raw",
    "footfall_estimate", "illumination", "availability",
    "image_count", "image_urls", "local_images",
    "description", "scraped_at", "importable", "warnings",
]


def write_jsonl(records: list[ScrapedHoarding], path: str | Path) -> Path:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(record.model_dump_json() + "\n")
    return target


def write_csv(records: list[ScrapedHoarding], path: str | Path) -> Path:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS, extrasaction="ignore")
        writer.writeheader()
        for record in records:
            writer.writerow(record.flat_row())
    return target


def read_jsonl(path: str | Path) -> list[ScrapedHoarding]:
    with Path(path).open(encoding="utf-8") as handle:
        return [ScrapedHoarding(**json.loads(line)) for line in handle if line.strip()]
