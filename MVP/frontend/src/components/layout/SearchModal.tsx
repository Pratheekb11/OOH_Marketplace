"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import EmptyState from "@/components/ui/EmptyState";
import Icon from "@/components/ui/Icon";
import Skeleton from "@/components/ui/Skeleton";
import { api, ApiError } from "@/lib/api";
import type { ListingOut, ListingPage } from "@/components/marketplace/types";

export interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

const DEBOUNCE_MS = 300;

/**
 * Global "quick find" overlay, opened from NavShellA's search button or
 * Ctrl+K / Cmd+K (listener lives in NavShellA so it works even while the
 * modal is unmounted). Hits `GET /listings?q=` — the same endpoint/param
 * FilterBar uses for the marketplace's free-text filter — and links straight
 * to `/listings/{id}`; no client-side result caching, matching every other
 * fetch in this app.
 */
export function SearchModal({ open, onClose }: SearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ListingOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Reset state and focus the input whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults([]);
    setError(null);
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Debounced search against the live API — no query, no request.
  useEffect(() => {
    if (!open || !query.trim()) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const trimmed = query.trim();
    const handle = setTimeout(() => {
      // GET /listings returns a paged envelope; the modal shows a short preview.
      api<ListingPage>(`/listings?q=${encodeURIComponent(trimmed)}&limit=8`)
        .then((data) => setResults(data.items))
        .catch((err: unknown) => {
          setError(err instanceof ApiError ? String(err.detail ?? err.message) : "Something went wrong.");
          setResults([]);
        })
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query, open]);

  // Esc to close, Tab/Shift+Tab trapped inside the dialog.
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Lock background scroll while the overlay is up.
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  if (!open) return null;

  function goToListing(id: number) {
    onClose();
    router.push(`/listings/${id}`);
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-primary/40 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search listings"
        className="glass-card w-full max-w-xl overflow-hidden rounded-2xl border border-border-subtle shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-border-subtle px-5 py-4">
          <Icon name="search" className="text-on-surface-variant" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search listings by title or location..."
            aria-label="Search listings"
            className="w-full bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none"
          />
          <kbd className="hidden shrink-0 rounded border border-border-subtle px-1.5 py-0.5 text-[10px] font-bold text-on-surface-variant sm:block">
            Esc
          </kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {!query.trim() ? (
            <p className="px-4 py-10 text-center text-sm text-on-surface-variant">
              Start typing to search active listings by title or location.
            </p>
          ) : loading ? (
            <div className="space-y-2 p-2">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </div>
          ) : error ? (
            <EmptyState icon="error" title="Couldn't search listings" description={error} className="py-10" />
          ) : results.length === 0 ? (
            <EmptyState icon="search_off" title="No matches" description={`Nothing found for "${query.trim()}".`} className="py-10" />
          ) : (
            <ul>
              {results.map((listing) => (
                <li key={listing.id}>
                  <button
                    type="button"
                    onClick={() => goToListing(listing.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left transition-colors hover:bg-surface-container"
                  >
                    <span>
                      <span className="block text-sm font-bold text-on-surface">{listing.title}</span>
                      <span className="block text-xs text-on-surface-variant">{listing.location}</span>
                    </span>
                    <Icon name="chevron_right" className="!text-sm text-on-surface-variant" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default SearchModal;
