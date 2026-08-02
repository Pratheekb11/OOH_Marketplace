"""Scraper tests.

These exercise parsing, record mapping and DB import against fixtures shaped
like real themediaant payloads. Nothing here touches the network.
"""
import json

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import Listing, ListingStatus, ScrapedListing
from scraper.adapters.themediaant import TheMediaAntAdapter, _parse_reach
from scraper.images import looks_like_hoarding_photo
from scraper.importer import import_records
from scraper.models import ScrapedHoarding
from scraper.parse import parse_dimensions, parse_footfall, parse_price
from scraper.writers import read_jsonl, write_csv, write_jsonl


# ---------------------------------------------------------------- parse.py

@pytest.mark.parametrize(
    "text,width,height",
    [
        ("Size: 40ft x 20ft", 40, 20),
        ("20 X 10", 20, 10),
        ("30' x 15'", 30, 15),
        ("Hoarding 12.5 ft by 8 ft", 12.5, 8),
        ("Width: 40 ft, Height: 20 ft", 40, 20),
    ],
)
def test_parse_dimensions_reads_common_formats(text, width, height):
    assert parse_dimensions(text)[:2] == (width, height)


def test_parse_dimensions_converts_metres_to_feet():
    width, height, _, _ = parse_dimensions("6 m x 3 m")
    assert (round(width), round(height)) == (20, 10)


def test_parse_dimensions_warns_when_unit_is_absent():
    assert any("assumed feet" in w for w in parse_dimensions("20 x 10")[3])


def test_parse_dimensions_rejects_implausible_sizes():
    # A phone number must never be read as a hoarding size.
    assert parse_dimensions("call 9876543210 x 2")[:2] == (None, None)


def test_parse_price_normalises_monthly_to_daily():
    per_day, _, period, _ = parse_price("Rs. 60,000 per month")
    assert (per_day, period) == (2000.0, "month")


def test_parse_price_expands_indian_scales():
    assert parse_price("₹1.2 lakh per month")[0] == pytest.approx(4000.0)


def test_parse_price_warns_when_period_is_assumed():
    assert any("assumed per month" in w for w in parse_price("₹30,000")[3])


def test_parse_footfall_expands_scale_words():
    assert parse_footfall("Daily footfall 1.5 lakh") == 150_000


def test_parse_reach_handles_site_format():
    assert _parse_reach("88.3K Unique Reach") == 88_300


def test_logos_and_icons_are_not_treated_as_photos():
    assert looks_like_hoarding_photo("https://x.com/medias/a/b/site.jpg")
    assert not looks_like_hoarding_photo("https://x.com/uploads/mediaLogos/1/2.jpg")
    assert not looks_like_hoarding_photo("https://x.com/facebook-icon.png")


# ------------------------------------------------------- adapter mapping

INDEX_ROW = {
    "_id": "abc123",
    "name": "Hoarding - Yelahanka Bengaluru, 37051",
    "urlSlug": "hoarding-yelahanka-bengaluru-37051",
    "dimensions": ["50W X 6H"],
    "minimumBilling": 198331,
    "locality": "Yelahanka, Bengaluru",
    "pageViews": 91,
    "serviceTaxPercentage": 18,
    "logo": "https://tma-live.s3.ap-south-1.amazonaws.com/medias/5d28/1562/site.jpg",
    "location": {"type": "Point", "coordinates": [77.5946, 13.0827]},
    "attributes": {
        "mediaType": {"value": "Hoarding"},
        "litType": {"value": "NON LIT"},
        "landmark": {"value": "Near RMZ Galleria Mall"},
        "uniqueId": {"value": 37051},
        "reach": {"value": "87K Unique Reach"},
        "totalImpressions": {"value": "10813500"},
    },
    "geos": [
        {
            "formatted_address": "Yelahanka, Bengaluru, Karnataka 560064, India",
            "address_components": [
                {"long_name": "Bengaluru", "types": ["locality", "political"]},
                {"long_name": "Karnataka", "types": ["administrative_area_level_1"]},
                {"long_name": "560064", "types": ["postal_code"]},
            ],
            "geometry": {"location": {"lat": 13.0827, "lng": 77.5946}},
        }
    ],
}

