"""make listing dimensions optional

Real OOH inventory does not always publish a physical size: bus shelters are
sold by a Small/Medium/Large bucket with no dimensions quoted. Requiring
width/height kept over half a scraped city catalogue out of the marketplace.

SQLite cannot ALTER a column's nullability, so this goes through Alembic's
batch mode (table rebuild).
"""
revision = 'a4d9c1b2f883'
down_revision = '1152e615efe4'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    with op.batch_alter_table('listings') as batch:
        batch.alter_column('width_ft', existing_type=sa.Float(), nullable=True)
        batch.alter_column('height_ft', existing_type=sa.Float(), nullable=True)


def downgrade() -> None:
    # Rows without a size cannot satisfy NOT NULL; drop them rather than
    # inventing dimensions for them.
    op.execute("DELETE FROM listings WHERE width_ft IS NULL OR height_ft IS NULL")
    with op.batch_alter_table('listings') as batch:
        batch.alter_column('width_ft', existing_type=sa.Float(), nullable=False)
        batch.alter_column('height_ft', existing_type=sa.Float(), nullable=False)
