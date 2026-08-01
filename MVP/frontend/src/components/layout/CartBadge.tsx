"use client";

import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { useCartCount } from "@/lib/cart-count";

/**
 * SEAM: reads count from `lib/cart-count.ts`'s useCartCount(), which is a
 * stub returning 0 until the cart-owning agent backs it with
 * `lib/cart-context.tsx`. This component itself needs no changes then.
 */
export function CartBadge() {
  const count = useCartCount();

  return (
    <Link
      href="/cart"
      aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
      className="relative flex items-center rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container"
    >
      <Icon name="shopping_cart" />
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[9px] font-bold text-white">
          {count}
        </span>
      ) : null}
    </Link>
  );
}

export default CartBadge;
