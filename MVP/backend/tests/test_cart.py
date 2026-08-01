"""Tests for the /api/v1/cart routes.

Uses the `client` and `actors` fixtures and the `register` helper from
tests/conftest.py -- no new fixtures are introduced here.
"""
from datetime import date, timedelta

from tests.test_listings import create_listing, listing_payload

TODAY = date(2026, 1, 1)


def dates(offset_start=0, offset_end=2):
    start = TODAY + timedelta(days=offset_start)
    end = TODAY + timedelta(days=offset_end)
    return start.isoformat(), end.isoformat()


def test_add_to_cart_appears_with_server_computed_totals(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"], price_per_day=1000.0)
    start, end = dates(0, 2)  # 3 inclusive days

    response = client.post("/api/v1/cart/items", json={
        "listing_id": listing["id"], "start_date": start, "end_date": end, "addons": ["printing"],
    }, headers=actors["advertiser"])
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["days"] == 3
    assert body["base_amount"] == 3000.0
    assert body["addons_amount"] == 25000.0
    assert body["listing_title"] == listing["title"]
    assert body["listing_price_per_day"] == 1000.0

    cart = client.get("/api/v1/cart", headers=actors["advertiser"])
    assert cart.status_code == 200
    cart_body = cart.json()
    assert len(cart_body["items"]) == 1
    item = cart_body["items"][0]
    assert item["base_amount"] == 3000.0
    assert item["addons_amount"] == 25000.0
    expected_gst = round((3000.0 + 25000.0) * 0.18, 2)
    assert item["gst_amount"] == expected_gst
    assert item["total_amount"] == round(3000.0 + 25000.0 + expected_gst, 2)
    assert cart_body["subtotal"] == 3000.0
    assert cart_body["addons_total"] == 25000.0
    assert cart_body["gst_total"] == expected_gst
    assert cart_body["grand_total"] == round(3000.0 + 25000.0 + expected_gst, 2)


def test_adding_identical_row_twice_is_idempotent(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"])
    start, end = dates(0, 2)
    payload = {"listing_id": listing["id"], "start_date": start, "end_date": end, "addons": []}

    first = client.post("/api/v1/cart/items", json=payload, headers=actors["advertiser"])
    assert first.status_code == 201, first.text

    second = client.post("/api/v1/cart/items", json=payload, headers=actors["advertiser"])
    assert second.status_code == 200, second.text
    assert second.json()["id"] == first.json()["id"]

    cart = client.get("/api/v1/cart", headers=actors["advertiser"])
    assert len(cart.json()["items"]) == 1


def test_bad_addon_code_is_422(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"])
    start, end = dates(0, 2)
    response = client.post("/api/v1/cart/items", json={
        "listing_id": listing["id"], "start_date": start, "end_date": end, "addons": ["not-a-real-addon"],
    }, headers=actors["advertiser"])
    assert response.status_code == 422


def test_end_date_before_start_date_is_422(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"])
    start, end = dates(2, 0)
    response = client.post("/api/v1/cart/items", json={
        "listing_id": listing["id"], "start_date": start, "end_date": end, "addons": [],
    }, headers=actors["advertiser"])
    assert response.status_code == 422


def test_unknown_listing_is_404(actors):
    client = actors["client"]
    start, end = dates(0, 2)
    response = client.post("/api/v1/cart/items", json={
        "listing_id": 999999, "start_date": start, "end_date": end, "addons": [],
    }, headers=actors["advertiser"])
    assert response.status_code == 404


def test_inactive_listing_is_409(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"])
    archive = client.delete(f"/api/v1/listings/{listing['id']}", headers=actors["owner"])
    assert archive.status_code == 204

    start, end = dates(0, 2)
    response = client.post("/api/v1/cart/items", json={
        "listing_id": listing["id"], "start_date": start, "end_date": end, "addons": [],
    }, headers=actors["advertiser"])
    assert response.status_code == 409


def test_other_users_cart_item_is_invisible_and_patch_delete_404(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"])
    start, end = dates(0, 2)
    add = client.post("/api/v1/cart/items", json={
        "listing_id": listing["id"], "start_date": start, "end_date": end, "addons": [],
    }, headers=actors["advertiser"])
    item_id = add.json()["id"]

    other_cart = client.get("/api/v1/cart", headers=actors["second_advertiser"])
    assert other_cart.json()["items"] == []

    patch = client.patch(f"/api/v1/cart/items/{item_id}", json={
        "start_date": start, "end_date": end, "addons": ["monitoring"],
    }, headers=actors["second_advertiser"])
    assert patch.status_code == 404

    delete = client.delete(f"/api/v1/cart/items/{item_id}", headers=actors["second_advertiser"])
    assert delete.status_code == 404

    # Still there for the owning user.
    mine = client.get("/api/v1/cart", headers=actors["advertiser"])
    assert len(mine.json()["items"]) == 1


def test_delete_cart_empties_it(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"])
    start, end = dates(0, 2)
    client.post("/api/v1/cart/items", json={
        "listing_id": listing["id"], "start_date": start, "end_date": end, "addons": [],
    }, headers=actors["advertiser"])

    response = client.delete("/api/v1/cart", headers=actors["advertiser"])
    assert response.status_code == 204

    cart = client.get("/api/v1/cart", headers=actors["advertiser"])
    assert cart.json()["items"] == []
