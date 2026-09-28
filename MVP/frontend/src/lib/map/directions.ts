import type { ListingOut } from "@/components/marketplace/types";
import { toMapPoints } from "./points";

export type MapsProvider = "apple" | "google";

/**
 * Which maps app a "Navigate" tap should open. Apple devices get Apple Maps,
 * which is always installed there; everything else gets Google Maps, whose
 * https links Android hands straight to the installed app (and desktops open
 * on the web). iPadOS reports a Mac user agent, so Macs count as Apple too —
 * a Mac opens Maps.app, which is what its owner expects.
 */
export function mapsProviderFor(userAgent: string, maxTouchPoints = 0): MapsProvider {
  const mac = /Macintosh/i.test(userAgent);
  const ios = /iPhone|iPad|iPod/i.test(userAgent) || (mac && maxTouchPoints > 1);
  return ios || mac ? "apple" : "google";
}

/**
 * Turn-by-turn directions to a listing, as a universal https link rather than
 * an app scheme (`comgooglemaps://`, `geo:`), which does nothing at all on a
 * device without a handler. Exact coordinates win; without them the address
 * is sent for the maps app to geocode. Null when there is neither.
 */
export function directionsUrl(listing: ListingOut, provider: MapsProvider): string | null {
  const [point] = toMapPoints([listing]);
  const destination = point ? `${point.lat},${point.lng}` : listing.location.trim();
  if (!destination) return null;

  if (provider === "apple") {
    return `https://maps.apple.com/?${new URLSearchParams({ daddr: destination, dirflg: "d" })}`;
  }
  return `https://www.google.com/maps/dir/?${new URLSearchParams({ api: "1", destination, travelmode: "driving" })}`;
}

/** The provider for the current browser; Google during prerender. */
export function currentMapsProvider(): MapsProvider {
  if (typeof navigator === "undefined") return "google";
  return mapsProviderFor(navigator.userAgent, navigator.maxTouchPoints);
}
