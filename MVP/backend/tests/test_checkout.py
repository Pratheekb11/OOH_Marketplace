"""Tests for /api/v1/checkout and /api/v1/payments/{id}.

Uses the `client` and `actors` fixtures and the `register` helper from
tests/conftest.py, plus the listing helpers from tests/test_listings.py --
no new fixtures are introduced here.
"""
from datetime import date, timedelta

from tests.test_listings import create_listing

TODAY = date(2026, 1, 1)


def dates(offset_start=0, offset_end=2):
    start = TODAY + timedelta(days=offset_start)
    end = TODAY + timedelta(days=offset_end)
    return start.isoformat(), end.isoformat()


def add_to_cart(client, headers, listing_id, offset_start=0, offset_end=2, addons=None):
    start, end = dates(offset_start, offset_end)
    response = client.post("/api/v1/cart/items", json={
        "listing_id": listing_id, "start_date": start, "end_date": end, "addons": addons or [],
    }, headers=headers)
    assert response.status_code in (200, 201), response.text
    return response.json()


def test_checkout_happy_path_two_items(actors):
    client = actors["client"]
    listing_a = create_listing(client, actors["owner"], title="Listing A", price_per_day=1000.0)
    listing_b = create_listing(client, actors["owner"], title="Listing B", price_per_day=2000.0)
    add_to_cart(client, actors["advertiser"], listing_a["id"], 0, 2)
    add_to_cart(client, actors["advertiser"], listing_b["id"], 5, 6, addons=["monitoring"])

    cart = client.get("/api/v1/cart", headers=actors["advertiser"]).json()
    grand_total = cart["grand_total"]

    response = client.post("/api/v1/checkout", json={"method_label": "Card •••• 4242"}, headers=actors["advertiser"])
    assert response.status_code == 201, response.text
    body = response.json()
    assert len(body["bookings"]) == 2
    assert body["amount_paid"] == grand_total
    assert body["provider_order_id"].startswith("poc_")
    assert body["paid_at"]

    empty_cart = client.get("/api/v1/cart", headers=actors["advertiser"])
    assert empty_cart.json()["items"] == []

    bookings = client.get("/api/v1/bookings", headers=actors["advertiser"])
    assert bookings.status_code == 200
    assert len(bookings.json()) == 2
    assert all(b["status"] == "booked" for b in bookings.json())

    payment = client.get(f"/api/v1/payments/{body['payment_id']}", headers=actors["advertiser"])
    assert payment.status_code == 200
    assert payment.json()["amount"] == grand_total
    assert len(payment.json()["bookings"]) == 2


def test_checkout_empty_cart_is_409(actors):
    client = actors["client"]
    response = client.post("/api/v1/checkout", json={}, headers=actors["advertiser"])
    assert response.status_code == 409


def test_checkout_mid_list_overlap_rolls_back_completely(actors):
    client = actors["client"]
    listing_a = create_listing(client, actors["owner"], title="Listing A")
    listing_b = create_listing(client, actors["owner"], title="Listing B")
    listing_c = create_listing(client, actors["owner"], title="Listing C")

    # second_advertiser builds a 3-item cart while all three listings are still free -- the
    # cart-time advisory check has nothing to object to yet.
    add_to_cart(client, actors["second_advertiser"], listing_a["id"], 0, 2)
    add_to_cart(client, actors["second_advertiser"], listing_b["id"], 5, 6)
    add_to_cart(client, actors["second_advertiser"], listing_c["id"], 10, 12)

    # Meanwhile a different advertiser grabs listing_b for the same window and checks out.
    # This is the race the *authoritative* checkout-time guard exists to catch: the cart-time
    # advisory check only looked at bookings that existed back when the item was added.
    add_to_cart(client, actors["advertiser"], listing_b["id"], 5, 6)
    first_checkout = client.post("/api/v1/checkout", json={}, headers=actors["advertiser"])
    assert first_checkout.status_code == 201, first_checkout.text

    response = client.post("/api/v1/checkout", json={}, headers=actors["second_advertiser"])
    assert response.status_code == 409, response.text

    # The listing_a booking created earlier in this same checkout's loop (before the listing_b
    # conflict was hit) must have been rolled back along with everything else.
    bookings = client.get("/api/v1/bookings", headers=actors["second_advertiser"])
    assert bookings.json() == []

    cart = client.get("/api/v1/cart", headers=actors["second_advertiser"])
    assert len(cart.json()["items"]) == 3

    payments_for_second = client.get("/api/v1/payments/999999", headers=actors["second_advertiser"])
    assert payments_for_second.status_code == 404


def test_checkout_intra_cart_self_conflict_is_409(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"])
    add_to_cart(client, actors["advertiser"], listing["id"], 0, 5)
    # Different UniqueConstraint slot (different end_date) but overlapping window.
    add_to_cart(client, actors["advertiser"], listing["id"], 3, 8)

    response = client.post("/api/v1/checkout", json={}, headers=actors["advertiser"])
    assert response.status_code == 409

    bookings = client.get("/api/v1/bookings", headers=actors["advertiser"])
    assert bookings.json() == []
    cart = client.get("/api/v1/cart", headers=actors["advertiser"])
    assert len(cart.json()["items"]) == 2


def test_get_payment_owner_sees_it_other_user_gets_404(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"])
    add_to_cart(client, actors["advertiser"], listing["id"], 0, 2)
    checkout = client.post("/api/v1/checkout", json={}, headers=actors["advertiser"])
    payment_id = checkout.json()["payment_id"]

    mine = client.get(f"/api/v1/payments/{payment_id}", headers=actors["advertiser"])
    assert mine.status_code == 200

    other = client.get(f"/api/v1/payments/{payment_id}", headers=actors["second_advertiser"])
    assert other.status_code == 404


def test_second_checkout_of_same_dates_same_listing_is_409(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"])
    # second_advertiser adds the slot while it's still free...
    add_to_cart(client, actors["second_advertiser"], listing["id"], 0, 2)

    # ...but the first advertiser adds and checks out for the identical window first.
    add_to_cart(client, actors["advertiser"], listing["id"], 0, 2)
    first = client.post("/api/v1/checkout", json={}, headers=actors["advertiser"])
    assert first.status_code == 201, first.text

    second = client.post("/api/v1/checkout", json={}, headers=actors["second_advertiser"])
    assert second.status_code == 409
