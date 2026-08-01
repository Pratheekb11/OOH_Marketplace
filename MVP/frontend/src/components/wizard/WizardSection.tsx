import type { ReactNode } from "react";

export interface WizardSectionProps {
  heading: string;
  description?: string;
  /** Rendered under the heading in the label column — used by the review
   * page for its "Edit" links (prototype: review.html puts Edit next to
   * each section title, not inside the content card). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** The 12-col "label column + filled content card" layout repeated across
 * every step section in the prototype (md:col-span-4 heading, md:col-span-8
 * bg-surface-container-low card). */
export function WizardSection({ heading, description, action, children, className = "" }: WizardSectionProps) {
  return (
    <section className="grid grid-cols-1 gap-12 md:grid-cols-12">
      <div className="md:col-span-4">
        <h2 className="mb-3 font-syne text-2xl font-bold text-primary">{heading}</h2>
        {description ? <p className="text-sm text-on-surface-variant">{description}</p> : null}
        {action}
      </div>
      <div className={`space-y-8 rounded-xl bg-surface-container-low p-10 md:col-span-8 ${className}`}>
        {children}
      </div>
    </section>
  );
}

export default WizardSection;
