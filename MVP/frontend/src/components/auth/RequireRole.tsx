"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import type { Role } from "@/types/api";

export interface RequireRoleProps {
  role: Role;
  /** Where to send a signed-in user whose role doesn't match, e.g. an owner
   * hitting /cart — redirected rather than shown a 403 blob. */
  fallback?: string;
  children: ReactNode;
}

export function RequireRole({ role, fallback = "/", children }: RequireRoleProps) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (status === "authenticated" && user.role !== role) {
      router.replace(fallback);
    }
  }, [status, user, role, fallback, router, pathname]);

  if (status !== "authenticated" || user.role !== role) return null;
  return <>{children}</>;
}

export default RequireRole;
