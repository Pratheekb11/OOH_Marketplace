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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

interface FieldErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

// Same `?next=` isolation strategy as LoginForm.tsx's NextParamSync — kept
// as a local, near-identical copy rather than a shared export so each form
// stays a self-contained unit; see that file for the full rationale.
function NextParamSync({ onResolved }: { onResolved: (next: string | null) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    onResolved(searchParams.get("next"));
  }, [searchParams, onResolved]);
  return null;
}

export function RegisterForm() {
  const router = useRouter();
  const { register } = useAuth();

  const [role, setRole] = useState<AuthRole>("advertiser");
  const [nextPath, setNextPath] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!fullName.trim()) {
      errors.fullName = "Please enter your full name.";
    }
    if (!EMAIL_PATTERN.test(email)) {
      errors.email = "Enter a valid email address.";
    }
    if (password.length < 8) {
      errors.password = "Password must be at least 8 characters.";
    }
    if (confirmPassword !== password) {
      errors.confirmPassword = "Passwords do not match.";
    }
    return errors;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await register({ email, full_name: fullName, password, role });
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

      {/* Real role selector — feeds RegisterInput.role, unlike the
          decorative toggle on /login. */}
      <RoleToggle value={role} onChange={setRole} />

      <header className="space-y-2 pt-10">
        <h2 className="font-headline text-3xl font-bold tracking-tight text-on-surface">Create Your Account</h2>
        <p className="font-medium text-on-surface-variant">
          {role === "owner"
            ? "List your advertising space and start earning."
            : "Discover premium OOH inventory across the city."}
        </p>
      </header>

      <form className="space-y-6 pt-6" onSubmit={handleSubmit} noValidate>
        <div className="space-y-5">
          <TextField
            label="Full Name"
            name="full_name"
            type="text"
            autoComplete="name"
            placeholder="Jane Doe"
            required
            value={fullName}
            onChange={(event) => {
              setFullName(event.target.value);
              setFieldErrors((prev) => ({ ...prev, fullName: undefined }));
            }}
            error={fieldErrors.fullName}
          />

          <TextField
            label="Email Address"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="name@company.com"
            required
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setFieldErrors((prev) => ({ ...prev, email: undefined }));
            }}
            error={fieldErrors.email}
          />

          <TextField
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            required
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setFieldErrors((prev) => ({ ...prev, password: undefined }));
            }}
            error={fieldErrors.password}
            hint={fieldErrors.password ? undefined : "At least 8 characters."}
          />

          <TextField
            label="Confirm Password"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            required
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
            }}
            error={fieldErrors.confirmPassword}
          />
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
          {submitting ? "Creating Account…" : "Create Account"}
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
          Already have an account?
          <Link href="/login" className="ml-1 font-bold text-secondary hover:underline">
            Sign In
          </Link>
        </p>
      </footer>
    </>
  );
}

export default RegisterForm;
