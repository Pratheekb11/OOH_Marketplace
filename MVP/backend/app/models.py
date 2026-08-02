import enum
from datetime import date, datetime
from sqlalchemy import Date, DateTime, Enum, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
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
    archived = "archived"


class BookingStatus(str, enum.Enum):
    pending = "pending_payment"
    booked = "booked"
    active = "active"
    cancelled = "cancelled"


class PaymentStatus(str, enum.Enum):
    created = "created"
    paid = "paid"
    failed = "failed"


class Timestamped:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class User(Timestamped, Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(Enum(Role, native_enum=False, length=30), default=Role.advertiser)


class Listing(Timestamped, Base):
    __tablename__ = "listings"
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(180))
    space_type: Mapped[str] = mapped_column(String(50))
    description: Mapped[str] = mapped_column(Text, default="")
    location: Mapped[str] = mapped_column(String(255))
    # Nullable: real OOH inventory does not always publish a physical size.
    # Bus shelters in particular are sold by a Small/Medium/Large bucket
    # (kept in `extra.size_bucket`) with no dimensions quoted anywhere.
    width_ft: Mapped[float | None] = mapped_column(Float, nullable=True)
    height_ft: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_per_day: Mapped[float] = mapped_column(Float)
    footfall_estimate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[ListingStatus] = mapped_column(Enum(ListingStatus, native_enum=False, length=30), default=ListingStatus.active)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    lighting: Mapped[str | None] = mapped_column(String(20), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    extra: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class CartItem(Timestamped, Base):
    __tablename__ = "cart_items"
    __table_args__ = (UniqueConstraint("user_id", "listing_id", "start_date", "end_date", name="uq_cart_item_slot"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    listing_id: Mapped[int] = mapped_column(ForeignKey("listings.id"), index=True)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    addons: Mapped[list | None] = mapped_column(JSON, nullable=True, default=list)


class Booking(Timestamped, Base):
    __tablename__ = "bookings"
    id: Mapped[int] = mapped_column(primary_key=True)
    listing_id: Mapped[int] = mapped_column(ForeignKey("listings.id"), index=True)
    advertiser_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    base_amount: Mapped[float] = mapped_column(Float)
    addons_amount: Mapped[float] = mapped_column(Float, default=0)
    addons: Mapped[list | None] = mapped_column(JSON, nullable=True)
    gst_amount: Mapped[float] = mapped_column(Float)
    total_amount: Mapped[float] = mapped_column(Float)
    status: Mapped[BookingStatus] = mapped_column(Enum(BookingStatus, native_enum=False, length=30), default=BookingStatus.booked)


class Payment(Timestamped, Base):
    __tablename__ = "payments"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    booking_ids: Mapped[list] = mapped_column(JSON)
    amount: Mapped[float] = mapped_column(Float)
    status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus, native_enum=False, length=30), default=PaymentStatus.created)
    provider_order_id: Mapped[str] = mapped_column(String(100), unique=True)
    method_label: Mapped[str] = mapped_column(String(40), default="Dummy Card")
