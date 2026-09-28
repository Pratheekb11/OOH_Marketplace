"""Listings carry every site photo, at a resolution that is not a thumbnail.

The first import shipped themediaant's 300x125 preview for almost every
listing, one per listing. The source publishes the same shots at camera
resolution, sometimes several per site. The importer now copies all of them
(downscaled to a web size), drops the site's generic placeholder that many
listings share, and the API exposes them as `image_urls`.
"""
import json
import re
from pathlib import Path

from app.models import Listing, ListingStatus
from PIL import Image
from scripts.export_static import listing_json
from scripts.import_scraped import (
    MAX_PHOTO_PX,
    copy_image,
    copy_images,
    listing_fields,
    shared_image_digests,
)

from tests.test_listings import create_listing

SOURCE_ID = "5c332ada62b4651323deb8fd"
FRONTEND_PUBLIC = Path(__file__).resolve().parents[2] / "frontend" / "public"
OPAQUE_NAME = re.compile(r"^/images/listings/[0-9a-f]{20}\.[a-z0-9]+$")
LEGACY_URL = f"/images/listings/scraped-{SOURCE_ID}.jpg"


def write_photo(path: Path, size=(3200, 2400), fmt="JPEG", color=(90, 120, 60)) -> Path:
    Image.new("RGB", size, color).save(path, fmt)
    return path


def image(path: Path, sha: str) -> dict:
    return {"local_path": str(path), "sha256": sha}


def pixels(public_dir: Path, url: str) -> tuple[int, int]:
    with Image.open(public_dir / Path(url).name) as im:
        return im.size


# --- which photos count ---------------------------------------------------------------

def test_photo_reused_across_many_listings_is_a_placeholder():
    """themediaant attaches one "Images shown are for reference only" shot to
    11 unrelated listings. A photo that three or more listings share is not a
    picture of any of them."""
    records = [
        {"source_id": str(n), "images": [{"sha256": "placeholder"}, {"sha256": f"own-{n}"}]}
        for n in range(3)
    ]
    records.append({"source_id": "x", "images": [{"sha256": "twin"}]})
    records.append({"source_id": "y", "images": [{"sha256": "twin"}]})

    assert shared_image_digests(records) == {"placeholder"}


def test_copy_images_keeps_every_photo_in_order(tmp_path):
    a = write_photo(tmp_path / "a.jpg", color=(10, 10, 10))
    b = write_photo(tmp_path / "b.jpg", color=(200, 10, 10))
    record = {"source_id": SOURCE_ID, "images": [image(a, "a"), image(b, "b")]}
    public_dir = tmp_path / "public"

    urls = copy_images(record, public_dir)

    assert len(urls) == 2 and len(set(urls)) == 2
    for url in urls:
        assert OPAQUE_NAME.match(url), url
        assert SOURCE_ID not in url
    # The first photo keeps the name the single-photo importer gave it, so
    # rows already in a hosted database keep resolving.
    assert urls[0] == copy_image(record, tmp_path / "other")
    with Image.open(public_dir / Path(urls[1]).name) as im:
        assert im.getpixel((0, 0))[0] > 150  # b, not a copy of a


def test_shared_placeholder_is_dropped(tmp_path):
    a = write_photo(tmp_path / "a.jpg")
    p = write_photo(tmp_path / "p.jpg", color=(1, 2, 3))
    record = {"source_id": SOURCE_ID, "images": [image(p, "placeholder"), image(a, "a")]}

    urls = copy_images(record, tmp_path / "public", skip_digests={"placeholder"})

    assert len(urls) == 1


def test_large_photo_is_downscaled_for_the_web(tmp_path):
    source = write_photo(tmp_path / "big.jpg", size=(3200, 2400))
    public_dir = tmp_path / "public"

    [url] = copy_images({"source_id": SOURCE_ID, "images": [image(source, "a")]}, public_dir)

    width, height = pixels(public_dir, url)
    assert max(width, height) == MAX_PHOTO_PX
    assert abs(width / height - 4 / 3) < 0.01


def test_small_photo_is_not_upscaled(tmp_path):
    source = write_photo(tmp_path / "small.jpg", size=(850, 591))
    public_dir = tmp_path / "public"

    [url] = copy_images({"source_id": SOURCE_ID, "images": [image(source, "a")]}, public_dir)

    assert pixels(public_dir, url) == (850, 591)


def test_png_and_bmp_photos_ship_as_jpeg(tmp_path):
    png = write_photo(tmp_path / "a.png", size=(1600, 900), fmt="PNG")
    bmp = write_photo(tmp_path / "b.bmp", size=(640, 480), fmt="BMP", color=(9, 9, 9))
    public_dir = tmp_path / "public"

    urls = copy_images({"source_id": SOURCE_ID, "images": [image(png, "a"), image(bmp, "b")]}, public_dir)

    assert [Path(u).suffix for u in urls] == [".jpg", ".jpg"]
    for url in urls:
        with Image.open(public_dir / Path(url).name) as im:
            assert im.format == "JPEG"


