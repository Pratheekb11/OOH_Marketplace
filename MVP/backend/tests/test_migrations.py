"""The migration chain must run end to end on SQLite.

Migration c7f1a9d4e210 adds a Postgres EXCLUDE constraint (and the btree_gist
extension it needs). Neither exists on SQLite, so that migration branches on the
dialect and does nothing there. This test is what keeps that branch honest: a
local `alembic upgrade head` against SQLite is the first thing every developer
runs, and it must not blow up on Postgres-only DDL.
"""
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

from app.config import get_settings

BACKEND_ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def alembic_config(tmp_path, monkeypatch):
    db_path = tmp_path / "migration_check.db"
    url = f"sqlite:///{db_path}"
    # alembic/env.py takes its URL from get_settings(), not from the Config, and
    # get_settings is lru_cached -- so the cache has to be dropped both before
    # and after, or this test would run against (and then tear down) whatever
    # DATABASE_URL the developer's .env points at.
    monkeypatch.setenv("DATABASE_URL", url)
    get_settings.cache_clear()
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    config.set_main_option("sqlalchemy.url", url)
    try:
        yield config, url
    finally:
        get_settings.cache_clear()


def test_upgrade_head_then_downgrade_base_on_sqlite(alembic_config):
    config, url = alembic_config

    command.upgrade(config, "head")
    tables = set(inspect(create_engine(url)).get_table_names())
    assert {"users", "listings", "cart_items", "bookings", "payments"} <= tables

    # The Postgres-only migration must also be reversible from SQLite, where it
    # has nothing to undo.
    command.downgrade(config, "base")
    remaining = set(inspect(create_engine(url)).get_table_names())
    assert "bookings" not in remaining
