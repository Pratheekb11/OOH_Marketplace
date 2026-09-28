"""The headline price on a card must be the price checkout charges.

`extra.display_price` used to be whatever the owner typed, and the marketplace
card shows it instead of `price_per_day` -- so a space billed at 4,500 a day
could advertise 450. Now the owner only picks a unit from a fixed set, and
`display_price` is computed from `price_per_day` every time a listing is
read. Rows stored before this (including anything already live) are corrected
on the way out, with no data migration.
"""
from app.models import Listing
from sqlalchemy import select

from tests.test_listings import create_listing

API = "/api/v1"


def _extra(client, listing_id):
    return client.get(f"{API}/listings/{listing_id}").json()["extra"] or {}


def test_owner_display_price_is_replaced_by_the_charged_price(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"], price_per_day=4500.0, extra={"display_unit": "/ Slot", "display_price": 450})
    extra = _extra(client, listing["id"])
    assert extra["display_price"] == 4500
    assert extra["display_unit"] == "/ Slot"


def test_longer_units_are_the_day_rate_times_the_period(actors):
    client = actors["client"]
    for unit, days in (("/ Day", 1), ("/ Week", 7), ("/ Month", 30)):
        listing = create_listing(client, actors["owner"], title=f"Unit {unit}", price_per_day=2833.33, extra={"display_unit": unit, "display_price": 1})
        assert _extra(client, listing["id"])["display_price"] == round(2833.33 * days)


def test_unit_spellings_are_normalised(actors):
    client = actors["client"]
    for given, shown in (("day", "/ Day"), ("per month", "/ Month"), ("/week", "/ Week"), (" SLOT ", "/ Slot")):
        listing = create_listing(client, actors["owner"], title=f"Spelling {given}", price_per_day=100.0, extra={"display_unit": given})
        assert _extra(client, listing["id"])["display_unit"] == shown


def test_an_unknown_unit_is_dropped(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"], extra={"display_unit": "/ Year - 90% OFF", "display_price": 1, "city": "Bengaluru"})
    extra = _extra(client, listing["id"])
    assert "display_unit" not in extra
    assert "display_price" not in extra
    assert extra["city"] == "Bengaluru"


def test_a_price_without_a_unit_is_dropped(actors):
    """No unit means the card falls back to the plain per-day price."""
    client = actors["client"]
    listing = create_listing(client, actors["owner"], extra={"display_price": 1})
    assert "display_price" not in _extra(client, listing["id"])


def test_the_owner_figure_is_never_stored(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"], extra={"display_unit": "/ Month", "display_price": 1})
    with actors["session_factory"]() as db:
        stored = db.scalar(select(Listing).where(Listing.id == listing["id"])).extra or {}
    assert "display_price" not in stored
    assert stored["display_unit"] == "/ Month"


def test_a_legacy_row_with_a_bait_price_is_corrected_on_read(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"], price_per_day=4500.0)
    with actors["session_factory"]() as db:
        row = db.scalar(select(Listing).where(Listing.id == listing["id"]))
        row.extra = {"display_unit": "/ Slot", "display_price": 1}
        db.commit()
    assert _extra(client, listing["id"])["display_price"] == 4500
    browse = client.get(f"{API}/listings", params={"q": listing["title"]}).json()["items"]
    assert next(item for item in browse if item["id"] == listing["id"])["extra"]["display_price"] == 4500


def test_changing_the_day_rate_moves_the_headline_price(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"], price_per_day=1000.0, extra={"display_unit": "/ Week"})
    payload = {k: v for k, v in listing.items() if k not in ("id", "owner_id", "status", "rejection_reason", "image_urls", "min_booking_days")}
    payload["price_per_day"] = 2000.0
    assert client.put(f"{API}/listings/{listing['id']}", json=payload, headers=actors["owner"]).status_code == 200
    assert _extra(client, listing["id"])["display_price"] == 14000
