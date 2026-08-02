"""Export active inventory as a static snapshot for the GitHub Pages build.

Pages is a static host: there is no API for the deployed site to call, and a
build with no `NEXT_PUBLIC_API_BASE_URL` falls back to `127.0.0.1`, which the
browser refuses to reach from an https origin ("Permission was denied for this
request to access the loopback address space"). Shipping the catalogue as JSON
lets the deployed marketplace browse and filter without a backend.

The snapshot is read-only by nature: booking and checkout still need the API.

    python -m scripts.export_static
"""
from __future__ import annotations

import argparse
import gzip
import json
from pathlib import Path

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Listing, ListingStatus


def listing_json(listing: Listing) -> dict:
    """Mirror ListingOut so the snapshot and the API are interchangeable."""
    return {
        "id": listing.id,
        "owner_id": listing.owner_id,
        "title": listing.title,
        "space_type": listing.space_type,
        "description": listing.description or "",
        "location": listing.location,
        "width_ft": listing.width_ft,
        "height_ft": listing.height_ft,
        "price_per_day": listing.price_per_day,
        "footfall_estimate": listing.footfall_estimate,
        "status": listing.status.value if hasattr(listing.status, "value") else listing.status,
        "rejection_reason": listing.rejection_reason,
        "lighting": listing.lighting,
        "image_url": listing.image_url,
        "extra": listing.extra,
    }


def build_facets(rows: list[dict]) -> dict:
    """Same shape as GET /listings/facets, derived from the snapshot itself."""
    sizes: dict[str, int] = {}
    for row in rows:
        if row["width_ft"] and row["height_ft"]:
            key = f"{row['width_ft']:g}W X {row['height_ft']:g}H"
            sizes[key] = sizes.get(key, 0) + 1
    prices = [r["price_per_day"] for r in rows if r["price_per_day"]]
    return {
        "space_types": sorted({r["space_type"] for r in rows if r["space_type"]}),
        "lightings": sorted({r["lighting"] for r in rows if r["lighting"]}),
        # Most common first, matching the API's ORDER BY count DESC LIMIT 40.
        "sizes": [s for s, _ in sorted(sizes.items(), key=lambda kv: -kv[1])][:40],
        "price_min": min(prices) if prices else None,
        "price_max": max(prices) if prices else None,
        "total": len(rows),
    }


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Export active listings as a static snapshot")
    parser.add_argument("--out-dir", default="../frontend/public/data")
    args = parser.parse_args(argv)

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    with SessionLocal() as db:
        listings = db.scalars(
            select(Listing).where(Listing.status == ListingStatus.active).order_by(Listing.id)
        ).all()
        rows = [listing_json(listing) for listing in listings]

    facets = build_facets(rows)
    # Compact separators: this file is downloaded by every visitor.
    listings_text = json.dumps(rows, separators=(",", ":"))
    (out_dir / "listings.json").write_text(listings_text)
    (out_dir / "facets.json").write_text(json.dumps(facets, separators=(",", ":")))

    raw_kb = len(listings_text) // 1024
    gz_kb = len(gzip.compress(listings_text.encode())) // 1024
    print(f"Wrote {len(rows)} listings -> {out_dir/'listings.json'}")
    print(f"  {raw_kb} KB raw, ~{gz_kb} KB gzipped over the wire")
    print(f"  with photo: {sum(1 for r in rows if r['image_url'])}")
    print(f"Wrote facets -> {out_dir/'facets.json'} ({facets['total']} total)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
