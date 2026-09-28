"""Verify Google Identity Services ID tokens.

The browser gets a Google-signed JWT (the "credential") from the Sign in with
Google button and hands it to POST /api/v1/auth/google. It is checked here
against Google's published signing keys -- no client secret, no call to
Google's tokeninfo endpoint, and no extra dependency beyond python-jose,
which already signs our own tokens.
"""
import time
from typing import NamedTuple

import httpx
from jose import JWTError, jwt

GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = ("accounts.google.com", "https://accounts.google.com")

# Google rotates these keys every few days and advertises a Cache-Control
# max-age; an hour is well inside that and keeps warm serverless instances
# from fetching them on every sign-in.
_JWKS_TTL_SECONDS = 3600
_jwks_cache: dict = {"keys": None, "fetched_at": 0.0}


class InvalidGoogleToken(Exception):
    pass


class GoogleIdentity(NamedTuple):
    sub: str
    email: str
    name: str


def fetch_google_jwks() -> dict:
    now = time.monotonic()
    if _jwks_cache["keys"] is None or now - _jwks_cache["fetched_at"] > _JWKS_TTL_SECONDS:
        response = httpx.get(GOOGLE_CERTS_URL, timeout=5.0)
        response.raise_for_status()
        _jwks_cache["keys"] = response.json()
        _jwks_cache["fetched_at"] = now
    return _jwks_cache["keys"]


def verify_google_credential(credential: str, client_id: str) -> GoogleIdentity:
    """Return who the token says signed in, or raise InvalidGoogleToken.

    Only a verified email is trusted: accounts are linked by email, so an
    unverified one would let anyone claim an existing account.
    """
    try:
        claims = jwt.decode(
            credential,
            fetch_google_jwks(),
            algorithms=["RS256"],
            audience=client_id,
            issuer=GOOGLE_ISSUERS,
            # GIS ID tokens are issued without an access token to hash against.
            options={"verify_at_hash": False},
        )
    except (JWTError, httpx.HTTPError, ValueError) as exc:
        raise InvalidGoogleToken(str(exc)) from exc

    email = claims.get("email")
    sub = claims.get("sub")
    if not email or not sub or claims.get("email_verified") is not True:
        raise InvalidGoogleToken("Google did not vouch for this email address")
    name = (claims.get("name") or email.split("@")[0]).strip()
    return GoogleIdentity(sub=str(sub), email=email.lower(), name=name[:120])
