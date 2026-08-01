# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository shape

This repo has two mostly-independent halves that are being wired together:

- `Ui_Prototype_MVP_Prep/` — static HTML/CSS/Tailwind prototype of the marketplace (no build step, no bundler; open files directly or serve as static files).
- `backend/` — a FastAPI + SQLAlchemy + Alembic REST API for the same product. This is the source of truth for business logic; the frontend is being progressively connected to it (see "Frontend/backend wiring" below).

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

## Frontend/backend wiring

`Ui_Prototype_MVP_Prep/js/api.js` is the only integration point so far: a tiny `api(path, options)` helper that reads `window.OOH_API_BASE_URL` (default `http://127.0.0.1:8000/api/v1`), attaches the JWT from `localStorage` (`adspace_access_token`), and throws on non-OK responses. `login_Page.html` is the only page currently wired to it (posts to `/auth/login`, stores the token, redirects to `listing_page.html`).

Every other prototype page (`listing_page.html`, `listing_your_adspace.html`, `checkout_page.html`, `Campaign_analytics.html`, etc.) is still presentation-only. When wiring a new page, follow the mapping in `backend/docs/FRONTEND.md` (e.g. marketplace cards → `GET /listings`/`GET /listings/{id}`, owner submission → `POST /listings` + multipart document upload, checkout → `POST /bookings`, dashboards → `GET /dashboard/{advertiser,owner}`). Never put secrets or provider keys in this frontend JS — the API is the only caller of external providers (Maps, GST, SMTP, S3).

Each prototype page has a matching hand-authored CSS file and Tailwind config under `Ui_Prototype_MVP_Prep/css/` and `Ui_Prototype_MVP_Prep/js/tailwind.config.*.js` (one pair per page, not shared) — check for an existing pair before adding new styles for a page.
