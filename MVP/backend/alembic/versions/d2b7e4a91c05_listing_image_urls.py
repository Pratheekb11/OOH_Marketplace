"""add listings.image_urls

A listing can have several site photographs. `image_url` stays the cover (the
card, cart and dashboards read it); `image_urls` holds every photo, cover
first. Nullable, so existing rows need no backfill: the API falls back to
`[image_url]`.
"""
revision = 'd2b7e4a91c05'
down_revision = 'c7f1a9d4e210'
branch_labels = None
depends_on = None

import sqlalchemy as sa
from alembic import op


def upgrade() -> None:
    op.add_column('listings', sa.Column('image_urls', sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('listings') as batch:
        batch.drop_column('image_urls')
