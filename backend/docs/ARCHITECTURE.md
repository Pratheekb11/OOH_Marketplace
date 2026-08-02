# Architecture and data model

## Scope

This service is the API for an OOH advertising marketplace. It supports advertisers booking approved ad spaces, owners submitting inventory, administrators approving inventory and operating VAS jobs, and advertisers purchasing printing, installation, or maintenance services.

The HTTP application lives in `app/main.py`. It uses FastAPI, SQLAlchemy, and Pydantic. The initial relational schema is managed by Alembic rather than being created automatically at application startup.

## Runtime layout

```text
Static HTML pages ──HTTP/JSON──> FastAPI API
                                  │
                         SQLAlchemy / Alembic
                                  │
                            PostgreSQL
                                  │
    S3-compatible storage <── documents / invoices
    SMTP adapter           <── future notification worker
    Google Maps API        <── optional geocoding
    GST provider API       <── optional GST validation
```

For local development, SQLite and local `uploads/` storage can be used. Production deployment uses the API and PostgreSQL services in `docker-compose.yml`.

## Modules

| Path | Responsibility |
| --- | --- |
| `app/main.py` | Routes, authorization, pricing, business workflows, security middleware. |
| `app/models.py` | SQLAlchemy entities and status enums. |
| `app/schemas.py` | Request validation and response schemas. |
| `app/database.py` | Engine, session factory and dependency. |
| `app/config.py` | Environment-backed configuration. |
| `app/integrations.py` | GST, Maps, S3/local storage, SMTP and invoice PDF adapters. |
| `alembic/` | Database migration environment and schema revision. |

## Roles

| Role | Capabilities |
| --- | --- |
| `advertiser` | Browse active listings, create bookings, create VAS orders, create payment intents, view invoices and advertiser dashboard. |
| `owner` | Submit listings and documents, pause/resume approved listings, view owner dashboard. |
| `admin` | Review listings and manage VAS job assignment/status. |

Production registration blocks public `admin` account creation. Provision admins through an internal process or direct administrative migration.

## Core entities

| Entity | Purpose |
| --- | --- |
| `User` | Account identity, role, GSTIN and KYC state. |
| `Listing` | Owner’s OOH inventory, dimensions, location, price and approval state. |
| `ListingDocument` | Ownership/GST evidence stored against a listing. |
| `Booking` | Date-bound booking of one listing by one advertiser. |
| `VASOrder` | Printing, installation or maintenance work; may be linked to a booking or an advertiser’s own space. |
| `Payment` | Provider-neutral payment intent/result record. |
| `Invoice` | Generated tax invoice and its storage location. |
| `Notification` | In-app event/outbox record. |
| `AuditLog` | Who changed what and when. |

## States and lifecycle

`Listing`: `pending_approval` → `active` / `rejected`; an active listing can be `paused` and resumed.

`Booking`: `pending_payment` → `booked` → `active`; cancellation is represented by `cancelled`.

`VASOrder`: `unassigned` → `scheduled` → `in_progress` → `completed`; `cancelled` is also available.

`Payment`: `created` → `paid` or `failed`. Payment confirmation is development-only until a gateway webhook is implemented.

## Pricing

Booking base amount is `inclusive number of booking days × listing.price_per_day`. Optional VAS pricing is currently defined in `VAS_RATES` in `app/main.py`:

- Printing: ₹25 per supplied quantity
- Installation: ₹1,500 per supplied quantity
- Maintenance: ₹750 per supplied quantity

GST is calculated at 18% over base plus VAS. Use decimal/currency-safe storage before handling real financial settlement; the current MVP schema uses `Float`.

When VAS is selected during booking checkout, its selected line items are retained with the booking. After the development payment confirmation, the system creates a linked unassigned VAS job; a standalone VAS order is created immediately, while a re-order requires an active booking.
