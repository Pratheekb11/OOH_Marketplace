import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: { id: 6, email: "admin@example.com", full_name: "Admin", role: "admin" },
    token: "t",
    logout: vi.fn(),
  }),
}));
vi.mock("./CartBadge", () => ({ default: () => null }));

import NavActions from "./NavActions";

afterEach(cleanup);

describe("NavActions (admin)", () => {
  it("links an admin to the verification queue", () => {
    render(<NavActions />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    const link = screen.getByRole("menuitem", { name: /verification requests/i });
    expect(link.getAttribute("href")).toBe("/admin/verifications");
  });
});
