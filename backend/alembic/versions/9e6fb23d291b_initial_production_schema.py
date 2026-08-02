"""initial production schema"""
from alembic import op
import sqlalchemy as sa

revision = "9e6fb23d291b"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("users", sa.Column("id", sa.Integer, primary_key=True), sa.Column("email", sa.String(255), nullable=False, unique=True), sa.Column("full_name", sa.String(120), nullable=False), sa.Column("password_hash", sa.String(255), nullable=False), sa.Column("role", sa.String(20), nullable=False), sa.Column("gstin", sa.String(30)), sa.Column("kyc_status", sa.String(30), nullable=False), sa.Column("created_at", sa.DateTime, nullable=False), sa.Column("updated_at", sa.DateTime, nullable=False))
    op.create_index("ix_users_email", "users", ["email"])
    op.create_table("listings", sa.Column("id", sa.Integer, primary_key=True), sa.Column("owner_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False), sa.Column("title", sa.String(180), nullable=False), sa.Column("space_type", sa.String(50), nullable=False), sa.Column("description", sa.Text, nullable=False), sa.Column("location", sa.String(255), nullable=False), sa.Column("latitude", sa.Float), sa.Column("longitude", sa.Float), sa.Column("width_ft", sa.Float, nullable=False), sa.Column("height_ft", sa.Float, nullable=False), sa.Column("price_per_day", sa.Float, nullable=False), sa.Column("footfall_estimate", sa.Integer), sa.Column("status", sa.String(30), nullable=False), sa.Column("rejection_reason", sa.Text), sa.Column("created_at", sa.DateTime, nullable=False), sa.Column("updated_at", sa.DateTime, nullable=False))
    op.create_index("ix_listings_owner_id", "listings", ["owner_id"])
    op.create_table("bookings", sa.Column("id", sa.Integer, primary_key=True), sa.Column("listing_id", sa.Integer, sa.ForeignKey("listings.id"), nullable=False), sa.Column("advertiser_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False), sa.Column("start_date", sa.Date, nullable=False), sa.Column("end_date", sa.Date, nullable=False), sa.Column("base_amount", sa.Float, nullable=False), sa.Column("vas_amount", sa.Float, nullable=False), sa.Column("vas_services", sa.JSON), sa.Column("gst_amount", sa.Float, nullable=False), sa.Column("total_amount", sa.Float, nullable=False), sa.Column("status", sa.String(30), nullable=False), sa.Column("created_at", sa.DateTime, nullable=False), sa.Column("updated_at", sa.DateTime, nullable=False))
    op.create_index("ix_bookings_listing_id", "bookings", ["listing_id"]); op.create_index("ix_bookings_advertiser_id", "bookings", ["advertiser_id"])
    op.create_table("vas_orders", sa.Column("id", sa.Integer, primary_key=True), sa.Column("advertiser_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False), sa.Column("booking_id", sa.Integer, sa.ForeignKey("bookings.id")), sa.Column("own_space_details", sa.JSON), sa.Column("services", sa.JSON, nullable=False), sa.Column("subtotal", sa.Float, nullable=False), sa.Column("gst_amount", sa.Float, nullable=False), sa.Column("total_amount", sa.Float, nullable=False), sa.Column("status", sa.String(30), nullable=False), sa.Column("assigned_to", sa.Integer, sa.ForeignKey("users.id")), sa.Column("scheduled_date", sa.Date), sa.Column("created_at", sa.DateTime, nullable=False), sa.Column("updated_at", sa.DateTime, nullable=False))
    op.create_index("ix_vas_orders_advertiser_id", "vas_orders", ["advertiser_id"]); op.create_index("ix_vas_orders_booking_id", "vas_orders", ["booking_id"])
    op.create_table("payments", sa.Column("id", sa.Integer, primary_key=True), sa.Column("booking_id", sa.Integer, sa.ForeignKey("bookings.id")), sa.Column("vas_order_id", sa.Integer, sa.ForeignKey("vas_orders.id")), sa.Column("amount", sa.Float, nullable=False), sa.Column("status", sa.String(30), nullable=False), sa.Column("provider_order_id", sa.String(100), nullable=False, unique=True), sa.Column("created_at", sa.DateTime, nullable=False), sa.Column("updated_at", sa.DateTime, nullable=False))
    op.create_table("notifications", sa.Column("id", sa.Integer, primary_key=True), sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False), sa.Column("event_type", sa.String(80), nullable=False), sa.Column("message", sa.Text, nullable=False), sa.Column("read", sa.Boolean, nullable=False), sa.Column("created_at", sa.DateTime, nullable=False), sa.Column("updated_at", sa.DateTime, nullable=False))
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_table("audit_logs", sa.Column("id", sa.Integer, primary_key=True), sa.Column("actor_id", sa.Integer, sa.ForeignKey("users.id")), sa.Column("action", sa.String(120), nullable=False), sa.Column("entity_type", sa.String(60), nullable=False), sa.Column("entity_id", sa.String(60), nullable=False), sa.Column("details", sa.JSON), sa.Column("created_at", sa.DateTime, nullable=False))
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"]); op.create_index("ix_audit_logs_actor_id", "audit_logs", ["actor_id"])
    op.create_table("listing_documents", sa.Column("id", sa.Integer, primary_key=True), sa.Column("listing_id", sa.Integer, sa.ForeignKey("listings.id"), nullable=False), sa.Column("uploaded_by", sa.Integer, sa.ForeignKey("users.id"), nullable=False), sa.Column("original_name", sa.String(255), nullable=False), sa.Column("content_type", sa.String(100), nullable=False), sa.Column("storage_key", sa.String(500), nullable=False, unique=True), sa.Column("created_at", sa.DateTime, nullable=False), sa.Column("updated_at", sa.DateTime, nullable=False))
    op.create_index("ix_listing_documents_listing_id", "listing_documents", ["listing_id"])
    op.create_table("invoices", sa.Column("id", sa.Integer, primary_key=True), sa.Column("invoice_number", sa.String(50), nullable=False, unique=True), sa.Column("booking_id", sa.Integer, sa.ForeignKey("bookings.id")), sa.Column("vas_order_id", sa.Integer, sa.ForeignKey("vas_orders.id")), sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False), sa.Column("amount", sa.Float, nullable=False), sa.Column("gst_amount", sa.Float, nullable=False), sa.Column("document_key", sa.String(500)), sa.Column("created_at", sa.DateTime, nullable=False), sa.Column("updated_at", sa.DateTime, nullable=False))
    op.create_index("ix_invoices_invoice_number", "invoices", ["invoice_number"]); op.create_index("ix_invoices_user_id", "invoices", ["user_id"])


def downgrade() -> None:
    for table in ["invoices", "listing_documents", "audit_logs", "notifications", "payments", "vas_orders", "bookings", "listings", "users"]:
        op.drop_table(table)
