import type { Metadata } from "next";
import CartClient from "./CartClient";

export const metadata: Metadata = {
  title: "Your Cart · AdSpace",
};

// Server Component wrapper — all state (auth, cart) lives client-side in
// CartClient, per the same split used by (auth)/login/page.tsx.
export default function CartPage() {
  return <CartClient />;
}
