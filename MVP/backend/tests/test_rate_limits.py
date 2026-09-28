"""Rate limits must hold across serverless instances.

On Vercel every request can land on a fresh function instance, so a counter
kept in process memory resets constantly and a brute-force run never trips
it. The counters live in the database instead: these tests prove the limits
trip, that the count is stored in `rate_limit_buckets` rather than in the
process, and that the client address is only taken from a proxy header when
running on Vercel (whose edge overwrites it), never from a header a caller
can set themselves.
"""
import pytest
from app import ratelimit
from app.main import limiter
from app.models import RateLimitBucket
from sqlalchemy import select

NOW = 1_800_000_000.0


@pytest.fixture
def limited(client, monkeypatch):
    """Limits on, a frozen clock, and not on Vercel unless a test says so."""
    monkeypatch.setattr(ratelimit, "clock", lambda: NOW)
    monkeypatch.delenv("VERCEL", raising=False)
    previous = limiter.enabled
    limiter.enabled = True
    yield client
    limiter.enabled = previous


def _login(test_client, email="nobody@example.com", ip=None):
    headers = {"X-Real-IP": ip} if ip else {}
    return test_client.post("/api/v1/auth/login", json={"email": email, "password": "wrong-password"}, headers=headers)


def test_login_trips_after_ten_attempts_a_minute(limited):
    test_client, _ = limited
    for _ in range(10):
        assert _login(test_client).status_code == 401
    blocked = _login(test_client)
    assert blocked.status_code == 429
    assert int(blocked.headers["Retry-After"]) > 0


def test_the_count_lives_in_the_database(limited):
    test_client, session_factory = limited
    for _ in range(3):
        _login(test_client)
    with session_factory() as db:
        hits = db.scalars(select(RateLimitBucket.hits)).all()
    assert 3 in hits


def test_the_window_resets(limited, monkeypatch):
    test_client, _ = limited
    for _ in range(11):
        _login(test_client)
    assert _login(test_client).status_code == 429
    monkeypatch.setattr(ratelimit, "clock", lambda: NOW + 3600)
    assert _login(test_client).status_code == 401


def test_one_account_is_protected_from_many_addresses(limited, monkeypatch):
    """A botnet guessing one password from many IPs still hits the per-account cap."""
    monkeypatch.setenv("VERCEL", "1")
    test_client, _ = limited
    for n in range(10):
        assert _login(test_client, email="victim@example.com", ip=f"203.0.113.{n}").status_code == 401
    assert _login(test_client, email="victim@example.com", ip="203.0.113.99").status_code == 429
    # A different account from a fresh address is unaffected.
    assert _login(test_client, email="someone@example.com", ip="198.51.100.7").status_code == 401


def test_a_spoofed_ip_header_is_ignored_off_vercel(limited):
    test_client, _ = limited
    for n in range(10):
        assert _login(test_client, email=f"user{n}@example.com", ip=f"203.0.113.{n}").status_code == 401
    assert _login(test_client, email="user99@example.com", ip="203.0.113.99").status_code == 429


def test_on_vercel_each_client_address_is_counted_separately(limited, monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    test_client, _ = limited
    for n in range(12):
        assert _login(test_client, email=f"user{n}@example.com", ip=f"203.0.113.{n}").status_code == 401


def test_registration_trips_after_five_a_minute(limited):
    test_client, _ = limited
    for n in range(5):
        response = test_client.post("/api/v1/auth/register", json={
            "email": f"new{n}@example.com", "full_name": "New User", "password": "secure-password-123",
        })
        assert response.status_code == 201, response.text
    blocked = test_client.post("/api/v1/auth/register", json={
        "email": "new9@example.com", "full_name": "New User", "password": "secure-password-123",
    })
    assert blocked.status_code == 429


def test_lead_form_trips_after_five_a_minute(limited):
    test_client, _ = limited
    lead = {"name": "Asha", "phone": "+91 98450 12345", "reason": "Service Quotation"}
    for _ in range(5):
        assert test_client.post("/api/v1/leads", json=lead).status_code == 201
    assert test_client.post("/api/v1/leads", json=lead).status_code == 429


def test_password_change_trips_after_five_a_minute(limited):
    test_client, _ = limited
    test_client.post("/api/v1/auth/register", json={
        "email": "pw@example.com", "full_name": "Pw User", "password": "secure-password-123",
    })
    token = test_client.post("/api/v1/auth/login", json={
        "email": "pw@example.com", "password": "secure-password-123",
    }).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    for _ in range(5):
        response = test_client.post("/api/v1/auth/password", json={
            "current_password": "not-it", "new_password": "rotated-password-456",
        }, headers=headers)
        assert response.status_code == 401
    assert test_client.post("/api/v1/auth/password", json={
        "current_password": "not-it", "new_password": "rotated-password-456",
    }, headers=headers).status_code == 429
