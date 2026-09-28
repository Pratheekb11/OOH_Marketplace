import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import VerificationQueue, { type VerificationRequest } from "./VerificationQueue";

/** The admin's side: every pending request, with who asked, and a decision. */
afterEach(cleanup);

const REQUESTS: VerificationRequest[] = [
  {
    id: 11,
    title: "Skywalk - Ashok Nagar",
    location: "Ashok Nagar, Bengaluru",
    space_type: "Skywalk",
    image_url: null,
    owner_id: 4,
    owner_name: "Aarav Mehta",
    owner_email: "owner@example.com",
  },
  {
    id: 12,
    title: "Hoarding - MG Road",
    location: "MG Road, Bengaluru",
    space_type: "Hoarding",
    image_url: null,
    owner_id: 9,
    owner_name: "Rhea Nair",
    owner_email: "rhea@example.com",
  },
];

describe("VerificationQueue", () => {
  it("lists each request with the space and who asked", () => {
    render(<VerificationQueue items={REQUESTS} onDecide={vi.fn()} />);
    const row = screen.getByTestId("verification-request-11");
    expect(within(row).getByText("Skywalk - Ashok Nagar")).toBeTruthy();
    expect(within(row).getByText(/owner@example.com/)).toBeTruthy();
    expect(within(row).getByRole("link", { name: /view/i }).getAttribute("href")).toBe("/listings/11");
  });

  it("approves and rejects the right listing", () => {
    const onDecide = vi.fn();
    render(<VerificationQueue items={REQUESTS} onDecide={onDecide} />);
    fireEvent.click(within(screen.getByTestId("verification-request-12")).getByRole("button", { name: /approve/i }));
    expect(onDecide).toHaveBeenLastCalledWith(12, true);
    fireEvent.click(within(screen.getByTestId("verification-request-11")).getByRole("button", { name: /reject/i }));
    expect(onDecide).toHaveBeenLastCalledWith(11, false);
  });

  it("says so when nothing is waiting", () => {
    render(<VerificationQueue items={[]} onDecide={vi.fn()} />);
    expect(screen.getByText(/no verification requests/i)).toBeTruthy();
  });
});
