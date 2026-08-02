"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, AUTH_EXPIRED_EVENT } from "@/lib/api";
import { clearToken, getToken, setToken } from "@/lib/auth-storage";
import type { Role, Token, User } from "@/types/api";

/**
 * Highest-risk file in the frontend core — read this comment before editing.
 *
 * State is a discriminated union and MUST initialize to `status: "loading"`,
 * a value the server can also render. localStorage is read only inside a
 * useEffect (after mount), never during render.
 *
 * Banned patterns (all cause a hydration mismatch — React 19 discards the
 * whole server-rendered tree when the first client render disagrees with it):
 *   - `useState(() => localStorage.getItem(...))` — lazy initializers still
 *     run during the client's first render, before hydration reconciles.
 *   - `typeof window !== "undefined" ? A : B` inside JSX/render output.
 *   - calling `router.replace()` during render instead of inside useEffect.
 */
export type AuthState =
  | { status: "loading"; user: null; token: null }
  | { status: "authenticated"; user: User; token: string }
  | { status: "unauthenticated"; user: null; token: null };

export interface RegisterInput {
  email: string;
  full_name: string;
  password: string;
  role?: Role;
  gstin?: string | null;
}

export type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const INITIAL_STATE: AuthState = { status: "loading", user: null, token: null };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL_STATE);

  const loadUser = useCallback(async (token: string) => {
    try {
      const user = await api<User>("/auth/me");
      setState({ status: "authenticated", user, token });
    } catch {
      // Token present but rejected/expired — fall back to signed-out.
      clearToken();
      setState({ status: "unauthenticated", user: null, token: null });
    }
  }, []);

  // Client-only bootstrap: read the stored token and resolve /auth/me.
  // Runs after mount, so the server-rendered "loading" markup always matches
  // the client's first paint.
  useEffect(() => {
    const token = getToken();
    if (token) {
      void loadUser(token);
    } else {
      setState({ status: "unauthenticated", user: null, token: null });
    }
  }, [loadUser]);

  // api.ts dispatches this on any 401 so a stale/expired token doesn't leave
  // the UI stuck showing an authenticated shell with empty data underneath.
  useEffect(() => {
    function handleExpired() {
      setState({ status: "unauthenticated", user: null, token: null });
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const tokenResponse = await api<Token>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        skipAuth: true,
      });
      setToken(tokenResponse.access_token);
      await loadUser(tokenResponse.access_token);
    },
    [loadUser],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      await api("/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
        skipAuth: true,
      });
      await login(input.email, input.password);
    },
    [login],
  );

  const logout = useCallback(() => {
    clearToken();
    setState({ status: "unauthenticated", user: null, token: null });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, register, logout }),
    [state, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export default AuthProvider;
