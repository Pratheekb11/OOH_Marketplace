"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Skeleton from "@/components/ui/Skeleton";

/**
 * `/list-your-space` itself renders nothing — it forwards straight to step 1.
 *
 * This is a client-side redirect rather than the server `redirect()` it used
 * to be: a static export has no server to issue a 307, so `redirect()` would
 * fail the Pages build. `useSearchParams` needs a <Suspense> boundary or the
 * production build hard-fails, hence the split below.
 *
 * A bookmarked/shared `?listingId=` link is still carried through to
 * EditModeSync on the details page instead of being dropped.
 */
function ListYourSpaceRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const listingId = searchParams.get("listingId");
    const suffix = listingId ? `?listingId=${encodeURIComponent(listingId)}` : "";
    router.replace(`/list-your-space/details${suffix}`);
  }, [router, searchParams]);

  return null;
}

export default function ListYourSpaceIndexPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
      <ListYourSpaceRedirect />
    </Suspense>
  );
}
