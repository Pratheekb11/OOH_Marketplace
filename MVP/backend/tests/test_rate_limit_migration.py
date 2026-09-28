"""The shared rate-limit counters need their table on every database."""
from alembic import command
from sqlalchemy import create_engine, inspect

from tests.test_migrations import alembic_config  # noqa: F401  - pytest fixture


def test_head_has_the_rate_limit_table(alembic_config):  # noqa: F811
    config, url = alembic_config
    command.upgrade(config, "head")
    columns = {column["name"] for column in inspect(create_engine(url)).get_columns("rate_limit_buckets")}
    assert {"key", "window_start", "hits"} <= columns
    command.downgrade(config, "base")
