/**
 * Hand-written TS mirrors of the backend contract (MVP/backend/app/schemas.py,
 * MVP/backend/app/models.py). Money fields are `number` (the backend stores
 * Float in the MVP schema — see CLAUDE.md's note that this is not yet
 * Decimal-safe for real settlement).
 *
 * Addon / CartItem / CartOut / Quote / CheckoutOut mirror the live
 * `/addons`, `/cart`, `/cart/items`, and `/checkout` routes in
 * MVP/backend/app/main.py + schemas.py (AddonOut, CartItemOut, CartResponse,
 * CheckoutResponse). An earlier wave forward-declared this section against
 * the OLD top-level backend's VAS model (services printing/installation/
 * maintenance, a `vas_amount` field) — that shape never matched this app's
 * real API (addon codes are printing/installation/monitoring, prices come
 * from `GET /addons`, and cart/booking rows use `addons`/`addons_amount`).
 * This section has been rewritten to match the real contract; verify against
 * schemas.py if it drifts further.
 */

export type Role = "advertiser" | "owner" | "admin";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  gstin: string | null;
  kyc_status: string;
}

export type ListingStatus = "pending_approval" | "active" | "rejected" | "paused";

export interface Listing {
  id: number;
  owner_id: number;
  title: string;
  space_type: string;
  description: string;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  width_ft: number;
  height_ft: number;
  price_per_day: number;
  footfall_estimate: number | null;
  status: ListingStatus;
  lighting?: string | null;
  image_url?: string | null;
  extra?: Record<string, unknown> | null;
}

export type BookingStatus = "pending_payment" | "booked" | "active" | "cancelled";

/** A resolved add-on line as it appears on a cart item or booking (code/label/price
 * snapshotted at quote time — matches `AddonLineOut` in schemas.py). */
export interface AddonLine {
  code: string;
  label: string;
  price: number;
}

/** Mirrors the base/addons/GST/total split shared by cart items and bookings. */
export interface Quote {
  base_amount: number;
  addons_amount: number;
  gst_amount: number;
  total_amount: number;
}

export interface Booking extends Quote {
  id: number;
  listing_id: number;
  advertiser_id: number;
  start_date: string; // ISO date (YYYY-MM-DD)
  end_date: string; // ISO date (YYYY-MM-DD)
  addons: AddonLine[] | null;
  status: BookingStatus;
}

/** `GET /addons` — public catalog, the only source of add-on prices. Codes
 * are `printing` | `installation` | `monitoring`. Never hardcode a price. */
export interface Addon {
  code: string;
  label: string;
  price: number;
  icon: string;
  blurb: string;
}

/** One row of `GET /cart` / `POST /cart/items` — carries its own
 * server-computed quote plus denormalized listing info, so a cart row needs
 * no second fetch. Mirrors `CartItemOut` in schemas.py. */
export interface CartItem extends Quote {
  id: number;
  listing_id: number;
  start_date: string;
  end_date: string;
  addons: string[]; // selected addon codes
  listing_title: string;
  listing_location: string;
  listing_image_url: string | null;
  listing_price_per_day: number;
  days: number;
  addon_lines: AddonLine[];
}

/** `GET /cart` response. The four totals are server-computed — never sum
 * `items` client-side (float rounding means sum(rounded) != round(sum)). */
export interface CartOut {
  items: CartItem[];
  subtotal: number;
  addons_total: number;
  gst_total: number;
  grand_total: number;
}

/** `POST /checkout` response (`CheckoutResponse` in schemas.py). */
export interface CheckoutOut {
  payment_id: number;
  provider_order_id: string;
  amount_paid: number;
  paid_at: string;
  bookings: Booking[];
}

export interface Token {
  access_token: string;
  token_type: string;
}
