"""sign in with Google

Google-only accounts have no password, so `users.password_hash` becomes
nullable, and `users.google_sub` holds Google's stable subject id so a
returning user is found even if their Google email changes.

SQLite cannot ALTER a column's nullability, so this goes through Alembic's
batch mode (table rebuild).
"""
revision = 'f3a6b9d2c418'
down_revision = 'e5c3a8f10b72'
branch_labels = None
depends_on = None

import sqlalchemy as sa
from alembic import op


def upgrade() -> None:
    with op.batch_alter_table('users') as batch:
        batch.alter_column('password_hash', existing_type=sa.String(length=255), nullable=True)
        batch.add_column(sa.Column('google_sub', sa.String(length=255), nullable=True))
        batch.create_index('ix_users_google_sub', ['google_sub'], unique=True)


def downgrade() -> None:
    # A Google-only account cannot satisfy NOT NULL. "!" is not a hash passlib
    # recognises, so it can never match a password -- the same placeholder the
    # scraper's synthetic owner uses.
    op.execute("UPDATE users SET password_hash = '!' WHERE password_hash IS NULL")
    with op.batch_alter_table('users') as batch:
        batch.drop_index('ix_users_google_sub')
        batch.drop_column('google_sub')
        batch.alter_column('password_hash', existing_type=sa.String(length=255), nullable=False)
