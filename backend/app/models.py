import enum
from datetime import datetime
from sqlalchemy import Date, DateTime, Enum, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Role(str, enum.Enum):
    advertiser = "advertiser"
    owner = "owner"
    admin = "admin"


class ListingStatus(str, enum.Enum):
    pending = "pending_approval"
    active = "active"
    rejected = "rejected"
    paused = "paused"


class BookingStatus(str, enum.Enum):
    pending = "pending_payment"
    booked = "booked"
    active = "active"
    cancelled = "cancelled"


class PaymentStatus(str, enum.Enum):
    created = "created"
    paid = "paid"
    failed = "failed"


class JobStatus(str, enum.Enum):
    unassigned = "unassigned"
    scheduled = "scheduled"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class Timestamped:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class User(Timestamped, Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(Enum(Role), default=Role.advertiser)
    gstin: Mapped[str | None] = mapped_column(String(30), nullable=True)
    kyc_status: Mapped[str] = mapped_column(String(30), default="not_required")


class Listing(Timestamped, Base):
    __tablename__ = "listings"
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(180))
    space_type: Mapped[str] = mapped_column(String(50))
    description: Mapped[str] = mapped_column(Text, default="")
    location: Mapped[str] = mapped_column(String(255))
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    width_ft: Mapped[float] = mapped_column(Float)
    height_ft: Mapped[float] = mapped_column(Float)
    price_per_day: Mapped[float] = mapped_column(Float)
    footfall_estimate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Denormalised out of `location` so the marketplace can filter on them.
    city: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    illumination: Mapped[str | None] = mapped_column(String(30), nullable=True, index=True)
    status: Mapped[ListingStatus] = mapped_column(Enum(ListingStatus), default=ListingStatus.pending)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)


class Booking(Timestamped, Base):
    __tablename__ = "bookings"
    id: Mapped[int] = mapped_column(primary_key=True)
    listing_id: Mapped[int] = mapped_column(ForeignKey("listings.id"), index=True)
    advertiser_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    start_date: Mapped[datetime] = mapped_column(Date)
    end_date: Mapped[datetime] = mapped_column(Date)
    base_amount: Mapped[float] = mapped_column(Float)
    vas_amount: Mapped[float] = mapped_column(Float, default=0)
    vas_services: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    gst_amount: Mapped[float] = mapped_column(Float)
    total_amount: Mapped[float] = mapped_column(Float)
    status: Mapped[BookingStatus] = mapped_column(Enum(BookingStatus), default=BookingStatus.pending)


class VASOrder(Timestamped, Base):
    __tablename__ = "vas_orders"
    id: Mapped[int] = mapped_column(primary_key=True)
    advertiser_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    booking_id: Mapped[int | None] = mapped_column(ForeignKey("bookings.id"), nullable=True, index=True)
    own_space_details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    services: Mapped[dict] = mapped_column(JSON)
    subtotal: Mapped[float] = mapped_column(Float)
    gst_amount: Mapped[float] = mapped_column(Float)
    total_amount: Mapped[float] = mapped_column(Float)
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.unassigned)
    assigned_to: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    scheduled_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)


class Payment(Timestamped, Base):
    __tablename__ = "payments"
    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int | None] = mapped_column(ForeignKey("bookings.id"), nullable=True)
    vas_order_id: Mapped[int | None] = mapped_column(ForeignKey("vas_orders.id"), nullable=True)
    amount: Mapped[float] = mapped_column(Float)
    status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus), default=PaymentStatus.created)
    provider_order_id: Mapped[str] = mapped_column(String(100), unique=True)


class Notification(Timestamped, Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    event_type: Mapped[str] = mapped_column(String(80))
    message: Mapped[str] = mapped_column(Text)
    read: Mapped[bool] = mapped_column(default=False)


class Invoice(Timestamped, Base):
    __tablename__ = "invoices"
    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    booking_id: Mapped[int | None] = mapped_column(ForeignKey("bookings.id"), nullable=True)
    vas_order_id: Mapped[int | None] = mapped_column(ForeignKey("vas_orders.id"), nullable=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    amount: Mapped[float] = mapped_column(Float)
    gst_amount: Mapped[float] = mapped_column(Float)
    document_key: Mapped[str | None] = mapped_column(String(500), nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(120), index=True)
    entity_type: Mapped[str] = mapped_column(String(60))
    entity_id: Mapped[str] = mapped_column(String(60))
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ScrapedListing(Timestamped, Base):
    """Provenance for listings ingested from an external site.

    Kept alongside `listings` rather than as columns on it so scraper concerns
    never leak into the marketplace schema. `source_url` is unique, which is
    what makes re-running an import idempotent.
    """
    __tablename__ = "scraped_listings"
    id: Mapped[int] = mapped_column(primary_key=True)
    listing_id: Mapped[int | None] = mapped_column(ForeignKey("listings.id"), nullable=True, index=True)
    source_site: Mapped[str] = mapped_column(String(120), index=True)
    source_url: Mapped[str] = mapped_column(String(700), unique=True)
    source_id: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    scraped_at: Mapped[datetime] = mapped_column(DateTime)
    image_keys: Mapped[list | None] = mapped_column(JSON, nullable=True)
    payload: Mapped[dict] = mapped_column(JSON)


class ListingDocument(Timestamped, Base):
    __tablename__ = "listing_documents"
    id: Mapped[int] = mapped_column(primary_key=True)
    listing_id: Mapped[int] = mapped_column(ForeignKey("listings.id"), index=True)
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    original_name: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))
    storage_key: Mapped[str] = mapped_column(String(500), unique=True)
