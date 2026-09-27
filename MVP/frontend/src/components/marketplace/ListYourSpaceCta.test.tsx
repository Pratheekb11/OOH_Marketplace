import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ListYourSpaceCta from "./ListYourSpaceCta";

afterEach(() => cleanup());

const INVENTED = [/500\+/, /₹50Cr\+/, /₹2\.5L\+/, /hundreds of media owners/i, /international advertisers/i, /Horizon/];

describe("ListYourSpaceCta (P0-5)", () => {
  it("shows the live listing count instead of invented figures", () => {
    const { container } = render(<ListYourSpaceCta totalListings={2120} />);
    const text = container.textContent ?? "";
    expect(text).toContain("2,120");
    for (const claim of INVENTED) expect(text).not.toMatch(claim);
  });

  it("shows no figure at all while the count is unknown", () => {
    const { container } = render(<ListYourSpaceCta totalListings={null} />);
    const text = container.textContent ?? "";
    for (const claim of INVENTED) expect(text).not.toMatch(claim);
    expect(text).not.toMatch(/\d+\s*(spaces|listings)/i);
  });

  it("keeps the call to action", () => {
    render(<ListYourSpaceCta totalListings={2120} />);
    const link = screen.getByRole("link", { name: /list your space/i });
    expect(link.getAttribute("href")).toBe("/list-your-space");
  });

  it("has no dead Learn More button", () => {
    render(<ListYourSpaceCta totalListings={2120} />);
    expect(screen.queryByRole("button", { name: /learn more/i })).toBeNull();
  });
});
