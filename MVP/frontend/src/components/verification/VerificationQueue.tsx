"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";

/** One row of GET /admin/verification-requests (VerificationRequestOut). */
export interface VerificationRequest {
  id: number;
  title: string;
  location: string;
  space_type: string;
  image_url: string | null;
  owner_id: number;
  owner_name: string;
  owner_email: string;
}

export interface VerificationQueueProps {
  items: VerificationRequest[];
  onDecide: (listingId: number, approve: boolean) => void;
  /** Listing ids with a decision in flight. */
  pending?: ReadonlySet<number>;
}

/** The admin's side of verification: every open request and a decision for each. */
export function VerificationQueue({ items, onDecide, pending }: VerificationQueueProps) {
  if (items.length === 0) {
    return <p className="py-12 text-center text-sm text-on-surface-variant">No verification requests are waiting.</p>;
  }

  return (
    <ul className="divide-y divide-border-subtle">
      {items.map((item) => {
        const busy = pending?.has(item.id) ?? false;
        return (
          <li
            key={item.id}
            data-testid={`verification-request-${item.id}`}
            className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate font-bold text-on-surface">{item.title}</p>
              <p className="truncate text-xs text-on-surface-variant">
                {item.space_type} · {item.location}
              </p>
              <p className="mt-1 truncate text-xs text-on-surface-variant">
                Requested by {item.owner_name} · {item.owner_email}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Link
                href={`/listings/${item.id}`}
                className="text-[10px] font-bold uppercase tracking-widest text-secondary hover:underline"
              >
                View
              </Link>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => onDecide(item.id, false)}>
                Reject
              </Button>
              <Button variant="primary" size="sm" disabled={busy} onClick={() => onDecide(item.id, true)}>
                Approve
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default VerificationQueue;