DETAIL = {
    "city": "Bengaluru",
    "about": "Hoarding advertising in Yelahanka.",
    # Detail pages encode attributes as a list keyed by display name.
    "attributes": [
        {"showName": "Media Type", "value": "Hoarding"},
        {"showName": "Lighting", "value": "NON LIT"},
        {"showName": "Unique Reach (Per day)", "value": "87000"},
    ],
    # ...and reuse the `location` key for a display string, not GeoJSON.
    "location": "Yelahanka, Bengaluru",
    "mediaOptions": [
        {
            "name": "Hoarding",
            "unit": "Per Day",
            "rates": {"defaultRates": {"cardRate": 31167, "discountedRate": 28333,
                                       "minimumBilling": 198331}},
            "creativeSpecs": [
                {"fields": [{"key": "Width", "value": 50}, {"key": "Height", "value": 6},
                            {"key": "Unit", "value": "ft"}]}
            ],
        }
    ],
}


def _adapter():
    return TheMediaAntAdapter(fetcher=None, location="Bangalore", location_id="x")


def test_record_maps_index_and_detail_onto_listing_fields():
    record = _adapter()._record(INDEX_ROW, DETAIL)

    assert record.title == "Hoarding - Yelahanka Bengaluru, 37051"
    assert record.space_type == "hoarding"
    assert (record.width_ft, record.height_ft) == (50.0, 6.0)
    assert record.area_sqft == 300.0
    # discountedRate is the per-day rate, not minimumBilling.
    assert record.price_per_day == 28333
    assert record.price_period == "day"
    assert record.footfall_estimate == 87_000
    assert record.illumination == "non_lit"
    assert (record.city, record.state, record.pincode) == ("Bengaluru", "Karnataka", "560064")
    assert (record.latitude, record.longitude) == (13.0827, 77.5946)
    assert record.is_importable()


def test_record_survives_the_detail_payload_reshaping_shared_keys():
    """Detail sends `attributes` as a list and `location` as a string.

    Merging naively over the index row turns both into the wrong type, which is
    what broke the first run against the live site.
    """
    record = _adapter()._record(INDEX_ROW, DETAIL)
    assert record.latitude == 13.0827  # GeoJSON preserved from the index row
    assert record.illumination == "non_lit"  # list-encoded attribute still read


def test_record_falls_back_to_the_dimension_string_without_detail():
    record = _adapter()._record(INDEX_ROW, None)
    assert (record.width_ft, record.height_ft) == (50.0, 6.0)
    # No rate card is available without the detail page.
    assert record.price_per_day is None
    assert any("no per-day rate" in w for w in record.warnings)


def test_preview_sized_photo_is_still_collected():
    """`uploads/mediaLogos/` holds the site's own 300x125 preview, not a brand
    mark: the URLs are per-listing (1691 distinct across 1703 records). Treating
    them as chrome left ~1700 listings with no picture at all."""
    row = {**INDEX_ROW, "logo": "https://tma-live.s3.ap-south-1.amazonaws.com/uploads/mediaLogos/1/2.jpg"}
    record = _adapter()._record(row, DETAIL)
    assert len(record.images) == 1
    assert record.extra["photo_source"] == "preview"


def test_site_photograph_is_collected_and_served_from_the_cdn():
    record = _adapter()._record(INDEX_ROW, DETAIL)
    assert [image.url for image in record.images] == [
        "https://the-media-ant.mo.cloudinary.net/medias/5d28/1562/site.jpg"
    ]
    assert record.extra["photo_source"] == "full"


def test_photo_urls_are_trusted_past_the_logo_heuristic():
    """The site names full-size photos `<name>_logo.jpg`. The generic junk
    filter rejects any URL containing "logo", which silently discarded them."""
    from scraper.images import looks_like_hoarding_photo

    url = "https://tma-live.s3.ap-south-1.amazonaws.com/medias/a/b/Gantry 1_logo.jpg"
    assert not looks_like_hoarding_photo(url)  # heuristic alone would drop it
    record = _adapter()._record({**INDEX_ROW, "logo": url}, DETAIL)
    assert record.images[0].trusted is True


def test_missing_photo_is_reported():
    record = _adapter()._record({**INDEX_ROW, "logo": ""}, DETAIL)
    assert record.images == []
    assert any("no photograph" in w for w in record.warnings)


def test_pixel_resolution_is_not_recorded_as_a_physical_size():
    """Digital screens publish a pixel resolution in the size field.

    Reading 832x384 px as feet would invent a 320,000 sq ft hoarding and price
    it as one, so the record must carry no dimensions at all.
    """
    detail = json.loads(json.dumps(DETAIL))
    detail["mediaOptions"][0]["creativeSpecs"] = [
        {"fields": [{"key": "Width", "value": 832}, {"key": "Height", "value": 384},
                    {"key": "Unit", "value": "px"}]}
    ]
    record = _adapter()._record({**INDEX_ROW, "dimensions": []}, detail)

    assert (record.width_ft, record.height_ft) == (None, None)
    assert record.extra["resolution_px"] == "832x384"
    assert any("not a physical measurement" in w for w in record.warnings)
    assert not record.is_importable()


