import type { ReactNode } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";

export interface WizardStepShellProps {
  titlePrefix: string;
  titleHighlight: string;
  description: string;
  footerIcon: string;
  footerCaption: string;
  /** Omitted on the first step. */
  prevHref?: string;
  /** The step's Next/Submit control — differs enough per step (validation,
   * submit-vs-navigate) that it's left to the caller rather than baked in. */
  footerRight: ReactNode;
  children: ReactNode;
}

/** Shared header + footer chrome for each of the 5 wizard steps, ported
 * from listing_your_adspace.html / location.html / pricing.html /
 * availability.html / review.html's <main>. Headings use font-syne per the
 * build spec (the rest of the app uses font-headline/Epilogue). */
export function WizardStepShell({
  titlePrefix,
  titleHighlight,
  description,
  footerIcon,
  footerCaption,
  prevHref,
  footerRight,
  children,
}: WizardStepShellProps) {
  return (
    <main className="flex-1 bg-surface px-8 py-16 font-manrope lg:px-24">
      <div className="mb-20 max-w-4xl">
        <h1 className="mb-6 font-syne text-4xl font-bold leading-tight tracking-tight text-primary sm:text-5xl lg:text-6xl">
          {titlePrefix} <span className="text-secondary">{titleHighlight}</span>
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-on-surface-variant">{description}</p>
      </div>

      <div className="space-y-24">{children}</div>

      <div className="mt-12 flex flex-col items-center justify-between gap-8 border-t border-slate-200 pt-12 md:flex-row">
        <div className="flex items-center gap-4 text-slate-400">
          <Icon name={footerIcon} />
          <span className="text-xs font-semibold uppercase tracking-widest">{footerCaption}</span>
        </div>
        <div className="flex w-full items-center gap-6 md:w-auto">
          {prevHref ? (
            <Link
              href={prevHref}
              className="flex-1 px-12 py-5 text-center font-syne font-bold text-on-surface-variant transition-colors hover:text-primary md:flex-none"
            >
              Previous
            </Link>
          ) : null}
          {footerRight}
        </div>
      </div>
    </main>
  );
}

export default WizardStepShell;
