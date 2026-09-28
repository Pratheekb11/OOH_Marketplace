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
import re
import shutil
import sys
from collections import Counter
from collections.abc import Iterable
from pathlib import Path

from app.database import SessionLocal
from app.images import image_file_name
from app.models import Booking, CartItem, Listing, ListingStatus, Role, User
from PIL import Image, UnidentifiedImageError
from sqlalchemy import delete, func, select

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
# Photos are committed to the frontend's public dir, so they are shipped at a
# web size rather than the source's camera resolution (3200x2400, ~2.7 MB).
MAX_PHOTO_PX = 1280
JPEG_QUALITY = 80
# themediaant attaches one "Images shown are for reference only" shot to many
# unrelated listings. A photo this many listings share depicts none of them.
SHARED_PHOTO_THRESHOLD = 3
# Below this on the long edge a photo is a card thumbnail (the source's own
# preview is 300x125), dropped whenever the listing has a real photo.
THUMBNAIL_PX = 500

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


def shared_image_digests(records: Iterable[dict], threshold: int = SHARED_PHOTO_THRESHOLD) -> set[str]:
    """Digests of photos attached to `threshold` or more listings."""
    counts = Counter(
        digest
        for record in records
        for digest in {image.get("sha256") for image in record.get("images") or []}
        if digest
    )
    return {digest for digest, count in counts.items() if count >= threshold}


def _resolve(local_path: str) -> Path:
    source = Path(local_path)
    if not source.is_absolute():
        source = (Path(__file__).resolve().parents[3] / "backend" / source).resolve()
    return source


def _write_web_photo(source: Path, target_dir: Path, stem_key: str) -> Path:
    """Save `source` as a metadata-free JPEG no larger than MAX_PHOTO_PX.

    Every photo is re-encoded, even one already small enough, because a byte
    copy would ship the source's EXIF, comment and XMP segments. A JPEG that
    fits is saved with its own quantisation tables (`quality="keep"`), so the
    pixels survive practically unchanged. A file that does not decode is not
    a photo we can vouch for and is copied as-is.
    """
    target = target_dir / image_file_name(stem_key, ".jpg")
    try:
        with Image.open(source) as im:
            keep = im.format == "JPEG" and max(im.size) <= MAX_PHOTO_PX and im.mode in ("RGB", "L")
            photo = im if keep else im.convert("RGB")
            if not keep:
                photo.thumbnail((MAX_PHOTO_PX, MAX_PHOTO_PX), Image.LANCZOS)
            # Pillow carries `comment` (and friends) over from `info` on save.
            photo.info.clear()
            photo.save(
                target, "JPEG", quality="keep" if keep else JPEG_QUALITY, optimize=True, progressive=True
            )
    except (UnidentifiedImageError, OSError):
        target.unlink(missing_ok=True)
        target = target_dir / image_file_name(stem_key, source.suffix or ".jpg")
        shutil.copyfile(source, target)
    return target


def _long_edge(source: Path) -> int:
    try:
        with Image.open(source) as im:
            return max(im.size)
    except (UnidentifiedImageError, OSError):
        return 0


def copy_images(record: dict, public_dir: Path, skip_digests: Iterable[str] = ()) -> list[str]:
    """Copy every scraped photo into the Next.js public dir; return their URLs,
    sharpest first.

    Names are opaque (see app/images.py). The first photo is named from the
    source id alone, as the single-photo importer did, so a cover URL already
    stored in a hosted database keeps resolving.
    """
    skip = set(skip_digests)
    sources = [
        _resolve(image["local_path"])
        for image in record.get("images") or []
        if image.get("local_path") and image.get("sha256") not in skip
    ]
    sources = [source for source in sources if source.exists()]
    if not sources:
        return []
    # Sharpest first: the cover is what the marketplace card shows.
    sized = sorted(((_long_edge(source), source) for source in sources), key=lambda pair: -pair[0])
    if sized[0][0] >= THUMBNAIL_PX:
        sized = [pair for pair in sized if pair[0] >= THUMBNAIL_PX]
    sources = [source for _, source in sized]
    public_dir.mkdir(parents=True, exist_ok=True)
    urls = []
    for index, source in enumerate(sources):
        key = record["source_id"] if index == 0 else f"{record['source_id']}#{index}"
        target = _write_web_photo(source, public_dir, key)
        urls.append(f"/images/listings/{target.name}")
    return urls


