"""Seeds the dev database with two demo users and the 9 real listings lifted
verbatim from the static prototype.

Run as:

    cd MVP/backend
    source .venv/bin/activate
    alembic upgrade head        # make sure the schema exists first -- this
                                 # script never creates tables itself
    python -m scripts.seed [--force]

Idempotent: if owner@adspace.example already exists, the script prints a message
and exits without touching the database. --force deletes every row owned by
the two seed users (in FK-safe order: payments -> bookings -> cart_items ->
listings -> users) and re-seeds from scratch.

--------------------------------------------------------------------------
Price normalization (checkout multiplies price_per_day * inclusive days, so
every listing must be expressed in per-day terms no matter how the prototype
card displayed it):

    prototype unit      ->  price_per_day formula      -> extra["display_unit"]
    ------------------- --- -------------------------- --- --------------------
    "/ Slot"            ->  price as-is                 -> "/ Slot"
    "/ Month"           ->  round(price / 30, 2)        -> "/ Month"
    "/ Week"            ->  round(price / 7, 2)         -> "/ Week"

The original prototype figure (e.g. 85000 for "₹85k / Month") is preserved
verbatim in extra["display_price"] so the marketplace card can still render
"₹85k / Month" instead of a converted per-day number.
--------------------------------------------------------------------------

Sources (read, never modified):
  Ui_Prototype_MVP_Prep/listing_page.html  -- the 8 marketplace cards
  Ui_Prototype_MVP_Prep/listing_view.html  -- the MG Road Premium Unipole detail page
"""
import argparse

from sqlalchemy import delete, select

from app.database import SessionLocal
from app.models import Booking, CartItem, Listing, ListingStatus, Payment, Role, User
from app.security import password_context

OWNER_EMAIL = "owner@adspace.example"
ADVERTISER_EMAIL = "advertiser@adspace.example"
SEED_PASSWORD = "password123"


def per_month(price: float) -> float:
    return round(price / 30, 2)


def per_week(price: float) -> float:
    return round(price / 7, 2)


# Verbatim from the 8 cards in Ui_Prototype_MVP_Prep/listing_page.html, in card order.
# image_url dest paths come straight from scripts/image_manifest.json.
LISTING_CARDS = [
    {
        "title": "Indiranagar 100ft Rd Junction",
        "space_type": "Digital OOH",
        "location": "Opposite Toit",
        "width_ft": 20, "height_ft": 15,  # prototype card grid gives no per-card size; using the
        # page's own "Dimensions (in feet)" filter option nearest to a digital OOH screen (20W X 15H)
        "footfall_estimate": 245000,
        "price_per_day": 45000.0,
        "display_unit": "/ Slot",
        "display_price": 45000,
        "image_url": "/images/listings/indiranagar-100ft-rd-junction.png",
        "extra": {"verified": True, "avg_per_day_shown_on_map": "₹32k"},
    },
    {
        "title": "Koramangala Sony World",
        "space_type": "Bus Shelter",
        "location": "80ft Road, 4th Block",
        "width_ft": 20, "height_ft": 10,  # nearest catalog size for a bus shelter kiosk (20W X 10H)
        "footfall_estimate": 180000,
        "price_per_day": per_month(85000.0),
        "display_unit": "/ Month",
        "display_price": 85000,
        "image_url": "/images/listings/koramangala-sony-world.png",
        "extra": {},
    },
    {
        "title": "MG Road Metro Pillar",
        "space_type": "Hoarding",
        "location": "MG Road, Bengaluru",
        "width_ft": 40, "height_ft": 20,  # nearest catalog hoarding size (40W X 20H)
        "footfall_estimate": 600000,
        "price_per_day": per_month(120000.0),
        "display_unit": "/ Month",
        "display_price": 120000,
        "image_url": "/images/listings/mg-road-metro-pillar.png",
        "extra": {},
    },
    {
        "title": "HSR 27th Main Hub",
        "space_type": "Digital Bus Shelter",
        "location": "HSR Layout Sector 1",
        "width_ft": 20, "height_ft": 10,
        "footfall_estimate": 120000,
        "price_per_day": 38000.0,
        "display_unit": "/ Slot",
        "display_price": 38000,
        # Source asset (hsr-27th-main-hub.png) rotted on the ephemeral image
        # host and is unrecoverable — null so the UI renders its branded
        # placeholder instead of a slow 404 request.
        "image_url": None,
        "extra": {},
    },
    {
        "title": "Hebbal Flyover Skywalk",
        "space_type": "Skywalk",
        "location": "Hebbal Junction",
        "width_ft": 30, "height_ft": 20,
        "footfall_estimate": 400000,
        "price_per_day": per_month(95000.0),
        "display_unit": "/ Month",
        "display_price": 95000,
        # Source asset (hebbal-flyover-skywalk.png) rotted on the ephemeral
        # image host and is unrecoverable — null so the UI renders its
        # branded placeholder instead of a slow 404 request.
        "image_url": None,
        "extra": {},
    },
    {
        "title": "BMTC Volvo - ORR Wrap",
        "space_type": "Transit",
        "location": "Hebbal to Silk Board",
        "width_ft": 20, "height_ft": 10,
        "footfall_estimate": 500000,
        "price_per_day": per_week(12000.0),
        "display_unit": "/ Week",
        "display_price": 12000,
        "image_url": "/images/listings/bmtc-volvo-orr-wrap.png",
        "extra": {},
    },
    {
        "title": "Indiranagar 12th Main",
        "space_type": "Digital OOH",
        "location": "Near Starbucks",
        "width_ft": 20, "height_ft": 15,
        "footfall_estimate": 310000,
        "price_per_day": 55000.0,
        "display_unit": "/ Slot",
        "display_price": 55000,
        "image_url": "/images/listings/indiranagar-12th-main.png",
        "extra": {},
    },
    {
        "title": "Meenakshi Mall Frontage",
        "space_type": "Hoarding",
        "location": "Bannerghatta Road",
        "width_ft": 40, "height_ft": 20,
        "footfall_estimate": 280000,
        "price_per_day": per_month(110000.0),
        "display_unit": "/ Month",
        "display_price": 110000,
        "image_url": "/images/listings/meenakshi-mall-frontage.png",
        "extra": {},
    },
]

