from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator
from app.models import JobStatus, ListingStatus, Role


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=8, max_length=128)
    role: Role = Role.advertiser
    gstin: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(ORMModel):
    id: int; email: EmailStr; full_name: str; role: Role; gstin: str | None; kyc_status: str


class ListingCreate(BaseModel):
    title: str = Field(min_length=3, max_length=180)
    space_type: str
    description: str = ""
    location: str
    latitude: float | None = None
    longitude: float | None = None
    width_ft: float = Field(gt=0)
    height_ft: float = Field(gt=0)
    price_per_day: float = Field(gt=0)
    footfall_estimate: int | None = Field(default=None, ge=0)
    city: str | None = None
    illumination: str | None = None


class ListingOut(ORMModel):
    id: int; owner_id: int; title: str; space_type: str; description: str; location: str
    latitude: float | None; longitude: float | None; width_ft: float; height_ft: float
    price_per_day: float; footfall_estimate: int | None; status: ListingStatus; rejection_reason: str | None
    city: str | None = None; illumination: str | None = None


class ListingPage(BaseModel):
    """Browse results are paged: the catalogue is far too large to return whole."""
    items: list[ListingOut]
    total: int
    limit: int
    offset: int


class ListingFacets(BaseModel):
    """Filter options and ranges, so the UI never hardcodes them."""
    space_types: list[str]
    cities: list[str]
    illuminations: list[str]
    sizes: list[str]
    price_min: float | None
    price_max: float | None
    width_max: float | None
    height_max: float | None
    total: int


class ListingReview(BaseModel):
    approve: bool
    rejection_reason: str | None = None


class VASItem(BaseModel):
    service: str = Field(pattern="^(printing|installation|maintenance)$")
    quantity: float = Field(default=1, gt=0)


class BookingCreate(BaseModel):
    listing_id: int
    start_date: date
    end_date: date
    vas_items: list[VASItem] = []

    @model_validator(mode="after")
    def valid_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class BookingOut(ORMModel):
    id: int; listing_id: int; advertiser_id: int; start_date: date; end_date: date
    base_amount: float; vas_amount: float; gst_amount: float; total_amount: float; status: str


class VASOrderCreate(BaseModel):
    booking_id: int | None = None
    own_space_details: dict | None = None
    services: list[VASItem] = Field(min_length=1)

    @model_validator(mode="after")
    def require_space_context(self):
        if not self.booking_id and not self.own_space_details:
            raise ValueError("booking_id or own_space_details is required")
        return self


class VASOrderOut(ORMModel):
    id: int; advertiser_id: int; booking_id: int | None; own_space_details: dict | None
    services: dict; subtotal: float; gst_amount: float; total_amount: float; status: JobStatus
    assigned_to: int | None; scheduled_date: date | None


class JobUpdate(BaseModel):
    status: JobStatus
    assigned_to: int | None = None
    scheduled_date: date | None = None


class PaymentConfirm(BaseModel):
    success: bool = True


class PaymentOut(ORMModel):
    id: int; booking_id: int | None; vas_order_id: int | None; amount: float; status: str; provider_order_id: str


class NotificationOut(ORMModel):
    id: int; event_type: str; message: str; read: bool; created_at: datetime
