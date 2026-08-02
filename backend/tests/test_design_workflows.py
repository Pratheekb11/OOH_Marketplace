"""Acceptance tests derived from the supplied C4/activity diagrams.

These assert user-visible business rules and state transitions rather than
private functions or SQLAlchemy implementation details.
"""
from app.models import Booking, BookingStatus


def create_listing(actors, price=100.0):
    response = actors["client"].post("/api/v1/listings", headers=actors["owner"], json={"title": "MG Road Landmark", "space_type": "billboard", "description": "High traffic asset", "location": "Bengaluru", "width_ft": 20, "height_ft": 10, "price_per_day": price, "footfall_estimate": 10000})
    assert response.status_code == 201, response.text
    return response.json()


def approve(actors, listing_id):
    response = actors["client"].post(f"/api/v1/admin/listings/{listing_id}/review", headers=actors["admin"], json={"approve": True})
    assert response.status_code == 200, response.text


def test_owner_listing_requires_admin_approval_before_marketplace_visibility(actors):
    listing = create_listing(actors)
    public = actors["client"].get("/api/v1/listings")
    assert public.status_code == 200
    assert listing["id"] not in [item["id"] for item in public.json()["items"]]

    forbidden = actors["client"].post(f"/api/v1/admin/listings/{listing['id']}/review", headers=actors["advertiser"], json={"approve": True})
    assert forbidden.status_code == 403

    approve(actors, listing["id"])
    public = actors["client"].get("/api/v1/listings?location=Bengaluru&space_type=billboard")
    assert [item["id"] for item in public.json()["items"]] == [listing["id"]]
    assert public.json()["items"][0]["status"] == "active"


def test_rejection_requires_reason_and_notifies_owner(actors):
    listing = create_listing(actors)
    missing_reason = actors["client"].post(f"/api/v1/admin/listings/{listing['id']}/review", headers=actors["admin"], json={"approve": False})
    assert missing_reason.status_code == 422

    rejected = actors["client"].post(f"/api/v1/admin/listings/{listing['id']}/review", headers=actors["admin"], json={"approve": False, "rejection_reason": "Ownership proof is incomplete"})
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "rejected"
    owner_notifications = actors["client"].get("/api/v1/notifications", headers=actors["owner"]).json()
    assert any(note["event_type"] == "listing.rejected" for note in owner_notifications)


def test_booking_prices_inclusive_days_vas_and_gst_and_prevents_double_booking(actors):
    listing = create_listing(actors, price=100)
    approve(actors, listing["id"])
    payload = {"listing_id": listing["id"], "start_date": "2026-08-01", "end_date": "2026-08-03", "vas_items": [{"service": "installation", "quantity": 1}, {"service": "printing", "quantity": 2}]}
    booking = actors["client"].post("/api/v1/bookings", headers=actors["advertiser"], json=payload)
    assert booking.status_code == 201, booking.text
    data = booking.json()
    assert data["base_amount"] == 300
    assert data["vas_amount"] == 1550
    assert data["gst_amount"] == 333
    assert data["total_amount"] == 2183

    overlapping = actors["client"].post("/api/v1/bookings", headers=actors["second_advertiser"], json={"listing_id": listing["id"], "start_date": "2026-08-03", "end_date": "2026-08-05"})
    assert overlapping.status_code == 409


def test_paid_booking_with_checkout_vas_creates_invoice_and_vas_job(actors):
    listing = create_listing(actors)
    approve(actors, listing["id"])
    booking = actors["client"].post("/api/v1/bookings", headers=actors["advertiser"], json={"listing_id": listing["id"], "start_date": "2026-09-01", "end_date": "2026-09-02", "vas_items": [{"service": "installation", "quantity": 1}]}).json()
    payment = actors["client"].post(f"/api/v1/payments/booking/{booking['id']}", headers=actors["advertiser"]).json()
    paid = actors["client"].post(f"/api/v1/payments/{payment['id']}/confirm", headers=actors["advertiser"], json={"success": True})
    assert paid.status_code == 200 and paid.json()["status"] == "paid"

    invoices = actors["client"].get("/api/v1/invoices", headers=actors["advertiser"]).json()
    jobs = actors["client"].get("/api/v1/vas/orders", headers=actors["advertiser"]).json()
    assert len(invoices) == 1
    assert len(jobs) == 1
    assert jobs[0]["booking_id"] == booking["id"]
    assert jobs[0]["status"] == "unassigned"


def test_standalone_vas_and_active_campaign_reorder_follow_distinct_paths(actors):
    standalone = actors["client"].post("/api/v1/vas/orders", headers=actors["advertiser"], json={"own_space_details": {"location": "HSR Layout", "width_ft": 12, "height_ft": 8}, "services": [{"service": "printing", "quantity": 96}]})
    assert standalone.status_code == 201
    assert standalone.json()["booking_id"] is None

    listing = create_listing(actors); approve(actors, listing["id"])
    booking = actors["client"].post("/api/v1/bookings", headers=actors["advertiser"], json={"listing_id": listing["id"], "start_date": "2026-10-01", "end_date": "2026-10-03"}).json()
    not_active = actors["client"].post("/api/v1/vas/orders", headers=actors["advertiser"], json={"booking_id": booking["id"], "services": [{"service": "maintenance", "quantity": 1}]})
    assert not_active.status_code == 409

    with actors["session_factory"]() as db:
        row = db.get(Booking, booking["id"]); row.status = BookingStatus.active; db.commit()
    reorder = actors["client"].post("/api/v1/vas/orders", headers=actors["advertiser"], json={"booking_id": booking["id"], "services": [{"service": "maintenance", "quantity": 1}]})
    assert reorder.status_code == 201
    assert reorder.json()["booking_id"] == booking["id"]


def test_admin_can_operate_vas_job_and_advertiser_is_notified(actors):
    job = actors["client"].post("/api/v1/vas/orders", headers=actors["advertiser"], json={"own_space_details": {"location": "Indiranagar"}, "services": [{"service": "installation", "quantity": 1}]}).json()
    denied = actors["client"].patch(f"/api/v1/admin/vas/orders/{job['id']}", headers=actors["advertiser"], json={"status": "scheduled"})
    assert denied.status_code == 403
    scheduled = actors["client"].patch(f"/api/v1/admin/vas/orders/{job['id']}", headers=actors["admin"], json={"status": "scheduled", "scheduled_date": "2026-08-10"})
    assert scheduled.status_code == 200
    assert scheduled.json()["status"] == "scheduled"
    notifications = actors["client"].get("/api/v1/notifications", headers=actors["advertiser"]).json()
    assert any(note["event_type"] == "vas.job.updated" for note in notifications)
