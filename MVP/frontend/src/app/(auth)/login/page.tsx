import type { Metadata } from "next";
import { Suspense } from "react";
import AuthVisualPanel from "../_components/AuthVisualPanel";
import AuthFormSkeleton from "../_components/AuthFormSkeleton";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign In · AdSpace",
};

// Server Component — ports the "Authentication Form Section" split screen
// from login_Page.html (lines ~55-172). LoginForm itself already isolates
// its `useSearchParams()` read (for `?next=`) behind a local <Suspense>
// (see LoginForm.tsx's NextParamSync), but the whole form is wrapped here
// too so the boundary is guaranteed at the route level regardless of how
// LoginForm evolves, with a fixed-size skeleton (not `null`) as the
// fallback so the split-screen layout never jumps.
export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col font-manrope md:flex-row">
      <AuthVisualPanel />
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 md:px-24">
        <div className="w-full max-w-md">
          <Suspense fallback={<AuthFormSkeleton fields={2} />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
