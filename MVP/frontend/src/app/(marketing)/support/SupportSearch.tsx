"use client";

import type { KeyboardEvent } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";

export interface SupportSearchEntry {
  id: string;
  question: string;
}

/**
 * The only interactive piece of the support hero — kept in its own client
 * component so `support/page.tsx` can stay a Server Component and export
 * `metadata` (Next.js forbids that export from a "use client" file).
 * Deliberately simple: no fetch, no fuzzy search — Enter jumps to and opens
 * the first FAQ `<details>` whose question text contains the query. This
 * replaces the prototype's `performSearch()` (a full-page innerText scan
 * with regex highlighting) with something scoped to real FAQ content.
 */
export function SupportSearch({ entries }: { entries: SupportSearchEntry[] }) {
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const query = event.currentTarget.value.trim().toLowerCase();
    if (!query) return;
    const match = entries.find((entry) => entry.question.toLowerCase().includes(query));
    if (!match) return;
    const el = document.getElementById(match.id);
    if (el instanceof HTMLDetailsElement) el.open = true;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    // On a phone the button and the field cannot share one pill without
    // squeezing the placeholder to a couple of characters, so they stack.
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:rounded-full sm:bg-surface-container-highest sm:p-1 sm:pr-2">
      <div className="flex min-w-0 items-center rounded-full bg-surface-container-highest px-2 sm:flex-1 sm:bg-transparent sm:px-0">
        <Icon name="search" className="px-4 text-on-surface-variant sm:px-6" />
        <input
          type="text"
          placeholder="Search FAQs, then press Enter…"
          className="w-full min-w-0 border-none bg-transparent py-4 font-medium text-on-surface placeholder:text-outline focus:ring-0"
          onKeyDown={handleKeyDown}
        />
      </div>
      <Link
        href="#faq"
        className="shrink-0 rounded-full bg-primary px-8 py-3 text-center text-sm font-bold text-white"
      >
        Browse FAQs
      </Link>
    </div>
  );
}

export default SupportSearch;
