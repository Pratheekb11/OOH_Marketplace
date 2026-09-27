"""An admin account must be able to work both halves of the product.

There is no admin-only surface in this build (Role.admin exists, no route is
gated on it), so "admin access" means exactly one thing: an admin passes both
the owner gates and the advertiser gates. The endpoints still scope their
queries by the caller's own id, which is what the isolation assertions below
pin down -- widening access must not turn into seeing everybody's rows.
"""
from tests.conftest import register
from tests.test_checkout import add_to_cart
from tests.test_listings import create_listing


def test_admin_can_use_the_owner_surfaces(actors):
    client = actors["client"]
    listing = create_listing(client, actors["admin"], title="Admin's Hoarding", price_per_day=900.0)
    assert listing["status"] == "active"

    listings = client.get("/api/v1/owner/listings", headers=actors["admin"])
    assert listings.status_code == 200, listings.text
    assert [row["title"] for row in listings.json()] == ["Admin's Hoarding"]

    bookings = client.get("/api/v1/owner/bookings", headers=actors["admin"])
    assert bookings.status_code == 200, bookings.text
    assert bookings.json() == []


def test_admin_can_use_the_advertiser_surfaces(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"], price_per_day=1000.0)
    add_to_cart(client, actors["admin"], listing["id"], 0, 2)

    cart = client.get("/api/v1/cart", headers=actors["admin"])
    assert cart.status_code == 200, cart.text
    assert len(cart.json()["items"]) == 1

    paid = client.post("/api/v1/checkout", json={"method_label": "Card"}, headers=actors["admin"])
    assert paid.status_code == 201, paid.text

    bookings = client.get("/api/v1/bookings", headers=actors["admin"])
    assert bookings.status_code == 200, bookings.text
    assert [row["listing_id"] for row in bookings.json()] == [listing["id"]]


def test_admin_sees_only_its_own_rows_not_everybodys(actors):
    """The guard widens access; it must not widen what a query returns."""
    client = actors["client"]
    owner_listing = create_listing(client, actors["owner"], title="Not Admin's", price_per_day=500.0)
    add_to_cart(client, actors["advertiser"], owner_listing["id"], 0, 1)
    assert client.post("/api/v1/checkout", json={"method_label": "Card"}, headers=actors["advertiser"]).status_code == 201

    # The advertiser's booking above belongs to the advertiser, not the admin.
    assert client.get("/api/v1/bookings", headers=actors["admin"]).json() == []
    # And the owner's listing is not in the admin's own inventory.
    assert client.get("/api/v1/owner/listings", headers=actors["admin"]).json() == []


def test_non_admin_role_gates_still_reject(actors):
    """The admin bypass must not have loosened the ordinary role boundaries."""
    client = actors["client"]
    assert client.get("/api/v1/owner/bookings", headers=actors["advertiser"]).status_code == 403
    assert client.post("/api/v1/listings", json={
        "title": "Nope", "space_type": "Hoarding", "location": "Bengaluru", "price_per_day": 100.0,
    }, headers=actors["advertiser"]).status_code == 403
    assert client.get("/api/v1/cart", headers=actors["owner"]).status_code == 403
    assert client.get("/api/v1/bookings", headers=actors["owner"]).status_code == 403

    other_admin = register(client, "second-admin@example.com", "admin")
    assert client.get("/api/v1/owner/listings", headers=other_admin).status_code == 200
