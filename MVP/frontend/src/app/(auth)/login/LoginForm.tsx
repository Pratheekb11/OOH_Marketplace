"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { ApiError } from "@/lib/api";
import Icon from "@/components/ui/Icon";
import TextField from "@/components/ui/TextField";
import GoogleGlyph from "../_components/GoogleGlyph";
import RoleToggle, { type AuthRole } from "../_components/RoleToggle";

function extractErrorMessage(detail: unknown): string {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const first = detail[0];
    if (first && typeof first === "object" && "msg" in first && typeof (first as { msg?: unknown }).msg === "string") {
      return (first as { msg: string }).msg;
    }
  }
  return "Something went wrong. Please try again.";
}

/**
 * Reads `?next=` and nothing else. Isolated into its own component behind a
 * local <Suspense> boundary (rather than wrapping the whole form) so that
 * `useSearchParams()` only de-opts this sliver from static prerendering —
 * see CLAUDE build notes: without *some* Suspense boundary above it,
 * `next build` fails with "useSearchParams() should be wrapped in a
 * suspense boundary." The rest of the form renders immediately, no flash.
 */
function NextParamSync({ onResolved }: { onResolved: (next: string | null) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    onResolved(searchParams.get("next"));
  }, [searchParams, onResolved]);
  return null;
}

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();

  const [role, setRole] = useState<AuthRole>("advertiser");
  const [nextPath, setNextPath] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.push(nextPath || "/marketplace");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(extractErrorMessage(err.detail));
      } else {
        setError("Something went wrong. Please try again.");
      }
      setSubmitting(false);
    }
  }

  return (
    <>
      <Suspense fallback={null}>
        <NextParamSync onResolved={setNextPath} />
      </Suspense>

      {/* Dual entry switch — cosmetic on login (the API has no per-role
          login endpoint); real role selection lives on /register. */}
      <RoleToggle value={role} onChange={setRole} />

      <header className="space-y-2 pt-10">
        <h2 className="font-headline text-3xl font-bold tracking-tight text-on-surface">Welcome Back</h2>
        <p className="font-medium text-on-surface-variant">
          Access your {role === "owner" ? "space owner" : "advertiser"} dashboard.
        </p>
      </header>

      <form className="space-y-6 pt-6" onSubmit={handleSubmit} noValidate>
        <div className="space-y-5">
          <TextField
            label="Email Address"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="name@company.com"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <div className="flex flex-col gap-2">
            <div className="ml-1 flex items-center justify-between">
              <label
                htmlFor="password"
                className="text-xs font-bold font-label uppercase tracking-widest text-on-surface-variant"
              >
                Password
              </label>
              <Link
                href="/support"
                className="text-xs font-bold text-secondary transition-colors hover:text-secondary-container"
              >
                Forgot Password?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border-0 bg-surface-container-highest px-4 py-4 text-on-surface placeholder:text-outline transition-all focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        <div className="ml-1 flex items-center space-x-3">
          <input
            id="remember"
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
            className="h-5 w-5 rounded border-0 bg-surface-container-highest text-secondary focus:ring-2 focus:ring-secondary/20 focus:ring-offset-0"
          />
          <label htmlFor="remember" className="text-sm font-medium text-on-surface-variant">
            Keep me signed in for 30 days
          </label>
        </div>

        {error ? (
          <p role="alert" className="rounded-xl bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="brand-gradient flex w-full items-center justify-center gap-2 rounded-xl py-4 font-bold text-white transition-smooth hover:scale-[1.02] active:scale-95 disabled:pointer-events-none disabled:opacity-60"
        >
          {submitting ? "Signing In…" : "Sign In"}
          <Icon name="arrow_forward" className="!text-xl" />
        </button>
      </form>

      <div className="relative py-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-outline-variant/30" />
        </div>
        <div className="relative flex justify-center bg-background px-4 font-label text-xs font-bold uppercase tracking-widest text-outline">
          Or continue with
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          disabled
          title="Google sign-in is out of scope for this build — no OAuth provider is wired up yet."
          className="flex cursor-not-allowed items-center justify-center gap-3 rounded-xl border-0 bg-surface-container-lowest px-4 py-3 font-bold text-on-surface opacity-60"
        >
          <GoogleGlyph />
          Google
        </button>
        <button
          type="button"
          disabled
          title="Single sign-on is out of scope for this build — no identity provider is configured yet."
          className="flex cursor-not-allowed items-center justify-center gap-3 rounded-xl border-0 bg-surface-container-lowest px-4 py-3 font-bold text-on-surface opacity-60"
        >
          <Icon name="account_balance" className="!text-2xl" />
          SSO
        </button>
      </div>

      <footer className="pt-4 text-center">
        <p className="font-medium text-on-surface-variant">
          New to the marketplace?
          <Link href="/register" className="ml-1 font-bold text-secondary hover:underline">
            Create Account
          </Link>
        </p>
      </footer>
    </>
  );
}

export default LoginForm;
