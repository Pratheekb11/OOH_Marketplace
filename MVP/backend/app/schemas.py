from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.models import BookingStatus, ListingStatus, PaymentStatus, Role
from app.pricing import ADDON_CATALOG, min_booking_days
from app.text import html_to_text


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=8, max_length=128)
    role: Role = Role.advertiser


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class PasswordChangeRequest(BaseModel):
    """Self-service password change. `current_password` is required even though the
    caller already holds a valid bearer token: a stolen token should not be enough to
    lock the real owner out of their own account."""
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)

    @model_validator(mode="after")
    def _must_differ(self):
        if self.new_password == self.current_password:
            raise ValueError("new_password must differ from current_password")
        return self


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(ORMModel):
    id: int; email: EmailStr; full_name: str; role: Role


#: Keys the scraper importer writes into `Listing.extra` for its own use:
#: provenance for re-imports, and the source's commercial terms. None of them
#: may leave the API. `minimum_billing` still shapes `min_booking_days`.
PRIVATE_EXTRA_KEYS = frozenset({"source_url", "source_site", "source_id", "card_rate", "minimum_billing", "warnings"})


def public_extra(extra: dict | None) -> dict | None:
    if extra is None:
        return None
    return {key: value for key, value in extra.items() if key not in PRIVATE_EXTRA_KEYS}


class ListingCreate(BaseModel):
    title: str = Field(min_length=3, max_length=180)
    space_type: str
    description: str = ""
    location: str
    # Optional, and still positive when given: some formats (bus shelters) are
    # sold by a size bucket with no dimensions published anywhere.
    width_ft: float | None = Field(default=None, gt=0)
    height_ft: float | None = Field(default=None, gt=0)
    price_per_day: float = Field(gt=0)
    footfall_estimate: int | None = Field(default=None, ge=0)
    lighting: str | None = None
    image_url: str | None = None
    extra: dict | None = None

    @field_validator("description")
    @classmethod
    def _plain_description(cls, value: str) -> str:
        return html_to_text(value)


class ListingUpdate(ListingCreate):
    pass


class ListingOut(ORMModel):
    """The public face of a listing.

    Built from the stored row, but not a mirror of it: the description is
    cleaned to plain text (rows imported before cleaning existed still hold
    HTML), private `extra` keys are dropped, and the minimum booking term they
    imply is published as `min_booking_days` instead.
    """
    id: int; owner_id: int; title: str; space_type: str; description: str; location: str
    width_ft: float | None; height_ft: float | None; price_per_day: float; footfall_estimate: int | None
    status: ListingStatus; rejection_reason: str | None; lighting: str | None; image_url: str | None; extra: dict | None
    min_booking_days: int = 1

    @model_validator(mode="before")
    @classmethod
    def _public_view(cls, data):
        if isinstance(data, dict):
            fields = dict(data)
        else:
            fields = {name: getattr(data, name) for name in cls.model_fields if hasattr(data, name)}
        extra = fields.get("extra")
        derived = min_booking_days(fields.get("price_per_day") or 0, extra)
        # An already-public dict has lost `minimum_billing`; keep what it carries.
        fields["min_booking_days"] = max(derived, int(fields.get("min_booking_days") or 1))
        fields["extra"] = public_extra(extra)
        fields["description"] = html_to_text(fields.get("description"))
        return fields


class ListingPage(BaseModel):
    """Browse results are paged; a city catalogue is too large to return whole."""
    items: list[ListingOut]
    total: int
    limit: int
    offset: int


class ListingFacets(BaseModel):
    """Filter options and ranges derived from live inventory."""
    space_types: list[str]
    lightings: list[str]
    sizes: list[str]
    price_min: float | None
    price_max: float | None
    total: int

# Later agents append listing/cart/checkout schemas below.


class AddonOut(BaseModel):
    code: str; label: str; price: float; icon: str; blurb: str


class AddonLineOut(BaseModel):
    code: str; label: str; price: float


def _validate_dates_and_addons(start_date: date, end_date: date, addons: list[str]) -> None:
    if end_date < start_date:
        raise ValueError("end_date must be on or after start_date")
    unknown = [code for code in addons if code not in ADDON_CATALOG]
    if unknown:
        raise ValueError(f"Unknown addon code(s): {', '.join(unknown)}")


class CartItemCreate(BaseModel):
    listing_id: int
    start_date: date
    end_date: date
    addons: list[str] = []

    @model_validator(mode="after")
    def _valid(self):
        _validate_dates_and_addons(self.start_date, self.end_date, self.addons)
        return self


class CartItemUpdate(BaseModel):
    start_date: date
    end_date: date
    addons: list[str] = []

    @model_validator(mode="after")
    def _valid(self):
        _validate_dates_and_addons(self.start_date, self.end_date, self.addons)
        return self


class CartItemOut(BaseModel):
    id: int
    listing_id: int
    start_date: date
    end_date: date
    addons: list[str]
    listing_title: str
    listing_location: str
    listing_image_url: str | None
    listing_price_per_day: float
    days: int
    base_amount: float
    addon_lines: list[AddonLineOut]
    addons_amount: float
    gst_amount: float
    total_amount: float


class CartResponse(BaseModel):
    items: list[CartItemOut]
    subtotal: float
    addons_total: float
    gst_total: float
    grand_total: float


class BookingOut(ORMModel):
    id: int; listing_id: int; advertiser_id: int; start_date: date; end_date: date
    base_amount: float; addons_amount: float; addons: list[dict] | None
    gst_amount: float; total_amount: float; status: BookingStatus


class OwnerBookingOut(BaseModel):
    """A booking on one of *your* spaces, seen from the media owner's side.

    Deliberately a different shape from BookingOut: the owner needs the
    counterparty (who booked, how to reach them) and which of their spaces was
    booked, neither of which the advertiser-facing schema carries.
    """
    id: int
    listing_id: int
    start_date: date
    end_date: date
    days: int
    base_amount: float
    addons_amount: float
    addons: list[dict] | None
    gst_amount: float
    total_amount: float
    status: BookingStatus
    created_at: datetime
    listing_title: str
    listing_location: str
    listing_image_url: str | None
    listing_status: ListingStatus
    advertiser_id: int
    advertiser_name: str
    advertiser_email: EmailStr


class CheckoutRequest(BaseModel):
    method_label: str | None = None


class CheckoutResponse(BaseModel):
    payment_id: int
    provider_order_id: str
    amount_paid: float
    paid_at: datetime
    bookings: list[BookingOut]


class PaymentOut(ORMModel):
    id: int; user_id: int; booking_ids: list[int]; amount: float; status: PaymentStatus
    provider_order_id: str; method_label: str; created_at: datetime


class PaymentDetailOut(PaymentOut):
    bookings: list[BookingOut]
