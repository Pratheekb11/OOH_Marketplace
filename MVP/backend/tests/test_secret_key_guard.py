"""Production must refuse to boot with a guessable SECRET_KEY.

Every bearer token is an HS256 JWT signed with it. A default or example key
lets anyone mint a token for any user id, admins included -- so a missing or
copied-from-the-docs key is a startup error, not a warning.
"""
import secrets

import pytest
from app.config import Settings
from pydantic import ValidationError

KNOWN_WEAK = [
    "change-me-in-production",                               # the code default
    "dev-only-secret-key-change-me-please-32chars",          # .env.example
    "generate-a-long-random-secret-at-least-32-characters",  # docs example
    "short-but-random-9f2k",                                 # under 32 chars
    "a" * 40,                                                # long but one character
]


@pytest.mark.parametrize("key", KNOWN_WEAK)
def test_production_refuses_a_weak_secret_key(key):
    with pytest.raises(ValidationError, match="SECRET_KEY"):
        Settings(_env_file=None, app_env="production", secret_key=key)


def test_production_refuses_the_default_when_nothing_is_set(monkeypatch):
    monkeypatch.delenv("SECRET_KEY", raising=False)
    with pytest.raises(ValidationError, match="SECRET_KEY"):
        Settings(_env_file=None, app_env="production")


def test_app_env_is_matched_whatever_the_case():
    with pytest.raises(ValidationError, match="SECRET_KEY"):
        Settings(_env_file=None, app_env="Production", secret_key="change-me-in-production")


def test_production_accepts_a_random_key():
    key = secrets.token_hex(32)
    assert Settings(_env_file=None, app_env="production", secret_key=key).secret_key == key


def test_development_keeps_working_with_the_default():
    assert Settings(_env_file=None, app_env="development").secret_key
