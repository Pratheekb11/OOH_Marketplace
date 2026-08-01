"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/auth/RequireAuth";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import CartItemRow from "@/components/cart/CartItemRow";
import OrderSummaryAside from "@/components/cart/OrderSummaryAside";
import { api } from "@/lib/api";
import { useCart } from "@/lib/cart-context";
import type { AddonOut } from "@/components/marketplace/types";

function CartSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
      <div className="space-y-6 lg:col-span-8">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
      <Skeleton className="h-96 w-full rounded-xl lg:col-span-4" />
    </div>
  );
}

function CartBody() {
  const { cart, loading, forbidden, error, refetch } = useCart();
  const [addons, setAddons] = useState<AddonOut[]>([]);
  const [addonsLoading, setAddonsLoading] = useState(true);
  const [addonsUnavailable, setAddonsUnavailable] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<AddonOut[]>("/addons")
      .then((data) => {
        if (!cancelled) setAddons(data);
      })
      .catch(() => {
        if (!cancelled) setAddonsUnavailable(true);
      })
      .finally(() => {
        if (!cancelled) setAddonsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleClearCart() {
    setClearing(true);
    try {
      await api("/cart", { method: "DELETE" });
      await refetch();
    } finally {
      setClearing(false);
    }
  }

  if (forbidden) {
    return (
      <EmptyState
        icon="storefront"
        title="Carts are for advertiser accounts"
        description="You're signed in as a space owner. Sign in with an advertiser account to build a booking cart."
      />
    );
  }

  if (loading && cart.items.length === 0) {
    return <CartSkeleton />;
  }

  if (error) {
    return (
      <EmptyState
        icon="error"
        title="Couldn't load your cart"
        description={error}
        action={
          <Button variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  if (cart.items.length === 0) {
    return (
      <EmptyState
        icon="shopping_cart"
        title="Your cart is empty"
        description="Browse the marketplace to find your next out-of-home placement."
        action={
          <Button variant="gradient" href="/marketplace">
            Browse marketplace
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-start">
      <div className="space-y-6 lg:col-span-8">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-2xl font-extrabold tracking-tight">
            {cart.items.length} item{cart.items.length === 1 ? "" : "s"} in cart
          </h2>
          <button
            type="button"
            onClick={handleClearCart}
            disabled={clearing}
            className="text-xs font-bold uppercase tracking-widest text-error hover:opacity-70 disabled:opacity-50"
          >
            {clearing ? "Clearing…" : "Clear cart"}
          </button>
        </div>

        {cart.items.map((item) => (
          <CartItemRow
            key={item.id}
            item={item}
            addons={addons}
            addonsLoading={addonsLoading}
            addonsUnavailable={addonsUnavailable}
            onChanged={() => void refetch()}
          />
        ))}
      </div>

      <OrderSummaryAside
        cart={cart}
        className="lg:col-span-4"
        cta={
          <Button href="/checkout" variant="gradient" size="lg" className="w-full">
            Proceed to Checkout
          </Button>
        }
      />
    </div>
  );
}

/** Client page: `RequireAuth` bounces an anonymous visitor to
 * `/login?next=/cart` (renders `null` while that redirect resolves). */
export function CartClient() {
  return (
    <RequireAuth>
      <main className="container mx-auto flex-grow px-6 py-12 font-manrope lg:px-12">
        <h1 className="mb-10 font-headline text-4xl font-black tracking-tight text-on-surface">Your Cart</h1>
        <CartBody />
      </main>
    </RequireAuth>
  );
}

export default CartClient;
