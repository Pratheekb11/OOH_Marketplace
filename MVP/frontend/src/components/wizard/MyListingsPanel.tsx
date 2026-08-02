"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import Badge from "@/components/ui/Badge";
import Icon from "@/components/ui/Icon";
import Skeleton from "@/components/ui/Skeleton";
import type { Listing } from "@/types/api";

/**
 * Lives in the wizard sidebar (WizardSidebar.tsx). Lists `GET
 * /owner/listings` — the caller's own listings, including archived ones —
 * with an Edit link (`?listingId=<id>`, picked up by the wizard layout's
 * EditModeSync) and a Delete action. This is the only surface for
 * update/delete, so it doubles as the wizard's "manage existing inventory"
 * panel rather than a 6th route.
 */
export function MyListingsPanel() {
  const { showToast } = useToast();
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<Listing[]>("/owner/listings");
      setListings(data);
      setError(null);
    } catch {
      setError("Couldn't load your listings.");
      setListings([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(listing: Listing) {
    const confirmed = window.confirm(`Archive "${listing.title}"? This removes it from the marketplace.`);
    if (!confirmed) return;
    setPendingDeleteId(listing.id);
    try {
      await api(`/listings/${listing.id}`, { method: "DELETE" });
      showToast({ title: "Listing archived", tone: "success" });
      await load();
    } catch (err) {
      showToast({
        title: "Couldn't archive listing",
        description: err instanceof ApiError ? String(err.message) : "Please try again.",
        tone: "error",
      });
    } finally {
      setPendingDeleteId(null);
    }
  }

  if (listings === null) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    return <p className="text-xs text-error">{error}</p>;
  }

  if (listings.length === 0) {
    return <p className="text-xs text-on-surface-variant">You have not listed any spaces yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {listings.map((listing) => {
        const isArchived = String(listing.status) === "archived";
        return (
          <li
            key={listing.id}
            className="rounded-lg bg-surface-container-lowest p-3 text-xs"
          >
            <div className="flex items-start justify-between gap-2">
              <p className={`truncate font-semibold ${isArchived ? "text-on-surface-variant" : "text-on-surface"}`}>
                {listing.title}
              </p>
              {isArchived ? (
                <Badge tone="tertiary" className="!bg-surface-container-highest !text-on-surface-variant shrink-0">
                  Archived
                </Badge>
              ) : (
                <Badge tone="secondary" className="shrink-0">
                  {listing.status}
                </Badge>
              )}
            </div>
            <div className="mt-2 flex items-center gap-3">
              <Link
                href={`/list-your-space/details?listingId=${listing.id}`}
                className="flex items-center gap-1 font-bold text-secondary hover:underline"
              >
                <Icon name="edit" className="!text-sm" />
                Edit
              </Link>
              {!isArchived ? (
                <button
                  type="button"
                  disabled={pendingDeleteId === listing.id}
                  onClick={() => handleDelete(listing)}
                  className="flex items-center gap-1 font-bold text-error hover:underline disabled:opacity-50"
                >
                  <Icon name="delete" className="!text-sm" />
                  {pendingDeleteId === listing.id ? "Archiving…" : "Delete"}
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default MyListingsPanel;
