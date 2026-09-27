"""P0-3: a listing's minimum booking term is published and enforced.

Media is sold on a minimum term. Scraped rows record the source's minimum
bill in `extra.minimum_billing`; the API turns that into a whole number of
days (`min_booking_days`, rounded up) so it can stay private (see
test_listing_privacy.py) while the rule it implies is still honoured. An
owner can set `extra.min_booking_days` directly, which takes precedence.

The cart rejects a shorter window, and checkout re-checks it because the
owner can raise the minimum after an item is already in someone's cart.
"""
from datetime import date, timedelta

from tests.test_listings import create_listing

START = date(2026, 1, 1)


def window(days):
    return START.isoformat(), (START + timedelta(days=days - 1)).isoformat()


def add_to_cart(client, headers, listing_id, days):
    start, end = window(days)
    return client.post(
        "/api/v1/cart/items",
        json={"listing_id": listing_id, "start_date": start, "end_date": end, "addons": []},
        headers=headers,
    )


def test_default_minimum_is_one_day(actors):
    listing = create_listing(actors["client"], actors["owner"], extra=None)
    assert listing["min_booking_days"] == 1


def test_minimum_is_derived_from_minimum_billing(actors):
    listing = create_listing(
        actors["client"], actors["owner"], price_per_day=33000.0, extra={"minimum_billing": 231000}
    )
    assert listing["min_booking_days"] == 7


def test_derived_minimum_rounds_up(actors):
    listing = create_listing(
        actors["client"], actors["owner"], price_per_day=10000.0, extra={"minimum_billing": 75000}
    )
    assert listing["min_booking_days"] == 8


def test_owner_set_minimum_takes_precedence(actors):
    listing = create_listing(
        actors["client"],
        actors["owner"],
        price_per_day=10000.0,
        extra={"minimum_billing": 75000, "min_booking_days": 30},
    )
    assert listing["min_booking_days"] == 30


def test_unusable_owner_minimum_is_ignored(actors):
    for bad in (0, -3, "abc", None):
        listing = create_listing(actors["client"], actors["owner"], extra={"min_booking_days": bad})
        assert listing["min_booking_days"] == 1, bad


def test_minimum_is_published_on_browse_and_detail(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"], price_per_day=33000.0, extra={"minimum_billing": 231000})

    detail = client.get(f"/api/v1/listings/{listing['id']}").json()
    assert detail["min_booking_days"] == 7
    browse = client.get("/api/v1/listings").json()["items"]
    assert [row["min_booking_days"] for row in browse] == [7]


def test_cart_rejects_window_shorter_than_minimum(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"], price_per_day=33000.0, extra={"minimum_billing": 231000})

    response = add_to_cart(client, actors["advertiser"], listing["id"], days=3)
    assert response.status_code == 422, response.text
    assert "7" in response.text
    assert "minimum" in response.text.lower()

    assert client.get("/api/v1/cart", headers=actors["advertiser"]).json()["items"] == []


def test_cart_accepts_window_at_minimum(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"], price_per_day=33000.0, extra={"minimum_billing": 231000})

    response = add_to_cart(client, actors["advertiser"], listing["id"], days=7)
    assert response.status_code == 201, response.text
    assert response.json()["days"] == 7
    assert response.json()["base_amount"] == 231000.0


def test_cart_update_rejects_shortening_below_minimum(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"], price_per_day=33000.0, extra={"minimum_billing": 231000})
    item = add_to_cart(client, actors["advertiser"], listing["id"], days=10).json()

    start, end = window(2)
    response = client.patch(
        f"/api/v1/cart/items/{item['id']}",
        json={"start_date": start, "end_date": end, "addons": []},
        headers=actors["advertiser"],
    )
    assert response.status_code == 422, response.text
    assert "minimum" in response.text.lower()


def test_checkout_rechecks_minimum_raised_after_add(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"], price_per_day=1000.0, extra=None)
    added = add_to_cart(client, actors["advertiser"], listing["id"], days=3)
    assert added.status_code == 201, added.text

    raised = client.put(
        f"/api/v1/listings/{listing['id']}",
        json={
            "title": listing["title"],
            "space_type": listing["space_type"],
            "description": listing["description"],
            "location": listing["location"],
            "price_per_day": listing["price_per_day"],
            "extra": {"min_booking_days": 7},
        },
        headers=actors["owner"],
    )
    assert raised.status_code == 200, raised.text

    response = client.post("/api/v1/checkout", json={}, headers=actors["advertiser"])
    assert response.status_code == 409, response.text
    assert "minimum" in response.text.lower()
    assert client.get("/api/v1/bookings", headers=actors["advertiser"]).json() == []


def test_one_day_listing_still_books_for_one_day(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"], price_per_day=1000.0, extra=None)
    assert add_to_cart(client, actors["advertiser"], listing["id"], days=1).status_code == 201
