"""rate limit buckets

Rate-limit counters used to live in each process's memory, which on Vercel
resets with every fresh function instance. This table holds them instead,
one fixed-window counter per key, so every instance sees the same count.
"""
revision = 'a9d4c2e7b813'
down_revision = 'f3a6b9d2c418'
branch_labels = None
depends_on = None

import sqlalchemy as sa
from alembic import op


def upgrade() -> None:
    op.create_table(
        'rate_limit_buckets',
        sa.Column('key', sa.String(length=255), primary_key=True),
        sa.Column('window_start', sa.Integer(), nullable=False),
        sa.Column('hits', sa.Integer(), nullable=False),
    )
    op.create_index('ix_rate_limit_buckets_window_start', 'rate_limit_buckets', ['window_start'])


def downgrade() -> None:
    op.drop_index('ix_rate_limit_buckets_window_start', table_name='rate_limit_buckets')
    op.drop_table('rate_limit_buckets')
