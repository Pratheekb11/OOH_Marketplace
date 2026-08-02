from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import get_settings
from app.database import Base, engine, get_db
from app.integrations import geocode, invoice_pdf, send_email, store_file, validate_gstin
from app.models import (AuditLog, Booking, BookingStatus, Invoice, JobStatus, Listing, ListingDocument, ListingStatus,
                        Notification, Payment, PaymentStatus, Role, User, VASOrder)
from app.schemas import (BookingCreate, BookingOut, JobUpdate, ListingCreate, ListingFacets, ListingOut, ListingPage,
                         ListingReview, LoginRequest, NotificationOut, PaymentConfirm,
                         PaymentOut, RegisterRequest, Token, UserOut, VASOrderCreate,
                         VASOrderOut)

settings = get_settings()
password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer()
limiter = Limiter(key_func=get_remote_address)
VAS_RATES = {"printing": 25.0, "installation": 1500.0, "maintenance": 750.0}
GST_RATE = 0.18

app = FastAPI(title="AdSpace Marketplace API", version="1.0.0", description="Backend API for OOH marketplace, bookings and VAS operations.", docs_url=None if settings.app_env == "production" else "/docs", redoc_url=None)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(CORSMiddleware, allow_origins=settings.origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.hosts if settings.app_env == "production" else ["*"])


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


