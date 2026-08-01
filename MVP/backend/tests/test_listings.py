"""Tests for the /api/v1/listings and /api/v1/owner/listings routes.

Uses the `client` and `actors` fixtures and the `register` helper from
tests/conftest.py -- no new fixtures are introduced here.
"""
from tests.conftest import register


def listing_payload(**overrides):
    payload = {
        "title": "Indiranagar 100ft Rd Junction",
        "space_type": "Digital OOH",
        "description": "High-visibility digital screen at a busy junction.",
        "location": "Opposite Toit",
        "width_ft": 20,
        "height_ft": 15,
        "price_per_day": 4500.0,
        "footfall_estimate": 245000,
        "lighting": "LED",
        "image_url": "/images/listings/indiranagar-100ft-rd-junction.png",
        "extra": {"display_unit": "/ Slot", "display_price": 45000},
    }
    payload.update(overrides)
    return payload


def create_listing(client, headers, **overrides):
    response = client.post("/api/v1/listings", json=listing_payload(**overrides), headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def test_create_listing_as_owner_returns_201_active(actors):
    client = actors["client"]
    body = create_listing(client, actors["owner"])
    assert body["status"] == "active"
    assert body["title"] == "Indiranagar 100ft Rd Junction"
    assert body["owner_id"]


def test_create_listing_as_advertiser_is_403(actors):
    client = actors["client"]
    response = client.post("/api/v1/listings", json=listing_payload(), headers=actors["advertiser"])
    assert response.status_code == 403


def test_browse_listings_excludes_archived(actors):
    client = actors["client"]
    keep = create_listing(client, actors["owner"], title="Keep Me Listing")
    drop = create_listing(client, actors["owner"], title="Archive Me Listing")

    delete_response = client.delete(f"/api/v1/listings/{drop['id']}", headers=actors["owner"])
    assert delete_response.status_code == 204

    response = client.get("/api/v1/listings")
    assert response.status_code == 200
    titles = [item["title"] for item in response.json()]
    assert "Keep Me Listing" in titles
    assert "Archive Me Listing" not in titles
    ids = [item["id"] for item in response.json()]
    assert keep["id"] in ids
    assert drop["id"] not in ids


def test_filter_by_q_matches_title_or_location(actors):
    client = actors["client"]
    create_listing(client, actors["owner"], title="Koramangala Sony World", location="80ft Road, 4th Block")
    create_listing(client, actors["owner"], title="MG Road Metro Pillar", location="MG Road, Bengaluru")

    response = client.get("/api/v1/listings", params={"q": "Koramangala"})
    assert response.status_code == 200
    titles = [item["title"] for item in response.json()]
    assert titles == ["Koramangala Sony World"]

    response = client.get("/api/v1/listings", params={"q": "MG Road"})
    titles = [item["title"] for item in response.json()]
    assert titles == ["MG Road Metro Pillar"]


def test_filter_by_space_type(actors):
    client = actors["client"]
    create_listing(client, actors["owner"], title="Hoarding Listing", space_type="Hoarding")
    create_listing(client, actors["owner"], title="Skywalk Listing", space_type="Skywalk")

    response = client.get("/api/v1/listings", params={"space_type": "Skywalk"})
    assert response.status_code == 200
    titles = [item["title"] for item in response.json()]
    assert titles == ["Skywalk Listing"]


def test_filter_by_lighting(actors):
    client = actors["client"]
    create_listing(client, actors["owner"], title="LED Listing", lighting="LED")
    create_listing(client, actors["owner"], title="Non Lit Listing", lighting="Non Lit")

    response = client.get("/api/v1/listings", params={"lighting": "Non Lit"})
    assert response.status_code == 200
    titles = [item["title"] for item in response.json()]
    assert titles == ["Non Lit Listing"]


def test_filter_by_min_and_max_price(actors):
    client = actors["client"]
    create_listing(client, actors["owner"], title="Cheap Listing", price_per_day=1000.0)
    create_listing(client, actors["owner"], title="Mid Listing", price_per_day=5000.0)
    create_listing(client, actors["owner"], title="Pricey Listing", price_per_day=9000.0)

    response = client.get("/api/v1/listings", params={"min_price": 2000, "max_price": 6000})
    assert response.status_code == 200
    titles = {item["title"] for item in response.json()}
    assert titles == {"Mid Listing"}


def test_sort_by_price_asc_and_footfall_desc(actors):
    client = actors["client"]
    create_listing(client, actors["owner"], title="Low Price High Footfall", price_per_day=1000.0, footfall_estimate=900000)
    create_listing(client, actors["owner"], title="High Price Low Footfall", price_per_day=9000.0, footfall_estimate=100000)

    response = client.get("/api/v1/listings", params={"sort": "price_asc"})
    titles = [item["title"] for item in response.json()]
    assert titles.index("Low Price High Footfall") < titles.index("High Price Low Footfall")

    response = client.get("/api/v1/listings", params={"sort": "footfall_desc"})
    titles = [item["title"] for item in response.json()]
    assert titles.index("Low Price High Footfall") < titles.index("High Price Low Footfall")


def test_get_listing_by_id_and_404_for_unknown(actors):
    client = actors["client"]
    body = create_listing(client, actors["owner"])

    response = client.get(f"/api/v1/listings/{body['id']}")
    assert response.status_code == 200
    assert response.json()["id"] == body["id"]

    response = client.get("/api/v1/listings/999999")
    assert response.status_code == 404


def test_update_listing_by_owner_changes_fields(actors):
    client = actors["client"]
    body = create_listing(client, actors["owner"])

    update = listing_payload(title="Updated Title", price_per_day=7777.0)
    response = client.put(f"/api/v1/listings/{body['id']}", json=update, headers=actors["owner"])
    assert response.status_code == 200, response.text
    updated = response.json()
    assert updated["title"] == "Updated Title"
    assert updated["price_per_day"] == 7777.0


def test_update_listing_by_different_owner_is_404(actors):
    client = actors["client"]
    body = create_listing(client, actors["owner"])
    other_owner = register(client, "other-owner@example.com", "owner")

    response = client.put(f"/api/v1/listings/{body['id']}", json=listing_payload(title="Hijacked"), headers=other_owner)
    assert response.status_code == 404


def test_update_listing_unauthenticated_is_401(actors):
    client = actors["client"]
    body = create_listing(client, actors["owner"])

    response = client.put(f"/api/v1/listings/{body['id']}", json=listing_payload())
    assert response.status_code == 401


def test_delete_listing_archives_and_hides_but_owner_still_sees_it(actors):
    client = actors["client"]
    body = create_listing(client, actors["owner"])

    response = client.delete(f"/api/v1/listings/{body['id']}", headers=actors["owner"])
    assert response.status_code == 204
    assert response.content == b""

    browse = client.get("/api/v1/listings")
    assert body["id"] not in [item["id"] for item in browse.json()]

    owned = client.get("/api/v1/owner/listings", headers=actors["owner"])
    assert owned.status_code == 200
    owned_ids = [item["id"] for item in owned.json()]
    assert body["id"] in owned_ids
    archived = next(item for item in owned.json() if item["id"] == body["id"])
    assert archived["status"] == "archived"


def test_delete_listing_by_different_owner_is_404(actors):
    client = actors["client"]
    body = create_listing(client, actors["owner"])
    other_owner = register(client, "another-owner@example.com", "owner")

    response = client.delete(f"/api/v1/listings/{body['id']}", headers=other_owner)
    assert response.status_code == 404


def test_owner_listings_returns_only_that_owners_listings(actors):
    client = actors["client"]
    mine = create_listing(client, actors["owner"], title="My Listing")
    other_owner = register(client, "third-owner@example.com", "owner")
    create_listing(client, other_owner, title="Someone Elses Listing")

    response = client.get("/api/v1/owner/listings", headers=actors["owner"])
    assert response.status_code == 200
    titles = [item["title"] for item in response.json()]
    assert titles == ["My Listing"]
    assert mine["id"] in [item["id"] for item in response.json()]
