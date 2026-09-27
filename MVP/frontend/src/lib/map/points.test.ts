import { describe, expect, it } from "vitest";
import type { ListingOut } from "@/components/marketplace/types";
import { toMapPoints } from "./points";

function listing(id: number, extra: ListingOut["extra"], overrides: Partial<ListingOut> = {}): ListingOut {
  return {
    id,
    owner_id: 1,
    title: `Listing ${id}`,
    space_type: "Hoarding",
    description: "",
    location: "Bengaluru",
    width_ft: 40,
    height_ft: 20,
    price_per_day: 1000 * id,
    footfall_estimate: null,
    status: "active",
    rejection_reason: null,
    lighting: null,
    image_url: null,
    extra,
    ...overrides,
  };
}

describe("toMapPoints (P0-4)", () => {
  it("maps listings with numeric coordinates", () => {
    const points = toMapPoints([listing(1, { latitude: 12.95689, longitude: 77.701663 })]);
    expect(points).toEqual([{ id: 1, title: "Listing 1", price: 1000, lat: 12.95689, lng: 77.701663 }]);
  });

  it("accepts coordinates stored as numeric strings (the owner wizard saves strings)", () => {
    const points = toMapPoints([listing(2, { latitude: "12.97", longitude: " 77.59 " })]);
    expect(points).toEqual([{ id: 2, title: "Listing 2", price: 2000, lat: 12.97, lng: 77.59 }]);
  });

  it("skips listings without usable coordinates", () => {
    const points = toMapPoints([
      listing(1, null),
      listing(2, {}),
      listing(3, { latitude: null, longitude: 77.5 }),
      listing(4, { latitude: "", longitude: "" }),
      listing(5, { latitude: "abc", longitude: "77.5" }),
      listing(6, { latitude: 0, longitude: 0 }),
      listing(7, { latitude: 91, longitude: 77.5 }),
      listing(8, { latitude: 12.9, longitude: 181 }),
      listing(9, { latitude: 12.9, longitude: 77.6 }),
    ]);
    expect(points.map((p) => p.id)).toEqual([9]);
  });

  it("returns an empty list for no listings", () => {
    expect(toMapPoints([])).toEqual([]);
  });
});