def create_token(user: User) -> str:
    payload = {"sub": str(user.id), "role": user.role.value, "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)}
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)) -> User:
    try:
        payload = jwt.decode(credentials.credentials, settings.secret_key, algorithms=["HS256"])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired access token")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_roles(*roles: Role):
    def checker(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return checker


def notify(db: Session, user_id: int, event_type: str, message: str) -> None:
    """Outbox boundary; a worker can later deliver these records through email/SMS."""
    db.add(Notification(user_id=user_id, event_type=event_type, message=message))


def audit(db: Session, actor_id: int | None, action: str, entity_type: str, entity_id: int | str, details: dict | None = None) -> None:
    db.add(AuditLog(actor_id=actor_id, action=action, entity_type=entity_type, entity_id=str(entity_id), details=details))


def issue_invoice(db: Session, user_id: int, amount: float, gst_amount: float, booking_id: int | None = None, vas_order_id: int | None = None) -> Invoice:
    number = f"ADS-{datetime.now(timezone.utc):%Y%m%d}-{uuid4().hex[:8].upper()}"
    key = store_file(f"invoices/{number}.pdf", invoice_pdf(number, amount, gst_amount), "application/pdf")
    invoice = Invoice(invoice_number=number, booking_id=booking_id, vas_order_id=vas_order_id, user_id=user_id, amount=amount, gst_amount=gst_amount, document_key=key)
    db.add(invoice)
    return invoice


def vas_totals(items) -> tuple[dict, float, float, float]:
    lines = [{"service": item.service, "quantity": item.quantity, "unit_price": VAS_RATES[item.service], "amount": round(item.quantity * VAS_RATES[item.service], 2)} for item in items]
    subtotal = round(sum(line["amount"] for line in lines), 2)
    gst = round(subtotal * GST_RATE, 2)
    return {"items": lines}, subtotal, gst, round(subtotal + gst, 2)


@app.get("/health")
def health():
    return {"status": "ok", "service": "adspace-api"}


@app.post("/api/v1/auth/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(request: Request, payload: RegisterRequest, db: Session = Depends(get_db)):
    if payload.role == Role.admin and settings.app_env == "production":
        raise HTTPException(status_code=403, detail="Admin accounts are provisioned internally")
    if db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(status_code=409, detail="Email is already registered")
    if not validate_gstin(payload.gstin):
        raise HTTPException(status_code=422, detail="GSTIN validation failed")
    user = User(email=str(payload.email), full_name=payload.full_name, password_hash=password_context.hash(payload.password), role=payload.role, gstin=payload.gstin, kyc_status="pending" if payload.role == Role.owner else "not_required")
    db.add(user); db.flush(); audit(db, user.id, "user.registered", "user", user.id); db.commit(); db.refresh(user)
    return user


@app.post("/api/v1/auth/login", response_model=Token)
@limiter.limit("10/minute")
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email))
    if not user or not password_context.verify(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    audit(db, user.id, "user.logged_in", "user", user.id); db.commit()
    return Token(access_token=create_token(user))


@app.get("/api/v1/auth/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user


#: Browse sort keys, mapped to their ORDER BY. Anything else is rejected rather
#: than silently ignored, so a typo in the UI does not look like working code.
LISTING_SORTS = {
    "newest": Listing.created_at.desc(),
    "price_asc": Listing.price_per_day.asc(),
    "price_desc": Listing.price_per_day.desc(),
    "footfall_desc": Listing.footfall_estimate.desc().nullslast(),
    "size_desc": (Listing.width_ft * Listing.height_ft).desc(),
    "size_asc": (Listing.width_ft * Listing.height_ft).asc(),
}


@app.get("/api/v1/listings", response_model=ListingPage)
def browse_listings(
    q: str | None = None,
    location: str | None = None,
    city: str | None = None,
    space_type: str | None = None,
    illumination: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    min_width: float | None = None,
    max_width: float | None = None,
    min_height: float | None = None,
    max_height: float | None = None,
    min_area: float | None = None,
    max_area: float | None = None,
    min_footfall: int | None = None,
    size: str | None = None,
    sort: str = "newest",
    limit: int = 24,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """Browse active inventory.

    Returns a page envelope rather than a bare list: with a real catalogue
    loaded the result set runs to thousands of rows, and the grid needs the
    total to paginate.
    """
    if sort not in LISTING_SORTS:
        raise HTTPException(status_code=422, detail=f"sort must be one of {sorted(LISTING_SORTS)}")
    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    filters = [Listing.status == ListingStatus.active]
    if q:
        term = f"%{q}%"
        filters.append(Listing.title.ilike(term) | Listing.location.ilike(term))
    if location: filters.append(Listing.location.ilike(f"%{location}%"))
    if city: filters.append(Listing.city == city)
    if space_type: filters.append(Listing.space_type == space_type)
    if illumination: filters.append(Listing.illumination == illumination)
    if min_price is not None: filters.append(Listing.price_per_day >= min_price)
    if max_price is not None: filters.append(Listing.price_per_day <= max_price)
    if min_width is not None: filters.append(Listing.width_ft >= min_width)
    if max_width is not None: filters.append(Listing.width_ft <= max_width)
    if min_height is not None: filters.append(Listing.height_ft >= min_height)
    if max_height is not None: filters.append(Listing.height_ft <= max_height)
    if min_area is not None: filters.append(Listing.width_ft * Listing.height_ft >= min_area)
    if max_area is not None: filters.append(Listing.width_ft * Listing.height_ft <= max_area)
    if min_footfall is not None: filters.append(Listing.footfall_estimate >= min_footfall)
    if size:
        # "40W X 20H" as shown in the dimensions dropdown.
        try:
            width_text, height_text = size.upper().replace("H", "").split("X")
            filters.append(Listing.width_ft == float(width_text.replace("W", "").strip()))
            filters.append(Listing.height_ft == float(height_text.strip()))
        except (ValueError, AttributeError):
            raise HTTPException(status_code=422, detail="size must look like '40W X 20H'")

    total = db.scalar(select(func.count()).select_from(Listing).where(*filters)) or 0
    items = db.scalars(
        select(Listing).where(*filters).order_by(LISTING_SORTS[sort]).limit(limit).offset(offset)
    ).all()
    return ListingPage(items=items, total=total, limit=limit, offset=offset)


@app.get("/api/v1/listings/facets", response_model=ListingFacets)
def listing_facets(db: Session = Depends(get_db)):
    """Available filter values, derived from the live catalogue.

    Declared before `/listings/{listing_id}` so the literal path wins over the
    dynamic one.
    """
    active = Listing.status == ListingStatus.active

    def distinct(column):
        return [v for (v,) in db.execute(
            select(column).where(active, column.is_not(None)).distinct().order_by(column)
        ).all() if v]

    sizes = db.execute(
        select(Listing.width_ft, Listing.height_ft, func.count())
        .where(active).group_by(Listing.width_ft, Listing.height_ft)
        .order_by(func.count().desc()).limit(40)
    ).all()

    return ListingFacets(
        space_types=distinct(Listing.space_type),
        cities=distinct(Listing.city),
        illuminations=distinct(Listing.illumination),
        sizes=[f"{w:g}W X {h:g}H" for w, h, _ in sizes],
        price_min=db.scalar(select(func.min(Listing.price_per_day)).where(active)),
        price_max=db.scalar(select(func.max(Listing.price_per_day)).where(active)),
        width_max=db.scalar(select(func.max(Listing.width_ft)).where(active)),
        height_max=db.scalar(select(func.max(Listing.height_ft)).where(active)),
        total=db.scalar(select(func.count()).select_from(Listing).where(active)) or 0,
    )


@app.post("/api/v1/listings", response_model=ListingOut, status_code=status.HTTP_201_CREATED)
def create_listing(payload: ListingCreate, owner: User = Depends(require_roles(Role.owner)), db: Session = Depends(get_db)):
    values = payload.model_dump()
    if values["latitude"] is None or values["longitude"] is None:
        values["latitude"], values["longitude"] = geocode(values["location"])
    listing = Listing(owner_id=owner.id, **values)
    db.add(listing); db.flush(); audit(db, owner.id, "listing.created", "listing", listing.id); db.commit(); db.refresh(listing)
    return listing


@app.get("/api/v1/listings/{listing_id}", response_model=ListingOut)
def get_listing(listing_id: int, db: Session = Depends(get_db)):
    listing = db.get(Listing, listing_id)
    if not listing: raise HTTPException(status_code=404, detail="Listing not found")
    return listing


@app.get("/api/v1/owner/listings", response_model=list[ListingOut])
def owner_listings(owner: User = Depends(require_roles(Role.owner)), db: Session = Depends(get_db)):
    return db.scalars(select(Listing).where(Listing.owner_id == owner.id)).all()


@app.patch("/api/v1/owner/listings/{listing_id}/status", response_model=ListingOut)
def set_listing_status(listing_id: int, paused: bool, owner: User = Depends(require_roles(Role.owner)), db: Session = Depends(get_db)):
    listing = db.get(Listing, listing_id)
    if not listing or listing.owner_id != owner.id:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.status not in {ListingStatus.active, ListingStatus.paused}:
        raise HTTPException(status_code=409, detail="Only approved listings can be paused or resumed")
    listing.status = ListingStatus.paused if paused else ListingStatus.active
    audit(db, owner.id, "listing.status_changed", "listing", listing.id, {"status": listing.status.value}); db.commit(); db.refresh(listing)
    return listing


@app.get("/api/v1/dashboard/advertiser")
def advertiser_dashboard(advertiser: User = Depends(require_roles(Role.advertiser)), db: Session = Depends(get_db)):
    bookings = db.scalars(select(Booking).where(Booking.advertiser_id == advertiser.id).order_by(Booking.created_at.desc())).all()
    return {"booking_count": len(bookings), "total_spend": round(sum(item.total_amount for item in bookings if item.status != BookingStatus.cancelled), 2), "active_bookings": sum(item.status in {BookingStatus.booked, BookingStatus.active} for item in bookings), "bookings": bookings}


@app.get("/api/v1/dashboard/owner")
def owner_dashboard(owner: User = Depends(require_roles(Role.owner)), db: Session = Depends(get_db)):
    listings = db.scalars(select(Listing).where(Listing.owner_id == owner.id)).all()
    listing_ids = [listing.id for listing in listings]
    bookings = db.scalars(select(Booking).where(Booking.listing_id.in_(listing_ids), Booking.status.in_([BookingStatus.booked, BookingStatus.active]))) if listing_ids else []
    bookings = list(bookings)
    return {"listing_count": len(listings), "active_listings": sum(item.status == ListingStatus.active for item in listings), "booking_revenue": round(sum(item.base_amount for item in bookings), 2), "booking_count": len(bookings)}


@app.post("/api/v1/owner/listings/{listing_id}/documents", status_code=status.HTTP_201_CREATED)
async def upload_listing_document(listing_id: int, file: UploadFile = File(...), owner: User = Depends(require_roles(Role.owner)), db: Session = Depends(get_db)):
    listing = db.get(Listing, listing_id)
    if not listing or listing.owner_id != owner.id:
        raise HTTPException(status_code=404, detail="Listing not found")
    if file.content_type not in {"application/pdf", "image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="Only PDF, JPEG, PNG and WebP files are accepted")
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Maximum upload size is 10 MB")
    key = f"listing-documents/{listing.id}/{uuid4().hex}-{file.filename}"
    document = ListingDocument(listing_id=listing.id, uploaded_by=owner.id, original_name=file.filename or "upload", content_type=file.content_type, storage_key=store_file(key, content, file.content_type))
    db.add(document); db.flush(); audit(db, owner.id, "listing.document_uploaded", "listing_document", document.id); db.commit()
    return {"id": document.id, "storage_key": document.storage_key}


@app.get("/api/v1/admin/listings/pending", response_model=list[ListingOut])
def pending_listings(_: User = Depends(require_roles(Role.admin)), db: Session = Depends(get_db)):
    return db.scalars(select(Listing).where(Listing.status == ListingStatus.pending)).all()


@app.post("/api/v1/admin/listings/{listing_id}/review", response_model=ListingOut)
def review_listing(listing_id: int, payload: ListingReview, _: User = Depends(require_roles(Role.admin)), db: Session = Depends(get_db)):
    listing = db.get(Listing, listing_id)
    if not listing: raise HTTPException(status_code=404, detail="Listing not found")
    if payload.approve:
        listing.status, listing.rejection_reason = ListingStatus.active, None
        notify(db, listing.owner_id, "listing.approved", f"Your listing '{listing.title}' is now live.")
    else:
        if not payload.rejection_reason: raise HTTPException(status_code=422, detail="rejection_reason is required")
        listing.status, listing.rejection_reason = ListingStatus.rejected, payload.rejection_reason
        notify(db, listing.owner_id, "listing.rejected", payload.rejection_reason)
    audit(db, _.id, "listing.reviewed", "listing", listing.id, {"approved": payload.approve}); db.commit(); db.refresh(listing)
    return listing


@app.post("/api/v1/bookings", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_booking(payload: BookingCreate, advertiser: User = Depends(require_roles(Role.advertiser)), db: Session = Depends(get_db)):
    listing = db.get(Listing, payload.listing_id)
    if not listing or listing.status != ListingStatus.active: raise HTTPException(status_code=404, detail="Active listing not found")
    overlap = db.scalar(select(Booking).where(Booking.listing_id == listing.id, Booking.status.in_([BookingStatus.pending, BookingStatus.booked, BookingStatus.active]), Booking.start_date <= payload.end_date, Booking.end_date >= payload.start_date))
    if overlap: raise HTTPException(status_code=409, detail="Selected dates are unavailable")
    days = (payload.end_date - payload.start_date).days + 1
    base = round(days * listing.price_per_day, 2)
    vas_services, vas, vas_gst, _ = vas_totals(payload.vas_items)
    gst = round((base + vas) * GST_RATE, 2)
    booking = Booking(listing_id=listing.id, advertiser_id=advertiser.id, start_date=payload.start_date, end_date=payload.end_date, base_amount=base, vas_amount=vas, vas_services=vas_services if payload.vas_items else None, gst_amount=gst, total_amount=round(base + vas + gst, 2))
    db.add(booking); db.flush(); audit(db, advertiser.id, "booking.created", "booking", booking.id); db.commit(); db.refresh(booking)
    return booking


@app.get("/api/v1/bookings", response_model=list[BookingOut])
def my_bookings(advertiser: User = Depends(require_roles(Role.advertiser)), db: Session = Depends(get_db)):
    return db.scalars(select(Booking).where(Booking.advertiser_id == advertiser.id).order_by(Booking.created_at.desc())).all()


@app.post("/api/v1/vas/orders", response_model=VASOrderOut, status_code=status.HTTP_201_CREATED)
def create_vas_order(payload: VASOrderCreate, advertiser: User = Depends(require_roles(Role.advertiser)), db: Session = Depends(get_db)):
    if payload.booking_id:
        booking = db.get(Booking, payload.booking_id)
        if not booking or booking.advertiser_id != advertiser.id: raise HTTPException(status_code=404, detail="Booking not found")
        if booking.status != BookingStatus.active:
            raise HTTPException(status_code=409, detail="VAS reorders require an active booking")
    services, subtotal, gst, total = vas_totals(payload.services)
    order = VASOrder(advertiser_id=advertiser.id, booking_id=payload.booking_id, own_space_details=payload.own_space_details, services=services, subtotal=subtotal, gst_amount=gst, total_amount=total)
    db.add(order); db.flush(); audit(db, advertiser.id, "vas_order.created", "vas_order", order.id); db.commit(); db.refresh(order)
    return order


@app.get("/api/v1/vas/orders", response_model=list[VASOrderOut])
def my_vas_orders(advertiser: User = Depends(require_roles(Role.advertiser)), db: Session = Depends(get_db)):
    return db.scalars(select(VASOrder).where(VASOrder.advertiser_id == advertiser.id).order_by(VASOrder.created_at.desc())).all()


@app.get("/api/v1/admin/vas/orders", response_model=list[VASOrderOut])
def vas_queue(job_status: JobStatus | None = None, _: User = Depends(require_roles(Role.admin)), db: Session = Depends(get_db)):
    query = select(VASOrder)
    if job_status: query = query.where(VASOrder.status == job_status)
    return db.scalars(query.order_by(VASOrder.created_at.desc())).all()


@app.patch("/api/v1/admin/vas/orders/{order_id}", response_model=VASOrderOut)
def update_vas_job(order_id: int, payload: JobUpdate, _: User = Depends(require_roles(Role.admin)), db: Session = Depends(get_db)):
    order = db.get(VASOrder, order_id)
    if not order: raise HTTPException(status_code=404, detail="VAS order not found")
    order.status = payload.status
    if payload.assigned_to is not None: order.assigned_to = payload.assigned_to
    if payload.scheduled_date is not None: order.scheduled_date = payload.scheduled_date
    notify(db, order.advertiser_id, "vas.job.updated", f"VAS job #{order.id} is now {order.status.value}.")
    audit(db, _.id, "vas_order.updated", "vas_order", order.id, {"status": order.status.value}); db.commit(); db.refresh(order)
    return order


@app.post("/api/v1/payments/booking/{booking_id}", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
def create_booking_payment(booking_id: int, advertiser: User = Depends(require_roles(Role.advertiser)), db: Session = Depends(get_db)):
    booking = db.get(Booking, booking_id)
    if not booking or booking.advertiser_id != advertiser.id: raise HTTPException(status_code=404, detail="Booking not found")
    payment = Payment(booking_id=booking.id, amount=booking.total_amount, provider_order_id=f"order_{uuid4().hex}")
    db.add(payment); db.commit(); db.refresh(payment)
    return payment


@app.post("/api/v1/payments/vas/{vas_order_id}", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
def create_vas_payment(vas_order_id: int, advertiser: User = Depends(require_roles(Role.advertiser)), db: Session = Depends(get_db)):
    vas_order = db.get(VASOrder, vas_order_id)
    if not vas_order or vas_order.advertiser_id != advertiser.id:
        raise HTTPException(status_code=404, detail="VAS order not found")
    payment = Payment(vas_order_id=vas_order.id, amount=vas_order.total_amount, provider_order_id=f"order_{uuid4().hex}")
    db.add(payment); db.commit(); db.refresh(payment)
    return payment


@app.post("/api/v1/payments/{payment_id}/confirm", response_model=PaymentOut)
def confirm_payment(payment_id: int, payload: PaymentConfirm, advertiser: User = Depends(require_roles(Role.advertiser)), db: Session = Depends(get_db)):
    if settings.app_env == "production":
        raise HTTPException(status_code=501, detail="Payment provider is not configured")
    payment = db.get(Payment, payment_id)
    if not payment: raise HTTPException(status_code=404, detail="Payment not found")
    booking = db.get(Booking, payment.booking_id) if payment.booking_id else None
    vas_order = db.get(VASOrder, payment.vas_order_id) if payment.vas_order_id else None
    if (booking and booking.advertiser_id != advertiser.id) or (vas_order and vas_order.advertiser_id != advertiser.id):
        raise HTTPException(status_code=403, detail="Not your payment")
    payment.status = PaymentStatus.paid if payload.success else PaymentStatus.failed
    if payload.success and booking:
        booking.status = BookingStatus.booked
        listing = db.get(Listing, booking.listing_id)
        issue_invoice(db, advertiser.id, booking.total_amount, booking.gst_amount, booking_id=booking.id)
        if booking.vas_services:
            db.add(VASOrder(advertiser_id=advertiser.id, booking_id=booking.id, services=booking.vas_services, subtotal=booking.vas_amount, gst_amount=round(booking.vas_amount * GST_RATE, 2), total_amount=round(booking.vas_amount * (1 + GST_RATE), 2)))
            notify(db, advertiser.id, "vas.job.created", f"VAS job for booking #{booking.id} is in the operations queue.")
        notify(db, advertiser.id, "booking.confirmed", f"Booking #{booking.id} is confirmed.")
        notify(db, listing.owner_id, "booking.confirmed", f"You received booking #{booking.id}.")
    if payload.success and vas_order:
        issue_invoice(db, advertiser.id, vas_order.total_amount, vas_order.gst_amount, vas_order_id=vas_order.id)
        notify(db, advertiser.id, "vas.job.created", f"VAS job #{vas_order.id} is in the operations queue.")
    db.commit(); db.refresh(payment)
    return payment


@app.get("/api/v1/invoices")
def invoices(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Invoice).where(Invoice.user_id == user.id).order_by(Invoice.created_at.desc())).all()


@app.get("/api/v1/notifications", response_model=list[NotificationOut])
def notifications(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Notification).where(Notification.user_id == user.id).order_by(Notification.created_at.desc())).all()
