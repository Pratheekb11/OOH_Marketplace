/**
 * SSR-safe token storage. `typeof window` guards live ONLY inside these
 * functions — never gate rendering on `typeof window` in JSX/components,
 * that pattern causes hydration mismatches (see AuthProvider's doc comment).
 */

export const TOKEN_KEY = "adspace_access_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage unavailable (private mode, quota) — swallow, caller stays
    // logged in for the current session only.
  }
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}
