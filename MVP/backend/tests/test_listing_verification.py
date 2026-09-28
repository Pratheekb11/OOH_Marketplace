"""The "Verified" badge is granted by an admin, never self-declared.

An owner used to be able to put `"verified": true` in a listing's `extra` and
get the badge. Now `verified` (and the request state behind it) is server
controlled: owners ask for verification, an admin approves or rejects, and
nothing an owner sends in `extra` can change either.
"""
from app.models import Listing
from sqlalchemy import select

from tests.conftest import register
from tests.test_listings import create_listing

API = "/api/v1"


def _owner_status(client, headers, listing_id):
    rows = client.get(f"{API}/owner/listings", headers=headers).json()
    return next(row for row in rows if row["id"] == listing_id)["verification_status"]


def _public_extra(client, listing_id):
    return client.get(f"{API}/listings/{listing_id}").json()["extra"] or {}


def test_an_owner_cannot_self_verify_on_create(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"], extra={"verified": True, "verification_status": "approved", "city": "Bengaluru"})
    extra = _public_extra(client, listing["id"])
    assert extra.get("verified") is not True
    assert "verification_status" not in extra
    assert extra["city"] == "Bengaluru"  # everything else in extra survives
    assert _owner_status(client, actors["owner"], listing["id"]) == "none"


def test_an_admin_cannot_self_verify_through_extra_either(actors):
    client = actors["client"]
    listing = create_listing(client, actors["admin"], extra={"verified": True})
    assert _public_extra(client, listing["id"]).get("verified") is not True


def test_owner_requests_and_admin_approves(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"])

    requested = client.post(f"{API}/listings/{listing['id']}/verification", headers=actors["owner"])
    assert requested.status_code == 200, requested.text
    assert _owner_status(client, actors["owner"], listing["id"]) == "requested"
    # The request state is the owner's business, not the public's.
    assert "verification_status" not in _public_extra(client, listing["id"])

    queue = client.get(f"{API}/admin/verification-requests", headers=actors["admin"])
    assert queue.status_code == 200, queue.text
    row = next(r for r in queue.json() if r["id"] == listing["id"])
    assert row["owner_email"] == "owner@example.com"
    assert row["title"] == listing["title"]

    decided = client.post(f"{API}/admin/listings/{listing['id']}/verification", json={"approve": True}, headers=actors["admin"])
    assert decided.status_code == 200, decided.text
    assert _public_extra(client, listing["id"])["verified"] is True
    assert _owner_status(client, actors["owner"], listing["id"]) == "verified"
    assert all(r["id"] != listing["id"] for r in client.get(f"{API}/admin/verification-requests", headers=actors["admin"]).json())


def test_admin_rejects_and_owner_may_ask_again(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"])
    client.post(f"{API}/listings/{listing['id']}/verification", headers=actors["owner"])
    rejected = client.post(f"{API}/admin/listings/{listing['id']}/verification", json={"approve": False}, headers=actors["admin"])
    assert rejected.status_code == 200, rejected.text
    assert _public_extra(client, listing["id"]).get("verified") is not True
    assert _owner_status(client, actors["owner"], listing["id"]) == "rejected"

    again = client.post(f"{API}/listings/{listing['id']}/verification", headers=actors["owner"])
    assert again.status_code == 200, again.text
    assert _owner_status(client, actors["owner"], listing["id"]) == "requested"


def test_editing_a_listing_cannot_change_its_verification(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"])
    client.post(f"{API}/listings/{listing['id']}/verification", headers=actors["owner"])
    client.post(f"{API}/admin/listings/{listing['id']}/verification", json={"approve": True}, headers=actors["admin"])

    # An edit that omits the badge keeps it; one that tries to flip it is ignored.
    for extra in ({"city": "Mysuru"}, {"verified": False, "verification_status": "rejected"}):
        payload = {**listing, "extra": extra}
        for field in ("id", "owner_id", "status", "rejection_reason", "image_urls", "min_booking_days"):
            payload.pop(field, None)
        response = client.put(f"{API}/listings/{listing['id']}", json=payload, headers=actors["owner"])
        assert response.status_code == 200, response.text
        assert _public_extra(client, listing["id"])["verified"] is True
        assert _owner_status(client, actors["owner"], listing["id"]) == "verified"


def test_an_unverified_listing_cannot_be_flipped_by_an_edit(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"])
    payload = {**listing, "extra": {"verified": True}}
    for field in ("id", "owner_id", "status", "rejection_reason", "image_urls", "min_booking_days"):
        payload.pop(field, None)
    assert client.put(f"{API}/listings/{listing['id']}", json=payload, headers=actors["owner"]).status_code == 200
    with actors["session_factory"]() as db:
        stored = db.scalar(select(Listing).where(Listing.id == listing["id"]))
        assert (stored.extra or {}).get("verified") is not True


def test_only_the_listing_owner_can_request(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"])
    other_owner = register(client, "other-owner@example.com", "owner")
    assert client.post(f"{API}/listings/{listing['id']}/verification", headers=other_owner).status_code == 404
    assert client.post(f"{API}/listings/{listing['id']}/verification", headers=actors["advertiser"]).status_code == 403
    assert client.post(f"{API}/listings/{listing['id']}/verification").status_code == 401


def test_an_already_verified_listing_cannot_be_requested_again(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"])
    client.post(f"{API}/listings/{listing['id']}/verification", headers=actors["owner"])
    client.post(f"{API}/admin/listings/{listing['id']}/verification", json={"approve": True}, headers=actors["admin"])
    assert client.post(f"{API}/listings/{listing['id']}/verification", headers=actors["owner"]).status_code == 409


def test_only_admins_see_the_queue_and_decide(actors):
    client = actors["client"]
    listing = create_listing(client, actors["owner"])
    client.post(f"{API}/listings/{listing['id']}/verification", headers=actors["owner"])
    for who in ("owner", "advertiser"):
        assert client.get(f"{API}/admin/verification-requests", headers=actors[who]).status_code == 403
        assert client.post(
            f"{API}/admin/listings/{listing['id']}/verification", json={"approve": True}, headers=actors[who],
        ).status_code == 403
    assert client.get(f"{API}/admin/verification-requests").status_code == 401
    assert _public_extra(client, listing["id"]).get("verified") is not True


def test_deciding_on_a_missing_listing_is_a_404(actors):
    client = actors["client"]
    assert client.post(f"{API}/admin/listings/999999/verification", json={"approve": True}, headers=actors["admin"]).status_code == 404
