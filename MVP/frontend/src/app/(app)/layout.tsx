import type { ReactNode } from "react";
import NavShellB from "@/components/layout/NavShellB";

/**
 * Server Component — the logged-in "app shell" route group. Deliberately
 * generic: cart and checkout pages land under this same group later, so
 * this must not carry any wizard-specific state or become 'use client'.
 * NavShellB is already normalized to `sticky` — no `pt-*` offset needed on
 * children's <main>.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <NavShellB />
      {children}
    </>
  );
}
