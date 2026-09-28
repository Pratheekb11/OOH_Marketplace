import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ListingOut } from "@/components/marketplace/types";
import NavigateButton from "./NavigateButton";

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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("NavigateButton", () => {
  it("links to turn-by-turn directions to the billboard's coordinates", () => {
    render(<NavigateButton listing={listing({ latitude: 12.95689, longitude: 77.701663 })} />);
    const link = screen.getByRole("link", { name: /navigate/i });
    const url = new URL(link.getAttribute("href")!);
    expect(url.hostname).toBe("www.google.com");
    expect(url.searchParams.get("destination")).toBe("12.95689,77.701663");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("hands iPhone users to Apple Maps", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
      maxTouchPoints: 5,
    });
    render(<NavigateButton listing={listing({ latitude: 12.95689, longitude: 77.701663 })} />);
    await waitFor(() =>
      expect(new URL(screen.getByRole("link", { name: /navigate/i }).getAttribute("href")!).hostname).toBe(
        "maps.apple.com",
      ),
    );
  });

  it("renders nothing when there is nowhere to navigate to", () => {
    const { container } = render(<NavigateButton listing={listing(null, "")} />);
    expect(container.querySelector("a")).toBeNull();
  });
});
