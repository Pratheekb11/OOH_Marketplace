"""Test infrastructure deliberately uses a fresh database per scenario.

Tests interact only through the public HTTP API except where a diagram requires
an external lifecycle event (a booked campaign becoming active).
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app, limiter


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(engine)

    def override_db():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    previous_enabled = limiter.enabled
    limiter.enabled = False
    with TestClient(app) as test_client:
        yield test_client, session_factory
    limiter.enabled = previous_enabled
    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)


def register(client, email, role):
    response = client.post("/api/v1/auth/register", json={"email": email, "full_name": role.title(), "password": "secure-password-123", "role": role})
    assert response.status_code == 201, response.text
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "secure-password-123"})
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


@pytest.fixture
def actors(client):
    test_client, session_factory = client
    return {
        "client": test_client,
        "session_factory": session_factory,
        "advertiser": register(test_client, "advertiser@example.com", "advertiser"),
        "second_advertiser": register(test_client, "second@example.com", "advertiser"),
        "owner": register(test_client, "owner@example.com", "owner"),
        "admin": register(test_client, "admin@example.com", "admin"),
    }
