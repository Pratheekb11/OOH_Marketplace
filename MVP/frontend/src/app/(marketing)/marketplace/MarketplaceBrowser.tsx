"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { fetchListings } from "@/lib/listings-source";
import FilterBar from "@/components/marketplace/FilterBar";
import ListingGrid from "@/components/marketplace/ListingGrid";
import MapPanel from "@/components/marketplace/MapPanel";
import type { ListingOut, ListingPage } from "@/components/marketplace/types";

const PAGE_SIZE = 24;

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
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryString = searchParams.toString();

  // First page. Refetches whenever any filter changes; `listings` is replaced
  // rather than appended so a filter change never shows stale rows.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams(queryString);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", "0");

    fetchListings(params.toString())
      .then((data) => {
        if (cancelled) return;
        setListings(data.items);
        setTotal(data.total);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof ApiError ? String(err.detail ?? err.message) : "Something went wrong.";
        setError(message);
        setListings([]);
        setTotal(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [queryString]);

  const loadMore = () => {
    setLoadingMore(true);
    const params = new URLSearchParams(queryString);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(listings.length));

    fetchListings(params.toString())
      .then((data) => {
        // Append, and re-sync the total in case inventory changed underneath.
        setListings((current) => [...current, ...data.items]);
        setTotal(data.total);
      })
      .catch(() => undefined)
      .finally(() => setLoadingMore(false));
  };

  // `sort` alone is not a filter — it never changes which listings match.
  const hasActiveFilters = Array.from(searchParams.keys()).some(
    (key) => key !== "sort" && key !== "limit" && key !== "offset",
  );

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
                {loading
                  ? "Loading premium OOH spaces…"
                  : `${total.toLocaleString("en-IN")} premium OOH space${total === 1 ? "" : "s"} available in Bengaluru`}
              </p>
            </div>
            {!loading && total > listings.length ? (
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                Showing {listings.length.toLocaleString("en-IN")}
              </p>
            ) : null}
          </div>

          <ListingGrid
            listings={listings}
            loading={loading}
            error={error}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={() => router.replace(pathname)}
          />

          {!loading && !error && listings.length < total ? (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-lg border-2 border-primary px-8 py-3 text-xs font-bold uppercase tracking-widest text-primary transition-all hover:bg-primary hover:text-white disabled:opacity-50"
              >
                {loadingMore
                  ? "Loading…"
                  : `Load more (${(total - listings.length).toLocaleString("en-IN")} remaining)`}
              </button>
            </div>
          ) : null}
        </aside>

        <MapPanel listings={listings} className="lg:w-[32%]" />
      </div>
    </div>
  );
}

export default MarketplaceBrowser;
