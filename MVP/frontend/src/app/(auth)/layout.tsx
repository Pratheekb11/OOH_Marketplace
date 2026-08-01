import type { ReactNode } from "react";
import Link from "next/link";
import NavShellA from "@/components/layout/NavShellA";

// Server Component. Ported from login_Page.html's slim page-footer bar
// (lines ~176-189) — deliberately NOT the full <SiteFooter/> (that's a
// 4-column newsletter/links footer meant for marketing pages, not the
// auth flow). Brand is AdSpace throughout, not the prototype's
// "OOH Marketplace" / "AdSpace Horizon" naming.
function AuthFooterBar() {
  return (
    <footer className="w-full border-t border-outline-variant/10 bg-slate-50 py-12">
      <div className="flex w-full flex-col items-center justify-between px-12 font-headline text-sm md:flex-row">
        <div className="mb-6 flex items-center gap-4 md:mb-0">
          <span className="font-bold text-primary-container">AdSpace</span>
          <span className="text-slate-500">
            &copy; {new Date().getFullYear()} AdSpace. All rights reserved.
          </span>
        </div>
        {/* No dedicated legal/contact pages exist in this build — all four
            route to /support rather than "#", consistent with SiteFooter. */}
        <div className="flex gap-8">
          <Link href="/support" className="text-slate-500 transition-colors hover:text-secondary-container">
            Privacy Policy
          </Link>
          <Link href="/support" className="text-slate-500 transition-colors hover:text-secondary-container">
            Terms of Service
          </Link>
          <Link href="/support" className="text-slate-500 transition-colors hover:text-secondary-container">
            Cookie Settings
          </Link>
          <Link href="/support" className="text-slate-500 transition-colors hover:text-secondary-container">
            Contact Sales
          </Link>
        </div>
      </div>
    </footer>
  );
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <NavShellA />
      {children}
      <AuthFooterBar />
    </>
  );
}
