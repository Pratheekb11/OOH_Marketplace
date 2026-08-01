import type { Metadata } from "next";
import { Suspense } from "react";
import AuthVisualPanel from "../_components/AuthVisualPanel";
import AuthFormSkeleton from "../_components/AuthFormSkeleton";
import RegisterForm from "./RegisterForm";

export const metadata: Metadata = {
  title: "Create Account · AdSpace",
};

// Server Component — mirrors login/page.tsx's split screen so /register
// shares the exact same visual language (same AuthVisualPanel, same
// max-w-md form column). RegisterForm reads `?next=` the same way
// LoginForm does, so it gets the same <Suspense> boundary + skeleton.
export default function RegisterPage() {
  return (
    <main className="flex min-h-screen flex-col font-manrope md:flex-row">
      <AuthVisualPanel
        headline={
          <>
            Your Space. <br />
            Your Audience.
          </>
        }
        lede="Join thousands of advertisers and space owners already trading premium OOH inventory on AdSpace."
      />
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 md:px-24">
        <div className="w-full max-w-md">
          <Suspense fallback={<AuthFormSkeleton fields={4} />}>
            <RegisterForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
