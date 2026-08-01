"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import FilterBar from "@/components/marketplace/FilterBar";
import ListingGrid from "@/components/marketplace/ListingGrid";
import MapPanel from "@/components/marketplace/MapPanel";
import type { ListingOut } from "@/components/marketplace/types";

/**
 * Owns the split-pane body: fetches from GET /listings server-side-filtered
 * (never filters a client array) every time the URL query string changes,
 * so filters stay shareable/back-forward-able via FilterBar's URL sync.
 *
 * Layout fix vs. the prototype (listing_page.html): the prototype's <main>
 * is `h-[calc(100vh-160px)] overflow-hidden` with a `sticky top-[72px]`
 * filter bar hardcoded to its own nav's exact pixel height, and its CTA +
 * footer sit *inside* that overflow-hidden main, making them unreachable.
 * Here the split pane is a normal-flow section with its own bounded height
 * and an internally scrolling <aside min-h-0 overflow-y-auto>; nothing wraps
 * the CTA/footer that render after it in page.tsx, so the page scrolls
 * normally to reach them.
 */
export function MarketplaceBrowser() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [listings, setListings] = useState<ListingOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queryString = searchParams.toString();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api<ListingOut[]>(`/listings${queryString ? `?${queryString}` : ""}`)
      .then((data) => {
        if (!cancelled) setListings(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof ApiError ? String(err.detail ?? err.message) : "Something went wrong.";
        setError(message);
        setListings([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [queryString]);

  const hasActiveFilters = queryString.length > 0;

  return (
    <div className="flex min-h-0 flex-col">
      <FilterBar />

      <div className="flex min-h-[70vh] flex-1 flex-col lg:h-[75vh] lg:flex-row">
        <aside className="hide-scrollbar min-h-0 flex-1 overflow-y-auto bg-surface px-8 py-6 lg:w-[68%] lg:flex-none">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h1 className="font-headline text-3xl font-extrabold tracking-tight text-primary">
                Discover Spaces
              </h1>
              <p className="mt-1 text-sm text-on-surface-variant">
                {loading ? "Loading premium OOH spaces…" : `${listings.length} premium OOH space${listings.length === 1 ? "" : "s"} available in Bengaluru`}
              </p>
            </div>
          </div>

          <ListingGrid
            listings={listings}
            loading={loading}
            error={error}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={() => router.replace(pathname)}
          />
        </aside>

        <MapPanel listings={listings} className="lg:w-[32%]" />
      </div>
    </div>
  );
}

export default MarketplaceBrowser;
