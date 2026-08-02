"""Load scraped OOH inventory into the MVP marketplace.

Reads the JSONL written by `backend/scraper` (see its README) and maps it onto
this app's `Listing`. The scraper's vocabulary is snake_case; the MVP stores
display strings ("Hoarding", "Front Lit"), so the mapping happens here rather
than polluting either side.

    python -m scripts.import_scraped ../../backend/data/bangalore/listings.jsonl --replace

`--replace` clears existing listings first; it refuses to run if any listing is
referenced by a cart or booking, since that would orphan a real order.
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

from sqlalchemy import delete, func, select

from app.database import SessionLocal
from app.models import Booking, CartItem, Listing, ListingStatus, Role, User

OWNER_EMAIL = "scraped-inventory@internal.invalid"
OWNER_NAME = "Scraped Inventory (unclaimed)"

# The scraper records the source's own category name in
# `extra.source_media_type`, which already matches the MVP's display strings.
SPACE_TYPE_FALLBACK = {
    "hoarding": "Hoarding",
    "bus_shelter": "Bus Shelter",
    "digital_ooh": "Digital OOH",
    "skywalk": "Skywalk",
    "road_median": "Road Median",
    "pole_kiosk": "Pole Kiosk",
}
LIGHTING = {
    "front_lit": "Front Lit",
    "back_lit": "Back Lit",
    "non_lit": "Non Lit",
    "digital": "LED",
}


def get_or_create_owner(db) -> User:
    owner = db.scalar(select(User).where(User.email == OWNER_EMAIL))
    if owner:
        return owner
    # Unusable password hash: this is an inventory holder, not a login.
    owner = User(email=OWNER_EMAIL, full_name=OWNER_NAME, password_hash="!", role=Role.owner)
    db.add(owner)
    db.flush()
    return owner


def copy_image(record: dict, public_dir: Path) -> str | None:
    """Copy the scraped photo into the Next.js public dir; return its URL."""
    images = record.get("images") or []
    if not images or not images[0].get("local_path"):
        return None
    source = Path(images[0]["local_path"])
    if not source.is_absolute():
        source = (Path(__file__).resolve().parents[3] / "backend" / source).resolve()
    if not source.exists():
        return None
    public_dir.mkdir(parents=True, exist_ok=True)
    target = public_dir / f"scraped-{record['source_id']}{source.suffix}"
    shutil.copyfile(source, target)
    return f"/images/listings/{target.name}"


def listing_fields(record: dict, owner_id: int, image_url: str | None) -> dict:
    extra = record.get("extra") or {}
    space_type = extra.get("source_media_type") or SPACE_TYPE_FALLBACK.get(
        record.get("space_type", ""), "Hoarding"
    )
    return dict(
        owner_id=owner_id,
        title=record["title"][:180],
        space_type=space_type[:50],
        description=record.get("description") or "",
        location=record["location"][:255],
        width_ft=record.get("width_ft"),
        height_ft=record.get("height_ft"),
        price_per_day=record["price_per_day"],
        footfall_estimate=record.get("footfall_estimate"),
        status=ListingStatus.active,
        lighting=LIGHTING.get(record.get("illumination") or ""),
        image_url=image_url,
        extra={
            "source_url": record.get("source_url"),
            "source_site": record.get("source_site"),
            "source_id": record.get("source_id"),
            "city": record.get("city"),
            "latitude": record.get("latitude"),
            "longitude": record.get("longitude"),
            "size_bucket": extra.get("size_bucket"),
            "landmark": extra.get("landmark"),
            "locality": extra.get("locality"),
            "resolution_px": extra.get("resolution_px"),
            "total_impressions": extra.get("total_impressions"),
            "card_rate": extra.get("card_rate"),
            "minimum_billing": extra.get("minimum_billing"),
            "warnings": record.get("warnings") or [],
        },
    )


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Import scraped listings into the MVP database")
    parser.add_argument("path", help="listings.jsonl produced by backend/scraper")
    parser.add_argument("--replace", action="store_true", help="delete existing listings first")
    parser.add_argument("--public-dir", default="../frontend/public/images/listings")
    args = parser.parse_args(argv)

    records = [json.loads(line) for line in Path(args.path).read_text().splitlines() if line.strip()]
    # A listing with no price cannot be booked or checked out.
    usable = [r for r in records if r.get("price_per_day")]
    skipped = len(records) - len(usable)

    public_dir = Path(args.public_dir).resolve()

    with SessionLocal() as db:
        if args.replace:
            referenced = db.scalar(select(func.count()).select_from(CartItem)) or 0
            referenced += db.scalar(select(func.count()).select_from(Booking)) or 0
            if referenced:
                print(
                    f"Refusing --replace: {referenced} cart/booking rows reference existing "
                    "listings. Clear them first, or import without --replace.",
                    file=sys.stderr,
                )
                return 1
            deleted = db.execute(delete(Listing)).rowcount
            print(f"Deleted {deleted} existing listings")

        owner = get_or_create_owner(db)

        # Re-importing a file must refresh rows rather than duplicate them, so
        # a single media type can be topped up without touching the rest of the
        # catalogue. `extra.source_id` is the source's own stable id.
        existing = {
            (listing.extra or {}).get("source_id"): listing
            for listing in db.scalars(select(Listing).where(Listing.owner_id == owner.id))
            if (listing.extra or {}).get("source_id")
        }

        created = updated = with_photo = 0
        for record in usable:
            image_url = copy_image(record, public_dir)
            with_photo += bool(image_url)
            fields = listing_fields(record, owner.id, image_url)

            listing = existing.get(record.get("source_id"))
            if listing is None:
                db.add(Listing(**fields))
                created += 1
            else:
                for key, value in fields.items():
                    setattr(listing, key, value)
                updated += 1
        db.commit()

        total = db.scalar(select(func.count()).select_from(Listing))

    print(f"Read {len(records)} records from {args.path}")
    print(f"  created: {created}   updated: {updated}   skipped (no price): {skipped}")
    print(f"  with photo: {with_photo}")
    print(f"  listings now in database: {total}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
