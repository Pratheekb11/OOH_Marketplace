import { describe, expect, it } from "vitest";
import type { ListingOut } from "@/components/marketplace/types";
import { directionsUrl, mapsProviderFor } from "./directions";

function listing(extra: ListingOut["extra"], location = "Ashok Nagar, Bengaluru"): ListingOut {
  return {
    id: 9,
    owner_id: 1,
    title: "Skywalk - Ashok Nagar",
    space_type: "Skywalk",
    description: "",
    location,
    width_ft: null,
    height_ft: null,
    price_per_day: 30000,
    footfall_estimate: null,
    status: "active",
    rejection_reason: null,
    lighting: null,
    image_url: null,
    extra,
  };
}

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPADOS =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

describe("mapsProviderFor", () => {
  it("sends iPhone users to Apple Maps", () => {
    expect(mapsProviderFor(IPHONE)).toBe("apple");
  });

  it("sends iPadOS (which reports a Mac user agent, but has touch) to Apple Maps", () => {
    expect(mapsProviderFor(IPADOS, 5)).toBe("apple");
  });

  it("sends Mac desktops to Apple Maps", () => {
    expect(mapsProviderFor(IPADOS, 0)).toBe("apple");
  });

  it("sends Android and everything else to Google Maps", () => {
    expect(mapsProviderFor(ANDROID)).toBe("google");
    expect(mapsProviderFor(WINDOWS)).toBe("google");
    expect(mapsProviderFor("")).toBe("google");
  });
});

describe("directionsUrl", () => {
  it("routes Google Maps to the listing's exact coordinates", () => {
    const url = new URL(directionsUrl(listing({ latitude: 12.95689, longitude: 77.701663 }), "google")!);
    expect(url.origin).toBe("https://www.google.com");
    expect(url.pathname).toBe("/maps/dir/");
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("destination")).toBe("12.95689,77.701663");
  });

  it("routes Apple Maps to the listing's exact coordinates", () => {
    const url = new URL(directionsUrl(listing({ latitude: "12.95689", longitude: "77.701663" }), "apple")!);
    expect(url.origin).toBe("https://maps.apple.com");
    expect(url.searchParams.get("daddr")).toBe("12.95689,77.701663");
  });

  it("falls back to the address when the listing has no coordinates", () => {
    const google = new URL(directionsUrl(listing(null), "google")!);
    expect(google.searchParams.get("destination")).toBe("Ashok Nagar, Bengaluru");
    const apple = new URL(directionsUrl(listing({}), "apple")!);
    expect(apple.searchParams.get("daddr")).toBe("Ashok Nagar, Bengaluru");
  });

  it("does not trust the (0, 0) placeholder or out-of-range coordinates", () => {
    const zero = new URL(directionsUrl(listing({ latitude: 0, longitude: 0 }), "google")!);
    expect(zero.searchParams.get("destination")).toBe("Ashok Nagar, Bengaluru");
    const bad = new URL(directionsUrl(listing({ latitude: 120, longitude: 77.7 }), "google")!);
    expect(bad.searchParams.get("destination")).toBe("Ashok Nagar, Bengaluru");
  });

  it("returns null when there is nothing to navigate to", () => {
    expect(directionsUrl(listing(null, "  "), "google")).toBeNull();
  });
});
