import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ListingOut } from "@/components/marketplace/types";

vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));

import OwnerCard from "./OwnerCard";

function listing(extra: ListingOut["extra"]): ListingOut {
  return {
    id: 1,
    owner_id: 1,
    title: "Skywalk - Ashok Nagar",
    space_type: "Skywalk",
    description: "",
    location: "Ashok Nagar, Bengaluru",
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

afterEach(() => cleanup());

describe("OwnerCard (P0-5)", () => {
  it("makes no trust claims the data does not back", () => {
    const { container } = render(<OwnerCard listing={listing(null)} />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/5yr/i);
    expect(text).not.toMatch(/GST Registered/i);
    expect(text).not.toMatch(/primary leasing rights/i);
    expect(text).not.toMatch(/Horizon/);
    expect(screen.queryByText("Verified owner")).toBeNull();
  });

  it("shows the verified badge only when the listing is verified", () => {
    render(<OwnerCard listing={listing({ verified: true })} />);
    expect(screen.getByText("Verified owner")).toBeTruthy();
  });

  it("does not show a stock photo as if it were the owner", () => {
    const { container } = render(<OwnerCard listing={listing(null)} />);
    const sources = [...container.querySelectorAll("img")].map((img) => img.getAttribute("src") ?? "");
    expect(sources.some((src) => src.includes("listing-view-owner"))).toBe(false);
  });
});
