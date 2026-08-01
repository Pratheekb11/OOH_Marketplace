"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/ui/Icon";
import NavActions from "./NavActions";
import SearchModal from "./SearchModal";

// Ported from index.html / listing_page.html's desktop nav links.
// Partnerships & Analytics now have real routes (/partnerships, /analytics).
const PRIMARY_LINKS = [
  { label: "Home", href: "/" },
  { label: "Inventory", href: "/marketplace" },
  { label: "Partnerships", href: "/partnerships" },
  { label: "Analytics", href: "/analytics" },
  { label: "Support", href: "/support" },
];

/** Marketing/marketplace nav shell, ported from index.html / listing_page.html. */
export function NavShellA() {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);

  // Ctrl+K / Cmd+K opens search from anywhere this nav is mounted, even
  // while the modal itself isn't in the DOM (it early-returns null when closed).
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <nav className="sticky top-0 z-50 flex w-full items-center justify-between border-b border-border-subtle bg-white/95 px-8 py-5 backdrop-blur-sm">
      <Link
        href="/"
        className="font-headline text-xl font-extrabold uppercase tracking-tight transition-opacity hover:opacity-80"
      >
        Ad<span className="text-secondary">Space</span>
      </Link>

      <div className="hidden items-center space-x-10 text-[13px] font-semibold uppercase tracking-wider md:flex">
        {PRIMARY_LINKS.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.label}
              href={link.href}
              className={
                isActive
                  ? "nav-link border-b-2 border-secondary pb-1 text-secondary"
                  : "nav-link text-on-surface-variant transition-colors hover:text-primary"
              }
            >
              {link.label}
            </Link>
          );
        })}
      </div>

      <div className="flex items-center space-x-6">
        <button
          type="button"
          aria-label="Search listings (Ctrl+K)"
          onClick={() => setSearchOpen(true)}
          className="text-primary transition-opacity hover:opacity-70"
        >
          <Icon name="search" />
        </button>
        <NavActions />
      </div>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </nav>
  );
}

export default NavShellA;
