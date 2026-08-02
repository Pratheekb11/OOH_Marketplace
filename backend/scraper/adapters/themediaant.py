"""Adapter for themediaant.com outdoor inventory.

The site is a Next.js app. Three things make it tractable without a browser:

* the listing page embeds a `__NEXT_DATA__` blob carrying the filter config,
  including per-media-type ids *and the totals the site advertises* - which is
  what lets a run verify it collected everything;
* the grid paginates through `api.themediaant.com/outdoor?params={json}`;
* each detail page is available as compact JSON at
  `/_next/data/<buildId>/outdoor/<slug>.json` (~28 KB) instead of 217 KB of HTML.

Records are collected per media type rather than by walking the unfiltered
list: sorting is by `pageViews`, which is not a stable key, so deep offsets on
the combined list return duplicates and silently drop inventory.
"""
from __future__ import annotations

import json
import logging
import re
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import quote, urlencode

from scraper.adapters.base import Adapter, next_data
from scraper.models import ScrapedHoarding, ScrapedImage
from scraper.parse import FEET_PER_METRE, MAX_DIM_FT, MIN_DIM_FT, clean_text

logger = logging.getLogger(__name__)

SITE = "themediaant.com"
WEB_BASE = "https://www.themediaant.com"
API_BASE = "https://api.themediaant.com/outdoor"
PAGE_SIZE = 100
MAX_PASSES = 12
PASS_PATIENCE = 4

# "Printing"/"Mounting Charges" are add-on services attached to every media,
# not inventory; counting them would double-count the catalogue.
NON_INVENTORY_TEMPLATES = {"Printing Charges", "Mounting Charges"}

DIMENSION_RE = re.compile(r"(?P<w>\d+(?:\.\d+)?)\s*W\s*[xX×]\s*(?P<h>\d+(?:\.\d+)?)\s*H", re.I)
REACH_RE = re.compile(r"(?P<amt>\d+(?:\.\d+)?)\s*(?P<scale>K|L|Lakhs?|M|Mn|Million|Cr|Crores?)?", re.I)
REACH_SCALES = {
    "k": 1_000, "l": 100_000, "lakh": 100_000, "lakhs": 100_000,
    "m": 1_000_000, "mn": 1_000_000, "million": 1_000_000,
    "cr": 10_000_000, "crore": 10_000_000, "crores": 10_000_000,
}
LIT_MAP = {"FRONT LIT": "front_lit", "BACK LIT": "back_lit", "NON LIT": "non_lit", "LED": "digital"}


#: The site serves its own S3 bucket through this CDN. Same pixels, roughly
#: half the bytes (87 KB vs 191 KB on a sampled 850x591 photo).
S3_HOSTS = ("tma-live.s3.ap-south-1.amazonaws.com", "tma-live.s3.amazonaws.com")
CDN_HOST = "the-media-ant.mo.cloudinary.net"


def cdn_url(url: str) -> str:
    """Rewrite an S3 asset URL to the site's image CDN, leaving others alone.

    No width transform is applied: `?tx=w_N` happily upscales, which inflates
    the file without recovering any detail the source never had.
    """
    for host in S3_HOSTS:
        if host in url:
            return url.replace(host, CDN_HOST, 1)
    return url


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (value or "").lower()).strip("_")


def _to_int(value) -> int | None:
    try:
        number = float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return None
    return int(number) if number > 0 else None


def _parse_reach(raw) -> int | None:
    """'88.3K Unique Reach' -> 88300."""
    if raw is None:
        return None
    match = REACH_RE.search(str(raw))
    if not match:
        return None
    amount = float(match.group("amt"))
    scale = (match.group("scale") or "").lower().rstrip(".")
    return int(amount * REACH_SCALES.get(scale, 1))


