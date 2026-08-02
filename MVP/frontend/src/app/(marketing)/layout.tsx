import type { ReactNode } from "react";
import NavShellA from "@/components/layout/NavShellA";
import SiteFooter from "@/components/layout/SiteFooter";

// Server Component — the marketing/landing route group. Route groups (the
// parens) don't affect the URL, so this wraps "/" only (page.tsx sits
// alongside it in this same folder).
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <NavShellA />
      {children}
      <SiteFooter />
    </>
  );
}