def test_pixel_resolution_does_not_leak_through_the_dimension_fallback():
    """The `dimensions` string repeats the resolution for digital screens.

    Falling back to it after rejecting the px spec is how a 1440x1440 screen
    was recorded as a 2,073,600 sq ft board.
    """
    detail = json.loads(json.dumps(DETAIL))
    detail["mediaOptions"][0]["creativeSpecs"] = [
        {"fields": [{"key": "Width", "value": 1440}, {"key": "Height", "value": 1440},
                    {"key": "Unit", "value": "px"}]}
    ]
    record = _adapter()._record({**INDEX_ROW, "dimensions": ["1440W X 1440H"]}, detail)
    assert (record.width_ft, record.height_ft) == (None, None)
    assert record.area_sqft is None


def test_implausible_dimensions_are_discarded():
    record = _adapter()._record({**INDEX_ROW, "dimensions": ["5000W X 4000H"]}, None)
    assert (record.width_ft, record.height_ft) == (None, None)
    assert any("implausible" in w for w in record.warnings)


def test_metre_specs_are_converted_to_feet():
    detail = json.loads(json.dumps(DETAIL))
    detail["mediaOptions"][0]["creativeSpecs"] = [
        {"fields": [{"key": "Width", "value": 6}, {"key": "Height", "value": 3},
                    {"key": "Unit", "value": "m"}]}
    ]
    record = _adapter()._record(INDEX_ROW, detail)
    assert (round(record.width_ft), round(record.height_ft)) == (20, 10)


def test_record_is_tagged_with_the_filter_it_was_collected_under():
    """Coverage is counted per collection filter, not per self-reported type.

    themediaant returns digital bus shelters tagged `mediaType: Bus Shelter`,
    so grouping by the label makes a complete run look like it missed 21.
    """
    record = _adapter()._record(INDEX_ROW, DETAIL, "Digital Bus Shelter")
    assert record.extra["source_media_type"] == "Digital Bus Shelter"
    assert record.extra["media_type"] == "Hoarding"


def test_missing_size_and_rate_make_a_record_unimportable():
    row = {**INDEX_ROW, "dimensions": []}
    record = _adapter()._record(row, None)
    assert not record.is_importable()
    assert set(record.missing_for_import()) == {"width_ft", "height_ft", "price_per_day"}


# ------------------------------------------------------------- writers

def test_jsonl_round_trips(tmp_path):
    record = _adapter()._record(INDEX_ROW, DETAIL)
    path = write_jsonl([record], tmp_path / "out.jsonl")
    assert read_jsonl(path)[0].source_url == record.source_url


def test_csv_flattens_nested_fields(tmp_path):
    record = _adapter()._record(INDEX_ROW, DETAIL)
    text = write_csv([record], tmp_path / "out.csv").read_text()
    assert "area_sqft" in text and "300.0" in text


# ------------------------------------------------------------- importer

@pytest.fixture
def db(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)  # store_file writes under ./uploads
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False},
                           poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine)() as session:
        yield session


def _record():
    return _adapter()._record(INDEX_ROW, DETAIL)


def test_import_creates_a_pending_listing_with_provenance(db):
    summary = import_records(db, [_record()])
    assert summary["created"] == 1

    listing = db.query(Listing).one()
    # Scraped inventory must go through the same review as owner submissions.
    assert listing.status == ListingStatus.pending
    assert (listing.width_ft, listing.height_ft) == (50.0, 6.0)
    assert listing.price_per_day == 28333

    provenance = db.query(ScrapedListing).one()
    assert provenance.listing_id == listing.id
    assert provenance.source_site == "themediaant.com"


def test_reimporting_updates_rather_than_duplicates(db):
    import_records(db, [_record()])

    cheaper = _record()
    cheaper.price_per_day = 19999
    summary = import_records(db, [cheaper])

    assert summary == {"created": 0, "updated": 1, "skipped_incomplete": 0}
    assert db.query(Listing).count() == 1
    assert db.query(Listing).one().price_per_day == 19999


def test_incomplete_records_are_skipped_by_default(db):
    record = _adapter()._record({**INDEX_ROW, "dimensions": []}, None)
    summary = import_records(db, [record])
    assert summary["skipped_incomplete"] == 1
    assert db.query(Listing).count() == 0


def test_scraped_owner_account_cannot_be_logged_into(db):
    from app.models import User
    import_records(db, [_record()])
    owner = db.query(User).one()
    # A bcrypt verify against this can never succeed.
    assert owner.password_hash == "!"
