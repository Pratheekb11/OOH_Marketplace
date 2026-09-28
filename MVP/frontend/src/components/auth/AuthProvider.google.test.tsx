import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth, type AuthContextValue } from "./AuthProvider";
import { TOKEN_KEY } from "@/lib/auth-storage";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

let ctx: AuthContextValue | null = null;
function Probe() {
  ctx = useAuth();
  return null;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  ctx = null;
});

describe("AuthProvider.loginWithGoogle", () => {
  it("posts the credential and role, stores the token and loads the user", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/auth/google")) {
        return jsonResponse({ access_token: "jwt-1", token_type: "bearer", needs_role: false });
      }
      if (url.endsWith("/auth/me")) {
        return jsonResponse({ id: 7, email: "asha@example.com", full_name: "Asha Rao", role: "owner" });
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(ctx?.status).toBe("unauthenticated"));

    let result: unknown;
    await act(async () => {
      result = await ctx!.loginWithGoogle("google-id-token", "owner");
    });

    expect(result).toEqual({ needsRole: false });
    const [url, init] = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/auth/google"))! as unknown as [
      string,
      RequestInit,
    ];
    expect(url.endsWith("/auth/google")).toBe(true);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ credential: "google-id-token", role: "owner" });
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe("jwt-1");
    await waitFor(() => expect(ctx?.status).toBe("authenticated"));
    expect(ctx?.user?.email).toBe("asha@example.com");
  });

  it("reports needsRole for a new Google user without signing anyone in", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/auth/google")) {
        return jsonResponse({
          access_token: null,
          token_type: "bearer",
          needs_role: true,
          email: "asha@example.com",
          full_name: "Asha Rao",
        });
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(ctx?.status).toBe("unauthenticated"));

    let result: unknown;
    await act(async () => {
      result = await ctx!.loginWithGoogle("google-id-token");
    });

    expect(result).toEqual({ needsRole: true, email: "asha@example.com", fullName: "Asha Rao" });
    const [, init] = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/auth/google"))! as unknown as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(String(init.body))).toEqual({ credential: "google-id-token" });
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(ctx?.status).toBe("unauthenticated");
  });
});