class TheMediaAntAdapter(Adapter):
    name = "themediaant"
    # The JSON API is same-origin checked; mirror what the site's own grid sends.
    default_headers = {
        "Accept": "application/json, text/html;q=0.9",
        "Origin": WEB_BASE,
        "Referer": f"{WEB_BASE}/",
    }

    def __init__(self, fetcher, *, location: str, location_id: str, with_details: bool = True,
                 detail_workers: int = 4, media_types: list[str] | None = None,
                 limit: int | None = None, **options) -> None:
        super().__init__(fetcher, **options)
        self.location = location
        self.location_id = location_id
        self.with_details = with_details
        self.detail_workers = max(1, detail_workers)
        self.media_types = {m.lower() for m in media_types} if media_types else None
        self.limit = limit
        self._build_id: str | None = None
        self._templates: list[dict] = []

    # -- discovery -----------------------------------------------------
    @property
    def index_url(self) -> str:
        return f"{WEB_BASE}/outdoor?" + urlencode({"location": self.location, "locationId": self.location_id})

    def discover(self) -> None:
        """Read the build id and the site's own per-media-type totals."""
        if self._templates:
            return
        payload = next_data(self.fetcher.get_text(self.index_url))
        self._build_id = payload.get("buildId")

        filters = payload["props"]["pageProps"]["config"]["filters"]
        template_filter = next((f for f in filters if f.get("urlKey") == "templateId"), None)
        if not template_filter:
            raise RuntimeError("themediaant: templateId filter missing; page structure changed")

        self._templates = [
            {"id": value["_id"], "name": value["name"], "count": value.get("count") or 0}
            for value in template_filter.get("values", [])
            if value.get("name") not in NON_INVENTORY_TEMPLATES
        ]
        if self.media_types:
            self._templates = [t for t in self._templates if t["name"].lower() in self.media_types]
        logger.info(
            "themediaant: build=%s, %d media types, %d advertised records",
            self._build_id, len(self._templates), sum(t["count"] for t in self._templates),
        )

    def expected_counts(self) -> dict[str, int]:
        self.discover()
        return {t["name"]: t["count"] for t in self._templates}

    # -- listing -------------------------------------------------------
    def _api_page(self, template_id: str, offset: int) -> list[dict]:
        params = {
            "filters": {
                "location": self.location,
                "locationId": self.location_id,
                "templateId": template_id,
            },
            "sortBy": "pageViews",
            "limit": PAGE_SIZE,
            "offset": offset,
        }
        url = f"{API_BASE}?params={quote(json.dumps(params))}"
        # Never cached: repeat passes rely on the API re-shuffling its results,
        # and a cache hit would replay the same page forever.
        return json.loads(self.fetcher.get_text(url, use_cache=False)).get("medias") or []

    def _sweep(self, template_id: str, rows: dict[str, dict], target: int) -> None:
        """One offset walk over a media type, merging into `rows`."""
        offset = 0
        # Offsets are consumed by repeats, so allow well past the nominal count
        # before accepting that the list is exhausted.
        ceiling = (target * 3 if target else 0) + PAGE_SIZE * 5
        while offset <= ceiling:
            page = self._api_page(template_id, offset)
            if not page:
                return
            for row in page:
                rows[row["_id"]] = row
            if len(page) < PAGE_SIZE:
                return
            if self.limit and len(rows) >= self.limit:
                return
            offset += PAGE_SIZE

    def _list_template(self, template: dict) -> dict[str, dict]:
        """Collect every record for one media type.

        The only sort the API offers is `pageViews`, and it is not stable:
        identical requests come back in different orders, so a single walk
        returns duplicates and misses roughly 10% of the inventory. Because the
        ordering is effectively re-shuffled per request, repeating the walk
        converges on the full set - observed reaching 1101/1101 bus shelters on
        the third pass after the second pass added nothing.
        """
        rows: dict[str, dict] = {}
        target = template["count"]
        stagnant = 0

        for attempt in range(1, MAX_PASSES + 1):
            before = len(rows)
            self._sweep(template["id"], rows, target)
            gained = len(rows) - before
            logger.info(
                "themediaant: %s pass %d -> %d/%d (+%d)",
                template["name"], attempt, len(rows), target, gained,
            )
            if self.limit and len(rows) >= self.limit:
                break
            if target and len(rows) >= target:
                break
            # A single barren pass is not proof of exhaustion; only give up
            # after several in a row.
            stagnant = stagnant + 1 if gained == 0 else 0
            if stagnant >= PASS_PATIENCE:
                logger.warning(
                    "themediaant: %s stalled at %d/%d after %d idle passes",
                    template["name"], len(rows), target, stagnant,
                )
                break

        return rows

    # -- detail --------------------------------------------------------
    def _detail_url(self, slug: str) -> str:
        return f"{WEB_BASE}/_next/data/{self._build_id}/outdoor/{slug}.json"

    def _fetch_detail(self, slug: str) -> dict | None:
        try:
            payload = json.loads(self.fetcher.get_text(self._detail_url(slug)))
            return payload.get("pageProps", {}).get("media")
        except Exception as exc:  # noqa: BLE001 - a missing detail must not stop the run
            logger.warning("detail fetch failed for %s: %s", slug, exc)
            return None

    # -- mapping -------------------------------------------------------
    @staticmethod
    def _attributes(row: dict, detail: dict | None) -> dict:
        """Flatten both attribute encodings into one lookup.

        The listing API returns a dict keyed by camelCase name
        (`{"litType": {"value": "NON LIT"}}`); detail pages return a list keyed
        by display name (`[{"showName": "Lighting", "value": "NON LIT"}]`).
        """
        merged: dict = {}
        for key, entry in (row.get("attributes") or {}).items():
            merged[key] = entry.get("value") if isinstance(entry, dict) else entry
        for entry in (detail or {}).get("attributes") or []:
            if isinstance(entry, dict) and entry.get("showName"):
                merged[entry["showName"]] = entry.get("value")
        return merged

    def _record(self, row: dict, detail: dict | None, template_name: str = "") -> ScrapedHoarding:
        merged = {**row, **(detail or {})}
        attributes = self._attributes(row, detail)

        def attribute(*keys):
            for key in keys:
                value = attributes.get(key)
                if value not in (None, ""):
                    return value
            return None

        warnings: list[str] = []
        slug = merged.get("urlSlug", "")
        media_type = attribute("mediaType", "Media Type") or "Hoarding"

        # -- size: creativeSpecs is authoritative, the "50W X 6H" string is the fallback
        width = height = None
        size_raw = None
        resolution_px = None
        option = (merged.get("mediaOptions") or [{}])[0] if detail else {}
        for spec in option.get("creativeSpecs") or []:
            fields = {f.get("key"): f.get("value") for f in spec.get("fields", [])}
            if not (fields.get("Width") and fields.get("Height")):
                continue
            raw_w, raw_h = float(fields["Width"]), float(fields["Height"])
            unit = str(fields.get("Unit", "ft")).lower().strip().rstrip(".")
            if unit in ("ft", "feet", "foot", "'"):
                width, height = raw_w, raw_h
            elif unit in ("m", "mtr", "meter", "metre", "meters", "metres"):
                width, height = round(raw_w * FEET_PER_METRE, 2), round(raw_h * FEET_PER_METRE, 2)
            else:
                # Digital screens publish a pixel resolution here. That is a
                # creative spec, not a physical size - reading 832x384 px as
                # feet would invent a 320,000 sq ft hoarding.
                resolution_px = f"{fields['Width']}x{fields['Height']}"
                warnings.append(f"size given as {unit}, not a physical measurement")
                break
            size_raw = f"{fields['Width']} x {fields['Height']} {fields.get('Unit', 'ft')}"
            break
        # Only fall back to the "50W X 6H" string when no spec was published at
        # all. When the spec was a pixel resolution, this field repeats it, and
        # trusting it is how a 1440x1440 screen became a 2,073,600 sq ft board.
        if width is None and resolution_px is None:
            dimensions = merged.get("dimensions") or []
            if dimensions:
                match = DIMENSION_RE.search(str(dimensions[0]))
                if match:
                    width, height = float(match.group("w")), float(match.group("h"))
                    size_raw = str(dimensions[0])

        # Last line of defence against a resolution or an id reaching the
        # marketplace as a physical size.
        if width is not None and not (
            MIN_DIM_FT <= width <= MAX_DIM_FT and MIN_DIM_FT <= height <= MAX_DIM_FT
        ):
            warnings.append(f"discarded implausible size {width}x{height} ft")
            width = height = None
            size_raw = None

        if width is None:
            warnings.append("no dimensions published")

        # -- price: discountedRate is the real per-day rate.
        # Verified against the site's own arithmetic: rate x span == minimumBilling.
        price_per_day = price_raw = None
        rates = (option.get("rates") or {}).get("defaultRates") or {}
        if rates:
            price_per_day = rates.get("discountedRate") or rates.get("cardRate")
            price_raw = json.dumps(rates)
        elif merged.get("minimumBilling"):
            warnings.append("no rate card; only minimumBilling available (not a daily rate)")
            price_raw = f"minimumBilling={merged['minimumBilling']}"
        if not price_per_day:
            warnings.append("no per-day rate published")

        # -- location
        geos = merged.get("geos") or []
        geo = geos[0] if geos and isinstance(geos[0], dict) else {}
        # The listing API carries GeoJSON; detail pages put a display string in
        # the same key, so only trust it when it is actually a Point.
        latitude = longitude = None
        point = row.get("location")
        coordinates = point.get("coordinates") if isinstance(point, dict) else None
        if isinstance(coordinates, list) and len(coordinates) == 2:  # GeoJSON is [lng, lat]
            longitude, latitude = float(coordinates[0]), float(coordinates[1])
        else:
            fallback = ((geo.get("geometry") or {}).get("location")) or {}
            if fallback.get("lat") is not None:
                latitude, longitude = float(fallback["lat"]), float(fallback["lng"])
        components = {
            tuple(c.get("types", [])): c.get("long_name") for c in geo.get("address_components", [])
        }

        def component(kind):
            return next((v for types, v in components.items() if kind in types), None)

        landmark = attribute("landmark", "Landmark") or ""
        locality = merged.get("locality") or ""
        location_text = clean_text(geo.get("formatted_address") or f"{landmark}, {locality}".strip(", "))

        # -- images. Despite the field name, `logo` is the site photograph, and
        # it appears under two prefixes:
        #   medias/<id>/<ts>/<name>_logo.jpg   - full size, ~850px
        #   uploads/mediaLogos/<ts>/<n>.jpg    - the site's own 300x125 preview
        # Both are per-listing (1691 distinct URLs across 1703 records), so
        # neither is a media-owner brand mark. `_logo` in the filename is a
        # naming convention, not a sign that the image is chrome.
        images = []
        logo = merged.get("logo") or ""
        if logo:
            images.append(ScrapedImage(url=cdn_url(logo), trusted=True, alt=merged.get("name", "")))
        else:
            warnings.append("no photograph published")

        footfall = _parse_reach(attribute("reach", "Unique Reach (Per day)")) or _to_int(
            attribute("totalImpressions", "Total Impressions")
        )

        return ScrapedHoarding(
            source_url=f"{WEB_BASE}/outdoor/{slug}",
            source_site=SITE,
            source_id=str(merged.get("_id") or attribute("uniqueId", "ID") or slug),
            title=clean_text(merged.get("name")) or slug,
            space_type=_slug(media_type),
            description=clean_text(merged.get("about") or landmark),
            location=location_text,
            city=merged.get("city") or component("locality"),
            state=component("administrative_area_level_1"),
            pincode=component("postal_code"),
            latitude=latitude,
            longitude=longitude,
            width_ft=width,
            height_ft=height,
            size_raw=size_raw,
            price_per_day=price_per_day,
            price_raw=price_raw,
            price_period="day" if price_per_day else None,
            footfall_estimate=footfall,
            illumination=LIT_MAP.get(str(attribute("litType", "Lighting") or "").upper()),
            images=images,
            warnings=warnings,
            extra={
                # Which filter the record was collected under. The site files
                # digital bus shelters under a "Bus Shelter" mediaType, so
                # coverage must be counted by template, not by this label.
                "source_media_type": template_name or media_type,
                "media_type": media_type,
                "resolution_px": resolution_px,
                "landmark": landmark,
                "locality": locality,
                "quantity": attribute("quantity", "Quantity"),
                "size_bucket": attribute("size", "Size"),
                "unique_id": attribute("uniqueId", "ID"),
                "reach_raw": attribute("reach", "Unique Reach (Per day)"),
                "total_impressions": _to_int(attribute("totalImpressions", "Total Impressions")),
                "minimum_billing": merged.get("minimumBilling"),
                "card_rate": rates.get("cardRate"),
                "discounted_rate": rates.get("discountedRate"),
                "gst_percentage": merged.get("serviceTaxPercentage"),
                "page_views": merged.get("pageViews"),
                "url_slug": slug,
                "photo_source": ("full" if "/medias/" in logo else "preview") if logo else None,
            },
        )

    # -- driver --------------------------------------------------------
    def scrape(self) -> Iterator[ScrapedHoarding]:
        self.discover()
        for template in self._templates:
            rows = self._list_template(template)
            values = list(rows.values())
            if self.limit:
                values = values[: self.limit]

            details: dict[str, dict | None] = {}
            if self.with_details and self._build_id:
                slugs = [row["urlSlug"] for row in values if row.get("urlSlug")]
                with ThreadPoolExecutor(max_workers=self.detail_workers) as pool:
                    for slug, detail in zip(slugs, pool.map(self._fetch_detail, slugs)):
                        details[slug] = detail

            for row in values:
                yield self._record(row, details.get(row.get("urlSlug", "")), template["name"])
