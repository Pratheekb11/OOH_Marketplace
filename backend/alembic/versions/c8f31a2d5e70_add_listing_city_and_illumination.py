"""add listing city and illumination

Both are filterable facets on the marketplace browse page. They are
denormalised out of `location`/source data rather than derived at query time so
the listing grid can index them.
"""
revision = 'c8f31a2d5e70'
down_revision = 'b71020ffbb64'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    op.add_column('listings', sa.Column('city', sa.String(length=120), nullable=True))
    op.add_column('listings', sa.Column('illumination', sa.String(length=30), nullable=True))
    op.create_index(op.f('ix_listings_city'), 'listings', ['city'], unique=False)
    op.create_index(op.f('ix_listings_illumination'), 'listings', ['illumination'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_listings_illumination'), table_name='listings')
    op.drop_index(op.f('ix_listings_city'), table_name='listings')
    op.drop_column('listings', 'illumination')
    op.drop_column('listings', 'city')
