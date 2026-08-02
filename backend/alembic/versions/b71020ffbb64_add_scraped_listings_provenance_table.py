"""add scraped_listings provenance table

Autogenerate also reported enum-type and index-uniqueness drift on users,
listings, bookings, payments, invoices and vas_orders. That divergence predates
this change and altering enum columns is not a safe side effect of adding a
table, so it is deliberately left out - it needs its own reviewed migration.
"""
revision = 'b71020ffbb64'
down_revision = '9e6fb23d291b'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    op.create_table(
        'scraped_listings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('listing_id', sa.Integer(), nullable=True),
        sa.Column('source_site', sa.String(length=120), nullable=False),
        sa.Column('source_url', sa.String(length=700), nullable=False),
        sa.Column('source_id', sa.String(length=120), nullable=True),
        sa.Column('scraped_at', sa.DateTime(), nullable=False),
        sa.Column('image_keys', sa.JSON(), nullable=True),
        sa.Column('payload', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['listing_id'], ['listings.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('source_url'),
    )
    op.create_index(op.f('ix_scraped_listings_listing_id'), 'scraped_listings', ['listing_id'], unique=False)
    op.create_index(op.f('ix_scraped_listings_source_id'), 'scraped_listings', ['source_id'], unique=False)
    op.create_index(op.f('ix_scraped_listings_source_site'), 'scraped_listings', ['source_site'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_scraped_listings_source_site'), table_name='scraped_listings')
    op.drop_index(op.f('ix_scraped_listings_source_id'), table_name='scraped_listings')
    op.drop_index(op.f('ix_scraped_listings_listing_id'), table_name='scraped_listings')
    op.drop_table('scraped_listings')
