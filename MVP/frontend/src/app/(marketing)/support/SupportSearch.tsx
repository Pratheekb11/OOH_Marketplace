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
    <div className="flex items-center rounded-full bg-surface-container-highest p-1 pr-2">
      <Icon name="search" className="px-6 text-on-surface-variant" />
      <input
        type="text"
        placeholder="Search FAQs, then press Enter…"
        className="w-full border-none bg-transparent py-4 font-medium text-on-surface placeholder:text-outline focus:ring-0"
        onKeyDown={handleKeyDown}
      />
      <Link href="#faq" className="shrink-0 rounded-full bg-primary px-8 py-3 text-sm font-bold text-white">
        Browse FAQs
      </Link>
    </div>
  );
}

export default SupportSearch;
