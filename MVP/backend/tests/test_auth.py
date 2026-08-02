from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.models import Role
from app.security import require_roles


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
