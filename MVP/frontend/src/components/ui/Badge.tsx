import Icon from "./Icon";
import type { ReactNode } from "react";

export type BadgeTone = "primary" | "secondary" | "tertiary" | "verified";

// css/listing_page.css .badge-{primary,secondary,tertiary,verified}
const TONE_CLASSES: Record<BadgeTone, string> = {
  primary: "bg-primary text-white",
  secondary: "bg-secondary text-white",
  tertiary: "bg-tertiary-container text-white",
  verified: "bg-tertiary-container text-white",
};

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

/** The 9px uppercase pill used for listing tags/status chips. */
export function Badge({ tone = "primary", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest ${TONE_CLASSES[tone]} ${className}`}
    >
      {tone === "verified" ? <Icon name="verified" fill={1} className="!text-[10px] leading-none" /> : null}
      {children}
    </span>
  );
}

export default Badge;
