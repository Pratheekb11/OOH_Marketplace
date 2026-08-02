"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import Icon from "@/components/ui/Icon";
import { useWizard } from "@/lib/wizard/context";
import { WIZARD_STEPS } from "@/lib/wizard/constants";
import MyListingsPanel from "./MyListingsPanel";

/** Sidebar ported from listing_your_adspace.html's <aside> — 5-step nav +
 * onboarding progress bar (20/40/60/80/100%) + Save Draft + the owner's
 * existing listings (MyListingsPanel), which is what gives update/delete a
 * home without adding a 9th wizard page. */
export function WizardSidebar() {
  const pathname = usePathname();
  const { state, saveDraftNow } = useWizard();
  const { showToast } = useToast();

  const activeIndex = Math.max(
    0,
    WIZARD_STEPS.findIndex((step) => pathname?.endsWith(`/${step.path}`)),
  );
  const progressPercent = ((activeIndex + 1) / WIZARD_STEPS.length) * 100;

  function handleSaveDraft() {
    saveDraftNow();
    showToast({ title: "Draft saved", description: "Your progress is stored for this browser session.", tone: "success" });
  }

  return (
    <aside className="sticky top-20 hidden h-[calc(100vh-5rem)] w-72 shrink-0 flex-col overflow-y-auto py-8 lg:flex bg-surface-container-low">
      <div className="mb-8 px-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
            <Icon name="storefront" fill={1} />
          </span>
          <div>
            <p className="font-headline text-sm font-bold text-on-surface">
              {state.title.trim() || (state.listingId ? "Editing Listing" : "New Listing")}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
              Onboarding Progress: {Math.round(progressPercent)}%
            </p>
          </div>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
          <div className="h-full bg-secondary-container transition-all" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <nav className="flex flex-col font-headline text-sm">
        {WIZARD_STEPS.map((step, i) => {
          const isActive = i === activeIndex;
          return (
            <Link
              key={step.id}
              href={`/list-your-space/${step.path}`}
              className={
                isActive
                  ? "ml-2 flex items-center gap-4 rounded-l-lg bg-surface-container-lowest px-6 py-3 font-semibold text-on-surface"
                  : "flex items-center gap-4 px-6 py-3 text-on-surface-variant transition-colors hover:text-on-surface"
              }
            >
              <Icon name={step.icon} />
              <span>{step.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-8 border-t border-outline-variant/30 px-6 pt-8">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          My Listings
        </p>
        <MyListingsPanel />
      </div>

      <div className="mt-auto px-6 pt-8">
        <button
          type="button"
          onClick={handleSaveDraft}
          className="w-full rounded-xl border-2 border-primary py-3 text-sm font-bold text-primary transition-all duration-150 hover:bg-primary hover:text-white active:scale-95"
        >
          Save Draft
        </button>
      </div>
    </aside>
  );
}

export default WizardSidebar;
