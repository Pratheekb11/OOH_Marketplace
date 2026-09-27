"""P0-1 follow-up: listing image URLs must not reveal the scraped source id.

Imported photos were saved as `/images/listings/scraped-<source_id>.<ext>`,
which puts the source site's own listing id (and the word "scraped") in every
image URL. Files are renamed to an opaque, deterministic name derived from the
source id, and the API rewrites legacy URLs still stored in the database to
that same name -- so the hosted database needs no migration.
"""
import json
import re
from datetime import date
from pathlib import Path

from app.images import public_image_url
from app.models import Listing, ListingStatus
from scripts.export_static import listing_json
from scripts.import_scraped import copy_image
from scripts.rename_scraped_images import rename_scraped_images
from tests.test_listings import create_listing

SOURCE_ID = "5c332ada62b4651323deb8fd"
LEGACY_URL = f"/images/listings/scraped-{SOURCE_ID}.jpg"
FRONTEND_PUBLIC = Path(__file__).resolve().parents[2] / "frontend" / "public"
OPAQUE_NAME = re.compile(r"^/images/listings/[0-9a-f]{20}\.[a-z0-9]+$")


def assert_opaque(url):
    assert url is not None
    assert "scraped" not in url
    assert SOURCE_ID not in url
    assert OPAQUE_NAME.match(url), url


# --- the naming rule -------------------------------------------------------------

def test_legacy_url_maps_to_opaque_name():
    assert_opaque(public_image_url(LEGACY_URL))


def test_mapping_is_deterministic_and_keeps_extension():
    first = public_image_url(LEGACY_URL)
    assert first == public_image_url(LEGACY_URL)
    assert first.endswith(".jpg")
    assert public_image_url(f"/images/listings/scraped-{SOURCE_ID}.png").endswith(".png")


def test_different_sources_get_different_names():
    assert public_image_url("/images/listings/scraped-aaa.jpg") != public_image_url("/images/listings/scraped-bbb.jpg")


def test_other_urls_are_untouched():
    for url in (None, "", "/images/listings/indiranagar-100ft-rd-junction.png", "https://cdn.example.com/a.jpg"):
        assert public_image_url(url) == url


def test_already_opaque_url_is_untouched():
    opaque = public_image_url(LEGACY_URL)
    assert public_image_url(opaque) == opaque


# --- every route that returns an image url -----------------------------------------

def test_browse_and_detail_rewrite_legacy_image_url(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"], image_url=LEGACY_URL)
    assert_opaque(listing["image_url"])

    detail = client.get(f"/api/v1/listings/{listing['id']}")
    assert_opaque(detail.json()["image_url"])
    assert "scraped-" not in client.get("/api/v1/listings").text


def test_cart_rewrites_listing_image_url(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"], image_url=LEGACY_URL)
    day = date(2026, 1, 1).isoformat()
    added = client.post(
        "/api/v1/cart/items",
        json={"listing_id": listing["id"], "start_date": day, "end_date": day, "addons": []},
        headers=actors["advertiser"],
    )
    assert added.status_code == 201, added.text
    assert_opaque(added.json()["listing_image_url"])
    assert_opaque(client.get("/api/v1/cart", headers=actors["advertiser"]).json()["items"][0]["listing_image_url"])


def test_owner_bookings_rewrite_listing_image_url(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"], image_url=LEGACY_URL)
    day = date(2026, 1, 1).isoformat()
    client.post(
        "/api/v1/cart/items",
        json={"listing_id": listing["id"], "start_date": day, "end_date": day, "addons": []},
        headers=actors["advertiser"],
    )
    assert client.post("/api/v1/checkout", json={}, headers=actors["advertiser"]).status_code == 201

    rows = client.get("/api/v1/owner/bookings", headers=actors["owner"]).json()
    assert len(rows) == 1
    assert_opaque(rows[0]["listing_image_url"])


def test_static_snapshot_rewrites_image_url(client):
    _, session_factory = client
    with session_factory() as db:
        listing = Listing(
            owner_id=1, title="Skywalk", space_type="Skywalk", description="", location="Bengaluru",
            price_per_day=1000.0, status=ListingStatus.active, image_url=LEGACY_URL,
        )
        db.add(listing)
        db.commit()
        db.refresh(listing)
        assert_opaque(listing_json(listing)["image_url"])


# --- importer and one-off rename -----------------------------------------------------

def test_importer_writes_opaque_file_name(tmp_path):
    source = tmp_path / "photo.jpg"
    source.write_bytes(b"jpeg")
    public_dir = tmp_path / "public"
    record = {"source_id": SOURCE_ID, "images": [{"local_path": str(source)}]}

    url = copy_image(record, public_dir)

    assert_opaque(url)
    assert (public_dir / Path(url).name).read_bytes() == b"jpeg"
    assert not list(public_dir.glob("scraped-*"))


def test_rename_script_matches_api_names_and_is_idempotent(tmp_path):
    (tmp_path / f"scraped-{SOURCE_ID}.jpg").write_bytes(b"a")
    (tmp_path / "scraped-other.png").write_bytes(b"b")
    (tmp_path / "indiranagar-100ft-rd-junction.png").write_bytes(b"c")

    assert rename_scraped_images(tmp_path) == 2
    names = sorted(p.name for p in tmp_path.iterdir())
    assert Path(public_image_url(LEGACY_URL)).name in names
    assert Path(public_image_url("/images/listings/scraped-other.png")).name in names
    assert "indiranagar-100ft-rd-junction.png" in names
    assert not [n for n in names if n.startswith("scraped-")]

    assert rename_scraped_images(tmp_path) == 0


# --- what actually ships ------------------------------------------------------------

def test_no_shipped_image_file_is_named_after_its_source():
    shipped = [p.name for p in (FRONTEND_PUBLIC / "images" / "listings").iterdir()]
    assert shipped, "expected listing images in the frontend public dir"
    assert [n for n in shipped if n.startswith("scraped-")] == []


def test_static_snapshot_file_has_no_scraped_image_urls():
    rows = json.loads((FRONTEND_PUBLIC / "data" / "listings.json").read_text())
    assert [r["id"] for r in rows if r["image_url"] and "scraped-" in r["image_url"]] == []


def test_every_snapshot_image_exists_on_disk():
    rows = json.loads((FRONTEND_PUBLIC / "data" / "listings.json").read_text())
    missing = [r["image_url"] for r in rows if r["image_url"] and not (FRONTEND_PUBLIC / r["image_url"].lstrip("/")).exists()]
    assert missing == []
