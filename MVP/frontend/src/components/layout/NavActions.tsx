"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Skeleton from "@/components/ui/Skeleton";
import CartBadge from "./CartBadge";

/**
 * The one genuinely new UI element here (the prototype's Sign In button is
 * static markup). Renders by auth state:
 *   - loading         -> fixed-size Skeleton (no layout shift once resolved)
 *   - unauthenticated  -> "Sign In" -> /login
 *   - advertiser       -> CartBadge + account menu (email + Sign out)
 *   - owner            -> "List Media" -> /list-your-space + account menu
 */
export function NavActions() {
  const { status, user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (status === "loading") {
    return <Skeleton className="h-9 w-24 rounded-lg" />;
  }

  if (status === "unauthenticated") {
    return (
      <Button href="/login" variant="primary" size="sm">
        Sign In
      </Button>
    );
  }

  const accountMenu = (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        className="flex items-center gap-2 rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <Icon name="account_circle" />
      </button>
      {menuOpen ? (
        <div
          role="menu"
          className="glass-card absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-border-subtle p-2 shadow-lg"
        >
          <p className="truncate px-3 py-2 text-xs font-semibold text-on-surface-variant">{user.email}</p>
          <button
            type="button"
            role="menuitem"
            onClick={logout}
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-error transition-colors hover:bg-error/10"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );

  if (user.role === "owner") {
    return (
      <div className="flex items-center gap-4">
        <Button href="/list-your-space" variant="primary" size="sm">
          List Media
        </Button>
        {accountMenu}
      </div>
    );
  }

  // advertiser (and admin, defensively) get the cart badge.
  return (
    <div className="flex items-center gap-4">
      <CartBadge />
      {accountMenu}
    </div>
  );
}

export default NavActions;
