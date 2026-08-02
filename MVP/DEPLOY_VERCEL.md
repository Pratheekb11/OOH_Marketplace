# Deploying the MVP to Vercel

**Live: <https://adspace-ooh.vercel.app>**

One public URL serves both the app and the API. `MVP/frontend/vercel.json`
rewrites `/api/v1/*` to the backend deployment, and `NEXT_PUBLIC_API_BASE_URL`
is the relative `/api/v1`, so the browser only ever talks to one origin and
CORS never enters the picture. The backend project
(`ooh-marketplace-virid.vercel.app`) still exists but is an implementation
detail behind that proxy.

Both projects are Git-connected with root directories `MVP/frontend` and
`MVP/backend`; pushes to `main` deploy automatically.


Two Vercel projects from this one repo — the Next.js frontend and the FastAPI
backend — plus a free Neon Postgres. Everything in the repo is already prepared;
what follows is only the part that needs your accounts.

**Vercel's Hobby tier is for non-commercial use.** Fine for a demo or portfolio;
if this becomes a real product you need a paid plan.

---

## 1. Create the database

Vercel has no database of its own — functions run on an ephemeral filesystem, so
a SQLite file would be wiped on every cold start. Its Postgres offering is a
marketplace integration **powered by Neon**, so either route below gives you the
same database; it is only a question of where you click "create".

**Recommended — provision from inside Vercel** (one account, no copy-paste):

1. **Storage** lives in the *dashboard* top nav, alongside Projects — not in the
   project sidebar. Go there and choose **Create Database → Neon**. If it is not
   offered, install it straight from <https://vercel.com/marketplace/neon>.
2. Pick a region and the free plan, and name the database.
3. **Connect it to the project**: Storage → your database → **Connect Project**,
   select the backend project and tick Development, Preview and Production.
   Skipping this leaves the variables uninjected and the deploy will fall back
   to SQLite on an ephemeral disk.
4. That injects `DATABASE_URL` — already the **pooled** (PgBouncer) string, and
   already the variable this app reads. Nothing to set by hand.
   (`DATABASE_URL_UNPOOLED` is the direct connection; do not use it here.)
5. For step 2 below you still need the string locally — copy it from
   Storage → your database, or run `vercel env pull`.

**Alternative — sign up at <https://neon.tech>** and create a project, then paste
its connection string into the backend project as `DATABASE_URL` yourself. Pick a
region near your Vercel region.

If you signed up at Neon directly, use the **pooled** connection string — the
host contains `-pooler`:

```
postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require
```

Serverless opens many short-lived connections and the direct endpoint will run
out of them.

The `postgresql://` prefix is handled for you — `Settings.sqlalchemy_url`
rewrites it to `postgresql+psycopg://`, because SQLAlchemy otherwise looks for
psycopg2, which is not installed.

## 2. Load the schema and catalogue

From your machine, once. Replace the URL with your Neon string:

```bash
cd MVP/backend && source .venv/bin/activate
export DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.../neondb?sslmode=require"

alembic upgrade head
python -m scripts.import_scraped ../../backend/data/bangalore/listings.jsonl --replace
```

Expect `created: 2113` (or similar) and `listings now in database: 2114`.

Photos are **not** uploaded anywhere — they are static files under
`MVP/frontend/public/images/listings/` and ship with the frontend deployment.

## 3. Deploy the backend

New Vercel project → import this repo → set **Root Directory** to `MVP/backend`.
Vercel will detect `vercel.json` and build `api/index.py`.

Environment variables (Settings → Environment Variables):

| Name | Value |
| --- | --- |
| `DATABASE_URL` | injected automatically if you provisioned storage from inside Vercel; otherwise your **pooled** Neon string |
| `SECRET_KEY` | a fresh random string, 32+ chars (`openssl rand -hex 32`) |
| `APP_ENV` | `production` |
| `ALLOWED_HOSTS` | `*.vercel.app,localhost,127.0.0.1` |
| `CORS_ORIGINS` | the frontend URL — fill in after step 4, see step 5 |

The wildcard matters: Starlette's TrustedHostMiddleware only treats a pattern
as a suffix match when it *starts* with `*`, so a bare `.vercel.app` matches
nothing and every request comes back `400 Invalid host header`.

Deploy, then check in order — each failure means something different:

| URL | Expected | If not |
| --- | --- | --- |
| `/health` | `{"status":"ok",...}` | routing or host header |
| `/openapi.json` | 200 | `vercel.json` routing (see below) |
| `/api/v1/listings?limit=1` | `"total":2114` | database not connected or not seeded |

`vercel.json` uses the `builds`/`routes` form on purpose. The newer
`rewrites` form (`/(.*)` -> `/api/index`) collapses every request to the same
path, so FastAPI sees `/api/index` for everything and 404s every route.

Note the deployment-specific URL (the one with a build hash) is protected by
Vercel Authentication and will 302 to an SSO page. Test the project's plain
production URL instead.

Note `/docs` is disabled when `APP_ENV=production`. Drop that variable if you
want the interactive docs while testing.

## 4. Deploy the frontend

Another Vercel project → same repo → **Root Directory** `MVP/frontend`.
Framework preset: Next.js (auto-detected). No `vercel.json` needed.

Environment variable:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `https://<backend>.vercel.app/api/v1` |

This is baked in at build time, so changing it later needs a redeploy.

Leave `NEXT_PUBLIC_BASE_PATH` and `NEXT_OUTPUT` unset — those exist only for the
GitHub Pages export.

## 5. Close the CORS loop

Go back to the backend project, set `CORS_ORIGINS` to the frontend's URL exactly,
scheme and all:

```
CORS_ORIGINS=https://<frontend>.vercel.app
```

Redeploy the backend. Without this the browser blocks every request — the same
class of failure as the GitHub Pages loopback error.

Add your Vercel preview domain too if you use previews, comma-separated.

---

## Verifying

On the frontend URL:

- the marketplace shows **2,114** spaces with photos;
- filters, sorting and "Load more" work;
- browser devtools shows requests going to `<backend>.vercel.app`, not
  `127.0.0.1`, and no CORS errors;
- registering and signing in works (this is the real test — it proves writes
  reach Postgres, which the static snapshot could never do).

## What GitHub Pages does now

The Pages deployment still works and still serves the static snapshot in
`public/data/`. It is a read-only mirror. Once Vercel is live, treat Vercel as
the real deployment; you can leave Pages alone or disable the workflow.

## Keeping data current

The Neon database and the static snapshot are separate copies. After a new
scrape, refresh both:

```bash
cd MVP/backend
DATABASE_URL="<neon-url>" python -m scripts.import_scraped <file>.jsonl --replace
python -m scripts.export_static     # refreshes the Pages snapshot; commit it
```

## Known limits

- **Cold starts.** A first request after idle takes a second or two. Much better
  than a container host, but not zero.
- **Rate limiting is per-instance.** `slowapi` keeps counters in memory, so the
  limits are per serverless instance rather than global. It degrades, it does not
  break; a shared store (Redis) is the real fix.
- **Payments are simulated.** Money is stored as `Float` and there is no gateway
  webhook — see `backend/docs/OPERATIONS.md`. Do not take real money through this.
