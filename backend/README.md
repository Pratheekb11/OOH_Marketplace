# AdSpace Marketplace Backend

FastAPI backend covering the MVP workflows in the architecture diagrams: authentication and roles, GST validation and optional geocoding, owner listings/documents and admin approval, marketplace discovery, date-conflict-safe booking creation, VAS-only / booking-linked orders, operations, invoices, audit records, and notifications.

## Run locally

```bash
cd backend
source .venv/bin/activate
cp .env.example .env
# For a local-only run, change DATABASE_URL to sqlite:///./adspace.db.
alembic upgrade head
uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000/docs` for the interactive API. Use PostgreSQL in production; schema changes are only applied via Alembic migrations.

## Documentation

- [Architecture and data model](docs/ARCHITECTURE.md)
- [API reference and workflows](docs/API.md)
- [Configuration and deployment](docs/DEPLOYMENT.md)
- [Integrations, security, and known boundaries](docs/OPERATIONS.md)
- [Static frontend connection](docs/FRONTEND.md)
- [Design-derived test strategy](docs/TESTING.md)

## Production deployment

Set a unique, 32+ character `SECRET_KEY`, a production PostgreSQL `DATABASE_URL`, restrictive `CORS_ORIGINS` and `ALLOWED_HOSTS`, then run `docker compose up --build`. The container applies migrations before serving traffic. Configure SMTP, S3, Google Maps, and GST credentials only through deployment secrets; never commit `.env`.

## First-use roles

Register users with `advertiser`, `owner`, or `admin` using `/api/v1/auth/register`; log in to obtain a Bearer token. In production, admin creation must be restricted to an internal provisioning flow.

## Integration boundaries

Payment endpoints create a provider order id for development only. In `APP_ENV=production`, confirmation is disabled until a real payment provider webhook is implemented. Invoices, S3/local file storage, Google geocoding, GST validation, and an SMTP adapter are available; the current notification implementation persists an in-app outbox record and does not yet dispatch SMTP/SMS asynchronously.
