"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import NavActions from "./NavActions";

// Ported from checkout_page.html / listing_your_adspace.html's app-shell nav.
// The prototype's "My Inventory" (an owner listings dashboard) has no route
// or wired API yet (GET /dashboard/owner is unwired on the frontend) — rather
// than link it at a 404-ing "/my-inventory" placeholder, it's dropped until
// that dashboard exists. "Analytics" (Campaign_analytics.html) now has a
// real route (/analytics), scoped to advertisers with real booking data.
const APP_LINKS = [
  { label: "Marketplace", href: "/marketplace" },
  { label: "Analytics", href: "/analytics" },
  { label: "Support", href: "/support" },
];

/**
 * App-shell nav, ported from checkout_page.html / listing_your_adspace.html.
 * The prototype's checkout page uses `fixed top-0` + a `pt-32` magic number
 * on <main>, while the wizard (listing_your_adspace) uses `sticky` — this
 * shell normalizes both to `sticky`, so consuming pages should NOT add a
 * `pt-32`/`pt-*` offset to their <main>.
 */
export function NavShellB() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 flex w-full items-center justify-between bg-slate-50/60 px-8 py-4 backdrop-blur-xl">
      <div className="flex items-center gap-12">
        <Link href="/" className="font-headline text-2xl font-bold tracking-tighter text-primary">
          Ad<span className="text-secondary">Space</span>
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          {APP_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.label}
                href={link.href}
                className={
                  isActive
                    ? "border-b-2 border-secondary pb-1 font-headline font-bold tracking-tight text-primary"
                    : "font-headline font-medium tracking-tight text-slate-500 transition-colors hover:text-primary"
                }
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="Notifications"
          className="material-symbols-outlined rounded-lg p-2 text-on-surface-variant transition-all hover:bg-slate-100/50"
        >
          notifications
        </button>
        <NavActions />
      </div>
    </nav>
  );
}

export default NavShellB;
