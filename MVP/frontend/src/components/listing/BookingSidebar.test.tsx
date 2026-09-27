import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ListingOut } from "@/components/marketplace/types";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  push: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: mocks.api,
  ApiError: class ApiError extends Error {
    status: number;
    detail: unknown;
    constructor(status: number, detail: unknown) {
      super(String(detail));
      this.status = status;
      this.detail = detail;
    }
  },
}));
vi.mock("@/components/auth/AuthProvider", () => ({ useAuth: () => ({ status: "authenticated" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }), usePathname: () => "/listings/1" }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ showToast: mocks.showToast }) }));

import BookingSidebar from "./BookingSidebar";

function isoPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function listing(minBookingDays?: number): ListingOut {
  return {
    id: 1,
    owner_id: 1,
    title: "Skywalk - Ashok Nagar",
    space_type: "Skywalk",
    description: "",
    location: "Ashok Nagar, Bengaluru",
    width_ft: 68.6,
    height_ft: 10,
    price_per_day: 30000,
    footfall_estimate: 639000,
    status: "active",
    rejection_reason: null,
    lighting: "Front Lit",
    image_url: null,
    extra: null,
    ...(minBookingDays === undefined ? {} : { min_booking_days: minBookingDays }),
  };
}

const startInput = () => screen.getByLabelText(/start/i) as HTMLInputElement;
const endInput = () => screen.getByLabelText(/end/i) as HTMLInputElement;
const addButton = () => screen.getByRole("button", { name: /add to cart/i }) as HTMLButtonElement;

beforeEach(() => {
  mocks.api.mockReset();
  mocks.api.mockImplementation(async (path: string) => (path === "/addons" ? [] : {}));
});

afterEach(() => cleanup());

describe("BookingSidebar minimum term (P0-3)", () => {
  it("defaults the window to the listing's minimum", async () => {
    render(<BookingSidebar listing={listing(7)} />);
    await waitFor(() => expect(startInput().value).toBe(isoPlus(0)));
    expect(endInput().value).toBe(isoPlus(6));
  });

  it("states the minimum next to the dates", async () => {
    render(<BookingSidebar listing={listing(7)} />);
    expect(await screen.findByText(/minimum booking:?\s*7 days/i)).toBeTruthy();
  });

  it("prices the default window at the minimum", async () => {
    render(<BookingSidebar listing={listing(7)} />);
    expect(await screen.findByText(/base \(7 days\)/i)).toBeTruthy();
  });

  it("blocks a window shorter than the minimum", async () => {
    render(<BookingSidebar listing={listing(7)} />);
    await waitFor(() => expect(startInput().value).toBe(isoPlus(0)));

    fireEvent.change(endInput(), { target: { value: isoPlus(2) } });

    expect(await screen.findByText(/at least 7 days/i)).toBeTruthy();
    expect(addButton().disabled).toBe(true);
    fireEvent.click(addButton());
    expect(mocks.api).not.toHaveBeenCalledWith("/cart/items", expect.anything());
  });

  it("keeps the end date at least the minimum after the start date moves", async () => {
    render(<BookingSidebar listing={listing(7)} />);
    await waitFor(() => expect(startInput().value).toBe(isoPlus(0)));

    fireEvent.change(startInput(), { target: { value: isoPlus(10) } });

    await waitFor(() => expect(endInput().value).toBe(isoPlus(16)));
  });

  it("sends the minimum window to the cart", async () => {
    render(<BookingSidebar listing={listing(7)} />);
    await waitFor(() => expect(endInput().value).toBe(isoPlus(6)));

    fireEvent.click(addButton());

    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith("/cart/items", expect.anything()));
    const [, options] = mocks.api.mock.calls.find(([path]) => path === "/cart/items")!;
    expect(JSON.parse(options.body)).toMatchObject({
      listing_id: 1,
      start_date: isoPlus(0),
      end_date: isoPlus(6),
    });
  });

  it("keeps one-day listings at one day with no minimum notice", async () => {
    render(<BookingSidebar listing={listing(1)} />);
    await waitFor(() => expect(startInput().value).toBe(isoPlus(0)));
    expect(endInput().value).toBe(isoPlus(0));
    expect(screen.queryByText(/minimum booking/i)).toBeNull();
  });

  it("treats a listing without the field (older static snapshot) as one day", async () => {
    render(<BookingSidebar listing={listing()} />);
    await waitFor(() => expect(startInput().value).toBe(isoPlus(0)));
    expect(endInput().value).toBe(isoPlus(0));
  });
});
