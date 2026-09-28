"""Every API response carries defensive headers.

The API only ever returns JSON, so its CSP is the strictest there is: nothing
may load, nothing may frame it. HSTS is sent in production only -- local
development runs over plain http. The interactive docs, which exist only
outside production, keep a policy that lets them load.
"""
import pytest
from app.config import get_settings


def test_api_responses_carry_the_hardening_headers(client):
    test_client, _ = client
    response = test_client.get("/health")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
    csp = response.headers["Content-Security-Policy"]
    assert "default-src 'none'" in csp
    assert "frame-ancestors 'none'" in csp
    assert "camera=()" in response.headers["Permissions-Policy"]
    assert response.headers["Cross-Origin-Opener-Policy"] == "same-origin"


def test_error_responses_are_hardened_too(client):
    test_client, _ = client
    response = test_client.get("/api/v1/listings/999999")
    assert response.status_code == 404
    assert "default-src 'none'" in response.headers["Content-Security-Policy"]


def test_no_hsts_outside_production(client):
    test_client, _ = client
    assert "Strict-Transport-Security" not in test_client.get("/health").headers


@pytest.fixture
def production(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("SECRET_KEY", "x9" * 32)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_hsts_in_production(client, production):
    test_client, _ = client
    hsts = test_client.get("/health").headers["Strict-Transport-Security"]
    assert "max-age=63072000" in hsts
    assert "includeSubDomains" in hsts


def test_docs_still_load_in_development(client):
    test_client, _ = client
    response = test_client.get("/docs")
    assert response.status_code == 200
    assert "default-src 'none'" not in response.headers.get("Content-Security-Policy", "")
