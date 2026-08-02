"""Minimal regression test; run after `alembic upgrade head` against a test database."""
from fastapi.testclient import TestClient
from app.main import app


def test_health_sets_security_headers():
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.headers["x-content-type-options"] == "nosniff"
