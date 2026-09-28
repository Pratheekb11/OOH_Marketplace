from types import SimpleNamespace

import pytest
from app.models import Role
from app.security import require_roles
from fastapi import HTTPException


def test_health_returns_ok_with_security_headers(client):
    test_client, _ = client
    response = test_client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "adspace-mvp-api"}
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"


def test_register_returns_201(client):
    test_client, _ = client
    response = test_client.post("/api/v1/auth/register", json={"email": "new@example.com", "full_name": "New User", "password": "secure-password-123", "role": "advertiser"})
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["email"] == "new@example.com"
    assert body["role"] == "advertiser"
    assert "password" not in body
    assert "password_hash" not in body


def test_register_duplicate_email_is_rejected(client):
    test_client, _ = client
    payload = {"email": "dup@example.com", "full_name": "Dup User", "password": "secure-password-123", "role": "advertiser"}
    first = test_client.post("/api/v1/auth/register", json=payload)
    assert first.status_code == 201, first.text
    second = test_client.post("/api/v1/auth/register", json=payload)
    assert second.status_code == 400


def test_login_returns_bearer_token(client):
    test_client, _ = client
    test_client.post("/api/v1/auth/register", json={"email": "login@example.com", "full_name": "Login User", "password": "secure-password-123", "role": "advertiser"})
    response = test_client.post("/api/v1/auth/login", json={"email": "login@example.com", "password": "secure-password-123"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]


def test_me_round_trips(client):
    test_client, _ = client
    test_client.post("/api/v1/auth/register", json={"email": "me@example.com", "full_name": "Me User", "password": "secure-password-123", "role": "owner"})
    login = test_client.post("/api/v1/auth/login", json={"email": "me@example.com", "password": "secure-password-123"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = test_client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["email"] == "me@example.com"
    assert body["full_name"] == "Me User"
    assert body["role"] == "owner"


def test_me_with_garbage_token_is_401(client):
    test_client, _ = client
    response = test_client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert response.status_code == 401


def test_role_guard_rejects_wrong_role():
    guard = require_roles(Role.owner)
    advertiser = SimpleNamespace(role=Role.advertiser)
    with pytest.raises(HTTPException) as exc_info:
        guard(user=advertiser)
    assert exc_info.value.status_code == 403

    owner = SimpleNamespace(role=Role.owner)
    assert guard(user=owner) is owner


def test_role_guard_lets_admin_through_every_gate():
    """Admin is a superset of both product roles, so one account can work the
    owner surfaces and the advertiser surfaces without two logins."""
    admin = SimpleNamespace(role=Role.admin)
    for guard in (require_roles(Role.owner), require_roles(Role.advertiser)):
        assert guard(user=admin) is admin


def _password_headers(client, email):
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "secure-password-123"})
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_change_password_rotates_the_credential(actors):
    client = actors["client"]
    response = client.post("/api/v1/auth/password", json={
        "current_password": "secure-password-123", "new_password": "rotated-password-456",
    }, headers=actors["advertiser"])
    assert response.status_code == 200, response.text

    # The returned token works straight away, without a re-login round trip.
    fresh = {"Authorization": f"Bearer {response.json()['access_token']}"}
    assert client.get("/api/v1/auth/me", headers=fresh).status_code == 200

    assert client.post("/api/v1/auth/login", json={
        "email": "advertiser@example.com", "password": "rotated-password-456",
    }).status_code == 200
    assert client.post("/api/v1/auth/login", json={
        "email": "advertiser@example.com", "password": "secure-password-123",
    }).status_code == 401


def test_change_password_requires_the_current_one(actors):
    """A stolen bearer token alone must not be enough to seize the account."""
    client = actors["client"]
    response = client.post("/api/v1/auth/password", json={
        "current_password": "not-the-password", "new_password": "rotated-password-456",
    }, headers=actors["advertiser"])
    assert response.status_code == 401
    # The old credential still works -- nothing was written.
    assert client.post("/api/v1/auth/login", json={
        "email": "advertiser@example.com", "password": "secure-password-123",
    }).status_code == 200


def test_change_password_rejects_unauthenticated_and_weak_input(actors):
    client = actors["client"]
    assert client.post("/api/v1/auth/password", json={
        "current_password": "secure-password-123", "new_password": "rotated-password-456",
    }).status_code == 401  # no bearer token at all

    for bad in ("short7c", "secure-password-123"):  # under 8 chars; unchanged from current
        assert client.post("/api/v1/auth/password", json={
            "current_password": "secure-password-123", "new_password": bad,
        }, headers=actors["advertiser"]).status_code == 422


def test_change_password_only_ever_touches_the_caller(actors):
    """Even an admin cannot aim this at another account -- there is no target field."""
    client = actors["client"]
    assert client.post("/api/v1/auth/password", json={
        "current_password": "secure-password-123", "new_password": "rotated-password-456",
    }, headers=actors["admin"]).status_code == 200
    # The owner's credential is untouched by the admin's rotation.
    assert client.post("/api/v1/auth/login", json={
        "email": "owner@example.com", "password": "secure-password-123",
    }).status_code == 200
