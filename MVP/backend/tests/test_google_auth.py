"""Sign in / sign up with Google.

The browser gets an ID token from Google Identity Services and posts it to
POST /api/v1/auth/google. The API verifies it against Google's published keys
and answers with the same bearer token /auth/login hands out.

Google is never called: these tests sign their own ID tokens with a throwaway
RSA key and serve its public half in place of Google's JWKS. That keeps the
real verification path (signature, audience, issuer, expiry) under test.
"""
import time

import pytest
from app import google_auth
from app.config import get_settings
from app.models import User
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from jose import jwk, jwt
from sqlalchemy import select

CLIENT_ID = "test-client.apps.googleusercontent.com"
KID = "test-key-1"


def _keypair():
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
    ).decode()
    public_pem = private.public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode()
    public_jwk = jwk.construct(public_pem, algorithm="RS256").to_dict()
    public_jwk.update({"kid": KID, "use": "sig", "alg": "RS256"})
    return private_pem, {"keys": [public_jwk]}


PRIVATE_PEM, JWKS = _keypair()
OTHER_PRIVATE_PEM, _ = _keypair()


def id_token(key=PRIVATE_PEM, **overrides):
    now = int(time.time())
    claims = {
        "iss": "https://accounts.google.com",
        "aud": CLIENT_ID,
        "sub": "google-sub-123",
        "email": "asha@example.com",
        "email_verified": True,
        "name": "Asha Rao",
        "iat": now,
        "exp": now + 600,
    }
    claims.update(overrides)
    claims = {k: v for k, v in claims.items() if v is not None}
    return jwt.encode(claims, key, algorithm="RS256", headers={"kid": KID})


@pytest.fixture
def google(client, monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", CLIENT_ID)
    get_settings.cache_clear()
    monkeypatch.setattr(google_auth, "fetch_google_jwks", lambda: JWKS)
    yield client
    get_settings.cache_clear()


def post(test_client, credential, role=None):
    body = {"credential": credential}
    if role is not None:
        body["role"] = role
    return test_client.post("/api/v1/auth/google", json=body)


def me(test_client, token):
    return test_client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})


def test_new_google_user_without_role_is_asked_to_choose_one(google):
    test_client, session_factory = google
    response = post(test_client, id_token())
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["needs_role"] is True
    assert body["access_token"] is None
    assert body["email"] == "asha@example.com"
    assert body["full_name"] == "Asha Rao"
    with session_factory() as db:
        assert db.scalar(select(User).where(User.email == "asha@example.com")) is None


@pytest.mark.parametrize("role", ["advertiser", "owner"])
def test_new_google_user_with_role_is_created_and_signed_in(google, role):
    test_client, session_factory = google
    response = post(test_client, id_token(), role=role)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["needs_role"] is False
    assert body["token_type"] == "bearer"
    profile = me(test_client, body["access_token"])
    assert profile.status_code == 200, profile.text
    assert profile.json()["email"] == "asha@example.com"
    assert profile.json()["full_name"] == "Asha Rao"
    assert profile.json()["role"] == role
    with session_factory() as db:
        user = db.scalar(select(User).where(User.email == "asha@example.com"))
        assert user.google_sub == "google-sub-123"
        assert user.password_hash is None


def test_admin_cannot_be_created_through_google(google):
    test_client, session_factory = google
    response = post(test_client, id_token(), role="admin")
    assert response.status_code == 422
    with session_factory() as db:
        assert db.scalar(select(User).where(User.email == "asha@example.com")) is None


def test_returning_google_user_signs_in_and_keeps_their_role(google):
    test_client, _ = google
    first = post(test_client, id_token(), role="owner")
    assert first.status_code == 200, first.text
    # A role sent on a later sign-in (e.g. the toggle on /register) never
    # changes an existing account's role.
    again = post(test_client, id_token(), role="advertiser")
    assert again.status_code == 200, again.text
    assert again.json()["needs_role"] is False
    assert me(test_client, again.json()["access_token"]).json()["role"] == "owner"


