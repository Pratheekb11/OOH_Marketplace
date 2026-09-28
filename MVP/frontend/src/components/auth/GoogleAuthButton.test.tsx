import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  loginWithGoogle: vi.fn(),
}));

vi.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({ status: "unauthenticated", loginWithGoogle: mocks.loginWithGoogle }),
}));

import GoogleAuthButton from "./GoogleAuthButton";

const CLIENT_ID = "test-client.apps.googleusercontent.com";

type GisConfig = { client_id: string; callback: (response: { credential: string }) => void };

function stubGis() {
  const gis = {
    initialize: vi.fn(),
    renderButton: vi.fn(),
  };
  (window as unknown as { google: unknown }).google = { accounts: { id: gis } };
  return gis;
}

function googleCallback(gis: ReturnType<typeof stubGis>) {
  const config = gis.initialize.mock.calls[0][0] as GisConfig;
  return config.callback;
}

beforeEach(() => {
  mocks.loginWithGoogle.mockReset();
});

afterEach(() => {
  cleanup();
  delete (window as unknown as { google?: unknown }).google;
});

describe("GoogleAuthButton", () => {
  it("falls back to a disabled Google button when no client id is configured", () => {
    render(<GoogleAuthButton clientId="" onSignedIn={vi.fn()} />);
    const button = screen.getByRole("button", { name: /google/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("initialises Google Identity Services with the client id and renders Google's button", async () => {
    const gis = stubGis();
    render(<GoogleAuthButton clientId={CLIENT_ID} onSignedIn={vi.fn()} />);
    await waitFor(() => expect(gis.initialize).toHaveBeenCalledTimes(1));
    expect((gis.initialize.mock.calls[0][0] as GisConfig).client_id).toBe(CLIENT_ID);
    await waitFor(() => expect(gis.renderButton).toHaveBeenCalledTimes(1));
    expect(gis.renderButton.mock.calls[0][0]).toBeInstanceOf(HTMLElement);
  });

  it("signs in with the credential and the chosen role, then reports success", async () => {
    const gis = stubGis();
    const onSignedIn = vi.fn();
    mocks.loginWithGoogle.mockResolvedValue({ needsRole: false });
    render(<GoogleAuthButton clientId={CLIENT_ID} role="owner" onSignedIn={onSignedIn} />);
    await waitFor(() => expect(gis.initialize).toHaveBeenCalled());

    googleCallback(gis)({ credential: "google-id-token" });

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1));
    expect(mocks.loginWithGoogle).toHaveBeenCalledWith("google-id-token", "owner");
  });

  it("asks a new user which kind of account to create when no role was chosen", async () => {
    const gis = stubGis();
    const onSignedIn = vi.fn();
    mocks.loginWithGoogle
      .mockResolvedValueOnce({ needsRole: true, email: "asha@example.com", fullName: "Asha Rao" })
      .mockResolvedValueOnce({ needsRole: false });
    render(<GoogleAuthButton clientId={CLIENT_ID} onSignedIn={onSignedIn} />);
    await waitFor(() => expect(gis.initialize).toHaveBeenCalled());

    googleCallback(gis)({ credential: "google-id-token" });

    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("asha@example.com");
    expect(mocks.loginWithGoogle).toHaveBeenCalledWith("google-id-token", undefined);
    expect(onSignedIn).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /space owner/i }));

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1));
    expect(mocks.loginWithGoogle).toHaveBeenLastCalledWith("google-id-token", "owner");
  });

  it("shows the API's error when Google sign-in is refused", async () => {
    const gis = stubGis();
    const onSignedIn = vi.fn();
    mocks.loginWithGoogle.mockRejectedValue(new Error("Google sign-in failed"));
    render(<GoogleAuthButton clientId={CLIENT_ID} role="advertiser" onSignedIn={onSignedIn} />);
    await waitFor(() => expect(gis.initialize).toHaveBeenCalled());

    googleCallback(gis)({ credential: "bad-token" });

    expect((await screen.findByRole("alert")).textContent).toMatch(/google/i);
    expect(onSignedIn).not.toHaveBeenCalled();
  });
});