def test_listing_fields_carry_the_gallery():
    record = {
        "title": "Hoarding - Yelahanka", "location": "Yelahanka", "price_per_day": 1000,
        "source_id": SOURCE_ID,
    }
    fields = listing_fields(record, owner_id=1, image_urls=["/images/listings/a.jpg", "/images/listings/b.jpg"])
    assert fields["image_url"] == "/images/listings/a.jpg"
    assert fields["image_urls"] == ["/images/listings/a.jpg", "/images/listings/b.jpg"]

    bare = listing_fields(record, owner_id=1, image_urls=[])
    assert bare["image_url"] is None
    assert bare["image_urls"] == []


# --- what the API returns ---------------------------------------------------------------

def test_detail_returns_every_photo(client):
    client_, session_factory = client
    with session_factory() as db:
        listing = Listing(
            owner_id=1, title="Skywalk", space_type="Skywalk", description="", location="Bengaluru",
            price_per_day=1000.0, status=ListingStatus.active,
            image_url="/images/listings/a.jpg",
            image_urls=["/images/listings/a.jpg", "/images/listings/b.jpg"],
        )
        db.add(listing)
        db.commit()
        listing_id = listing.id

    body = client_.get(f"/api/v1/listings/{listing_id}").json()
    assert body["image_urls"] == ["/images/listings/a.jpg", "/images/listings/b.jpg"]
    assert body["image_url"] == "/images/listings/a.jpg"


def test_listing_with_only_a_cover_photo_reports_it_as_its_gallery(actors):
    """Owner-submitted rows, and hosted rows imported before the gallery
    existed, have `image_url` and nothing else."""
    listing = create_listing(actors["client"], actors["owner"], image_url="/images/listings/cover.jpg")
    assert listing["image_urls"] == ["/images/listings/cover.jpg"]

    bare = create_listing(actors["client"], actors["owner"], title="No Photo Listing", image_url=None)
    assert bare["image_urls"] == []


def test_gallery_urls_are_opaque_too(client):
    _, session_factory = client
    with session_factory() as db:
        listing = Listing(
            owner_id=1, title="Skywalk", space_type="Skywalk", description="", location="Bengaluru",
            price_per_day=1000.0, status=ListingStatus.active, image_url=LEGACY_URL, image_urls=[LEGACY_URL],
        )
        db.add(listing)
        db.commit()
        db.refresh(listing)
        body = listing_json(listing)
    assert "scraped-" not in json.dumps(body)
    assert body["image_urls"] == [body["image_url"]]


# --- what actually ships -----------------------------------------------------------------

def _snapshot():
    return json.loads((FRONTEND_PUBLIC / "data" / "listings.json").read_text())


def test_every_snapshot_gallery_photo_exists_on_disk():
    missing = [
        url for row in _snapshot() for url in row.get("image_urls") or []
        if not (FRONTEND_PUBLIC / url.lstrip("/")).exists()
    ]
    assert missing == []


def test_shipped_listing_photos_are_not_thumbnails():
    """Before: 2097 of 2105 shipped covers were the source's 300x125 preview.
    The source publishes nothing sharper for a few percent of sites (84 of
    2103 have no photo over 500px; 14 only a 300x125 card), so the bound is
    on those rates rather than zero."""
    covers = [row["image_url"] for row in _snapshot() if row.get("image_url")]
    assert covers
    previews = small = 0
    for url in covers:
        with Image.open(FRONTEND_PUBLIC / url.lstrip("/")) as im:
            previews += im.size == (300, 125)
            small += max(im.size) < 500
    assert previews / len(covers) < 0.01, f"{previews}/{len(covers)} covers are 300x125 previews"
    assert small / len(covers) < 0.05, f"{small}/{len(covers)} covers are under 500px"


def test_shipped_photos_are_web_sized():
    too_big = []
    for row in _snapshot():
        for url in row.get("image_urls") or []:
            path = FRONTEND_PUBLIC / url.lstrip("/")
            with Image.open(path) as im:
                if max(im.size) > MAX_PHOTO_PX:
                    too_big.append(url)
    assert too_big == []


def test_some_listings_ship_more_than_one_photo():
    assert any(len(row.get("image_urls") or []) > 1 for row in _snapshot())



def test_sharpest_photo_is_the_cover_and_thumbnails_are_dropped(tmp_path):
    """The source sometimes lists a 300x125 card before the real photo. The
    cover is what the marketplace card shows, so it must be the sharpest; a
    thumbnail beside a real photo adds nothing to the gallery."""
    thumb = write_photo(tmp_path / "thumb.png", size=(300, 125), fmt="PNG", color=(5, 5, 5))
    real = write_photo(tmp_path / "real.jpg", size=(1280, 960), color=(220, 30, 30))
    record = {"source_id": SOURCE_ID, "images": [image(thumb, "t"), image(real, "r")]}
    public_dir = tmp_path / "public"

    urls = copy_images(record, public_dir)

    assert len(urls) == 1
    assert pixels(public_dir, urls[0]) == (1280, 960)


def test_thumbnail_is_kept_when_it_is_all_there_is(tmp_path):
    thumb = write_photo(tmp_path / "thumb.jpg", size=(300, 125))
    [url] = copy_images({"source_id": SOURCE_ID, "images": [image(thumb, "t")]}, tmp_path / "public")
    assert url
