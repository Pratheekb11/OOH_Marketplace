# Design-derived test strategy

The acceptance suite is in `tests/test_design_workflows.py`. Its assertions were derived from the supplied context, system, booking, owner-listing, VAS, and ad-agency activity diagrams. It intentionally tests observable workflows and permissions, not private helper functions or SQLAlchemy implementation choices.

Run all tests:

```bash
cd backend
source .venv/bin/activate
pytest -q
```

## Scenarios covered

| Design rule | Test coverage |
| --- | --- |
| Owner submits inventory; only approved inventory is public | Pending listing is hidden; advertiser cannot review it; admin approval makes it searchable. |
| Rejections are actionable | Admin rejection without a reason is rejected; valid rejection creates owner notification. |
| Booking checkout calculates total and prevents double bookings | Inclusive dates, VAS prices and 18% GST are checked; an overlapping date range is rejected. |
| Booking + VAS uses one paid lifecycle | Confirming a booking payment produces its invoice and a booking-linked unassigned VAS job. |
| VAS supports all purchase paths | Standalone own-space VAS works; booking reorders require an active campaign. |
| Admin runs the VAS queue | Advertiser is denied admin actions; admin scheduling changes status and creates advertiser notification. |
| Baseline service safety | Health endpoint and HTTP security header are verified. |

## Test isolation

`tests/conftest.py` creates a fresh shared in-memory SQLite database for every design scenario and overrides FastAPI’s database dependency. It also writes invoice artifacts to pytest’s temporary directory. Consequently, tests neither mutate the developer database nor require PostgreSQL, S3, Maps, GST, or a payment gateway.

## Behavior gap found and fixed

The booking activity diagram requires checkout VAS to create an operational job once payment succeeds. The first implementation only included VAS in the booking price. The design test exposed the missing outcome, so the booking now preserves selected VAS line items and creates one linked `VASOrder` when the development payment is confirmed.

## Deliberate test boundaries

Actual gateway webhook verification, SMTP/SMS dispatch, S3 authorization, GST/Maps API contracts, database concurrency under PostgreSQL, and browser end-to-end tests require their real providers or dedicated test environments. Add contract/integration tests for those systems as each integration is enabled.
