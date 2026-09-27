import type { ListingOut } from "@/components/marketplace/types";

export interface MapPoint {
  id: number;
  title: string;
  price: number;
  lat: number;
  lng: number;
}

/** Coordinates live in `extra`; the owner wizard saves them as strings. */
function coordinate(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Listings that can be placed on the map. Rows without coordinates, with
 * out-of-range values, or at (0, 0) — the usual "unset" placeholder, which is
 * in the Atlantic — are left off rather than guessed at.
 */
export function toMapPoints(listings: ListingOut[]): MapPoint[] {
  const points: MapPoint[] = [];
  for (const listing of listings) {
    const lat = coordinate(listing.extra?.latitude);
    const lng = coordinate(listing.extra?.longitude);
    if (lat === null || lng === null) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    if (lat === 0 && lng === 0) continue;
    points.push({ id: listing.id, title: listing.title, price: listing.price_per_day, lat, lng });
  }
  return points;
}
