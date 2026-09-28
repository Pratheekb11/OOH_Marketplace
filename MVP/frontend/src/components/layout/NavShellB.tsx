"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import Icon from "@/components/ui/Icon";
import NavActions from "./NavActions";

// Ported from checkout_page.html / listing_your_adspace.html's app-shell nav.
// The links are role-aware because the two analytics surfaces are role-gated
// on the backend: /analytics reads the advertiser-only GET /bookings, and
// /dashboard/owner (the prototype's "My Inventory") reads the owner-only
// GET /owner/bookings + GET /owner/listings. Showing an owner a link that
// RequireRole would immediately bounce them off would be worse than no link.
const COMMON_LINKS = [{ label: "Marketplace", href: "/marketplace" }];
const ADVERTISER_LINKS = [{ label: "Analytics", href: "/analytics" }];
const OWNER_LINKS = [{ label: "My Inventory", href: "/dashboard/owner" }];
const TRAILING_LINKS = [{ label: "Support", href: "/support" }];

/**
 * App-shell nav, ported from checkout_page.html / listing_your_adspace.html.
 * The prototype's checkout page uses `fixed top-0` + a `pt-32` magic number
 * on <main>, while the wizard (listing_your_adspace) uses `sticky` — this
 * shell normalizes both to `sticky`, so consuming pages should NOT add a
 * `pt-32`/`pt-*` offset to their <main>.
 */
export function NavShellB() {
  const pathname = usePathname();
  const { status, user } = useAuth();
  // An admin passes both role gates (see require_roles in backend/app/security.py
  // and RequireRole), so it gets both links rather than having to know the URLs.
  const roleLinks =
    status !== "authenticated"
      ? []
      : user.role === "admin"
        ? [...ADVERTISER_LINKS, ...OWNER_LINKS]
        : user.role === "owner"
          ? OWNER_LINKS
          : user.role === "advertiser"
            ? ADVERTISER_LINKS
            : [];
  const appLinks = [...COMMON_LINKS, ...roleLinks, ...TRAILING_LINKS];

  // Below md the links are hidden, so a phone had no way off the current
  // page except the logo. They fold into a dropdown under the bar instead.
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <nav className="nav-lift sticky top-0 z-50 flex w-full items-center justify-between bg-slate-50/60 px-4 py-4 backdrop-blur-xl sm:px-8">
      <div className="flex items-center gap-12">
        <Link href="/" className="font-headline text-2xl font-bold tracking-tighter text-primary">
          Ad<span className="text-secondary">Space</span>
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          {appLinks.map((link) => {
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

      <div className="flex items-center gap-2 sm:gap-4">
        <button
          type="button"
          aria-label="Notifications"
          className="material-symbols-outlined rounded-lg p-2 text-on-surface-variant max-sm:!hidden transition-all hover:bg-slate-100/50"
        >
          notifications
        </button>
        <NavActions />
        <button
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="app-mobile-menu"
          onClick={() => setMenuOpen((open) => !open)}
          className="-mr-2 p-2 text-primary transition-opacity hover:opacity-70 md:hidden"
        >
          <Icon name={menuOpen ? "close" : "menu"} weight={400} />
        </button>
      </div>

      {menuOpen ? (
        <ul
          id="app-mobile-menu"
          className="fade-in absolute inset-x-0 top-full flex flex-col border-b border-border-subtle bg-white px-4 py-2 shadow-lg sm:px-8 md:hidden"
        >
          {appLinks.map((link) => (
            <li key={link.label}>
              <Link
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`block py-3 font-headline text-lg tracking-tight ${
                  pathname === link.href ? "font-bold text-secondary" : "font-medium text-primary"
                }`}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </nav>
  );
}

export default NavShellB;
