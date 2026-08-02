"""Command line entry point.

    python -m scraper.cli scrape themediaant --location "Bangalore, Karnataka, India" \
        --location-id ChIJbU60yXAWrjsR4E9-UejD3_g --out data/bangalore
    python -m scraper.cli import data/bangalore/listings.jsonl
"""
from __future__ import annotations

import argparse
import logging
import sys
from collections import Counter
from pathlib import Path

from scraper.adapters import ADAPTERS
from scraper.fetch import Fetcher
from scraper.images import download_images
from scraper.importer import import_records
from scraper.writers import read_jsonl, write_csv, write_jsonl

logger = logging.getLogger("scraper")


def _fetcher(args, adapter_class) -> Fetcher:
    return Fetcher(
        delay=args.delay,
        cache_dir=args.cache_dir,
        obey_robots=not args.ignore_robots,
        headers=adapter_class.default_headers,
    )


def cmd_scrape(args) -> int:
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    adapter_class = ADAPTERS[args.adapter]
    with _fetcher(args, adapter_class) as fetcher:
        adapter = adapter_class(
            fetcher,
            location=args.location,
            location_id=args.location_id,
            with_details=not args.no_details,
            detail_workers=args.detail_workers,
            media_types=args.media_type,
            limit=args.limit,
        )

        expected = adapter.expected_counts()
        if expected:
            print("Source advertises:")
            for name, count in sorted(expected.items(), key=lambda kv: -kv[1]):
                print(f"  {count:>6}  {name}")
            print(f"  {sum(expected.values()):>6}  TOTAL\n")

        records = []
        for record in adapter.scrape():
            if args.images:
                record.images = download_images(
                    record.images, fetcher, out_dir / "images", max_per_record=args.max_images
                )
            records.append(record)
            if len(records) % 100 == 0:
                print(f"  ...{len(records)} records", file=sys.stderr)

    jsonl = write_jsonl(records, out_dir / "listings.jsonl")
    csv_path = write_csv(records, out_dir / "listings.csv")

    # -- reconcile against the counts the source itself published.
    # Group by the filter each record was collected under, not by its own type
    # label: sources file sub-types under a parent label (themediaant returns
    # digital bus shelters tagged "Bus Shelter"), which makes a correct run
    # look like it missed a whole category.
    got = Counter(
        record.extra.get("source_media_type") or record.extra.get("media_type") or record.space_type
        for record in records
    )
    print(f"\nWrote {len(records)} records\n  {jsonl}\n  {csv_path}")
    if args.images:
        print(f"  {out_dir / 'images'}  ({sum(len(r.images) for r in records)} images)")

    if expected:
        print("\nCoverage:")
        shortfall = 0
        for name, count in sorted(expected.items(), key=lambda kv: -kv[1]):
            actual = got.get(name, 0)
            gap = count - actual
            shortfall += max(0, gap)
            flag = "OK" if gap == 0 else f"MISSING {gap}"
            print(f"  {name:<24} {actual:>5} / {count:<5} {flag}")
        print(f"  {'TOTAL':<24} {len(records):>5} / {sum(expected.values()):<5}")
        if shortfall:
            print(f"\n{shortfall} records short of the advertised total.", file=sys.stderr)

    importable = sum(1 for r in records if r.is_importable())
    print(f"\nImportable (has title, location, size and daily rate): {importable}/{len(records)}")
    return 0


def cmd_import(args) -> int:
    from app.database import SessionLocal

    records = read_jsonl(args.path)
    with SessionLocal() as db:
        summary = import_records(
            db, records,
            skip_incomplete=not args.include_incomplete,
            activate=args.activate,
        )
    print(f"Read {len(records)} records from {args.path}")
    for key, value in summary.items():
        print(f"  {key}: {value}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="scraper", description="OOH hoarding scraper")
    parser.add_argument("-v", "--verbose", action="store_true")
    subparsers = parser.add_subparsers(dest="command", required=True)

    scrape = subparsers.add_parser("scrape", help="collect inventory from a source site")
    scrape.add_argument("adapter", choices=sorted(ADAPTERS))
    scrape.add_argument("--location", default="Bangalore, Karnataka, India")
    scrape.add_argument("--location-id", default="ChIJbU60yXAWrjsR4E9-UejD3_g")
    scrape.add_argument("--out", default="data/scrape")
    scrape.add_argument("--media-type", action="append", help="restrict to a media type; repeatable")
    scrape.add_argument("--limit", type=int, help="cap records per media type (for smoke runs)")
    scrape.add_argument("--no-details", action="store_true",
                        help="skip detail pages - much faster, but no daily rate or exact size")
    scrape.add_argument("--detail-workers", type=int, default=4)
    scrape.add_argument("--images", action="store_true", help="download hoarding photos")
    scrape.add_argument("--max-images", type=int, default=4)
    scrape.add_argument("--delay", type=float, default=0.4, help="seconds between request starts")
    scrape.add_argument("--cache-dir", default=".scrape_cache")
    scrape.add_argument("--ignore-robots", action="store_true")
    scrape.set_defaults(func=cmd_scrape)

    load = subparsers.add_parser("import", help="load a JSONL file into the marketplace DB")
    load.add_argument("path")
    load.add_argument("--include-incomplete", action="store_true",
                      help="import records missing a size or rate (they will fail listing validation)")
    load.add_argument("--activate", action="store_true",
                      help="publish straight to the marketplace instead of queueing for admin review")
    load.set_defaults(func=cmd_import)
    return parser


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)s %(name)s: %(message)s",
    )
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
