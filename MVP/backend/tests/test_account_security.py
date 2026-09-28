"""Account-takeover guards.

Each test pins one way in that used to be open: registering straight into the
admin role, two accounts for one inbox that differ only by letter case, and a
bearer token that outlives the credential it was issued against.
"""
from app.models import User
from sqlalchemy import select

from tests.conftest import register


def _login(client, email, password="secure-password-123"):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def test_public_registration_cannot_create_an_admin(client):
    test_client, session_factory = client
    response = test_client.post("/api/v1/auth/register", json={
        "email": "mallory@example.com", "full_name": "Mallory", "password": "secure-password-123", "role": "admin",
    })
    assert response.status_code == 422, response.text
    with session_factory() as db:
        assert db.scalar(select(User).where(User.email == "mallory@example.com")) is None


def test_registration_still_offers_advertiser_and_owner(client):
    test_client, _ = client
    register(test_client, "ad@example.com", "advertiser")
    register(test_client, "own@example.com", "owner")


def test_email_is_one_account_whatever_the_letter_case(client):
    test_client, session_factory = client
    first = test_client.post("/api/v1/auth/register", json={
        "email": "Asha@Example.com", "full_name": "Asha", "password": "secure-password-123",
    })
    assert first.status_code == 201, first.text
    assert first.json()["email"] == "asha@example.com"
    again = test_client.post("/api/v1/auth/register", json={
        "email": "asha@example.com", "full_name": "Not Asha", "password": "other-password-123",
    })
    assert again.status_code == 400, again.text
    assert _login(test_client, "ASHA@example.COM").status_code == 200


def test_login_finds_a_legacy_mixed_case_row(client):
    """Rows written before emails were lower-cased keep working."""
    test_client, session_factory = client
    from app.security import password_context
    with session_factory() as db:
        db.add(User(email="Legacy@Example.com", full_name="Legacy", password_hash=password_context.hash("secure-password-123")))
        db.commit()
    assert _login(test_client, "legacy@example.com").status_code == 200


def test_changing_the_password_ends_older_sessions(actors):
    """A stolen token must not survive the owner rotating their password."""
    client = actors["client"]
    old = actors["advertiser"]
    response = client.post("/api/v1/auth/password", json={
        "current_password": "secure-password-123", "new_password": "rotated-password-456",
    }, headers=old)
    assert response.status_code == 200, response.text
    assert client.get("/api/v1/auth/me", headers=old).status_code == 401
    fresh = {"Authorization": f"Bearer {response.json()['access_token']}"}
    assert client.get("/api/v1/auth/me", headers=fresh).status_code == 200


def test_a_token_without_the_credential_stamp_is_refused(actors):
    """Tokens minted before the stamp existed, or forged without it, are dead."""
    from datetime import datetime, timedelta, timezone

    from app.config import get_settings
    from jose import jwt
    client = actors["client"]
    with actors["session_factory"]() as db:
        user_id = db.scalar(select(User.id).where(User.email == "advertiser@example.com"))
    bare = jwt.encode(
        {"sub": str(user_id), "role": "advertiser", "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
        get_settings().secret_key, algorithm="HS256",
    )
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {bare}"}).status_code == 401
