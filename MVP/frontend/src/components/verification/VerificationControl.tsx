"use client";

import Badge from "@/components/ui/Badge";

export type VerificationStatus = "none" | "requested" | "verified" | "rejected";

export interface VerificationControlProps {
  status: VerificationStatus;
  onRequest: () => void;
  /** A request is in flight: keep the button from sending a second one. */
  busy?: boolean;
}

const BUTTON =
  "text-[10px] font-bold uppercase tracking-widest text-secondary hover:underline disabled:opacity-50 disabled:no-underline";

/**
 * The owner's side of the "Verified" badge. Owners cannot set it themselves;
 * they ask, and an admin approves or rejects (see /admin/verifications).
 */
export function VerificationControl({ status, onRequest, busy = false }: VerificationControlProps) {
  // `tertiary`, not `verified`: that tone adds an icon whose ligature text also reads "verified".
  if (status === "verified") return <Badge tone="tertiary">Verified</Badge>;

  if (status === "requested") {
    return <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Verification requested</span>;
  }

  if (status === "rejected") {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-error">Not approved</span>
        <button type="button" onClick={onRequest} disabled={busy} className={BUTTON}>
          Request again
        </button>
      </span>
    );
  }

  return (
    <button type="button" onClick={onRequest} disabled={busy} className={BUTTON}>
      Request verification
    </button>
  );
}

export default VerificationControl;
