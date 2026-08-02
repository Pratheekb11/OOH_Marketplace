"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { api, ApiError } from "@/lib/api";
import type { CartOut } from "@/types/api";

const EMPTY_CART: CartOut = { items: [], subtotal: 0, addons_total: 0, gst_total: 0, grand_total: 0 };

export interface CartContextValue {
  cart: CartOut;
  /** True while the cart is being (re)fetched from the server. */
  loading: boolean;
  /** True when `GET /cart` 403'd — an owner-role account has no cart. */
  forbidden: boolean;
  /** Set on any other fetch failure; cleared on the next successful fetch. */
  error: string | null;
  refetch: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

/**
 * Owns the shopping cart for the whole app: fetches `GET /cart` once the
 * user is authenticated, and refetches whenever the listing detail page (or
 * anything else) dispatches `window.dispatchEvent(new Event("cart:changed"))`
 * — see BookingSidebar's "Add to Cart" handler.
 *
 * Never fetches while `status !== "authenticated"` (avoids a pointless 401
 * on every anonymous page load) and degrades a 403 (owner-role account) to
 * an empty cart with `forbidden: true` instead of throwing.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [cart, setCart] = useState<CartOut>(EMPTY_CART);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (status !== "authenticated") {
      setCart(EMPTY_CART);
      setForbidden(false);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api<CartOut>("/cart");
      setCart(data);
      setForbidden(false);
      setError(null);
    } catch (err) {
      setCart(EMPTY_CART);
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
        setError(null);
      } else {
        setForbidden(false);
        setError(err instanceof ApiError && typeof err.detail === "string" ? err.detail : "Couldn't load your cart.");
      }
    } finally {
      setLoading(false);
    }
  }, [status]);

  // Wait for auth to resolve (loading -> authenticated/unauthenticated)
  // before ever hitting the network.
  useEffect(() => {
    if (status === "loading") return;
    void refetch();
  }, [status, refetch]);

  useEffect(() => {
    function handleChanged() {
      void refetch();
    }
    window.addEventListener("cart:changed", handleChanged);
    return () => window.removeEventListener("cart:changed", handleChanged);
  }, [refetch]);

  const value = useMemo<CartContextValue>(
    () => ({ cart, loading, forbidden, error, refetch }),
    [cart, loading, forbidden, error, refetch],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/** Throws outside a `CartProvider` — use this in pages/components that are
 * always rendered inside the app shell (cart/checkout pages). */
export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}

/** Never throws — returns `null` outside a `CartProvider`. Use this from
 * components that may render before the provider mounts or in isolation
 * (e.g. `lib/cart-count.ts`'s `useCartCount()`). */
export function useCartOptional(): CartContextValue | null {
  return useContext(CartContext);
}

export default CartProvider;
