"use client";

import Link from "next/link";
import type { MouseEvent } from "react";

export interface WizardNextLinkProps {
  href: string;
  label: string;
  /** Runs on click; return false to cancel navigation (e.g. the step's zod
   * schema didn't pass) — the caller is responsible for rendering whatever
   * inline errors that produces. Always a real <Link> under the hood so the
   * wizard layout never remounts (see list-your-space/layout.tsx). */
  validate: () => boolean;
  disabled?: boolean;
}

export function WizardNextLink({ href, label, validate, disabled }: WizardNextLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (disabled) {
      event.preventDefault();
      return;
    }
    if (!validate()) {
      event.preventDefault();
    }
  }

  return (
    <Link
      href={href}
      aria-disabled={disabled}
      onClick={handleClick}
      className={`brand-gradient flex-1 rounded-xl px-16 py-5 text-center font-syne font-bold text-white shadow-xl shadow-secondary/20 transition-transform active:scale-95 md:flex-none ${
        disabled ? "pointer-events-none opacity-50" : "hover:scale-[1.02]"
      }`}
    >
      {label}
    </Link>
  );
}

export default WizardNextLink;
