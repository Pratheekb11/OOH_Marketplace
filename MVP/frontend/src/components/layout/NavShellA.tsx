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

  // The landing hero is a full-bleed night photograph, so the nav rides over
  // it unpainted and only takes on its white bar once the reader scrolls past
  // the fold. Every other route keeps the original sticky white nav.
  const overHero = pathname === "/";
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!overHero) {
      setScrolled(false);
      return;
    }
    const onScroll = () => setScrolled(window.scrollY > 64);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [overHero]);

  const onDark = overHero && !scrolled;

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
    <nav
      className={`z-50 flex w-full items-center justify-between px-6 py-5 transition-colors duration-300 sm:px-8 ${
        overHero ? "fixed inset-x-0 top-0" : "sticky top-0"
      } ${
        onDark
          ? "border-b border-transparent bg-transparent text-white"
          : "border-b border-border-subtle bg-white/95 text-primary backdrop-blur-sm"
      }`}
    >
      <Link
        href="/"
        className="font-syne text-xl font-extrabold uppercase tracking-tight transition-opacity hover:opacity-80"
      >
        Ad<span className={onDark ? "text-accent" : "text-secondary"}>Space</span>
      </Link>

      <div className="hidden items-center space-x-10 text-[13px] font-semibold uppercase tracking-wider md:flex">
        {PRIMARY_LINKS.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.label}
              href={link.href}
              className={[
                "nav-link transition-colors",
                onDark ? "nav-link-light" : "",
                isActive
                  ? onDark
                    ? "border-b-2 border-accent pb-1 text-accent"
                    : "border-b-2 border-secondary pb-1 text-secondary"
                  : onDark
                    ? "text-white/70 hover:text-white"
                    : "text-on-surface-variant hover:text-primary",
              ]
                .filter(Boolean)
                .join(" ")}
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
          className={`transition-opacity hover:opacity-70 ${onDark ? "text-white" : "text-primary"}`}
        >
          <Icon name="search" />
        </button>
        <NavActions onDark={onDark} />
      </div>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </nav>
  );
}

export default NavShellA;
