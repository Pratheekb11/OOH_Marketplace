from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import get_settings
from app.database import Base, engine, get_db
from app.models import Booking, BookingStatus, CartItem, Listing, ListingStatus, Payment, PaymentStatus, Role, User
from app.pricing import ADDON_CATALOG, quote_cart, quote_line
from app.schemas import (AddonOut, BookingOut, CartItemCreate, CartItemOut, CartItemUpdate,
                         CartResponse, CheckoutRequest, CheckoutResponse, ListingCreate, ListingFacets, ListingOut, ListingPage,
                         ListingUpdate, LoginRequest, PaymentDetailOut, RegisterRequest, Token, UserOut)
from app.security import (bearer, create_token, current_user, limiter,
                          password_context, require_roles)

settings = get_settings()

app = FastAPI(title="AdSpace MVP API", version="1.0.0", description="Backend API for OOH marketplace, bookings and VAS operations.", docs_url=None if settings.app_env == "production" else "/docs", redoc_url=None)
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


@app.get("/health")
def health():
    return {"status": "ok", "service": "adspace-mvp-api"}


@app.post("/api/v1/auth/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(request: Request, payload: RegisterRequest, db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(status_code=400, detail="Email is already registered")
    user = User(email=str(payload.email), full_name=payload.full_name, password_hash=password_context.hash(payload.password), role=payload.role)
    db.add(user); db.commit(); db.refresh(user)
    return user


@app.post("/api/v1/auth/login", response_model=Token)
@limiter.limit("10/minute")
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email))
    if not user or not password_context.verify(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return Token(access_token=create_token(user))


@app.get("/api/v1/auth/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user

# Later agents append listing/cart/checkout routes below.

# `bearer` (HTTPBearer, auto_error=True) is used by `current_user` for routes that require
# auth. Listing detail is public but needs to know *if* the caller is the owner (to unlock
# archived listings), so we need a variant that doesn't 401/403 when no token is sent at all.
_optional_bearer = HTTPBearer(auto_error=False)


def optional_user(credentials: HTTPAuthorizationCredentials | None = Depends(_optional_bearer), db: Session = Depends(get_db)) -> User | None:
    if credentials is None:
        return None
    try:
        return current_user(credentials=credentials, db=db)
    except HTTPException:
        return None


#: Dimensions are optional, so unsized rows sort last rather than vanishing.
AREA = Listing.width_ft * Listing.height_ft

SORTS = {
    "footfall_desc": Listing.footfall_estimate.desc().nullslast(),
    "price_asc": Listing.price_per_day.asc(),
    "price_desc": Listing.price_per_day.desc(),
    "size_desc": AREA.desc().nullslast(),
    "size_asc": AREA.asc().nullslast(),
    "newest": Listing.created_at.desc(),
}


@app.get("/api/v1/listings", response_model=ListingPage)
def browse_listings(
    q: str | None = None,
    space_type: str | None = None,
    lighting: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    min_width: float | None = None,
    max_width: float | None = None,
    min_height: float | None = None,
    max_height: float | None = None,
    min_area: float | None = None,
    max_area: float | None = None,
    size: str | None = None,
    min_footfall: int | None = None,
    has_dimensions: bool | None = None,
    sort: str = "footfall_desc",
    limit: int = 24,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """Browse active inventory.

    Returns a page envelope rather than a bare list: a real city catalogue runs
    to thousands of rows and the grid needs the total to paginate.
    """
    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    filters = [Listing.status == ListingStatus.active]
    if q: filters.append(or_(Listing.title.ilike(f"%{q}%"), Listing.location.ilike(f"%{q}%")))
    if space_type: filters.append(Listing.space_type == space_type)
    if lighting: filters.append(Listing.lighting == lighting)
    if min_price is not None: filters.append(Listing.price_per_day >= min_price)
    if max_price is not None: filters.append(Listing.price_per_day <= max_price)
    if min_width is not None: filters.append(Listing.width_ft >= min_width)
    if max_width is not None: filters.append(Listing.width_ft <= max_width)
    if min_height is not None: filters.append(Listing.height_ft >= min_height)
    if max_height is not None: filters.append(Listing.height_ft <= max_height)
    if min_area is not None: filters.append(AREA >= min_area)
    if max_area is not None: filters.append(AREA <= max_area)
    if min_footfall is not None: filters.append(Listing.footfall_estimate >= min_footfall)
    if has_dimensions is True: filters.append(Listing.width_ft.is_not(None))
    if has_dimensions is False: filters.append(Listing.width_ft.is_(None))
    if size:
        # "40W X 20H", exactly as the Dimensions dropdown renders it.
        try:
            width_text, height_text = size.upper().replace("H", "").split("X")
            filters.append(Listing.width_ft == float(width_text.replace("W", "").strip()))
            filters.append(Listing.height_ft == float(height_text.strip()))
        except (ValueError, AttributeError):
            raise HTTPException(status_code=422, detail="size must look like '40W X 20H'")

    total = db.scalar(select(func.count()).select_from(Listing).where(*filters)) or 0
    items = db.scalars(
        select(Listing).where(*filters)
        .order_by(SORTS.get(sort, SORTS["footfall_desc"]))
        .limit(limit).offset(offset)
    ).all()
    return ListingPage(items=items, total=total, limit=limit, offset=offset)


@app.get("/api/v1/listings/facets", response_model=ListingFacets)
def listing_facets(db: Session = Depends(get_db)):
    """Filter options taken from live inventory, so the UI hardcodes nothing.

    Declared before `/listings/{listing_id}` so the literal path wins.
    """
    active = Listing.status == ListingStatus.active

    def distinct(column):
        return [v for (v,) in db.execute(
            select(column).where(active, column.is_not(None)).distinct().order_by(column)
        ).all() if v]

    sizes = db.execute(
        select(Listing.width_ft, Listing.height_ft, func.count())
        .where(active, Listing.width_ft.is_not(None), Listing.height_ft.is_not(None))
        .group_by(Listing.width_ft, Listing.height_ft)
        .order_by(func.count().desc()).limit(40)
    ).all()

    return ListingFacets(
        space_types=distinct(Listing.space_type),
        lightings=distinct(Listing.lighting),
        sizes=[f"{w:g}W X {h:g}H" for w, h, _ in sizes],
        price_min=db.scalar(select(func.min(Listing.price_per_day)).where(active)),
        price_max=db.scalar(select(func.max(Listing.price_per_day)).where(active)),
        total=db.scalar(select(func.count()).select_from(Listing).where(active)) or 0,
    )


@app.get("/api/v1/listings/{listing_id}", response_model=ListingOut)
def get_listing(listing_id: int, db: Session = Depends(get_db), viewer: User | None = Depends(optional_user)):
    listing = db.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    is_owner = viewer is not None and viewer.id == listing.owner_id
    if listing.status == ListingStatus.archived and not is_owner:
        raise HTTPException(status_code=404, detail="Listing not found")
    return listing


@app.post("/api/v1/listings", response_model=ListingOut, status_code=status.HTTP_201_CREATED)
def create_listing(payload: ListingCreate, owner: User = Depends(require_roles(Role.owner)), db: Session = Depends(get_db)):
    # POC auto-approves every submission; pending/rejected stay unused until an admin
    # review flow exists (see rejection_reason column, also currently unused).
    listing = Listing(owner_id=owner.id, status=ListingStatus.active, **payload.model_dump())
    db.add(listing); db.commit(); db.refresh(listing)
    return listing


@app.put("/api/v1/listings/{listing_id}", response_model=ListingOut)
def update_listing(listing_id: int, payload: ListingUpdate, owner: User = Depends(require_roles(Role.owner)), db: Session = Depends(get_db)):
    listing = db.get(Listing, listing_id)
    if not listing or listing.owner_id != owner.id or listing.status == ListingStatus.archived:
        raise HTTPException(status_code=404, detail="Listing not found")
    for field, value in payload.model_dump().items():
        setattr(listing, field, value)
    db.commit(); db.refresh(listing)
    return listing


@app.delete("/api/v1/listings/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_listing(listing_id: int, owner: User = Depends(require_roles(Role.owner)), db: Session = Depends(get_db)):
    listing = db.get(Listing, listing_id)
    if not listing or listing.owner_id != owner.id or listing.status == ListingStatus.archived:
        raise HTTPException(status_code=404, detail="Listing not found")
    # Always a soft archive: bookings.listing_id is a non-nullable FK, so a hard delete
    # would either violate that constraint or orphan purchase history. Cart rows referencing
    # this listing are purged in the same transaction since they're not purchase history.
    listing.status = ListingStatus.archived
    db.execute(delete(CartItem).where(CartItem.listing_id == listing_id))
    db.commit()
    return None


@app.get("/api/v1/owner/listings", response_model=list[ListingOut])
def owner_listings(owner: User = Depends(require_roles(Role.owner)), db: Session = Depends(get_db)):
    return db.scalars(select(Listing).where(Listing.owner_id == owner.id).order_by(Listing.created_at.desc())).all()


# --- Cart, checkout, payments -----------------------------------------------------
# Cart and checkout are advertiser-only: every query below is scoped to
# current_user.id so one advertiser can never see or mutate another's cart/bookings.


def _active_booking_overlap(db: Session, listing_id: int, start_date, end_date) -> bool:
    """Advisory check used by the cart routes: tells the shopper immediately that a listing
    is unavailable, but is NOT a reservation -- the authoritative check happens again at
    checkout (see the comment there) because the cart row does nothing to hold the slot.
    """
    return db.scalar(select(Booking).where(
        Booking.listing_id == listing_id,
        Booking.status.in_([BookingStatus.pending, BookingStatus.booked, BookingStatus.active]),
        Booking.start_date <= end_date,
        Booking.end_date >= start_date,
    )) is not None


def _cart_item_out(item: CartItem, listing: Listing) -> dict:
    quote = quote_line(listing, item.start_date, item.end_date, item.addons or [])
    return {
        "id": item.id,
        "listing_id": item.listing_id,
        "start_date": item.start_date,
        "end_date": item.end_date,
        "addons": item.addons or [],
        "listing_title": listing.title,
        "listing_location": listing.location,
        "listing_image_url": listing.image_url,
        "listing_price_per_day": listing.price_per_day,
        "days": quote["days"],
        "base_amount": quote["base"],
        "addon_lines": quote["addon_lines"],
        "addons_amount": quote["addons_amount"],
        "gst_amount": quote["gst_amount"],
        "total_amount": quote["total"],
    }


@app.get("/api/v1/cart", response_model=CartResponse)
def get_cart(user: User = Depends(require_roles(Role.advertiser)), db: Session = Depends(get_db)):
    items = db.scalars(select(CartItem).where(CartItem.user_id == user.id).order_by(CartItem.id)).all()
    out_items = []
    lines = []
    for item in items:
        listing = db.get(Listing, item.listing_id)
        if not listing:
            continue  # orphaned row (shouldn't happen: archiving a listing purges its cart rows)
        lines.append(quote_line(listing, item.start_date, item.end_date, item.addons or []))
        out_items.append(_cart_item_out(item, listing))
    return {"items": out_items, **quote_cart(lines)}


@app.post("/api/v1/cart/items", response_model=CartItemOut, status_code=status.HTTP_201_CREATED)
def add_cart_item(payload: CartItemCreate, response: Response, user: User = Depends(require_roles(Role.advertiser)), db: Session = Depends(get_db)):
    listing = db.get(Listing, payload.listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.status != ListingStatus.active:
        raise HTTPException(status_code=409, detail="Listing is not available for booking")
    if _active_booking_overlap(db, listing.id, payload.start_date, payload.end_date):
        raise HTTPException(status_code=409, detail="Selected dates are unavailable for this listing")

    item = CartItem(user_id=user.id, listing_id=payload.listing_id, start_date=payload.start_date, end_date=payload.end_date, addons=payload.addons)
    db.add(item)
    try:
        db.commit()
    except IntegrityError:
        # Same (user, listing, start_date, end_date) already in the cart -- add-to-cart is
        # idempotent, so hand back the existing row instead of raising.
        db.rollback()
        existing = db.scalar(select(CartItem).where(
            CartItem.user_id == user.id, CartItem.listing_id == payload.listing_id,
            CartItem.start_date == payload.start_date, CartItem.end_date == payload.end_date,
        ))
        response.status_code = status.HTTP_200_OK
        return _cart_item_out(existing, listing)
    db.refresh(item)
    return _cart_item_out(item, listing)


@app.patch("/api/v1/cart/items/{item_id}", response_model=CartItemOut)
def update_cart_item(item_id: int, payload: CartItemUpdate, user: User = Depends(require_roles(Role.advertiser)), db: Session = Depends(get_db)):
    item = db.get(CartItem, item_id)
    if not item or item.user_id != user.id:
        raise HTTPException(status_code=404, detail="Cart item not found")
    listing = db.get(Listing, item.listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if _active_booking_overlap(db, listing.id, payload.start_date, payload.end_date):
        raise HTTPException(status_code=409, detail="Selected dates are unavailable for this listing")

    item.start_date = payload.start_date
    item.end_date = payload.end_date
    item.addons = payload.addons
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Another cart item already covers these exact dates")
    db.refresh(item)
    return _cart_item_out(item, listing)


@app.delete("/api/v1/cart/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cart_item(item_id: int, user: User = Depends(require_roles(Role.advertiser)), db: Session = Depends(get_db)):
    item = db.get(CartItem, item_id)
    if not item or item.user_id != user.id:
        raise HTTPException(status_code=404, detail="Cart item not found")
    db.delete(item)
    db.commit()
    return None


@app.delete("/api/v1/cart", status_code=status.HTTP_204_NO_CONTENT)
def clear_cart(user: User = Depends(require_roles(Role.advertiser)), db: Session = Depends(get_db)):
    db.execute(delete(CartItem).where(CartItem.user_id == user.id))
    db.commit()
    return None


@app.post("/api/v1/checkout", response_model=CheckoutResponse, status_code=status.HTTP_201_CREATED)
def checkout(payload: CheckoutRequest = CheckoutRequest(), advertiser: User = Depends(require_roles(Role.advertiser)), db: Session = Depends(get_db)):
    items = db.scalars(select(CartItem).where(CartItem.user_id == advertiser.id).order_by(CartItem.id)).all()
    if not items:
        raise HTTPException(status_code=409, detail="Cart is empty")

    # Intra-cart guard: two cart rows for the same listing with overlapping windows would
    # otherwise sail through the per-item checks below one at a time (each only compares
    # against *persisted* bookings, not against its cart siblings).
    for i, a in enumerate(items):
        for b in items[i + 1:]:
            if a.listing_id == b.listing_id and a.start_date <= b.end_date and b.start_date <= a.end_date:
                raise HTTPException(status_code=409, detail=f"Cart items {a.id} and {b.id} overlap on the same listing")

    bookings: list[Booking] = []
    lines: list[dict] = []
    for item in items:
        listing = db.get(Listing, item.listing_id)
        if not listing or listing.status != ListingStatus.active:
            raise HTTPException(status_code=409, detail=f"Listing {item.listing_id} is no longer available")

        # Authoritative overlap guard (the cart-time check is advisory only). This SELECT is
        # safe here because SQLite serializes all writers, so no second checkout can interleave
        # between this read and the `db.flush()` below. Under Postgres at the default READ
        # COMMITTED isolation level this is a check-then-act race: two concurrent checkouts for
        # overlapping dates can both pass this SELECT before either has committed its INSERT.
        # Closing that gap for real needs `SELECT ... FOR UPDATE` on the listing row (to
        # serialize concurrent checkouts of the same listing) or, better, a Postgres
        # `btree_gist` EXCLUDE constraint on (listing_id WITH =, daterange(start_date, end_date,
        # '[]') WITH &&) so the database itself rejects the overlapping insert.
        overlap = db.scalar(select(Booking).where(
            Booking.listing_id == item.listing_id,
            Booking.status.in_([BookingStatus.pending, BookingStatus.booked, BookingStatus.active]),
            Booking.start_date <= item.end_date,
            Booking.end_date >= item.start_date,
        ))
        if overlap:
            raise HTTPException(status_code=409, detail=f"Listing {item.listing_id} is unavailable for the selected dates")

        quote = quote_line(listing, item.start_date, item.end_date, item.addons or [])
        booking = Booking(
            listing_id=listing.id,
            advertiser_id=advertiser.id,
            start_date=item.start_date,
            end_date=item.end_date,
            base_amount=quote["base"],
            addons_amount=quote["addons_amount"],
            addons=quote["addon_lines"],
            gst_amount=quote["gst_amount"],
            total_amount=quote["total"],
            status=BookingStatus.booked,
        )
        db.add(booking)
        # Flush now (not just at the end): this assigns booking.id and -- critically -- makes
        # the row visible to the next iteration's overlap SELECT above, which is what catches
        # a self-conflicting pair of cart items inside this same loop/transaction.
        db.flush()
        bookings.append(booking)
        lines.append(quote)

    totals = quote_cart(lines)
    payment_kwargs = dict(
        user_id=advertiser.id,
        booking_ids=[b.id for b in bookings],
        amount=totals["grand_total"],
        status=PaymentStatus.paid,
        provider_order_id=f"poc_{uuid4().hex}",
    )
    if payload.method_label:
        payment_kwargs["method_label"] = payload.method_label
    payment = Payment(**payment_kwargs)
    db.add(payment)
    db.execute(delete(CartItem).where(CartItem.user_id == advertiser.id))

    # Single commit point: if anything above raised, nothing here has happened yet, so the
    # rollback that FastAPI/SQLAlchemy performs on the failed request leaves zero bookings,
    # zero payments and an intact cart.
    db.commit()
    db.refresh(payment)
    for b in bookings:
        db.refresh(b)

    return {
        "payment_id": payment.id,
        "provider_order_id": payment.provider_order_id,
        "amount_paid": payment.amount,
        "paid_at": payment.created_at,
        "bookings": bookings,
    }


@app.get("/api/v1/payments/{payment_id}", response_model=PaymentDetailOut)
def get_payment(payment_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    payment = db.get(Payment, payment_id)
    if not payment or payment.user_id != user.id:
        raise HTTPException(status_code=404, detail="Payment not found")
    bookings = db.scalars(select(Booking).where(Booking.id.in_(payment.booking_ids))).all() if payment.booking_ids else []
    return {
        "id": payment.id,
        "user_id": payment.user_id,
        "booking_ids": payment.booking_ids,
        "amount": payment.amount,
        "status": payment.status,
        "provider_order_id": payment.provider_order_id,
        "method_label": payment.method_label,
        "created_at": payment.created_at,
        "bookings": bookings,
    }


@app.get("/api/v1/bookings", response_model=list[BookingOut])
def list_bookings(advertiser: User = Depends(require_roles(Role.advertiser)), db: Session = Depends(get_db)):
    return db.scalars(select(Booking).where(Booking.advertiser_id == advertiser.id).order_by(Booking.created_at.desc())).all()


@app.get("/api/v1/addons", response_model=list[AddonOut])
def list_addons():
    return [{"code": code, **data} for code, data in ADDON_CATALOG.items()]
