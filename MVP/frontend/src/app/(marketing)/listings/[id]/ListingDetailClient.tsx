"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import Icon from "@/components/ui/Icon";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { ApiError } from "@/lib/api";
import { fetchListing } from "@/lib/listings-source";
import type { ListingOut } from "@/components/marketplace/types";
import BentoGallery from "@/components/listing/BentoGallery";
import StatsGrid from "@/components/listing/StatsGrid";
import OwnerCard from "@/components/listing/OwnerCard";
import BookingSidebar from "@/components/listing/BookingSidebar";

// The prototype's two-image bento gallery extras (listing_view.html) only
// exist for the MG Road Premium Unipole seed listing — matched by its
// marketplace-card image path rather than a hardcoded id, since seed ids
// shift across re-seeds. A 3rd gallery image (mg-road-unipole-3.png) is one
// of the 3 prototype images that rotted and was never downloaded, so that
// slot is deliberately left out here and falls back to the placeholder tile.
const EXTRA_GALLERY: Record<string, string[]> = {
  "/images/listings/mg-road-premium-unipole.png": [
    "/images/gallery/mg-road-unipole-1.png",
    "/images/gallery/mg-road-unipole-2.png",
  ],
};

function fallbackDescription(listing: ListingOut): string {
  const parts = [
    `${listing.title} is a ${listing.space_type.toLowerCase()} located at ${listing.location}.`,
  ];
  if (listing.footfall_estimate) {
    parts.push(`Estimated daily footfall of ${listing.footfall_estimate.toLocaleString("en-IN")}+ makes it a strong reach play for high-visibility campaigns.`);
  }
  parts.push("Full strategic overview coming soon — reach out via Support for a detailed site audit.");
  return parts.join(" ");
}

type LoadState =
  | { phase: "loading" }
  | { phase: "ready"; listing: ListingOut }
  | { phase: "missing" }
  | { phase: "error"; message: string };

/**
 * Client-side data fetch, not a Server Component `await`.
 *
 * The GitHub Pages build (`output: "export"`) prerenders every page at build
 * time on a CI runner where no API is reachable, so a server-side fetch here
 * would either fail the build or bake one snapshot of the database into
 * static HTML. Fetching in the browser keeps the deployed page live against
 * whatever NEXT_PUBLIC_API_BASE_URL points at, and behaves identically under
 * `next dev`.
 */
export default function ListingDetailClient({ id }: { id: string }) {
  const [state, setState] = useState<LoadState>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ phase: "loading" });

    fetchListing(id)
      .then((listing) => {
        if (!cancelled) setState({ phase: "ready", listing });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setState({ phase: "missing" });
          return;
        }
        setState({
          phase: "error",
          message: err instanceof Error ? err.message : "Could not load this space.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.phase === "missing") {
    notFound();
  }

  if (state.phase === "error") {
    return (
      <main className="container mx-auto flex-grow px-6 py-12 font-epilogue lg:px-12">
        <EmptyState
          icon="cloud_off"
          title="Couldn't load this space"
          description={state.message}
          action={
            <Button href="/marketplace" variant="primary" size="md">
              Back to marketplace
            </Button>
          }
        />
      </main>
    );
  }

  if (state.phase === "loading") {
    return (
      <main className="container mx-auto flex-grow px-6 py-12 font-epilogue lg:px-12">
        <div className="mb-12 space-y-4">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="mb-16 h-[480px] w-full rounded-xl" />
        <div className="flex flex-col gap-16 lg:flex-row">
          <div className="flex-grow space-y-8">
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-32 w-full" />
          </div>
          <Skeleton className="h-96 w-full rounded-xl lg:w-96" />
        </div>
      </main>
    );
  }

  const { listing } = state;
  const images = [listing.image_url, ...(EXTRA_GALLERY[listing.image_url ?? ""] ?? [])].filter(
    (src): src is string => Boolean(src),
  );
  const description = listing.description.trim() || fallbackDescription(listing);
  const verified = listing.extra?.verified === true;

  return (
    <main className="container mx-auto flex-grow px-6 py-12 font-epilogue lg:px-12">
      <div className="mb-12">
        <div className="font-label mb-4 flex items-center gap-2 text-sm text-on-surface-variant">
          <span>Bengaluru</span>
          <Icon name="chevron_right" className="!text-xs" />
          <span className="font-semibold text-primary">{listing.title}</span>
        </div>
        <h1 className="mb-4 text-5xl font-black leading-tight tracking-tight">{listing.title}</h1>
        <div className="flex flex-wrap items-center gap-4">
          {verified ? <Badge tone="verified">Verified Space</Badge> : null}
          <span className="flex items-center gap-1 font-medium text-on-surface-variant">
            <Icon name="location_on" className="!text-sm" />
            {listing.location}
          </span>
        </div>
      </div>

      <BentoGallery images={images} title={listing.title} />

      <div className="flex flex-col gap-16 lg:flex-row">
        <div className="flex-grow space-y-16">
          <StatsGrid listing={listing} />

          <section>
            <h2 className="mb-6 text-3xl font-black">Strategic Overview</h2>
            <p className="max-w-3xl text-lg leading-relaxed text-on-surface-variant">{description}</p>
          </section>

          <OwnerCard />
        </div>

        <BookingSidebar listing={listing} />
      </div>
    </main>
  );
}
