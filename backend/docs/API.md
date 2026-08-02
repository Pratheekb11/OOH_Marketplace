# API reference and workflows

Base URL: `http://127.0.0.1:8000/api/v1`. Development Swagger UI is at `/docs`.

Protected routes require `Authorization: Bearer <access_token>`.

## Authentication

| Method and path | Access | Purpose |
| --- | --- | --- |
| `POST /auth/register` | Public | Create advertiser or owner account; development also permits admin. |
| `POST /auth/login` | Public | Returns JWT bearer token. Rate limited to 10 attempts/minute per client. |
| `GET /auth/me` | Any authenticated user | Current user profile. |

Example registration:

```json
{"email":"owner@example.com","full_name":"Example Owner","password":"at-least-8-characters","role":"owner","gstin":"optional-gstin"}
```

## Listings

| Method and path | Role | Purpose |
| --- | --- | --- |
| `GET /listings` | Public | Active marketplace listings. Filters: `location`, `space_type`, `max_price`. |
| `GET /listings/{listing_id}` | Public | Listing detail. |
| `POST /listings` | Owner | Create listing in `pending_approval`. |
| `GET /owner/listings` | Owner | Owner inventory including non-public states. |
| `PATCH /owner/listings/{id}/status?paused=true` | Owner | Pause/resume active listing. |
| `POST /owner/listings/{id}/documents` | Owner | Upload PDF/JPEG/PNG/WebP, max 10 MB. Multipart field: `file`. |
| `GET /admin/listings/pending` | Admin | Pending review queue. |
| `POST /admin/listings/{id}/review` | Admin | Approve/reject: `{"approve":true}` or include `rejection_reason`. |

## Booking and VAS

| Method and path | Role | Purpose |
| --- | --- | --- |
| `POST /bookings` | Advertiser | Reserve an active listing for dates; overlapping non-cancelled bookings return `409`. |
| `GET /bookings` | Advertiser | Advertiser bookings. |
| `POST /vas/orders` | Advertiser | Create booking-linked or standalone VAS order. |
| `GET /vas/orders` | Advertiser | Advertiser VAS history. |
| `GET /admin/vas/orders` | Admin | VAS operations queue; optional `job_status`. |
| `PATCH /admin/vas/orders/{id}` | Admin | Update job status, assignee, scheduled date. |

Create a booking:

```json
{
  "listing_id": 24,
  "start_date": "2026-08-01",
  "end_date": "2026-08-07",
  "vas_items": [{"service":"installation","quantity":1}]
}
```

Create VAS for an owned space:

```json
{
  "own_space_details":{"location":"HSR Layout","width_ft":12,"height_ft":8,"type":"billboard"},
  "services":[{"service":"printing","quantity":96}]
}
```

## Payments, invoices, dashboards and notifications

| Method and path | Role | Purpose |
| --- | --- | --- |
| `POST /payments/booking/{id}` | Advertiser | Create a provider-neutral booking payment intent. |
| `POST /payments/vas/{id}` | Advertiser | Create a VAS payment intent. |
| `POST /payments/{id}/confirm` | Advertiser | Development-only simulated outcome; disabled in production. |
| `GET /invoices` | Authenticated | Current user invoices. |
| `GET /notifications` | Authenticated | Current user in-app notifications. |
| `GET /dashboard/advertiser` | Advertiser | Booking count, active count and spend summary. |
| `GET /dashboard/owner` | Owner | Listing and booking-revenue summary. |

## Typical booking workflow

1. Owner registers, submits a listing and uploads documents.
2. Admin approves the listing; it becomes discoverable.
3. Advertiser browses the listing and creates a booking with optional VAS items.
4. The API creates a payment intent. In development only, confirmation marks it paid, confirms the booking, creates an invoice and records notifications.
5. Admin assigns related VAS jobs and advances their status.

Never expose the development confirmation endpoint to production clients. Replace it with a payment-provider webhook that validates provider signatures and performs an idempotent state transition.
