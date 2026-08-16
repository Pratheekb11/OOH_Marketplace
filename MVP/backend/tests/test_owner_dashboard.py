"""Tests for the owner-side view of bookings (GET /api/v1/owner/bookings).

Reuses the `actors` fixture and `register` helper from tests/conftest.py and the
listing/cart helpers from the existing test modules -- no new fixtures here.
"""
from tests.conftest import register
from tests.test_checkout import add_to_cart
from tests.test_listings import create_listing


def checkout(client, headers):
    response = client.post("/api/v1/checkout", json={"method_label": "Card"}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def test_owner_sees_bookings_on_own_inventory_with_counterparty(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"], title="MG Road Hoarding", price_per_day=1000.0)
    add_to_cart(client, actors["advertiser"], listing["id"], 0, 2, addons=["monitoring"])
    checkout(client, actors["advertiser"])

    response = client.get("/api/v1/owner/bookings", headers=actors["owner"])
    assert response.status_code == 200, response.text
    rows = response.json()
    assert len(rows) == 1
    row = rows[0]
    assert row["listing_id"] == listing["id"]
    assert row["listing_title"] == "MG Road Hoarding"
    assert row["advertiser_email"] == "advertiser@example.com"
    assert row["days"] == 3
    assert row["base_amount"] == 3000.0
    assert row["addons_amount"] > 0
    assert row["total_amount"] == row["base_amount"] + row["addons_amount"] + row["gst_amount"]


def test_owner_never_sees_another_owners_bookings(actors):
    client = actors["client"]
    other_owner = register(client, "other-owner@example.com", "owner")
    mine = create_listing(client, actors["owner"], title="Mine", price_per_day=500.0)
    theirs = create_listing(client, other_owner, title="Theirs", price_per_day=500.0)
    add_to_cart(client, actors["advertiser"], mine["id"], 0, 1)
    add_to_cart(client, actors["advertiser"], theirs["id"], 10, 11)
    checkout(client, actors["advertiser"])

    mine_rows = client.get("/api/v1/owner/bookings", headers=actors["owner"]).json()
    theirs_rows = client.get("/api/v1/owner/bookings", headers=other_owner).json()
    assert [row["listing_title"] for row in mine_rows] == ["Mine"]
    assert [row["listing_title"] for row in theirs_rows] == ["Theirs"]


def test_owner_bookings_is_owner_only(actors):
    client = actors["client"]
    assert client.get("/api/v1/owner/bookings", headers=actors["advertiser"]).status_code == 403
    assert client.get("/api/v1/owner/bookings").status_code == 401  # no bearer token at all


def test_archived_listing_keeps_its_bookings_in_the_owner_view(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"], title="Retiring Site", price_per_day=800.0)
    add_to_cart(client, actors["advertiser"], listing["id"], 0, 1)
    checkout(client, actors["advertiser"])
    assert client.delete(f"/api/v1/listings/{listing['id']}", headers=actors["owner"]).status_code == 204

    rows = client.get("/api/v1/owner/bookings", headers=actors["owner"]).json()
    assert len(rows) == 1
    assert rows[0]["listing_status"] == "archived"


def test_owner_with_no_bookings_gets_an_empty_list(actors):
    client = actors["client"]
    create_listing(client, actors["owner"], title="Never Booked", price_per_day=900.0)
    assert client.get("/api/v1/owner/bookings", headers=actors["owner"]).json() == []
