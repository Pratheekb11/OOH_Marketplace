"""P0-1: the public listing API must not reveal where scraped inventory came from.

Scraped rows carry provenance (source URL, site, id) and the source's own
commercial terms (card rate, minimum billing) in `extra`. That is internal
bookkeeping for re-imports; none of it may reach a browser, whether through
the API or through the static snapshot the GitHub Pages build ships.
"""
from app.models import Listing, ListingStatus
from scripts.export_static import listing_json

PRIVATE_KEYS = {"source_url", "source_site", "source_id", "card_rate", "minimum_billing", "warnings"}

SCRAPED_EXTRA = {
    "source_url": "https://www.themediaant.com/outdoor/skywalk-marathahalli-bengaluru-30085",
    "source_site": "themediaant.com",
    "source_id": "5c332ada62b4651323deb8fd",
    "city": "Bengaluru",
    "latitude": 12.95689,
    "longitude": 77.701663,
    "size_bucket": None,
    "landmark": "Marathahalli, Twds ITPL",
    "locality": "Marathahalli",
    "resolution_px": None,
    "total_impressions": 673100,
    "card_rate": 36300,
    "minimum_billing": 231000,
    "warnings": ["price derived from card rate"],
}


def scraped_listing(client, headers, **overrides):
    payload = {
        "title": "Skywalk - Marathahalli Bengaluru",
        "space_type": "Skywalk",
        "description": "Skywalk advertising in Marathahalli.",
        "location": "Marathahalli, Bengaluru",
        "width_ft": 90,
        "height_ft": 10,
        "price_per_day": 33000.0,
        "footfall_estimate": 673000,
        "lighting": "Front Lit",
        "image_url": None,
        "extra": dict(SCRAPED_EXTRA),
    }
    payload.update(overrides)
    response = client.post("/api/v1/listings", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def assert_public(extra):
    assert extra is not None
    leaked = PRIVATE_KEYS & set(extra)
    assert not leaked, f"private keys exposed: {sorted(leaked)}"


def test_browse_hides_provenance_and_source_terms(actors):
    client = actors["client"]
    scraped_listing(client, actors["owner"])

    response = client.get("/api/v1/listings")
    assert response.status_code == 200
    for item in response.json()["items"]:
        assert_public(item["extra"])
    assert "themediaant" not in response.text


def test_detail_hides_provenance_and_source_terms(actors):
    client = actors["client"]
    created = scraped_listing(client, actors["owner"])

    response = client.get(f"/api/v1/listings/{created['id']}")
    assert response.status_code == 200
    assert_public(response.json()["extra"])
    assert "themediaant" not in response.text


def test_create_response_hides_provenance(actors):
    created = scraped_listing(actors["client"], actors["owner"])
    assert_public(created["extra"])


def test_public_location_fields_survive(actors):
    """Coordinates and place names are what the map and the card need."""
    client = actors["client"]
    created = scraped_listing(client, actors["owner"])

    extra = client.get(f"/api/v1/listings/{created['id']}").json()["extra"]
    assert extra["latitude"] == 12.95689
    assert extra["longitude"] == 77.701663
    assert extra["landmark"] == "Marathahalli, Twds ITPL"
    assert extra["locality"] == "Marathahalli"
    assert extra["city"] == "Bengaluru"


def test_owner_supplied_extra_keys_survive(actors):
    """Owners store their own rate-card fields in `extra`; those are theirs to show.

    Except the headline price: `display_price` is always derived from the
    `price_per_day` checkout charges (33000 here), never the owner's figure,
    so a card cannot advertise one price and bill another."""
    client = actors["client"]
    created = scraped_listing(
        client,
        actors["owner"],
        extra={"display_unit": "/ Slot", "display_price": 45000, "refund_policy": "Full refund 7 days out"},
    )
    extra = client.get(f"/api/v1/listings/{created['id']}").json()["extra"]
    assert extra == {"display_unit": "/ Slot", "display_price": 33000, "refund_policy": "Full refund 7 days out"}


def test_owner_listings_route_hides_provenance(actors):
    client = actors["client"]
    scraped_listing(client, actors["owner"])

    response = client.get("/api/v1/owner/listings", headers=actors["owner"])
    assert response.status_code == 200
    for item in response.json():
        assert_public(item["extra"])


def test_static_snapshot_hides_provenance(client):
    _, session_factory = client
    with session_factory() as db:
        listing = Listing(
            owner_id=1,
            title="Skywalk - Marathahalli Bengaluru",
            space_type="Skywalk",
            description="Skywalk advertising.",
            location="Marathahalli, Bengaluru",
            width_ft=90,
            height_ft=10,
            price_per_day=33000.0,
            footfall_estimate=673000,
            status=ListingStatus.active,
            lighting="Front Lit",
            image_url=None,
            extra=dict(SCRAPED_EXTRA),
        )
        db.add(listing)
        db.commit()
        db.refresh(listing)

        row = listing_json(listing)

    assert_public(row["extra"])
    assert row["extra"]["latitude"] == 12.95689
    assert "themediaant" not in str(row)
