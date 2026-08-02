"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import Icon from "@/components/ui/Icon";
import Money from "@/components/ui/Money";
import type { ListingOut } from "./types";

function formatCount(value: number | null): string {
  if (!value) return "—";
  if (value >= 1000) return `${Math.round(value / 1000)}k+`;
  return String(value);
}

/** Dimensions are optional: bus shelters are sold by a size bucket with no
 * measurements published, so fall back to that before showing nothing. */
function formatSize(listing: ListingOut): string | null {
  if (listing.width_ft && listing.height_ft) {
    const area = Math.round(listing.width_ft * listing.height_ft).toLocaleString("en-IN");
    return `${listing.width_ft}×${listing.height_ft} ft · ${area} sq ft`;
  }
  const bucket = listing.extra?.size_bucket;
  return typeof bucket === "string" && bucket ? `${bucket} format` : null;
}

export interface ListingCardProps {
  listing: ListingOut;
}

/**
 * Ported from listing_page.html's card markup. Degrades gracefully when
 * `image_url` 404s (2 of the 9 seeded listings point at rotted prototype
 * images) — the onError handler swaps to a branded placeholder instead of a
 * broken-image glyph.
 */
export function ListingCard({ listing }: ListingCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(listing.image_url) && !imageFailed;
  const displayPrice = listing.extra?.display_price;
  const displayUnit = listing.extra?.display_unit;
  const verified = listing.extra?.verified === true;
  const size = formatSize(listing);

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-surface-container bg-surface-container-lowest transition-all duration-300 hover:shadow-[0_20px_50px_rgba(10,31,68,0.08)]"
    >
      <div className="relative h-48 overflow-hidden bg-surface-container-high">
        {showImage ? (
          <Image
            src={listing.image_url as string}
            alt={listing.title}
            fill
            sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 90vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="brand-gradient flex h-full w-full flex-col items-center justify-center gap-2 text-white/90">
            <Icon name="image" className="!text-3xl" />
            <span className="max-w-[80%] truncate-line-2 text-center text-xs font-bold">{listing.title}</span>
          </div>
        )}
        <div className="absolute left-3 top-3 flex gap-2">
          <Badge tone="primary">{listing.space_type}</Badge>
          {verified ? <Badge tone="verified">Verified</Badge> : null}
        </div>
      </div>

      <div className="p-5">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="font-headline text-base font-bold leading-tight text-on-surface">{listing.title}</h3>
          <div className="shrink-0 text-right">
            {typeof displayPrice === "number" ? (
              <>
                <Money value={displayPrice} mode="compact" className="block text-sm font-black text-secondary" />
                <span className="text-[9px] font-bold uppercase text-on-surface-variant">
                  {displayUnit ?? "/ Day"}
                </span>
              </>
            ) : (
              <>
                <Money value={listing.price_per_day} mode="compact" className="block text-sm font-black text-secondary" />
                <span className="text-[9px] font-bold uppercase text-on-surface-variant">/ Day</span>
              </>
            )}
          </div>
        </div>

        <p className="mb-2 flex items-center gap-1 text-[10px] text-on-surface-variant">
          <Icon name="location_on" className="!text-xs" />
          <span className="truncate">{listing.location}</span>
        </p>

        {size ? (
          <p className="mb-3 flex items-center gap-1 text-[10px] font-semibold text-on-surface-variant">
            <Icon name="straighten" className="!text-xs" />
            {size}
            {listing.lighting ? <span className="text-on-surface-variant/70">· {listing.lighting}</span> : null}
          </p>
        ) : (
          <div className="mb-3" />
        )}

        <div className="flex items-center justify-between border-t border-surface-container-low pt-3">
          <span className="flex items-center gap-1 text-[11px] font-extrabold text-primary">
            <Icon name="trending_up" className="!text-sm text-secondary" />
            {formatCount(listing.footfall_estimate)}
          </span>
          <span className="rounded-lg bg-primary px-4 py-1.5 text-[10px] font-bold text-white transition-colors group-hover:bg-secondary">
            Book
          </span>
        </div>
      </div>
    </Link>
  );
}

export default ListingCard;
