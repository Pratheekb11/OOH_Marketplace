import { describe, expect, it } from "vitest";
import { toListingPayload } from "./to-payload";
import { initialWizardState } from "./types";

/**
 * The server works out the card's headline price from price_per_day; the
 * wizard only says which unit to show it in, and never sends a figure of its
 * own that could drift from what checkout charges.
 */
describe("toListingPayload pricing", () => {
  const payload = toListingPayload({ ...initialWizardState, title: "Test", pricePerDay: "4500" });

  it("sends the day rate as price_per_day", () => {
    expect(payload.price_per_day).toBe(4500);
  });

  it("asks for a per-day headline and sends no display price", () => {
    expect(payload.extra?.display_unit).toBe("/ Day");
    expect(payload.extra).not.toHaveProperty("display_price");
  });
});
