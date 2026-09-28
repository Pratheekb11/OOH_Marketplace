"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import Icon from "@/components/ui/Icon";
import { useWizard } from "@/lib/wizard/context";
import { WIZARD_STEPS } from "@/lib/wizard/constants";
import MyListingsPanel from "./MyListingsPanel";

/** Below lg the WizardSidebar is hidden, which used to take the step list,
 * Save Draft and My Listings with it. This strip carries the same controls
 * in a phone-sized form: a scrollable row of steps, the progress bar, and
 * My Listings folded into a <details>. */
export function WizardMobileNav() {
  const pathname = usePathname();
  const { saveDraftNow } = useWizard();
  const { showToast } = useToast();

  const activeIndex = Math.max(
    0,
    WIZARD_STEPS.findIndex((step) => pathname?.endsWith(`/${step.path}`)),
  );
  const progressPercent = ((activeIndex + 1) / WIZARD_STEPS.length) * 100;

  // Five steps do not fit across a phone; keep the current one on screen.
  const activeRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const link = activeRef.current;
    const strip = link?.parentElement;
    if (!link || !strip) return;
    strip.scrollTo({ left: link.offsetLeft - (strip.clientWidth - link.offsetWidth) / 2, behavior: "smooth" });
  }, [activeIndex]);

  function handleSaveDraft() {
    saveDraftNow();
    showToast({ title: "Draft saved", description: "Your progress is stored for this browser session.", tone: "success" });
  }

  return (
    <div className="border-b border-outline-variant/30 bg-surface-container-low px-5 pt-4 sm:px-8 lg:hidden">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
          Step {activeIndex + 1} of {WIZARD_STEPS.length}
        </p>
        <button
          type="button"
          onClick={handleSaveDraft}
          className="rounded-lg border border-primary px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-white"
        >
          Save Draft
        </button>
      </div>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-surface-container-highest">
        <div className="h-full bg-secondary-container transition-all" style={{ width: `${progressPercent}%` }} />
      </div>

      <nav className="hide-scrollbar relative -mx-5 mt-2 flex overflow-x-auto px-3 font-headline text-sm sm:-mx-8 sm:px-6">
        {WIZARD_STEPS.map((step, i) => {
          const isActive = i === activeIndex;
          return (
            <Link
              key={step.id}
              ref={isActive ? activeRef : undefined}
              href={`/list-your-space/${step.path}`}
              aria-current={isActive ? "step" : undefined}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 ${
                isActive
                  ? "border-secondary font-semibold text-on-surface"
                  : "border-transparent text-on-surface-variant"
              }`}
            >
              <Icon name={step.icon} className="!text-lg" />
              <span>{step.label}</span>
            </Link>
          );
        })}
      </nav>

      <details className="group border-t border-outline-variant/30 py-3">
        <summary className="flex cursor-pointer list-none items-center justify-between text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          My Listings
          <Icon name="expand_more" className="!text-lg transition-transform group-open:rotate-180" />
        </summary>
        <div className="pt-3">
          <MyListingsPanel />
        </div>
      </details>
    </div>
  );
}

export default WizardMobileNav;
