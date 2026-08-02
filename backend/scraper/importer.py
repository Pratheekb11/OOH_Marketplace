"""Load a scraped JSONL file into the marketplace database.

Imported inventory belongs to a synthetic owner and lands in
`pending_approval`, so scraped rows go through the same admin review as
owner-submitted ones and never appear in the marketplace unreviewed.

Re-running is idempotent: `scraped_listings.source_url` is unique, so a second
pass updates the existing listing instead of duplicating it.
"""
from __future__ import annotations

import logging
from pathlib import Path

from sqlalchemy.orm import Session

from app.integrations import store_file
from app.models import Listing, ListingStatus, Role, ScrapedListing, User
from scraper.images import content_type_for
from scraper.models import ScrapedHoarding

logger = logging.getLogger(__name__)

SCRAPER_OWNER_EMAIL = "scraped-inventory@internal.invalid"
SCRAPER_OWNER_NAME = "Scraped Inventory (unclaimed)"


def get_or_create_owner(db: Session) -> User:
    """The placeholder owner that holds scraped inventory until it is claimed.

    The password hash is set to a value no bcrypt verify can match, so the
    account cannot be logged into.
    """
    owner = db.query(User).filter(User.email == SCRAPER_OWNER_EMAIL).one_or_none()
    if owner:
        return owner
    owner = User(
        email=SCRAPER_OWNER_EMAIL,
        full_name=SCRAPER_OWNER_NAME,
        password_hash="!",  # unusable by design - not a login account
        role=Role.owner,
        kyc_status="not_required",
    )
    db.add(owner)
    db.flush()
    return owner


def _store_images(record: ScrapedHoarding, source_id: str) -> list[str]:
    keys = []
    for index, image in enumerate(record.images):
        if not image.local_path or not Path(image.local_path).exists():
            continue
        path = Path(image.local_path)
        key = f"scraped/{record.source_site}/{source_id}/{index}{path.suffix}"
        keys.append(store_file(key, path.read_bytes(), content_type_for(path.name)))
    return keys


def import_records(
    db: Session,
    records: list[ScrapedHoarding],
    *,
    skip_incomplete: bool = True,
    activate: bool = False,
) -> dict[str, int]:
    """Insert or refresh listings for `records`. Returns a counts summary.

    `activate` publishes imported rows straight to the marketplace instead of
    queueing them for admin review. It exists for bulk-loading a catalogue you
    already trust; leave it off for anything that should be reviewed.
    """
    owner = get_or_create_owner(db)
    status = ListingStatus.active if activate else ListingStatus.pending
    summary = {"created": 0, "updated": 0, "skipped_incomplete": 0}

    for record in records:
        missing = record.missing_for_import()
        if missing and skip_incomplete:
            logger.debug("skipping %s, missing %s", record.source_url, missing)
            summary["skipped_incomplete"] += 1
            continue

        provenance = (
            db.query(ScrapedListing)
            .filter(ScrapedListing.source_url == record.source_url)
            .one_or_none()
        )

        fields = dict(
            owner_id=owner.id,
            title=record.title[:180],
            space_type=record.space_type[:50],
            description=record.description,
            location=record.location[:255],
            latitude=record.latitude,
            longitude=record.longitude,
            width_ft=record.width_ft,
            height_ft=record.height_ft,
            price_per_day=record.price_per_day,
            footfall_estimate=record.footfall_estimate,
            city=record.city,
            illumination=record.illumination,
        )

        if provenance and provenance.listing_id:
            listing = db.get(Listing, provenance.listing_id)
            for key, value in fields.items():
                setattr(listing, key, value)
            summary["updated"] += 1
        else:
            listing = Listing(**fields, status=status)
            db.add(listing)
            db.flush()
            summary["created"] += 1

        image_keys = _store_images(record, record.source_id or str(listing.id))

        if provenance:
            provenance.listing_id = listing.id
            provenance.scraped_at = record.scraped_at.replace(tzinfo=None)
            provenance.image_keys = image_keys
            provenance.payload = record.model_dump(mode="json")
        else:
            db.add(
                ScrapedListing(
                    listing_id=listing.id,
                    source_site=record.source_site,
                    source_url=record.source_url,
                    source_id=record.source_id,
                    scraped_at=record.scraped_at.replace(tzinfo=None),
                    image_keys=image_keys,
                    payload=record.model_dump(mode="json"),
                )
            )

    db.commit()
    return summary
