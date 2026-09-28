"""Call-back requests ("leads") from the site's contact CTAs.

Request Proposal, Service Quotation, Speak to an Advisor and friends all open
one small form: name, phone, reason. The API stores each submission in `leads`
with `crm_status = "pending"` so a later CRM sync can pick up what it has not
pushed yet. Submitting is public -- most people asking for a call back have no
account -- but reading the queue is admin-only.
"""
from app.models import Lead, Listing, ListingStatus, User


def _lead(**overrides):
    body = {"name": "Asha Rao", "phone": "+91 98450 12345", "reason": "Service Quotation", "source": "/#services"}
    body.update(overrides)
    return body


def test_anonymous_visitor_can_request_a_call_back(client):
    test_client, session_factory = client
    response = test_client.post("/api/v1/leads", json=_lead())
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["id"] > 0
    assert body["reason"] == "Service Quotation"

    with session_factory() as db:
        lead = db.get(Lead, body["id"])
        assert lead.name == "Asha Rao"
        assert lead.phone == "+91 98450 12345"
        assert lead.reason == "Service Quotation"
        assert lead.source == "/#services"
        assert lead.user_id is None
        assert lead.crm_status == "pending"
        assert lead.created_at is not None


def test_signed_in_caller_is_attached_to_the_lead(actors):
    test_client = actors["client"]
    response = test_client.post("/api/v1/leads", json=_lead(), headers=actors["advertiser"])
    assert response.status_code == 201, response.text
    with actors["session_factory"]() as db:
        lead = db.get(Lead, response.json()["id"])
        user = db.query(User).filter_by(email="advertiser@example.com").one()
        assert lead.user_id == user.id


def test_an_expired_token_does_not_block_the_request(client):
    test_client, _ = client
    response = test_client.post("/api/v1/leads", json=_lead(), headers={"Authorization": "Bearer not-a-token"})
    assert response.status_code == 201, response.text


def test_fields_are_trimmed(client):
    test_client, session_factory = client
    response = test_client.post("/api/v1/leads", json=_lead(name="  Asha Rao ", reason="  Request Proposal  "))
    assert response.status_code == 201, response.text
    with session_factory() as db:
        lead = db.get(Lead, response.json()["id"])
        assert lead.name == "Asha Rao"
        assert lead.reason == "Request Proposal"


def test_source_is_optional(client):
    test_client, _ = client
    body = _lead()
    del body["source"]
    assert test_client.post("/api/v1/leads", json=body).status_code == 201


def test_name_phone_and_reason_are_required(client):
    test_client, _ = client
    for field in ("name", "phone", "reason"):
        body = _lead()
        del body[field]
        assert test_client.post("/api/v1/leads", json=body).status_code == 422, field
        assert test_client.post("/api/v1/leads", json=_lead(**{field: "   "})).status_code == 422, field


def test_phone_must_look_like_a_phone_number(client):
    test_client, _ = client
    for bad in ("12345", "call me maybe", "98450-1234x", "+91 98450 12345 12345 12"):
        assert test_client.post("/api/v1/leads", json=_lead(phone=bad)).status_code == 422, bad
    for good in ("9845012345", "+91-98450-12345", "080 4123 4567", "(080) 41234567"):
        assert test_client.post("/api/v1/leads", json=_lead(phone=good)).status_code == 201, good


def test_overlong_fields_are_rejected(client):
    test_client, _ = client
    assert test_client.post("/api/v1/leads", json=_lead(name="x" * 121)).status_code == 422
    assert test_client.post("/api/v1/leads", json=_lead(reason="x" * 501)).status_code == 422
    assert test_client.post("/api/v1/leads", json=_lead(source="x" * 256)).status_code == 422


def test_enquiry_about_a_listing_records_the_listing(actors):
    test_client = actors["client"]
    with actors["session_factory"]() as db:
        owner = db.query(User).filter_by(email="owner@example.com").one()
        listing = Listing(owner_id=owner.id, title="MG Road Unipole", space_type="Unipole", location="MG Road", price_per_day=5000, status=ListingStatus.active)
        db.add(listing)
        db.commit()
        listing_id = listing.id

    response = test_client.post("/api/v1/leads", json=_lead(reason="Enquiry: MG Road Unipole", listing_id=listing_id))
    assert response.status_code == 201, response.text
    with actors["session_factory"]() as db:
        assert db.get(Lead, response.json()["id"]).listing_id == listing_id


def test_unknown_listing_is_rejected(client):
    test_client, _ = client
    assert test_client.post("/api/v1/leads", json=_lead(listing_id=999_999)).status_code == 422


def test_only_admins_can_read_the_lead_queue(actors):
    test_client = actors["client"]
    test_client.post("/api/v1/leads", json=_lead(name="First Caller"))
    test_client.post("/api/v1/leads", json=_lead(name="Second Caller"))

    assert test_client.get("/api/v1/leads").status_code in (401, 403)
    assert test_client.get("/api/v1/leads", headers=actors["advertiser"]).status_code == 403
    assert test_client.get("/api/v1/leads", headers=actors["owner"]).status_code == 403

    response = test_client.get("/api/v1/leads", headers=actors["admin"])
    assert response.status_code == 200, response.text
    rows = response.json()
    # Newest first: whoever is working the queue wants the latest call backs on top.
    assert [row["name"] for row in rows] == ["Second Caller", "First Caller"]
    assert {"id", "name", "phone", "reason", "source", "listing_id", "crm_status", "created_at"} <= set(rows[0])
