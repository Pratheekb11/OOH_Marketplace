import type { Metadata } from "next";
import OwnerDashboardClient from "./OwnerDashboardClient";

export const metadata: Metadata = {
  title: "Owner Dashboard · AdSpace",
};

// Server Component wrapper — all state (auth/role, owner bookings, owner
// listings) lives client-side in OwnerDashboardClient, matching the split
// used by (app)/analytics and (app)/cart.
export default function OwnerDashboardPage() {
  return <OwnerDashboardClient />;
}
