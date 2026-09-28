"""add leads

Call-back requests from the site's contact CTAs (Request Proposal, Service
Quotation, ...). `crm_status` is "pending" until a CRM sync pushes the row.
"""
revision = 'e5c3a8f10b72'
down_revision = 'd2b7e4a91c05'
branch_labels = None
depends_on = None

import sqlalchemy as sa
from alembic import op


def upgrade() -> None:
    op.create_table(
        'leads',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('phone', sa.String(length=30), nullable=False),
        sa.Column('reason', sa.String(length=500), nullable=False),
        sa.Column('source', sa.String(length=255), nullable=True),
        sa.Column('listing_id', sa.Integer(), sa.ForeignKey('listings.id'), nullable=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('crm_status', sa.String(length=20), nullable=False),
        sa.Column('crm_ref', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_leads_listing_id', 'leads', ['listing_id'])
    op.create_index('ix_leads_user_id', 'leads', ['user_id'])
    op.create_index('ix_leads_crm_status', 'leads', ['crm_status'])


def downgrade() -> None:
    op.drop_index('ix_leads_crm_status', table_name='leads')
    op.drop_index('ix_leads_user_id', table_name='leads')
    op.drop_index('ix_leads_listing_id', table_name='leads')
    op.drop_table('leads')
