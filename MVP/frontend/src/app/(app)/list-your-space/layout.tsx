"use client";

import { Suspense } from "react";
import type { ReactNode } from "react";
import RequireRole from "@/components/auth/RequireRole";
import EditModeSync from "@/components/wizard/EditModeSync";
import WizardSidebar from "@/components/wizard/WizardSidebar";
import { WizardProvider, useWizard } from "@/lib/wizard/context";

/**
 * Owns the wizard's single `useReducer` (via WizardProvider) across all 5
 * step routes. App Router layouts do not remount when navigating between
 * their children, so as long as every intra-wizard link is a real <Link>
 * (never a full <a href> or a hard `router.push` to an absolute URL), this
 * component — and the reducer state inside WizardProvider — stays mounted
 * for the whole wizard session. That's what makes the review page's "Edit"
 * links and the sidebar's step links free: they navigate without losing
 * any in-progress field values.
 */
export default function ListYourSpaceLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole role="owner">
      <WizardProvider>
        {/* useSearchParams() (inside EditModeSync) must be wrapped in
            Suspense or `next build` fails — see login/LoginForm.tsx's
            NextParamSync for the identical pattern. */}
        <Suspense fallback={null}>
          <EditModeSync />
        </Suspense>
        <WizardBody>{children}</WizardBody>
      </WizardProvider>
    </RequireRole>
  );
}

/** Split out so it can read `hydrated` from the context that
 * ListYourSpaceLayout just created above it. */
function WizardBody({ children }: { children: ReactNode }) {
  const { hydrated } = useWizard();

  return (
    <div className="flex min-h-screen">
      <WizardSidebar />
      <div className="flex-1">
        {hydrated ? (
          children
        ) : (
          <div className="flex min-h-screen items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-on-surface-variant">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-secondary border-t-transparent" />
              <p className="text-sm font-medium">Loading your draft…</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
