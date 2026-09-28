"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/components/auth/AuthProvider";
import { ApiError } from "@/lib/api";
import Icon from "@/components/ui/Icon";
import GoogleGlyph from "@/app/(auth)/_components/GoogleGlyph";

type AccountRole = "advertiser" | "owner";

const GIS_SRC = "https://accounts.google.com/gsi/client";
const DEFAULT_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

/** The slice of Google Identity Services this component touches. */
interface GoogleIdentityServices {
  initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
}

function gis(): GoogleIdentityServices | undefined {
  return (window as unknown as { google?: { accounts?: { id?: GoogleIdentityServices } } }).google?.accounts?.id;
}

let gisScript: Promise<GoogleIdentityServices> | null = null;

/** Loads Google's script once per page, however many buttons ask for it. */
function loadGis(): Promise<GoogleIdentityServices> {
  const ready = gis();
  if (ready) return Promise.resolve(ready);
  gisScript ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => {
      const loaded = gis();
      if (loaded) resolve(loaded);
      else reject(new Error("Google Identity Services did not load"));
    };
    script.onerror = () => {
      gisScript = null;
      reject(new Error("Google Identity Services did not load"));
    };
    document.head.appendChild(script);
  });
  return gisScript;
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError && typeof err.detail === "string" && err.detail.trim()) return err.detail;
  return "Google sign-in failed. Please try again.";
}

/**
 * "Sign in with Google" for /login and /register, via Google Identity
 * Services in popup mode: Google hands an ID token to a JS callback and the
 * API verifies it (POST /auth/google). No redirect URIs, no client secret.
 *
 * `role` is what /register's toggle says. /login passes none, so a Google
 * account that has never been here is asked which kind of account to create
 * instead of silently becoming an advertiser.
 *
 * Without NEXT_PUBLIC_GOOGLE_CLIENT_ID (e.g. the static Pages mirror) it
 * degrades to the old disabled button.
 */
export function GoogleAuthButton({
  clientId = DEFAULT_CLIENT_ID,
  role,
  onSignedIn,
}: {
  clientId?: string;
  role?: AccountRole;
  onSignedIn: () => void;
}) {
  const { loginWithGoogle } = useAuth();
  const slotRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [pendingCredential, setPendingCredential] = useState<{ credential: string; email: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // GIS keeps the callback it was initialised with; these refs let that one
  // callback see the current role toggle and handlers.
  const latest = useRef({ role, loginWithGoogle, onSignedIn });
  latest.current = { role, loginWithGoogle, onSignedIn };

  async function signIn(credential: string, chosenRole: AccountRole | undefined) {
    setError(null);
    setBusy(true);
    try {
      const result = await latest.current.loginWithGoogle(credential, chosenRole);
      if (result.needsRole) {
        setPendingCredential({ credential, email: result.email });
        setBusy(false);
        return;
      }
      setPendingCredential(null);
      latest.current.onSignedIn();
    } catch (err) {
      setPendingCredential(null);
      setError(errorMessage(err));
      setBusy(false);
    }
  }
  const signInRef = useRef(signIn);
  signInRef.current = signIn;

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    loadGis()
      .then((google) => {
        if (cancelled || !slotRef.current) return;
        google.initialize({
          client_id: clientId,
          callback: ({ credential }) => void signInRef.current(credential, latest.current.role),
        });
        const width = Math.min(400, Math.max(200, Math.floor(slotRef.current.offsetWidth)));
        google.renderButton(slotRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "rectangular",
          text: latest.current.role ? "signup_with" : "signin_with",
          logo_alignment: "left",
          width,
        });
      })
      .catch(() => {
        if (!cancelled) setError("Google sign-in is unavailable right now. Please use email instead.");
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (!clientId) {
    return (
      <button
        type="button"
        disabled
        title="Google sign-in is not configured for this deployment."
        className="flex cursor-not-allowed items-center justify-center gap-3 rounded-xl border-0 bg-surface-container-lowest px-4 py-3 font-bold text-on-surface opacity-60"
      >
        <GoogleGlyph />
        Google
      </button>
    );
  }

  const roleDialog = pendingCredential ? (
    <div
      className="fade-in fixed inset-0 z-[100] flex items-center justify-center bg-primary/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) setPendingCredential(null);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) setPendingCredential(null);
        }}
        className="pop-in relative w-full max-w-md rounded-xl bg-surface-container-lowest p-8 text-left shadow-xl sm:p-10"
      >
        <button
          type="button"
          aria-label="Cancel"
          disabled={busy}
          onClick={() => setPendingCredential(null)}
          className="absolute right-4 top-4 p-1 text-on-surface-variant hover:text-on-surface"
        >
          <Icon name="close" />
        </button>
        <h2 id={titleId} className="font-headline text-2xl font-bold tracking-tight text-on-surface">
          Create Your Account
        </h2>
        <p className="mt-2 text-sm font-medium text-on-surface-variant">
          Signing up as <span className="font-bold text-on-surface">{pendingCredential.email}</span>. How will you use
          AdSpace?
        </p>
        <div className="mt-6 grid gap-3">
          {(
            [
              { value: "advertiser", label: "Advertiser", hint: "Discover and book OOH inventory." },
              { value: "owner", label: "Space Owner", hint: "List your advertising space and start earning." },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={busy}
              onClick={() => void signIn(pendingCredential.credential, option.value)}
              className="rounded-xl bg-surface-container-low px-5 py-4 text-left transition-all hover:bg-surface-container disabled:opacity-60"
            >
              <span className="block font-bold text-on-surface">{option.label}</span>
              <span className="block text-sm text-on-surface-variant">{option.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-2">
      <div ref={slotRef} className="flex min-h-[44px] items-center justify-center" />
      {error ? (
        <p role="alert" className="text-xs font-medium text-error">
          {error}
        </p>
      ) : null}
      {roleDialog ? createPortal(roleDialog, document.body) : null}
    </div>
  );
}

export default GoogleAuthButton;
