# OOH inventory scraper

Collects ad hoarding listings — photo, dimensions, daily rate, location,
lighting and reach — from external OOH marketplaces, writes them to
JSONL/CSV, and optionally imports them into the marketplace database.

## Install

Beyond `requirements.txt`:

```bash
pip install beautifulsoup4 lxml
pip install playwright && playwright install chromium   # only for browser mode
```

## Use

```bash
cd backend && source .venv/bin/activate

# Collect Bangalore inventory with photos
python -m scraper.cli scrape themediaant \
    --location "Bangalore, Karnataka, India" \
    --location-id "ChIJbU60yXAWrjsR4E9-UejD3_g" \
    --images --out data/bangalore

# One media type only, capped, for a quick check
python -m scraper.cli scrape themediaant --media-type Hoarding --limit 20

# Load into the marketplace (creates pending_approval listings)
python -m scraper.cli import data/bangalore/listings.jsonl
```

Useful flags: `--no-details` (skips detail pages — much faster, but you lose the
daily rate and exact size), `--delay` (seconds between request starts),
`--detail-workers`, `--max-images`, `--cache-dir`.

Output lands in `--out`:

| File | Contents |
| --- | --- |
| `listings.jsonl` | Canonical records — nested images, extras, warnings. What `import` reads. |
| `listings.csv` | Flattened spreadsheet view (lossy). |
| `images/` | Downloaded photos, named by content hash. |

## Loading into the MVP app

The Next.js MVP under `MVP/` has its own database and its own `Listing` shape,
so it has its own importer:

```bash
cd MVP/backend && source .venv/bin/activate
alembic upgrade head                       # dimensions became optional
python -m scripts.import_scraped ../../backend/data/bangalore/listings.jsonl --replace
```

`--replace` clears existing listings first and refuses to run if any cart or
booking still references one. Photos are copied into
`MVP/frontend/public/images/listings/`. Listings land `active` (this catalogue
is bulk-loaded, not owner-submitted), owned by the same synthetic
`scraped-inventory@internal.invalid` account.

## Layout

| Module | Responsibility |
| --- | --- |
| `fetch.py` | Polite HTTP: robots.txt, per-host rate limit, retries, disk cache. |
| `browser.py` | Playwright rendering for sites that build their listings client-side. |
| `parse.py` | Text heuristics — dimensions, price, footfall, city, lighting. |
| `images.py` | Download, de-duplicate, reject logos/icons/thumbnails. |
| `models.py` | `ScrapedHoarding`, shaped to mirror `app.models.Listing`. |
| `writers.py` | JSONL and CSV sinks. |
| `importer.py` | JSONL → `listings` + `scraped_listings`. |
| `adapters/` | Per-site logic. Everything else is shared. |

## What the importer does

Imported rows are owned by a synthetic `scraped-inventory@internal.invalid`
account whose password hash can never verify, and land in `pending_approval` —
they go through the same admin review as owner submissions and are never live
without it. `scraped_listings.source_url` is unique, so re-running an import
updates in place instead of duplicating.

A record is only imported if it has a title, location, both dimensions and a
daily rate (`ListingCreate`'s requirements). Everything else is reported as
`skipped_incomplete`; pass `--include-incomplete` to override.

## Adding a site

Subclass `Adapter`, implement `scrape()` yielding `ScrapedHoarding`, and
register it in `adapters/__init__.py`. Implement `expected_counts()` when the
source publishes its own totals — the CLI reconciles against them and reports
any shortfall, which is the only reliable way to know a run was complete.

Reuse `parse.py` rather than writing new regexes; when a value is inferred
rather than published, append to `record.warnings` instead of guessing
silently.

## themediaant adapter notes

The site is a Next.js app, so no browser is needed:

- the listing page's `__NEXT_DATA__` blob carries the media-type ids **and the
  totals the site advertises**, which is what makes a run verifiable;
- the grid paginates via `api.themediaant.com/outdoor?params={json}`;
- detail pages are available as ~28 KB JSON at
  `/_next/data/<buildId>/outdoor/<slug>.json` instead of 217 KB of HTML.

Two behaviours worth knowing:

**Pagination is non-deterministic.** The only sort offered is `pageViews`, and
it is unstable — identical requests return different orders, so a single walk
duplicates rows and misses ~10% of inventory, and offsets run out early. The
adapter therefore repeats the walk until it reaches the advertised count
(observed: bus shelters reached 1101/1101 on the fourth pass, and a *second*
pass that added nothing was followed by one that added 92). Listing requests
deliberately bypass the fetch cache, since the whole approach depends on the
API re-shuffling.

**Prices are per-day.** `rates.defaultRates.discountedRate` is the real daily
rate; `minimumBilling` is that rate times the minimum span (verified:
28333 × 7 = 198331). Without `--details` there is no rate at all.

Images: each media has at most **one** site photograph, in the `logo` field
under a `/medias/` path. Records whose `logo` points at `/uploads/mediaLogos/`
carry only a media-owner brand mark — those are recorded in
`extra.owner_logo` with a warning, not collected as inventory photos.

## Observed on Bangalore (Aug 2026)

2146 records collected against 2143 advertised — every category complete
(hoardings came back 742 vs an advertised 739; the site's own counts drift):

| | Bus Shelter | Hoarding | Skywalk | Digital OOH | Digital Bus Shelter | Road Median | Pole Kiosk |
|---|---|---|---|---|---|---|---|
| got | 1101 | 742 | 151 | 124 | 21 | 5 | 2 |
| advertised | 1101 | 739 | 151 | 124 | 21 | 5 | 2 |

Field coverage: lat/lng 2146, daily rate 2114, footfall 1441, dimensions 964,
site photograph 48.

Two source-side limitations worth knowing before planning around this data:

- **Bus shelters publish no dimensions** — 0 of 1101 carry a size, only a
  `size_bucket` of Small/Medium/Large. That is the single reason only ~943
  records are importable; everything else about them is complete.
- **Photographs are rare.** 1703 records expose only a media-owner brand mark
  (`extra.owner_logo`) rather than a picture of the site. There is at most one
  photo per media and no gallery, so 48 images is the real ceiling here, not a
  scraper limitation.

## Conduct

`Fetcher` obeys robots.txt by default and rate-limits per host. themediaant's
robots.txt allows `/outdoor` and the single-segment detail pages; its
`Disallow: /outdoor/*/*` covers deeper paths the adapter does not touch.
`--ignore-robots` exists for sites you own — check the target's terms before
using it.
