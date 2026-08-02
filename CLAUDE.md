# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository shape

This repo has two mostly-independent halves that are being wired together:

- `Ui_Prototype_MVP_Prep/` — static HTML/CSS/Tailwind prototype of the marketplace (no build step, no bundler; open files directly or serve as static files).
- `backend/` — a FastAPI + SQLAlchemy + Alembic REST API for the same product. This is the source of truth for business logic; the frontend is being progressively connected to it (see "Frontend/backend wiring" below).
- `backend/scraper/` — a standalone CLI that collects competitor OOH inventory into JSONL/CSV and optionally imports it as `pending_approval` listings. It imports from `app.*` but nothing in `app/` imports it, and the API never invokes it. See `backend/scraper/README.md`.

The root `index.html` is just a meta-refresh redirect into `Ui_Prototype_MVP_Prep/index.html` (the marketplace landing page).

## Backend: commands

All commands run from `backend/` with the venv active:

```bash
cd backend
source .venv/bin/activate
cp .env.example .env          # first time only
# set DATABASE_URL=sqlite:///./adspace.db in .env for local SQLite instead of Postgres
alembic upgrade head          # apply migrations — schema is never created via create_all()
uvicorn app.main:app --reload # run the API; interactive docs at /docs
```

Tests:

```bash
pytest -q                          # full suite
pytest -q tests/test_smoke.py      # single file
pytest -q tests/test_design_workflows.py::test_name_here  # single test
```

`tests/conftest.py` spins up a fresh in-memory SQLite DB per test and overrides the FastAPI DB dependency, so tests never touch `adspace.db`, Postgres, S3, Maps, GST, or a payment gateway.

After changing `app/models.py`, create a migration rather than relying on autocreate:

```bash
alembic revision --autogenerate -m "describe change"
alembic upgrade head
```
Review the generated SQL before applying it.

Docker: `docker compose up --build -d` (from `backend/`) runs `alembic upgrade head` then Uvicorn. Requires `APP_ENV=production`, a real `DATABASE_URL`, a 32+ char `SECRET_KEY`, and restrictive `CORS_ORIGINS`/`ALLOWED_HOSTS` — see `docs/DEPLOYMENT.md`.

## Backend: architecture

Everything routes through a small, flat module set — there is no service/repository layer:

| Path | Responsibility |
| --- | --- |
| `app/main.py` | All routes, authorization checks, pricing math, workflow orchestration, security middleware. |
| `app/models.py` | SQLAlchemy entities and status enums. |
| `app/schemas.py` | Pydantic request/response schemas. |
| `app/database.py` | Engine, session factory, `get_db` dependency. |
| `app/config.py` | Environment-backed settings. |
| `app/integrations.py` | GST validation, Google Maps geocoding, S3/local file storage, SMTP, invoice PDF generation — all as thin adapters, each falling back to a no-op/local behavior when unconfigured. |
| `alembic/` | Migration environment; only path allowed to change the DB schema. |

Core entities and their lifecycles (full detail in `backend/docs/ARCHITECTURE.md`):

