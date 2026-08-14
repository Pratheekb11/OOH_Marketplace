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

  // Below lg the five primary links do not fit beside the logo and the
  // account actions — they collided at 768-1024px and were simply absent on a
  // phone, leaving no way to reach Inventory or Support. They move into a
  // full-screen panel instead.
  const [menuOpen, setMenuOpen] = useState(false);

  // Close on route change, so tapping a link in the panel does not leave it
  // covering the page it just navigated to.
  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

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
      className={`z-50 w-full px-6 py-5 transition-colors duration-300 sm:px-8 ${
        overHero ? "fixed inset-x-0 top-0" : "sticky top-0"
      } ${
        menuOpen
          ? "border-b border-white/10 bg-[#05070f] text-white"
          : onDark
            ? "border-b border-transparent bg-transparent text-white"
            : "border-b border-border-subtle bg-white/95 text-primary backdrop-blur-sm"
      }`}
    >
      <div className="relative z-50 flex w-full items-center justify-between">
      <Link
        href="/"
        className="font-syne text-xl font-extrabold uppercase tracking-tight transition-opacity hover:opacity-80"
      >
        Ad<span className={onDark ? "text-accent" : "text-secondary"}>Space</span>
      </Link>

      <div className="hidden items-center space-x-8 text-[13px] font-semibold uppercase tracking-wider lg:flex xl:space-x-10">
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

      <div className="flex items-center gap-4 sm:gap-6">
        <button
          type="button"
          aria-label="Search listings (Ctrl+K)"
          onClick={() => setSearchOpen(true)}
          className={`hidden transition-opacity hover:opacity-70 sm:block ${
            menuOpen || onDark ? "text-white" : "text-primary"
          }`}
        >
          <Icon name="search" />
        </button>
        <div className="hidden sm:block">
          <NavActions onDark={menuOpen || onDark} />
        </div>

        <button
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className={`-mr-2 p-2 transition-opacity hover:opacity-70 lg:hidden ${
            menuOpen || onDark ? "text-white" : "text-primary"
          }`}
        >
          <Icon name={menuOpen ? "close" : "menu"} weight={400} />
        </button>
      </div>
      </div>

      {menuOpen ? (
        <div
          id="mobile-menu"
          className="night fixed inset-0 z-40 flex flex-col overflow-y-auto px-6 pb-12 pt-28 sm:px-8 lg:hidden"
        >
          <ul className="flex flex-col">
            {PRIMARY_LINKS.map((link) => (
              <li key={link.label} className="hairline-light border-b">
                <Link
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={`block py-5 font-syne text-3xl font-bold tracking-tight ${
                    pathname === link.href ? "text-accent" : "text-white"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setSearchOpen(true);
            }}
            className="hairline-light mt-8 flex items-center gap-3 border px-5 py-4 text-left font-inter text-xs font-semibold uppercase tracking-[0.18em] text-white/70 sm:hidden"
          >
            <Icon name="search" className="!text-lg" />
            Search listings
          </button>

          <Link
            href="/list-your-space"
            onClick={() => setMenuOpen(false)}
            className="mt-4 inline-flex items-center justify-center gap-3 bg-accent px-8 py-4 font-inter text-xs font-bold uppercase tracking-[0.18em] text-[#05070f] sm:mt-10"
          >
            List your space
          </Link>

          <div className="mt-4 sm:hidden [&_a]:flex [&_a]:w-full [&_a]:justify-center [&_a]:py-4">
            <NavActions onDark />
          </div>
        </div>
      ) : null}

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </nav>
  );
}

export default NavShellA;
