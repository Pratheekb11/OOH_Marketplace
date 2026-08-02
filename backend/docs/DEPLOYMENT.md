# Configuration and deployment

## Local development

```bash
cd backend
source .venv/bin/activate
cp .env.example .env
# Set DATABASE_URL=sqlite:///./adspace.db in .env for local SQLite.
alembic upgrade head
uvicorn app.main:app --reload
pytest -q
```

## Docker deployment

1. Copy `.env.example` to `.env` and replace every production secret and hostname.
2. Set `APP_ENV=production`.
3. Point `DATABASE_URL` to the `db` service or managed PostgreSQL.
4. Run `docker compose up --build -d`.
5. Put the API behind HTTPS termination (load balancer, Nginx, Caddy, or platform gateway).

The image runs `alembic upgrade head` before starting Uvicorn. Back up the database before applying future migrations.

## Environment variables

| Variable | Required in production | Meaning |
| --- | --- | --- |
| `APP_ENV` | Yes | `production` disables API docs and simulated payment confirmation. |
| `DATABASE_URL` | Yes | SQLAlchemy PostgreSQL URL, e.g. `postgresql+psycopg://user:pass@host/db`. |
| `SECRET_KEY` | Yes | Unique 32+ character JWT signing secret. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Recommended | JWT lifetime; default 1440. |
| `CORS_ORIGINS` | Yes | Comma-separated exact frontend origins. |
| `ALLOWED_HOSTS` | Yes | Comma-separated host allowlist. |
| `SMTP_*` | For future email dispatch | SMTP provider configuration. |
| `S3_BUCKET`, `S3_REGION`, AWS credentials | For object storage | Uses S3 instead of local `uploads/`. |
| `GOOGLE_MAPS_API_KEY` | Optional | Enables location geocoding on listing creation. |
| `GST_VALIDATION_URL`, `GST_VALIDATION_API_KEY` | Optional | Enables external GSTIN validation. |

## Database migration discipline

Do not call `Base.metadata.create_all()` in deployment. Create a new revision after model changes:

```bash
alembic revision --autogenerate -m "describe change"
alembic upgrade head
```

Review generated migration SQL before applying it. Apply migrations in CI/staging before production.