def copy_image(record: dict, public_dir: Path) -> str | None:
    """Copy the cover photo only; return its URL."""
    urls = copy_images({**record, "images": (record.get("images") or [])[:1]}, public_dir)
    return urls[0] if urls else None


#: themediaant titles end in its own listing number: "Bus Shelter - Juhu Mumbai, 17280".
_SOURCE_NUMBER_SUFFIX = re.compile(r",\s*\d{3,}\s*$")
MAX_TITLE_PLACE = 110


def _place(landmark: str) -> str:
    """"S. Parulekar Marg,Juhu Bus Station,Juhu" -> "S. Parulekar Marg, Juhu Bus Station, Juhu"."""
    parts: list[str] = []
    for part in re.split(r"\s*,\s*", landmark or ""):
        part = re.sub(r"\s+", " ", part).strip(" .-")
        if part and part.lower() not in (p.lower() for p in parts):
            parts.append(part)
    place = ", ".join(parts)
    while len(place) > MAX_TITLE_PLACE and ", " in place:
        place = place.rsplit(", ", 1)[0]
    return place if re.search(r"[A-Za-z]{3}", place) else ""


def listing_title(record: dict, space_type: str) -> str:
    """Our own title: the format and where it stands, never the source's number."""
    place = _place((record.get("extra") or {}).get("landmark", ""))
    if place:
        return f"{space_type} - {place}"[:180]
    return _SOURCE_NUMBER_SUFFIX.sub("", record["title"]).strip()[:180]


def listing_description(record: dict, space_type: str) -> str:
    """Plain facts about the site, written here rather than copied from the source."""
    extra = record.get("extra") or {}
    place = _place(extra.get("landmark", "")) or record.get("location", "")
    locality = (extra.get("locality") or "").strip()
    where = place
    if locality and locality.lower() not in place.lower():
        where = f"{place} in {locality}" if place else locality
    sentences = [f"{space_type} at {where}." if where else f"{space_type}."]

    specs = []
    lighting = LIGHTING.get(record.get("illumination") or "")
    if lighting:
        specs.append(lighting.lower())
    if record.get("width_ft") and record.get("height_ft"):
        specs.append(f"{record['width_ft']:g} x {record['height_ft']:g} ft")
    elif extra.get("size_bucket"):
        specs.append(f"{str(extra['size_bucket']).lower()} format")
    if specs:
        sentences.append(f"The display is {', '.join(specs)}.")

    if record.get("footfall_estimate"):
        sentences.append(f"Estimated daily reach: {record['footfall_estimate']:,} people.")
    return " ".join(sentences)


def listing_fields(
    record: dict, owner_id: int, image_urls: list[str] | None = None, *, image_url: str | None = None
) -> dict:
    """`image_url` alone is the pre-gallery call shape: a cover and nothing else."""
    if image_urls is None:
        image_urls = [image_url] if image_url else []
    extra = record.get("extra") or {}
    space_type = extra.get("source_media_type") or SPACE_TYPE_FALLBACK.get(
        record.get("space_type", ""), "Hoarding"
    )
    return dict(
        owner_id=owner_id,
        title=listing_title(record, space_type),
        space_type=space_type[:50],
        description=listing_description(record, space_type),
        location=record["location"][:255],
        width_ft=record.get("width_ft"),
        height_ft=record.get("height_ft"),
        price_per_day=record["price_per_day"],
        footfall_estimate=record.get("footfall_estimate"),
        status=ListingStatus.active,
        lighting=LIGHTING.get(record.get("illumination") or ""),
        image_url=image_urls[0] if image_urls else None,
        image_urls=image_urls,
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

        placeholders = shared_image_digests(records)
        created = updated = with_photo = photos = 0
        for record in usable:
            image_urls = copy_images(record, public_dir, skip_digests=placeholders)
            with_photo += bool(image_urls)
            photos += len(image_urls)
            fields = listing_fields(record, owner.id, image_urls)

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
    print(f"  with photo: {with_photo}   photos: {photos}   placeholders dropped: {len(placeholders)}")
    print(f"  listings now in database: {total}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
