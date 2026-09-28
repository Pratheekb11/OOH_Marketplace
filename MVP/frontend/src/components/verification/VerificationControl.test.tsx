import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import VerificationControl from "./VerificationControl";

/**
 * The owner's side of verification: the badge is never self-declared, only
 * requested. What the owner sees depends on where the request stands.
 */
afterEach(cleanup);

describe("VerificationControl", () => {
  it("offers a request when the space has never been reviewed", () => {
    const onRequest = vi.fn();
    render(<VerificationControl status="none" onRequest={onRequest} />);
    fireEvent.click(screen.getByRole("button", { name: /request verification/i }));
    expect(onRequest).toHaveBeenCalledTimes(1);
  });

  it("shows a pending request without a second button", () => {
    render(<VerificationControl status="requested" onRequest={vi.fn()} />);
    expect(screen.getByText(/verification requested/i)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the badge once an admin has approved", () => {
    render(<VerificationControl status="verified" onRequest={vi.fn()} />);
    expect(screen.getByText(/^verified$/i)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("lets the owner ask again after a rejection", () => {
    const onRequest = vi.fn();
    render(<VerificationControl status="rejected" onRequest={onRequest} />);
    expect(screen.getByText(/not approved/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /request again/i }));
    expect(onRequest).toHaveBeenCalledTimes(1);
  });

  it("disables the button while a request is in flight", () => {
    render(<VerificationControl status="none" onRequest={vi.fn()} busy />);
    expect((screen.getByRole("button", { name: /request verification/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});