- `Listing` (owner inventory): `pending_approval` → `active`/`rejected`; `active` can be `paused`/resumed.
- `Booking`: `pending_payment` → `booked` → `active`, or `cancelled`.
- `VASOrder` (printing/installation/maintenance): `unassigned` → `scheduled` → `in_progress` → `completed`, or `cancelled`. May be linked to a booking or standalone (owner's own space).
- `Payment`: `created` → `paid`/`failed`. **Confirmation is a development-only simulated endpoint** (`POST /payments/{id}/confirm`) and is disabled when `APP_ENV=production` — there is no real payment gateway webhook yet. Never wire a frontend "confirm" button to production traffic against this endpoint.

Roles are `advertiser`, `owner`, `admin`, enforced by guards in `main.py` (not DB-level). Production blocks public admin self-registration.

Pricing (in `app/main.py`, `VAS_RATES`): booking base = inclusive days × `listing.price_per_day`; VAS = printing ₹25/unit, installation ₹1,500/unit, maintenance ₹750/unit; GST is a flat 18% over base+VAS. Money is stored as `Float` in the MVP schema — treat as not yet safe for real settlement (see `docs/OPERATIONS.md` for the full list of pre-launch gaps: payment webhooks, Decimal money, async notification dispatch, signed document URLs, DB-level booking concurrency locks).

When a booking includes VAS items at checkout, those line items are persisted with the booking and a linked `VASOrder` is created once payment is confirmed; a standalone VAS order (no booking) is created immediately; a VAS *reorder* against an existing space requires an active booking.

Full endpoint list: `backend/docs/API.md`. Base path is `/api/v1`; protected routes take `Authorization: Bearer <token>`.

## Scraper

```bash
cd backend && source .venv/bin/activate
python -m scraper.cli scrape themediaant --location "Bangalore, Karnataka, India" \
    --location-id "ChIJbU60yXAWrjsR4E9-UejD3_g" --images --out data/bangalore
python -m scraper.cli import data/bangalore/listings.jsonl
```

Needs `beautifulsoup4` + `lxml`; `playwright` only for `scraper/browser.py`, which
is for sites that build their listings client-side (themediaant does not).

Scraped rows land in `listings` as `pending_approval` under a synthetic
`scraped-inventory@internal.invalid` owner, with provenance in `scraped_listings`
(unique `source_url`, so re-imports update in place). Never auto-approve them —
they go through the same admin review as owner submissions.

Adapters live in `scraper/adapters/`; everything shared (HTTP politeness,
parsing, images, output) sits outside them. An adapter that can report
`expected_counts()` lets the CLI reconcile a run against the source's own totals
— on sites with unstable pagination that is the only way to know a run finished.
Add per-site quirks to `scraper/README.md`, not to the adapter's docstring alone.

## Marketplace browse contract

`GET /listings` (both backends) returns a **paged envelope**
`{items, total, limit, offset}`, not a bare list — a real city catalogue is
thousands of rows. It filters on `q`, `space_type`, `lighting`/`illumination`,
price, width/height/area ranges, exact `size` ("40W X 20H"), `min_footfall` and
`has_dimensions`, with `sort` and `limit`/`offset`.

`GET /listings/facets` returns the dropdown options (space types, lightings,
common sizes, price range) derived from live inventory. The UI must read filter
options from it rather than hardcoding lists that drift from the data. It is
declared **before** `/listings/{listing_id}` so the literal path wins.

`Listing.width_ft`/`height_ft` are **nullable** in `MVP/backend`: real inventory
does not always publish a size (bus shelters are sold by a Small/Medium/Large
bucket, kept in `extra.size_bucket`). Anything rendering dimensions must degrade
rather than print `null x null`.

## Static snapshot (GitHub Pages)

Pages is a static host with no backend. `MVP/frontend/src/lib/listings-source.ts`
tries the API first and falls back to `public/data/*.json`, so the deployed site
stays browsable; booking and checkout still need a real API. The fallback only
triggers on a transport failure — a 4xx/5xx from a reachable API is surfaced, not
masked with stale data.

Regenerate the snapshot whenever the catalogue changes, or the deployed site
keeps showing the old inventory:

```bash
cd MVP/backend && source .venv/bin/activate
python -m scripts.export_static      # -> ../frontend/public/data/{listings,facets}.json
```

`generateStaticParams` for `/listings/[id]` reads that same snapshot, so detail
pages and the catalogue cannot drift. The snapshot filter/sort logic mirrors
`browse_listings` in `MVP/backend/app/main.py`; change one and change the other.

## Frontend/backend wiring

`Ui_Prototype_MVP_Prep/js/api.js` is the only integration point so far: a tiny `api(path, options)` helper that reads `window.OOH_API_BASE_URL` (default `http://127.0.0.1:8000/api/v1`), attaches the JWT from `localStorage` (`adspace_access_token`), and throws on non-OK responses. `login_Page.html` is the only page currently wired to it (posts to `/auth/login`, stores the token, redirects to `listing_page.html`).

Every other prototype page (`listing_page.html`, `listing_your_adspace.html`, `checkout_page.html`, `Campaign_analytics.html`, etc.) is still presentation-only. When wiring a new page, follow the mapping in `backend/docs/FRONTEND.md` (e.g. marketplace cards → `GET /listings`/`GET /listings/{id}`, owner submission → `POST /listings` + multipart document upload, checkout → `POST /bookings`, dashboards → `GET /dashboard/{advertiser,owner}`). Never put secrets or provider keys in this frontend JS — the API is the only caller of external providers (Maps, GST, SMTP, S3).

Each prototype page has a matching hand-authored CSS file and Tailwind config under `Ui_Prototype_MVP_Prep/css/` and `Ui_Prototype_MVP_Prep/js/tailwind.config.*.js` (one pair per page, not shared) — check for an existing pair before adding new styles for a page.