# Verbatim from Ui_Prototype_MVP_Prep/listing_view.html (MG Road Premium Unipole detail page).
MG_ROAD_UNIPOLE = {
    "title": "MG Road Premium Unipole",
    "space_type": "Premium Front-Facing Billboard",  # the page's own breadcrumb category
    "location": "MG Road Central, Bengaluru",
    "description": (
        "Prime position on MG Road, capturing high-intent shoppers and corporate traffic. "
        "Located at the intersection of major commercial hubs and luxury retail outlets, "
        "this billboard ensures maximum brand recall for premium audiences. The north-facing "
        "orientation avoids direct glare, maintaining clarity from sunrise to late-night "
        "illumination."
    ),
    "width_ft": 40, "height_ft": 20,
    "footfall_estimate": 250000,
    "price_per_day": per_month(145000.0),
    "display_unit": "/ Month",
    "display_price": 145000,
    "image_url": "/images/listings/mg-road-premium-unipole.png",
    "extra": {
        "verified": True,
        "visibility_radius": "450m",
        "peak_hours": "9AM - 9PM",
        "annual_discount": "15% Off Annual",
        "refund_policy": "100% Refundable until 48hrs before start",
    },
}


def build_listing_kwargs(card: dict) -> dict:
    extra = dict(card["extra"])
    extra["display_unit"] = card["display_unit"]
    extra["display_price"] = card["display_price"]
    return {
        "title": card["title"],
        "space_type": card["space_type"],
        "description": card.get("description", ""),
        "location": card["location"],
        "width_ft": float(card["width_ft"]),
        "height_ft": float(card["height_ft"]),
        "price_per_day": card["price_per_day"],
        "footfall_estimate": card["footfall_estimate"],
        "status": ListingStatus.active,
        "lighting": card.get("lighting"),
        "image_url": card["image_url"],
        "extra": extra,
    }


def force_wipe(db) -> None:
    seed_users = db.scalars(select(User).where(User.email.in_([OWNER_EMAIL, ADVERTISER_EMAIL]))).all()
    user_ids = [u.id for u in seed_users]
    if not user_ids:
        return
    listing_ids = db.scalars(select(Listing.id).where(Listing.owner_id.in_(user_ids))).all()
    db.execute(delete(Payment).where(Payment.user_id.in_(user_ids)))
    db.execute(delete(Booking).where(Booking.advertiser_id.in_(user_ids)))
    db.execute(delete(CartItem).where(CartItem.user_id.in_(user_ids)))
    if listing_ids:
        db.execute(delete(CartItem).where(CartItem.listing_id.in_(listing_ids)))
    db.execute(delete(Listing).where(Listing.owner_id.in_(user_ids)))
    db.execute(delete(User).where(User.id.in_(user_ids)))
    db.commit()
    print(f"--force: wiped {len(user_ids)} seed user(s) and their dependent rows.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="Delete existing seed data (FK-safe order) and re-seed.")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        existing_owner = db.scalar(select(User).where(User.email == OWNER_EMAIL))
        if existing_owner and not args.force:
            print(f"{OWNER_EMAIL} already exists (id={existing_owner.id}); skipping seeding. Pass --force to re-seed.")
            return

        if args.force:
            force_wipe(db)

        owner = User(email=OWNER_EMAIL, full_name="Aarav Mehta", password_hash=password_context.hash(SEED_PASSWORD), role=Role.owner)
        advertiser = User(email=ADVERTISER_EMAIL, full_name="Priya Sharma", password_hash=password_context.hash(SEED_PASSWORD), role=Role.advertiser)
        db.add_all([owner, advertiser])
        db.commit()
        db.refresh(owner)
        db.refresh(advertiser)

        cards = LISTING_CARDS + [MG_ROAD_UNIPOLE]
        listings = [Listing(owner_id=owner.id, **build_listing_kwargs(card)) for card in cards]
        db.add_all(listings)
        db.commit()

        print(f"Seeded {len(listings)} listings owned by {OWNER_EMAIL}.")
        print("\nDemo credentials:")
        print(f"  owner:      {OWNER_EMAIL} / {SEED_PASSWORD}")
        print(f"  advertiser: {ADVERTISER_EMAIL} / {SEED_PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
