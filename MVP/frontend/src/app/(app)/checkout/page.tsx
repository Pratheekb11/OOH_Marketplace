import type { Metadata } from "next";
import CheckoutClient from "./CheckoutClient";

export const metadata: Metadata = {
  title: "Checkout · AdSpace",
};

// Server Component wrapper — all state (auth, cart, `?payment=`) lives
// client-side in CheckoutClient, per the same split used by
// (auth)/login/page.tsx.
export default function CheckoutPage() {
  return <CheckoutClient />;
}
