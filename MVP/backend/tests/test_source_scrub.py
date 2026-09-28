"""Imported inventory must not carry the source site's fingerprints.

Provenance (`source_url`, `source_id`) is kept privately in `Listing.extra` so
re-imports update in place and a takedown can be traced; it never leaves the
API (see test_listing_privacy). What ships publicly -- titles, descriptions,
photo files and the static snapshot -- must not name the source, embed its
listing numbers, reuse its marketing copy or carry its file metadata.
"""
import json
import re
from pathlib import Path

from PIL import Image
from scripts.import_scraped import copy_images, listing_fields

FRONTEND_PUBLIC = Path(__file__).resolve().parents[2] / "frontend" / "public"
SOURCE_MARKERS = re.compile(r"media[\s_-]?ant|tma-live|cloudinary|mediaLogos|referenceArtworks", re.I)
SOURCE_NUMBER_SUFFIX = re.compile(r",\s*\d{3,}\s*$")
BOILERPLATE = "displays promotional campaigns to potential customers"

RECORD = {
    "title": "Bus Shelter - Juhu Mumbai, 17280",
    "location": "S. Parulekar Marg, Juhu, Mumbai",
    "price_per_day": 4000.0,
    "space_type": "bus_shelter",
    "illumination": "back_lit",
    "footfall_estimate": 88300,
    "description": (
        "<p>Bus Shelter Advertising in Juhu displays promotional campaigns to potential customers "
        "and helps improve visibility and brand recall.</p>"
    ),
    "source_id": "5c332ada62b4651323deb8fd",
    "source_url": "https://www.themediaant.com/outdoor/bus-shelter-juhu-mumbai-17280",
    "source_site": "themediaant",
    "extra": {
        "source_media_type": "Bus Shelter",
        "landmark": "S. Parulekar Marg,Juhu Bus Station,Juhu",
        "locality": "Juhu",
        "unique_id": 17280,
        "size_bucket": "Small",
    },
}


# --- title and description ------------------------------------------------------------

def test_title_drops_the_source_listing_number():
    title = listing_fields(RECORD, owner_id=1)["title"]
    assert "17280" not in title
    assert title.startswith("Bus Shelter")
    assert "Juhu" in title


def test_title_without_landmark_still_drops_the_number():
    record = {**RECORD, "extra": {**RECORD["extra"], "landmark": ""}}
    title = listing_fields(record, owner_id=1)["title"]
    assert not SOURCE_NUMBER_SUFFIX.search(title)
    assert "Juhu" in title


def test_description_is_written_from_facts_not_copied():
    description = listing_fields(RECORD, owner_id=1)["description"]
    assert BOILERPLATE not in description
    assert "brand recall" not in description
    assert "Bus Shelter" in description or "bus shelter" in description
    assert "Juhu" in description
    assert "88,300" in description
    assert "back lit" in description.lower()


def test_description_degrades_when_facts_are_missing():
    record = {
        "title": "Skywalk - Ashok Nagar Bengaluru, 30102", "location": "Ashok Nagar, Bengaluru",
        "price_per_day": 30000.0, "description": "<p>Skywalk Advertising in Ashok Nagar.</p>",
        "source_id": "abc",
    }
    description = listing_fields(record, owner_id=1)["description"]
    assert "Skywalk Advertising in" not in description
    assert "None" not in description and "null" not in description
    assert "Ashok Nagar" in description


# --- photo files -------------------------------------------------------------------------

def _tagged_photo(path: Path, size) -> Path:
    exif = Image.Exif()
    exif[0x013B] = "The Media Ant"          # Artist
    exif[0x8298] = "(c) themediaant.com"    # Copyright
    exif[0x010E] = "tma-live upload"        # ImageDescription
    Image.new("RGB", size, (80, 90, 100)).save(path, "JPEG", exif=exif, comment=b"themediaant")
    return path


def _assert_clean(path: Path):
    raw = path.read_bytes()
    assert not SOURCE_MARKERS.search(raw.decode("latin-1")), path
    with Image.open(path) as im:
        assert not im.getexif(), path
        assert "comment" not in im.info and "exif" not in im.info and "xmp" not in im.info, path


def test_web_sized_photo_is_stripped_of_metadata(tmp_path):
    """A photo already small enough is not resized, but still must not ship
    with the source's EXIF or comment segments."""
    source = _tagged_photo(tmp_path / "small.jpg", (850, 591))
    public_dir = tmp_path / "public"
    [url] = copy_images({"source_id": "a", "images": [{"local_path": str(source), "sha256": "x"}]}, public_dir)
    _assert_clean(public_dir / Path(url).name)


def test_resized_photo_is_stripped_of_metadata(tmp_path):
    source = _tagged_photo(tmp_path / "big.jpg", (3200, 2400))
    public_dir = tmp_path / "public"
    [url] = copy_images({"source_id": "a", "images": [{"local_path": str(source), "sha256": "x"}]}, public_dir)
    _assert_clean(public_dir / Path(url).name)


# --- what actually ships -------------------------------------------------------------------

def _snapshot():
    return json.loads((FRONTEND_PUBLIC / "data" / "listings.json").read_text())


def test_snapshot_never_names_the_source():
    text = (FRONTEND_PUBLIC / "data" / "listings.json").read_text()
    assert not SOURCE_MARKERS.search(text)


def test_snapshot_titles_carry_no_source_listing_number():
    assert [r["title"] for r in _snapshot() if SOURCE_NUMBER_SUFFIX.search(r["title"])] == []


def test_snapshot_descriptions_are_not_the_source_copy():
    assert [r["id"] for r in _snapshot() if BOILERPLATE in r["description"]] == []


def test_shipped_listing_photos_carry_no_metadata():
    dirty = []
    # Imported photos only (opaque hash names). The hand-named seed images are
    # the prototype's AI-generated shots, whose "Made with Google AI" /
    # trainedAlgorithmicMedia labels are a disclosure that must stay.
    imported = re.compile(r"^[0-9a-f]{20}\.[a-z0-9]+$")
    for path in (FRONTEND_PUBLIC / "images" / "listings").iterdir():
        if not imported.match(path.name):
            continue
        with Image.open(path) as im:
            if im.getexif() or {"comment", "exif", "xmp"} & set(im.info):
                dirty.append(path.name)
    assert dirty == []
