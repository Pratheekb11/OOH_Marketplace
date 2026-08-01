from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator
from app.models import BookingStatus, ListingStatus, PaymentStatus, Role
from app.pricing import ADDON_CATALOG


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


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(ORMModel):
    id: int; email: EmailStr; full_name: str; role: Role


class ListingCreate(BaseModel):
    title: str = Field(min_length=3, max_length=180)
    space_type: str
    description: str = ""
    location: str
    width_ft: float = Field(gt=0)
    height_ft: float = Field(gt=0)
    price_per_day: float = Field(gt=0)
    footfall_estimate: int | None = Field(default=None, ge=0)
    lighting: str | None = None
    image_url: str | None = None
    extra: dict | None = None


class ListingUpdate(ListingCreate):
    pass


class ListingOut(ORMModel):
    id: int; owner_id: int; title: str; space_type: str; description: str; location: str
    width_ft: float; height_ft: float; price_per_day: float; footfall_estimate: int | None
    status: ListingStatus; rejection_reason: str | None; lighting: str | None; image_url: str | None; extra: dict | None

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
