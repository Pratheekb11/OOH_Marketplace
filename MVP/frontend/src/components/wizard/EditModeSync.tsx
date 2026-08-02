"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useWizard } from "@/lib/wizard/context";
import { fromListing } from "@/lib/wizard/to-payload";
import type { Listing } from "@/types/api";

/**
 * Reads `?listingId=` and, if present, hydrates the wizard from
 * `GET /listings/{id}` so the review step submits a PUT instead of a POST.
 * Isolated behind its own component (rather than reading the param in the
 * layout directly) because `useSearchParams()` requires a <Suspense>
 * boundary above it to avoid a Next 15 build failure — see login's
 * NextParamSync for the same pattern.
 *
 * Waits for `hydrated` (the sessionStorage-restore flag) before doing
 * anything: on a hard refresh mid-edit, the draft in sessionStorage already
 * carries this listing's in-progress edits, and fetching fresh from the
 * server here would stomp them. Only fetches when the wizard's current
 * `listingId` doesn't already match the URL's.
 */
export function EditModeSync() {
  const searchParams = useSearchParams();
  const { state, dispatch, hydrated } = useWizard();
  const { showToast } = useToast();
  const fetchedIdRef = useRef<number | null>(null);

  const listingIdParam = searchParams.get("listingId");

  useEffect(() => {
    if (!hydrated) return;
    if (!listingIdParam) return;
    const idNum = Number(listingIdParam);
    if (!Number.isFinite(idNum)) return;
    if (state.listingId === idNum) return;
    if (fetchedIdRef.current === idNum) return;
    fetchedIdRef.current = idNum;

    let cancelled = false;
    (async () => {
      try {
        const listing = await api<Listing>(`/listings/${idNum}`);
        if (cancelled) return;
        dispatch({ type: "HYDRATE", state: fromListing(listing) });
      } catch {
        if (cancelled) return;
        showToast({
          title: "Couldn't load that listing",
          description: "Starting a new draft instead.",
          tone: "error",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, listingIdParam, state.listingId, dispatch, showToast]);

  return null;
}

export default EditModeSync;
