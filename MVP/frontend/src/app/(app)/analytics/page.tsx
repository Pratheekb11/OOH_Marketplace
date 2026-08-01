import type { Metadata } from "next";
import AnalyticsClient from "./AnalyticsClient";

export const metadata: Metadata = {
  title: "Campaign Analytics · AdSpace",
};

// Server Component wrapper — all state (auth/role, bookings, listings) lives
// client-side in AnalyticsClient, per the same split used by (app)/cart.
export default function AnalyticsPage() {
  return <AnalyticsClient />;
}
