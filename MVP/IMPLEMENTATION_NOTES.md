# AdSpace MVP — Implementation Notes

This is the **only** markdown file in this repo, by design. Everything about
the MVP — what it is, how to run it, why some things look wrong but aren't,
and what's still missing — lives here.

## What this is

A working proof-of-concept OOH (out-of-home) ad-space marketplace:

- Register/log in as an **advertiser** or **owner**.
- Browse/search/filter live listings, view a listing detail page.
- Add a listing to a cart with dates + optional add-ons (printing,
  installation, monitoring), edit/remove cart lines.
- Check out with a **simulated** payment and get a confirmation/receipt page.
- As an owner: list a new ad space via a 5-step wizard, edit or archive your
  own listings.
- Browse **Partnerships** (`/partnerships`) — an institutional marketing page
  for agencies/media owners.
- As an owner: see who booked your spaces, for when and for how much, at
  **`/dashboard/owner`** — real revenue, occupancy and per-space performance
  (see the dedicated section below).
- View **Campaign Analytics** (`/analytics`) as an advertiser — real spend,
  schedule, and add-on numbers derived from your own bookings (see the
  dedicated section below for exactly what is and isn't real here).

Backend: FastAPI + SQLAlchemy + Alembic + SQLite, 20 routes, 50 passing
tests. Frontend: Next.js 15 / React 19 / Tailwind 3.4, 17 routes, production
build green.

### Deliberately out of scope

| Feature | Why it's not here |
| --- | --- |
| Real payment gateway | `POST /checkout` simulates payment synchronously; no webhook exists (see Known gaps). |
| Maps / geocoding | `MapPanel` is a static image, not a real map integration. |
| 2FA / password reset / email verification | Auth is register + login only. |
| Document file upload (wizard compliance step) | Dropzones render but are inert — "Document upload lands in a later milestone." |
| Admin review workflow | `Listing.status` has `pending_approval`/`rejected` states and a `rejection_reason` column, but every submission auto-approves straight to `active`. |
| Impression/reach/footfall/CTR tracking | No ad-verification or footfall-sensor backend exists. `/analytics` marks these explicitly as "Not instrumented" rather than inventing numbers — see below. |

## How to run it

**Backend** (from `MVP/backend/`):

```bash
cd MVP/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
python -m scripts.fetch_prototype_images     # downloads prototype images into ../frontend/public/images
python -m scripts.seed                       # seeds demo users + 9 listings
uvicorn app.main:app --reload                # http://127.0.0.1:8000, docs at /docs
```

Notes:
- Seeding is `python -m scripts.seed`, **not** `python scripts/seed.py`.
  `scripts/__init__.py` makes `scripts` a package; running it with `-m` puts
  the repo root on `sys.path` so `from app...` imports resolve. Running the
  file directly does not.
- Never run uvicorn with `--workers N` here — SQLite has one writer at a
  time, and multiple worker processes will intermittently deadlock/lock the
  file under concurrent writes. Single-process only.
- `--force` on `scripts.seed` wipes and re-seeds only the two demo users and
  their listings/bookings/payments/cart rows (FK-safe order), leaving
  anything else in the DB alone.

**Frontend** (from `MVP/frontend/`):

```bash
cd MVP/frontend
npm install
cp .env.local.example .env.local
npm run dev                                  # http://localhost:3000
```

Notes:
- If port 3000 is already taken, Next.js silently starts on 3001 instead —
  and every API call then fails with an opaque CORS error (the backend's
  `CORS_ORIGINS` only allow-lists 3000). Either free port 3000 first, or add
  `http://localhost:3001` to `CORS_ORIGINS` in `backend/.env` and restart
  uvicorn.
- `NEXT_PUBLIC_API_BASE_URL` in `.env.local` must point at the backend
  (`http://127.0.0.1:8000/api/v1` by default).

### Never run `next build` while `next dev` is up

`next dev` (Turbopack) and `next build` (Webpack) both write compiled chunks
into the configured `distDir`. If a build runs while a dev server is still
serving requests, the build yanks the dev server's chunk files out from
under it mid-flight, and the browser throws
`TypeError: Cannot read properties of undefined (reading 'call')` inside
`webpack.js` — a real crash this build hit once. The fix here is structural,
not just discipline: `next.config.ts` sets
`distDir: process.env.NEXT_DIST_DIR || ".next"`, and `package.json`'s `dev`
script sets `NEXT_DIST_DIR=.next-dev`, so:

- `npm run dev` writes to `.next-dev/` (Turbopack).
- `npm run build` / `npm start` write to `.next/` (Webpack, unchanged default).

The two can now never corrupt each other's output, even if someone runs both
at once. Both directories are gitignored (`MVP/.gitignore`). Still: only run
one server at a time, and prefer `pgrep -f next-server | xargs -r kill -9`
before a fresh build regardless — the isolated dirs prevent *corruption*, not
the more mundane problem of two processes fighting over port 3000.

## Demo credentials

Seeded by `scripts/seed.py` (post email-domain fix — see Bug fix below):

| Role | Email | Password | Can do |
| --- | --- | --- | --- |
| Owner | `owner@adspace.example` | `password123` | Owns the 9 seeded listings; can list new spaces, edit/archive its own listings via the wizard. |
| Advertiser | `advertiser@adspace.example` | `password123` | Can browse, add to cart, check out, view its own bookings/payments. |

## Bug fix: seeded demo accounts could never log in

`scripts/seed.py` used to seed `owner@adspace.test` / `advertiser@adspace.test`.
It inserts `User` rows directly via SQLAlchemy, bypassing Pydantic — so the
rows existed in the DB — but `POST /auth/login`'s `LoginRequest.email` is a
Pydantic `EmailStr`, validated by `email-validator==2.3.0`, which rejects
`.test` as an IANA-reserved special-use TLD and returns `422` before the
password is even checked. **Every login attempt for both demo accounts
failed**, regardless of password.

Fix: renamed both seed emails to the `adspace.example` domain — `.example`
is the IETF-reserved documentation TLD (RFC 2606), so it's semantically
correct for demo data and passes `email-validator` (`.test`, `.example`,
`.invalid`, `.localhost` are all reserved, but `email-validator` special-
cases `.test` as un-deliverable/rejected while accepting `.example`).

Verified with the actual server, not by inspection:

```
POST /api/v1/auth/login  {"email":"owner@adspace.example","password":"password123"}       -> 200, token issued
POST /api/v1/auth/login  {"email":"advertiser@adspace.example","password":"password123"}  -> 200, token issued
```

## Architecture

### Backend: flat `main.py`, two extracted modules

Like the reference (non-MVP) backend, there's no service/repository layer —
routes, auth checks, and pricing math sit directly in `app/main.py`. Two
pieces were pulled out anyway, each for a specific import-time reason:

| Module | Why it's separate |
| --- | --- |
| `app/security.py` | `password_context` (passlib), JWT create/verify, and the `require_roles` dependency. `scripts/seed.py` needs `password_context.hash(...)` to seed users **without importing `app.main`**, which would construct the whole FastAPI app (middleware, rate limiter, etc.) as an import side effect just to hash a password. |
| `app/pricing.py` | `ADDON_CATALOG`, `inclusive_days`, `quote_line`, `quote_cart`. Both `tests/` and the cart/checkout routes need identical pricing logic; extracting it means the tests import the exact function the route calls, instead of re-deriving the formula and hoping it stays in sync. |

Everything else — routes, request/response shaping, authorization checks —
stays in `app/main.py`.

### The 5 tables and their lifecycles

| Table | Lifecycle | Notes |
| --- | --- | --- |
| `users` | — | `role` is `advertiser` \| `owner` \| `admin` (enforced in route dependencies, not at the DB level). `admin` is a **superset of the other two**: `require_roles` lets it through every role gate, and `RequireRole` on the frontend mirrors that, so one admin account can work the owner surfaces and the advertiser surfaces. No route is gated on `admin` *alone* — it grants reach, not extra data: every endpoint still scopes its query to the caller's own id, so an admin sees its own listings/cart/bookings, never everybody's. |
| `listings` | `pending_approval` → `active` → `archived` (soft delete); `rejected`/`paused` exist in the enum but are unused — every submission auto-approves to `active`. | `DELETE` always archives + purges referencing cart rows in the same transaction (see below). |
| `cart_items` | ephemeral — created on add-to-cart, replaced on edit, deleted on remove/checkout/clear. | Unique on `(user_id, listing_id, start_date, end_date)`; add-to-cart is idempotent against that. Stores add-on **codes**, not prices. |
| `bookings` | created `booked` directly at checkout (no `pending_payment` hop — see below); `active`/`cancelled` exist but nothing transitions to them yet. | Stores a **price snapshot** (`base_amount`, `addons_amount`, `gst_amount`, `total_amount`) — the immutable record of what was charged. |
| `payments` | `created` → `paid` (checkout writes `paid` immediately, since there's no real gateway round-trip to wait on) / `failed` (unused — nothing can fail). | `booking_ids` is a JSON array; one payment can cover many bookings from one checkout. |

### Frontend: three route groups, two nav shells

| Route group | Routes | Nav shell |
| --- | --- | --- |
| `(marketing)` | `/`, `/marketplace`, `/listings/[id]`, `/support`, `/partnerships` | `NavShellA` — public marketing/marketplace top nav, ported from `index.html`/`listing_page.html`. Owns the search affordance (see Polish below). |
| `(auth)` | `/login`, `/register` | No shared nav shell — full-bleed auth layout with `AuthVisualPanel`. |
| `(app)` | `/cart`, `/checkout`, `/list-your-space/*`, `/analytics`, `/dashboard/owner` | `NavShellB` — logged-in app shell, ported from `checkout_page.html`/`listing_your_adspace.html`. Normalized to `sticky` (the prototype mixed `fixed`+`pt-32` and `sticky` across pages). |

`/partnerships` (ported from `Partnerships.html`) and `/analytics` (ported
from `Campaign_analytics.html`) were the two prototype pages never carried
over in an earlier pass — proof was that `/partnerships`'s 5 downloaded
images (`misc/partnerships-*.png`) had zero references anywhere in `src/`.
Both are now linked from their nav shell (`NavShellA`/`NavShellB`) and
`/partnerships` is additionally linked from `SiteFooter`'s Platform column.

#### `/analytics`: what's real and what isn't

The prototype's `Campaign_analytics.html` is entirely hand-authored fake
copy — "4.2M" reach, "12.4%" trend, "₹4.12" CPM, "842k" weekly reach, "48
active displays" — with no backend behind any of it. This build has **no**
impression-tracking, footfall-sensor, or ad-verification system, so none of
those numbers can be measured. Rather than reproduce them, `/analytics`
(guarded by `RequireRole role="advertiser"`, since `GET /bookings` is
advertiser-only on the backend) derives every figure from the signed-in
advertiser's real data:

| Shown (real) | Source |
| --- | --- |
| Total spend, GST paid, booking counts | `GET /bookings` (`base_amount`/`addons_amount`/`gst_amount`/`total_amount`) |
| Active / Upcoming / Completed campaign counts | Computed client-side from `start_date`/`end_date` vs. today — `booking.status` isn't used for this because it never transitions past `booked` in this build (see "Bookings go straight to `booked`" below) |
| Spend by listing, listing titles/locations/thumbnails | `GET /bookings` joined with `GET /listings/{id}` per unique `listing_id` (same enrichment pattern as `ConfirmationPanel`) |
| Spend by month, "Where your money went" (base/add-ons/GST split) | Aggregated client-side from the same booking rows |
| Add-ons booked (counts + amounts by code) | `booking.addons` (the price-snapshotted `AddonLine[]` on each booking) |
| CSV export | Built client-side from the same fetched data — a real download, not a stub button |

What's **not** shown as real: impressions, reach, footfall delivered, and
click-through rate all render as a muted "—" inside a dashed-border "Not
instrumented in this POC" section with a `Badge`, rather than being invented
or omitted silently. The empty-state (zero bookings) links to `/marketplace`;
loading uses `Skeleton`.

#### `/dashboard/owner`: the owner half of the marketplace

Until this existed the owner side had no surface at all: `MyListingsPanel`
(wizard sidebar) showed inventory, but nothing anywhere told an owner who had
booked their spaces, for when, or for how much — `GET /bookings` is
advertiser-only, and the join through `Listing.owner_id` had no endpoint.

Backend: `GET /api/v1/owner/bookings` (owner-only) returns every booking made
against the caller's inventory, joined to the listing and to the booking
advertiser, newest first. Scoping is by the join (`Listing.owner_id ==
caller`), never by an id in the request, so an owner cannot read another
owner's bookings. Archived listings keep their bookings in the result — past
bookings are still real revenue and must not disappear when a space retires.
`OwnerBookingOut` is deliberately a different shape from `BookingOut`: it
carries the counterparty (name + email, so the owner can actually contact
them) and the space, neither of which the advertiser-facing schema needs.

Frontend `/dashboard/owner` (`RequireRole role="owner"`, advertisers bounce to
`/analytics`) derives everything from that endpoint plus `GET
/owner/listings`:

| Shown (real) | Source |
| --- | --- |
| Space revenue, add-on services, GST, gross booked value | `booking.base_amount` / `addons_amount` / `gst_amount` / `total_amount` |
| On air / Upcoming / Completed counts | Computed from `start_date`/`end_date` vs. today — `booking.status` never transitions past `booked` in this build |
| Next-90-day occupancy | Inclusive overlap of each booking with a fixed 90-day forward window, over `active` listings × 90 |
| Per-space performance, incl. spaces with zero bookings | `GET /owner/listings` keyed by id, merged with the booking rollup — "which of my spaces isn't selling" is the point |
| Who booked (name, mailto link) | `advertiser_name` / `advertiser_email` on each row |
| CSV export | Built client-side from the same fetched rows |

The money is labelled **booked value**, never "paid out": there is no payout
or settlement pipeline in this build, so only the first band (space rate) is
owner earnings — add-ons are platform-fulfilled and GST is statutory. Payouts
settled, next payout date, proof of display and market-relative occupancy sit
in a dashed "Not built yet" block, the same convention `/analytics` uses for
its uninstrumented metrics.

`NavShellB`'s links are role-aware as a result: an owner sees "My Inventory"
(`/dashboard/owner`), an advertiser sees "Analytics" (`/analytics`). Linking
both to everyone would just show each role a link `RequireRole` immediately
bounces them off.

#### `/support`: aligned to the prototype, with one deliberate gap

An earlier pass built `/support` "in spirit" without closely consulting
`support_page.html`, landing on a plain hero + FAQ accordion. This pass
re-aligned the visual language to the prototype (large "How can we help you
scale?" headline, pill search bar, rounded-full bento category cards) and
grouped the existing FAQ content under the same three categories the bento
cards advertise. **Not** reproduced: the prototype's "Support Portal" ticket
list, which is fake data top to bottom (ticket IDs like `#8842`, invented
agents "Marcus Chen"/"Sarah Jenkins", an invented "99.9% SLA" stat) with no
ticketing backend behind it — carrying that over would be exactly the kind
of fabricated-numbers-as-real problem `/analytics` was built to avoid.

Auth (`AuthProvider`) and cart (`CartProvider`) are React Context, mounted
once in `app/providers.tsx`, shared across all three groups.

## Decisions that look wrong but aren't

- **Tailwind pinned to `3.4.19`, deliberately not v4.** A v4 upgrade breaks
  three things silently: `rounded-full` stops being theme-driven (~40
  pills/avatars depend on it resolving through the theme), the default
  border color flips from `gray-200`-like to `currentColor` (darkening every
  bare `border`), and `ring` drops from a 3px default to 1px. Both
  `@tailwindcss/forms` and `@tailwindcss/container-queries` here also target
  v3. **Reject a v4 upgrade PR** unless it explicitly re-audits all three.
- **`primary` is `#00081e`, not `#0A1F44`.** The prototype's own
  `tailwind.config.js` declared `primary` twice; in a plain JS object
  literal the later key wins, so `#00081e` is what the prototype actually
  rendered everywhere. `tailwind.config.ts` here keeps that behavior on
  purpose — `#0a1f44` survives as `primary-container`. Don't "fix" this to
  the first-declared value; that would visually regress vs. the prototype.
- **`borderRadius` uses "Scale A".** The prototype shipped two conflicting
  scales across its five per-page configs. Scale B redefines `full:
  0.75rem`, which silently turns every `rounded-full` avatar into a rounded
  square. Scale A (used here) leaves `full` at Tailwind's default `9999px`.
- **Cart stores add-on codes; `Booking` stores a price snapshot.**
  `cart_items.addons` is `["printing", "monitoring"]` — no prices — and
  every cart read re-prices against `ADDON_CATALOG` live (`app/pricing.py`),
  so cart-vs-checkout price drift is structurally impossible. `bookings`, by
  contrast, freezes `base_amount`/`addons_amount`/`gst_amount`/`total_amount`
  at checkout time, because a booking is a receipt of what was actually
  charged — it must not silently reprice if the catalog changes later.
- **Bookings go straight to `booked`, skipping `pending_payment`.** The
  dummy payment step cannot fail (there's no gateway to reject it), so
  parking a booking in `pending_payment` first would be a lie that only
  creates orphan-cleanup work for a state nothing will ever occupy.
- **Listing `DELETE` is always a soft archive**, plus a purge of cart rows
  referencing that listing (not a hard delete — `bookings.listing_id` is a
  non-nullable FK, and hard-deleting would either violate that or orphan
  purchase history). **Non-owner `PUT`/`DELETE` return `404`, not `403`** —
  so probing listing IDs you don't own can't distinguish "doesn't exist"
  from "exists but isn't yours."
- **Auth is `localStorage` + React Context, not cookies.** The backend only
  authenticates via `HTTPBearer` (`Authorization: Bearer <token>`); cookie
  auth would need either a backend change or a BFF proxy layer, neither of
  which exists here.

## Known gaps / not production-ready

- **Money is `Float`, not `Decimal`**, on both `listings.price_per_day` and
  every booking/payment amount column. Fine for a POC; not safe for real
  settlement (rounding drift compounds).
- **No payment gateway.** `POST /checkout` simulates payment synchronously
  and returns `paid` — there is no webhook, no async confirmation, and the
  card fields in `DummyPaymentForm` are cosmetic and never leave the
  browser.
- **localStorage JWT is XSS-readable, and there's no `middleware.ts` route
  protection.** Server middleware can't see `localStorage`, so all guarding
  (`RequireAuth`, `RequireRole`) is client-side — an unauthenticated visitor
  briefly gets served the page shell before the client-side redirect fires.
- **3 of 31 prototype images have rotted.** The manifest's source URLs are
  ephemeral `lh3.googleusercontent.com/aida-public/*` Google Stitch preview
  links; 2 listing thumbnails (`hsr-27th-main-hub.png`,
  `hebbal-flyover-skywalk.png`) and 1 gallery slot
  (`mg-road-unipole-3.png`) now 400. The UI degrades to a branded
  gradient placeholder (`ListingCard`/`CartItemRow`'s `onError` swap).
  Re-running `scripts.fetch_prototype_images` will not recover them — the
  source URLs themselves are dead, not a local caching issue.
- **`seed.py` had to invent width/height/lighting for 8 of 9 listings**
  because `listing_page.html`'s marketplace cards never state per-card
  dimensions — those fields are filled in from the page's own "Dimensions"
  filter option nearest to each space type. Titles, locations, space types,
  footfall estimates, and prices are verbatim from the prototype.
- **Prototype prices mixed `/Slot`, `/Month`, `/Week`; checkout is always
  `days × price_per_day`.** Seeding normalizes every listing to a per-day
  rate (`/Month` price ÷ 30, `/Week` price ÷ 7) and preserves the original
  figure/unit in `listing.extra.display_price` / `extra.display_unit` so
  `ListingCard` still renders "₹85k / Month" while checkout math stays
  correct in per-day terms.
- **Wizard document dropzones (compliance step) are inert.** They render
  but don't accept files — "Document upload lands in a later milestone" is
  shown inline rather than pretending to work.
- **No admin review flow.** `ListingStatus.pending_approval`/`rejected` and
  `Listing.rejection_reason` exist in the schema but are dead — every
  `POST /listings` auto-approves straight to `active`.

## Polish applied this pass

- **`SearchModal`** (`src/components/layout/SearchModal.tsx`) — built, not
  skipped: `NavShellA`'s search button rendered on every marketing/
  marketplace/listing-detail page but had no `onClick` at all. Now opens a
  focus-trapped, `Esc`-to-close overlay (also bindable via `Ctrl+K`/`Cmd+K`,
  listener lives in `NavShellA`) that debounce-queries `GET /listings?q=`
  and links results to `/listings/{id}`. `NavShellB` (the app shell) has no
  search affordance in the prototype it was ported from, so it was left
  alone.
- **`ToastMessage.description`** widened from `string` to `ReactNode`, plus
  the "Added to cart" toast in `BookingSidebar` now includes an inline
  "View cart" link instead of just prose telling you to go find one
  yourself. Every other `showToast` call site still passes a plain string,
  which remains valid under the wider type — no other call sites changed.
- **`no-page-custom-font` ESLint warning** on `src/app/layout.tsx` — the
  Material Symbols `<link>` is a deliberate choice (`next/font/google`'s
  variable-axis support for `wght,FILL@100..700,0..1` is fragile). Silenced
  with a targeted `eslint-disable-next-line` and a comment explaining that
  the rule's premise (a per-page font in the `pages/` router) doesn't apply
  to the `app/` router's single root layout, which already loads the font
  for every route.
- **Loading/empty/error states audited across every page that fetches**
  (`MarketplaceBrowser`/`ListingGrid`, `CartClient`, `CheckoutClient`,
  `ConfirmationPanel`, `MyListingsPanel`, `BookingSidebar`, `CartItemRow`):
  all already had a `Skeleton` while pending, an `EmptyState` at zero
  results, and `ApiError`-aware error handling. **No changes were needed
  here** — this was a genuine audit, not a rewrite.
- **Route sweep** (`/`, `/marketplace`, `/listings/[id]`, `/login`,
  `/register`, `/cart`, `/checkout`, `/list-your-space/*`): all 12 routes
  checked against a live backend via `next dev` + `curl`, cross-referenced
  against the dev server log — 200s across the board, no server errors, no
  `hydrat`/`Error:` strings in any SSR payload. `AuthProvider`/`RequireAuth`
  already follow the hydration-safe pattern documented in their own
  comments (state initializes to `"loading"` on both server and client;
  `localStorage` is only read inside `useEffect`).
- **Follow-up route sweep** (added `/partnerships`, `/analytics`, revised
  `/support`): all 16 routes re-checked the same way — `curl` every route
  200, dev log clear of `⨯`/`Error`, an actual advertiser login + cart +
  checkout round-trip against the running backend to seed one real booking,
  confirmed via `GET /bookings` before `/analytics` was traced against it.
  Internal link audit (`grep -rhoE 'href="/[^"]*"'` plus every dynamic
  `href={...}` site) and the `/images/...` existence audit both came back
  clean — nothing pointed at a route or image file that doesn't exist.

## Double-booking: the checkout race, and how it is closed

`checkout()` used to be a plain check-then-act: SELECT for a conflicting
booking, then INSERT. SQLite hid that, because it serializes writers — but
production runs Postgres (Neon), where at the default READ COMMITTED
isolation two concurrent checkouts for the same listing and overlapping
dates could both pass their SELECT before either committed, and the space
was sold twice. This was reproduced against a real Postgres 16 before it was
fixed: two simultaneous checkouts, two `201`s, two rows in `bookings` for the
same listing and the same dates.

It is closed in two independent layers, either of which is sufficient:

1. **`SELECT ... FOR UPDATE` on the listing rows** (`app/main.py`), taken
   before the overlap checks, over the distinct listing ids **ordered by
   id** — the ordering is what stops two multi-item checkouts from
   deadlocking on each other. `with_for_update()` emits nothing on SQLite,
   which is correct: SQLite already allows one writer at a time.
2. **A Postgres `EXCLUDE` constraint** (migration `c7f1a9d4e210`) on
   `(listing_id WITH =, daterange(start_date, end_date, '[]') WITH &&)`
   `WHERE status IN ('pending', 'booked', 'active')`. The database refuses
   the overlapping row no matter who inserts it — a script, a future worker,
   a second API process. `IntegrityError` from it is caught in `checkout()`
   and returned as the same `409` the SELECT would have produced, so it
   never surfaces as a 500.

Two details that are easy to get wrong in that constraint:

- The range is `[]` (both ends inclusive), matching the pricing rule that
  bills the start *and* the end date.
- The predicate lists enum **names**, not values. `Enum(BookingStatus,
  native_enum=False)` persists the member name, so the column holds
  `'pending'`, not `'pending_payment'`. `cancelled` is excluded so a
  cancelled booking does not block a re-sale of those dates.

The migration is Postgres-only and branches on the dialect, so
`alembic upgrade head` on SQLite is a no-op — `tests/test_migrations.py`
runs the whole chain up and back down on SQLite to keep that branch honest.

**Deploy note:** the constraint needs the `btree_gist` extension. The
migration issues `CREATE EXTENSION IF NOT EXISTS btree_gist`, which Neon
allows; on a managed Postgres that does not, the migration fails loudly
rather than silently skipping a safety constraint.

Verified on Postgres 16 with the extension installed:

| Configuration | Result |
| --- | --- |
| Neither layer (the old code) | 2 × `201`, two overlapping bookings — the bug |
| EXCLUDE constraint only | `201` + `409`, one booking, no traceback |
| Both layers (shipped) | `201` + `409`, one booking, no traceback |

## Testing

```bash
cd MVP/backend && source .venv/bin/activate && pytest -q   # 50 tests
cd MVP/frontend && npm run build                            # the real gate
```

Backend tests (`tests/test_auth.py`, `test_listings.py`, `test_cart.py`,
`test_checkout.py`, `test_owner_dashboard.py`, `test_migrations.py`) cover: registration/login/role-guard rejection, listing
CRUD + ownership checks (404-not-403 on cross-owner writes), archived
listings staying hidden from browse but visible to their owner, every
filter/sort combination, cart idempotency and 409s (bad addon code, inverted
dates, inactive listing, overlapping bookings), and checkout's happy path,
empty-cart 409, intra-cart self-conflict 409, and full-rollback-on-overlap
behavior, the owner view of bookings (`/owner/bookings`: own inventory only,
owner-only, archived listings retained, counterparty fields), and that the
whole migration chain runs up and back down on SQLite. `tests/conftest.py`
gives every test a fresh in-memory SQLite DB
via a FastAPI dependency override — nothing touches `adspace_mvp.db`.

`npm run build` is the real frontend gate, not `npm run dev`: dev mode
tolerates a missing `<Suspense>` around `useSearchParams()`, un-awaited
`params`/`searchParams` (both are Promises in Next 15), and RSC boundary
violations that `next build` hard-fails on. Several components
(`CheckoutClient`'s `PaymentParamSync`, `LoginForm`, `FilterBar`,
`EditModeSync`) carry comments explaining exactly this.

## Continuous integration

Four workflows, all on GitHub-hosted runners (`.github/workflows/`):

| Workflow | Runs on | What it gates |
| --- | --- | --- |
| `ci.yml` | push to `main`/`MVP`, every PR | Frontend: `npm run lint`, `npx tsc --noEmit`, `npm run build`. Backend (matrix over **both** `MVP/backend` and `backend/`): `ruff check .`, `pytest -q`. |
| `security.yml` | push, PR, weekly Monday cron | `bandit -ll` over application/script code, `pip-audit` over both pinned requirement files, `npm audit` (fails on **critical**, reports **high**). |
| `dependency-review.yml` | PRs only | Fails a PR that *introduces* a dependency with a known critical vulnerability. |
| `codeql.yml` | push/PR to `main`, weekly cron | GitHub's SAST over JavaScript/TypeScript and Python. |

Plus `.github/dependabot.yml`: weekly grouped update PRs for npm, both pip
directories, and the actions themselves. Minor/patch updates are batched into
one PR per ecosystem; majors stay separate, because a Next or Tailwind major
here is a deliberate, re-tested decision (see the Tailwind v3-not-v4 note
above), not a rubber stamp.

Notes on the gates, since a few are deliberately not "fail on everything":

- **Lint config is narrow on purpose.** `ruff.toml` (repo root, covers both
  services) selects pyflakes, import order, and syntax/module-level import
  errors only. `E701`/`E702` are left out: both services declare compact
  Pydantic schemas as `id: int; email: EmailStr; full_name: str`, and
  enforcing one-statement-per-line would have flagged 170 lines of
  intentional house style and buried the real findings.
- **`npm audit` fails on critical, reports high.** Every current `high`
  (postcss, sharp, nanoid) resolves only by upgrading Next 15 → 16 — a major
  bump that needs its own re-test pass, not a blocked routine PR. The report
  step still prints the list on every run.
- **`pip-audit` runs with `--no-deps`**, auditing exactly the pinned lines,
  which is what actually deploys.
- **CodeQL advanced setup and CodeQL "default setup" are mutually
  exclusive.** If default setup is ever switched on in Settings → Code
  security, `codeql.yml` starts failing with `CodeQL default setup is
  enabled`; pick one or the other.
- **Dev tooling is pinned in `MVP/backend/requirements-dev.txt`**, separate
  from `requirements.txt` so linters never ship into the Vercel bundle. An
  unpinned linter turns someone else's release into a red build on an
  unrelated PR.

Enabling CI surfaced (and this pass fixed) real findings: 37 ruff errors
across both backends, two ESLint errors in `tailwind.config.ts`, two unused
imports, a `urlopen` that accepted any URL scheme from the image manifest,
and five known CVEs in `python-multipart` 0.0.22 plus one in `lxml` 6.0.2 —
both bumped to patched pins, with both test suites re-run after.

## Deployment: GitHub Pages (frontend only)

`.github/workflows/deploy-pages.yml` builds `MVP/frontend` as a static export
and publishes it to GitHub Pages on every push to the **`MVP`** branch (or
via *Actions -> Run workflow*). It runs on a GitHub-hosted `ubuntu-latest`
runner — nothing in the build needs a self-hosted one.

**Pages serves static files only, so the backend is not deployed by it.**
`MVP/backend` is FastAPI: it needs a live process and a database, neither of
which Pages provides. The published site is the real UI, fully navigable,
but every data-driven surface (marketplace listings, login, cart, checkout)
stays empty until it is pointed at a running API.

To point it at one, set the repository variable
`NEXT_PUBLIC_API_BASE_URL` (Settings -> Secrets and variables -> Actions ->
*Variables*) to e.g. `https://your-api.onrender.com/api/v1`, and add the
Pages origin to the API's `CORS_ORIGINS`. It is a **variable, not a
secret** — `NEXT_PUBLIC_*` values are inlined into the client bundle at
build time and are readable by anyone, so storing it as a secret would only
hide it from the repo UI, not from users.

Unset, it falls back to `http://127.0.0.1:8000/api/v1`, which means the
deployed page will talk to a backend running on the viewer's own machine.
That is genuinely useful for a demo (browsers exempt `127.0.0.1` from
mixed-content blocking as a trustworthy origin) provided `CORS_ORIGINS`
includes the Pages origin — but it works only for someone running the
backend locally, not for a general visitor.

### What static export required

Four changes, all gated behind `NEXT_OUTPUT=export` so `npm run dev` and
`npm run build` behave exactly as they did before:

1. **`next.config.ts`** gains `output: "export"`, `trailingSlash`,
   `basePath`/`assetPrefix` (from `NEXT_PUBLIC_BASE_PATH`) and a custom image
   loader — but only in export mode, because `output: "export"` disables
   `next start` and every server-rendering feature.
2. **`src/lib/pages-image-loader.ts`** is new, and is the non-obvious one.
   A project site is served from `/<repo>/`, and while `basePath` is applied
   automatically to `<Link>` hrefs and `_next/*` assets, it is **not** applied
   to a `next/image` `src` under `images.unoptimized` — which would have
   404'd every image on the deployed site while looking perfect locally. A
   custom loader replaces `unoptimized` (the two are mutually exclusive:
   `unoptimized` bypasses the loader) and prepends the base path itself.
3. **`/listings/[id]`** moved its data fetch from the Server Component into
   a new client component (`ListingDetailClient.tsx`). Export prerenders on
   a CI runner with no reachable API, so a server-side fetch would either
   fail the build or freeze one snapshot of the database into static HTML.
   The page also needs `generateStaticParams` — export cannot build a
   dynamic segment without an enumerable path list — so it emits shells for
   ids `1..NEXT_EXPORT_LISTING_IDS` (default 60), each of which fetches its
   own listing in the browser. Ids past that band land on Pages' `404.html`.
4. **`/list-your-space`** swapped its server `redirect()` for a client-side
   `router.replace()` in a `<Suspense>` boundary; a static export has no
   server to issue the 307.

The repo-root `.gitignore` also had to change from `.github/` to
`.github/*` + `!.github/workflows/`. A directory exclusion cannot be undone
by a later negation — git does not descend into an excluded directory — so
excluding the *contents* is what lets the workflow be committed while
`.github/skills/` stays ignored.

### First-time setup (one manual step)

Settings -> Pages -> **Source: GitHub Actions**. Without it the workflow
builds and then fails at the deploy step. This cannot be scripted from the
repo; it is a per-repository setting.

## If you pick this up next

1. A real payment webhook (Stripe/Razorpay) replacing the synchronous
   `POST /checkout` simulation, with `payments.status` actually able to
   land on `failed`.
2. `Decimal` money end-to-end (schema + Pydantic + frontend formatting)
   instead of `Float`.
3. Real file upload for the wizard's compliance-step document dropzones.
4. The still-deferred features: maps/geocoding, an impression/reach/
   footfall-tracking backend (would let `/analytics`'s "Not instrumented"
   section become real), 2FA, admin listing review (the schema already has
   `pending_approval`/`rejected`/`rejection_reason` sitting unused).
