"use client";

import { useCartOptional } from "@/lib/cart-context";

/**
 * Badge count backed by the real cart context. Degrades safely to 0 rather
 * than throwing: `useCartOptional()` returns `null` when rendered outside a
 * `CartProvider`, and the provider itself reports an empty cart while auth is
 * still resolving or the visitor is unauthenticated/owner-role (403), so
 * there is no separate "loading" case to special-case here.
 */
export function useCartCount(): number {
  const cart = useCartOptional();
  return cart?.cart.items.length ?? 0;
}