def test_google_email_matching_a_password_account_links_to_it(google):
    """Registration never proves the email, so whoever set that password may not
    own the inbox. Google does prove it: linking takes the account over for the
    verified owner, drops the unproven password and ends its sessions."""
    test_client, session_factory = google
    registered = test_client.post(
        "/api/v1/auth/register",
        json={"email": "asha@example.com", "full_name": "Asha R", "password": "secure-password-123", "role": "owner"},
    )
    assert registered.status_code == 201, registered.text
    password_token = test_client.post(
        "/api/v1/auth/login", json={"email": "asha@example.com", "password": "secure-password-123"},
    ).json()["access_token"]
    response = post(test_client, id_token())
    assert response.status_code == 200, response.text
    assert response.json()["needs_role"] is False
    profile = me(test_client, response.json()["access_token"]).json()
    assert profile["id"] == registered.json()["id"]
    assert profile["role"] == "owner"
    # The pre-set password no longer opens the account, and a token issued
    # against it is dead: an attacker who registered the victim's email first
    # is locked out the moment the real owner signs in with Google.
    login = test_client.post("/api/v1/auth/login", json={"email": "asha@example.com", "password": "secure-password-123"})
    assert login.status_code == 401, login.text
    assert me(test_client, password_token).status_code == 401
    with session_factory() as db:
        user = db.scalar(select(User).where(User.email == "asha@example.com"))
        assert user.google_sub == "google-sub-123"
        assert user.password_hash is None


def test_email_is_matched_case_insensitively(google):
    test_client, _ = google
    registered = test_client.post(
        "/api/v1/auth/register",
        json={"email": "asha@example.com", "full_name": "Asha R", "password": "secure-password-123", "role": "owner"},
    )
    assert registered.status_code == 201, registered.text
    response = post(test_client, id_token(email="Asha@Example.com"))
    assert response.status_code == 200, response.text
    assert me(test_client, response.json()["access_token"]).json()["id"] == registered.json()["id"]


def test_password_login_is_refused_for_a_google_only_account(google):
    test_client, _ = google
    assert post(test_client, id_token(), role="advertiser").status_code == 200
    for password in ["", "!", "anything-at-all"]:
        response = test_client.post("/api/v1/auth/login", json={"email": "asha@example.com", "password": password})
        assert response.status_code == 401


def test_password_change_is_refused_for_a_google_only_account(google):
    test_client, _ = google
    token = post(test_client, id_token(), role="advertiser").json()["access_token"]
    response = test_client.post(
        "/api/v1/auth/password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "", "new_password": "secure-password-456"},
    )
    assert response.status_code in (400, 401, 422)


@pytest.mark.parametrize(
    "credential",
    [
        pytest.param(lambda: id_token(aud="someone-elses-client.apps.googleusercontent.com"), id="wrong-audience"),
        pytest.param(lambda: id_token(iss="https://evil.example.com"), id="wrong-issuer"),
        pytest.param(lambda: id_token(exp=int(time.time()) - 60, iat=int(time.time()) - 700), id="expired"),
        pytest.param(lambda: id_token(key=OTHER_PRIVATE_PEM), id="not-signed-by-google"),
        pytest.param(lambda: id_token(email_verified=False), id="email-unverified"),
        pytest.param(lambda: id_token(email=None), id="no-email"),
        pytest.param(lambda: "not-a-jwt", id="garbage"),
    ],
)
def test_untrustworthy_tokens_are_rejected(google, credential):
    test_client, session_factory = google
    response = post(test_client, credential(), role="advertiser")
    assert response.status_code == 401, response.text
    with session_factory() as db:
        assert db.scalar(select(User).where(User.google_sub == "google-sub-123")) is None


def test_accounts_google_com_issuer_without_scheme_is_accepted(google):
    test_client, _ = google
    response = post(test_client, id_token(iss="accounts.google.com"), role="advertiser")
    assert response.status_code == 200, response.text


def test_google_sign_in_is_unavailable_when_not_configured(client, monkeypatch):
    test_client, _ = client
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "")
    get_settings.cache_clear()
    monkeypatch.setattr(google_auth, "fetch_google_jwks", lambda: JWKS)
    try:
        response = post(test_client, id_token(), role="advertiser")
    finally:
        get_settings.cache_clear()
    assert response.status_code == 503
