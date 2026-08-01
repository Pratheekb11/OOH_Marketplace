"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

/**
 * Renders `null` while auth status is "loading" or "unauthenticated" — the
 * redirect itself happens inside a useEffect (never during render, which
 * would break SSR) so `router.replace` only ever runs client-side.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  if (status !== "authenticated") return null;
  return <>{children}</>;
}

export default RequireAuth;
