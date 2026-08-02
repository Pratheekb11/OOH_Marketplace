/**
 * Local mirror of the backend's ListingOut / AddonOut shapes (MVP/backend
 * app/schemas.py + app/pricing.py's ADDON_CATALOG), used by both the
 * marketplace and listing-detail routes. Declared locally per the build
 * brief instead of in `src/types/api.ts` — that file's `Listing`/`Addon`
 * types predate `lighting`/`image_url`/`extra` and use a different addon
 * shape ({id, service, unit, price_per_unit}) that doesn't match the real
 * `GET /addons` response ({code, label, price, icon, blurb}), so importing
 * them here would silently mismatch the live API.
 */

export type ListingStatus = "pending_approval" | "active" | "rejected" | "paused" | "archived";

export interface ListingOut {
  id: number;
  owner_id: number;
  title: string;
  space_type: string;
  description: string;
  location: string;
  /** Null when the source publishes no physical size (e.g. bus shelters,
   * which are sold by a Small/Medium/Large bucket in `extra.size_bucket`). */
  width_ft: number | null;
  height_ft: number | null;
  price_per_day: number;
  footfall_estimate: number | null;
  status: ListingStatus;
  rejection_reason: string | null;
  lighting: string | null;
  image_url: string | null;
  extra: ListingExtra | null;
}

/** Freeform JSON blob — every key is optional, callers must degrade gracefully. */
export interface ListingExtra {
  display_unit?: string;
  display_price?: number;
  verified?: boolean;
  visibility_radius?: string;
  peak_hours?: string;
  annual_discount?: string;
  refund_policy?: string;
  avg_per_day_shown_on_map?: string;
  [key: string]: unknown;
}

/** GET /addons — public, the only source of add-on prices (never hardcode a rate). */
export interface AddonOut {
  code: string;
  label: string;
  price: number;
  icon: string;
  blurb: string;
}

export interface ListingsQuery {
  q?: string;
  space_type?: string;
  lighting?: string;
  min_price?: string;
  max_price?: string;
  size?: string;
  min_area?: string;
  max_area?: string;
  min_footfall?: string;
  has_dimensions?: string;
  sort?: string;
  limit?: string;
  offset?: string;
}

/** GET /listings — paged envelope; the catalogue is thousands of rows. */
export interface ListingPage {
  items: ListingOut[];
  total: number;
  limit: number;
  offset: number;
}

/** GET /listings/facets — filter options taken from live inventory, so the
 * UI never hardcodes a dropdown that drifts from the data. */
export interface ListingFacets {
  space_types: string[];
  lightings: string[];
  sizes: string[];
  price_min: number | null;
  price_max: number | null;
  total: number;
}
