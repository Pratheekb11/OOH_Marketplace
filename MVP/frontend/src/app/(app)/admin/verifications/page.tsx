import type { Metadata } from "next";
import VerificationsClient from "./VerificationsClient";

export const metadata: Metadata = {
  title: "Verification Requests · AdSpace",
};

// Server Component wrapper; the queue is admin-only and loads client-side,
// matching the split used by (app)/dashboard/owner.
export default function VerificationsPage() {
  return <VerificationsClient />;
}
