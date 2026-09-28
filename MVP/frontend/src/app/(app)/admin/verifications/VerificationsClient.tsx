"use client";

import { useEffect, useState } from "react";
import RequireRole from "@/components/auth/RequireRole";
import Skeleton from "@/components/ui/Skeleton";
import VerificationQueue, { type VerificationRequest } from "@/components/verification/VerificationQueue";
import { api } from "@/lib/api";

function QueueBody() {
  const [items, setItems] = useState<VerificationRequest[] | null>(null);
  const [pending, setPending] = useState<ReadonlySet<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<VerificationRequest[]>("/admin/verification-requests")
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load verification requests. Please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function decide(listingId: number, approve: boolean) {
    setError(null);
    setPending((current) => new Set(current).add(listingId));
    try {
      await api(`/admin/listings/${listingId}/verification`, {
        method: "POST",
        body: JSON.stringify({ approve }),
      });
      setItems((current) => (current ?? []).filter((item) => item.id !== listingId));
    } catch {
      setError("That decision didn't save. Please try again.");
    } finally {
      setPending((current) => {
        const next = new Set(current);
        next.delete(listingId);
        return next;
      });
    }
  }

  return (
    <section className="rounded-3xl bg-surface-container-lowest p-6 shadow-sm md:p-10">
      <h1 className="font-headline text-2xl font-bold">Verification requests</h1>
      <p className="mt-2 text-sm text-on-surface-variant">
        Owners ask for the Verified badge here; it only appears on a space once you approve it.
      </p>
      {error ? (
        <p role="alert" className="mt-6 text-sm font-medium text-error">
          {error}
        </p>
      ) : null}
      <div className="mt-6">
        {items === null && !error ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <VerificationQueue items={items ?? []} onDecide={decide} pending={pending} />
        )}
      </div>
    </section>
  );
}

/** Admin-only: anyone else is sent back to the marketplace. */
export default function VerificationsClient() {
  return (
    <RequireRole role="admin" fallback="/marketplace">
      <main className="container mx-auto flex-grow px-4 py-12 sm:px-6 lg:px-12">
        <QueueBody />
      </main>
    </RequireRole>
  );
}
