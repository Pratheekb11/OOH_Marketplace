import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({ status: "unauthenticated", user: null, token: null, logout: vi.fn() }),
}));

import NavActions from "./NavActions";

afterEach(cleanup);

describe("NavActions (signed out)", () => {
  it("offers both Sign In and Register", () => {
    render(<NavActions />);
    expect(screen.getByRole("link", { name: /sign in/i }).getAttribute("href")).toBe("/login");
    expect(screen.getByRole("link", { name: /register/i }).getAttribute("href")).toBe("/register");
  });
});
