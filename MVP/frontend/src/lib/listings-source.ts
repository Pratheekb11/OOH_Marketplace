import { api, ApiError } from "./api";
import type { ListingFacets, ListingOut, ListingPage } from "@/components/marketplace/types";

/**
 * Listings come from the API when one is reachable, and from a static snapshot
 * when it is not.
 *
 * The deployed GitHub Pages site has no backend. A build without
 * NEXT_PUBLIC_API_BASE_URL falls back to `127.0.0.1:8000`, and the browser
 * refuses to let an https origin touch the loopback address space at all, so
 * every request fails before it is even sent. `public/data/listings.json`
 * (written by MVP/backend/scripts/export_static.py) keeps the marketplace
 * browsable there.
 *
 * The snapshot is read-only: booking and checkout still require the API, and
 * those routes surface their own errors.
 */

const SNAPSHOT_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/data/listings.json`;
const FACETS_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/data/facets.json`;

let snapshotPromise: Promise<ListingOut[]> | null = null;
/** Null until probed; then remembered so we stop retrying a dead API. */
let apiReachable: boolean | null = null;

function loadSnapshot(): Promise<ListingOut[]> {
  if (!snapshotPromise) {
    snapshotPromise = fetch(SNAPSHOT_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`snapshot ${r.status}`);
        return r.json() as Promise<ListingOut[]>;
      })
      .catch((err) => {
        // Let the next call retry rather than caching a rejected promise.
        snapshotPromise = null;
        throw err;
      });
  }
  return snapshotPromise;
}

function num(params: URLSearchParams, key: string): number | null {
  const raw = params.get(key);
  if (raw === null || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function area(listing: ListingOut): number | null {
  return listing.width_ft && listing.height_ft ? listing.width_ft * listing.height_ft : null;
}

/** Same predicates, in the same order, as browse_listings in app/main.py. */
function matches(listing: ListingOut, params: URLSearchParams): boolean {
  const q = params.get("q");
  if (q) {
    const needle = q.toLowerCase();
    if (
      !listing.title.toLowerCase().includes(needle) &&
      !listing.location.toLowerCase().includes(needle)
    )
      return false;
  }

  const spaceType = params.get("space_type");
  if (spaceType && listing.space_type !== spaceType) return false;

  const lighting = params.get("lighting");
  if (lighting && listing.lighting !== lighting) return false;

  const minPrice = num(params, "min_price");
  if (minPrice !== null && listing.price_per_day < minPrice) return false;
  const maxPrice = num(params, "max_price");
  if (maxPrice !== null && listing.price_per_day > maxPrice) return false;

  const minWidth = num(params, "min_width");
  if (minWidth !== null && !(listing.width_ft !== null && listing.width_ft >= minWidth)) return false;
  const maxWidth = num(params, "max_width");
  if (maxWidth !== null && !(listing.width_ft !== null && listing.width_ft <= maxWidth)) return false;
  const minHeight = num(params, "min_height");
  if (minHeight !== null && !(listing.height_ft !== null && listing.height_ft >= minHeight)) return false;
  const maxHeight = num(params, "max_height");
  if (maxHeight !== null && !(listing.height_ft !== null && listing.height_ft <= maxHeight)) return false;

  // A NULL dimension fails a range test in SQL; keep that behaviour here so an
  // area filter excludes unsized listings rather than treating them as zero.
  const listingArea = area(listing);
  const minArea = num(params, "min_area");
  if (minArea !== null && !(listingArea !== null && listingArea >= minArea)) return false;
  const maxArea = num(params, "max_area");
  if (maxArea !== null && !(listingArea !== null && listingArea <= maxArea)) return false;

  const minFootfall = num(params, "min_footfall");
  if (minFootfall !== null && !(listing.footfall_estimate !== null && listing.footfall_estimate >= minFootfall))
    return false;

  const hasDimensions = params.get("has_dimensions");
  if (hasDimensions === "true" && listing.width_ft === null) return false;
  if (hasDimensions === "false" && listing.width_ft !== null) return false;

  const size = params.get("size");
  if (size) {
    const [widthText, heightText] = size.toUpperCase().replace(/H/g, "").split("X");
    const width = Number(widthText?.replace(/W/g, "").trim());
    const height = Number(heightText?.trim());
    if (!Number.isFinite(width) || !Number.isFinite(height)) return false;
    if (listing.width_ft !== width || listing.height_ft !== height) return false;
  }

  return true;
}

/** Nulls sort last in every ordering, matching the API's `nullslast()`. */
function comparator(sort: string): (a: ListingOut, b: ListingOut) => number {
  const nullsLast = (a: number | null, b: number | null, dir: number) => {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return (a - b) * dir;
  };
  switch (sort) {
    case "price_asc":
      return (a, b) => a.price_per_day - b.price_per_day;
    case "price_desc":
      return (a, b) => b.price_per_day - a.price_per_day;
    case "size_desc":
      return (a, b) => nullsLast(area(a), area(b), -1);
    case "size_asc":
      return (a, b) => nullsLast(area(a), area(b), 1);
    case "newest":
      return (a, b) => b.id - a.id;
    case "footfall_desc":
    default:
      return (a, b) => nullsLast(a.footfall_estimate, b.footfall_estimate, -1);
  }
}

function pageFromSnapshot(all: ListingOut[], query: string): ListingPage {
  const params = new URLSearchParams(query);
  const limit = Math.min(Math.max(num(params, "limit") ?? 24, 1), 100);
  const offset = Math.max(num(params, "offset") ?? 0, 0);

  const filtered = all.filter((listing) => matches(listing, params));
  filtered.sort(comparator(params.get("sort") ?? "footfall_desc"));

  return { items: filtered.slice(offset, offset + limit), total: filtered.length, limit, offset };
}

export async function fetchListings(query: string): Promise<ListingPage> {
  if (apiReachable !== false) {
    try {
      const page = await api<ListingPage>(`/listings${query ? `?${query}` : ""}`);
      apiReachable = true;
      return page;
    } catch (err) {
      // A 4xx/5xx means the API answered — surface it rather than masking a
      // real bug behind stale data. Only a transport failure means "no API".
      if (err instanceof ApiError) throw err;
      apiReachable = false;
    }
  }
  return pageFromSnapshot(await loadSnapshot(), query);
}

export async function fetchFacets(): Promise<ListingFacets> {
  if (apiReachable !== false) {
    try {
      const facets = await api<ListingFacets>("/listings/facets");
      apiReachable = true;
      return facets;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      apiReachable = false;
    }
  }
  const response = await fetch(FACETS_URL);
  if (!response.ok) throw new Error(`facets ${response.status}`);
  return response.json();
}

export async function fetchListing(id: string | number): Promise<ListingOut> {
  if (apiReachable !== false) {
    try {
      const listing = await api<ListingOut>(`/listings/${id}`);
      apiReachable = true;
      return listing;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      apiReachable = false;
    }
  }
  const all = await loadSnapshot();
  const match = all.find((listing) => String(listing.id) === String(id));
  if (!match) throw new Error("Listing not found");
  return match;
}

/** True once a request has proved the API unreachable — the UI uses this to
 * explain that booking is unavailable on the static deployment. */
export function isSnapshotMode(): boolean {
  return apiReachable === false;
}
