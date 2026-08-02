"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { CartProvider } from "@/lib/cart-context";
import { ToastProvider } from "@/components/ui/Toast";

/**
 * Provider tree: Auth outermost (cart and toast both may want the current
 * user), Toast innermost so it can sit closest to page content.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CartProvider>
        <ToastProvider>{children}</ToastProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default Providers;
