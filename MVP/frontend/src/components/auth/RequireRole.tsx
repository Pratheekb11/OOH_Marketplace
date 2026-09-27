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

/** Admin is a superset of both product roles (mirrors `require_roles` in
 * backend/app/security.py, where an admin passes every role gate), so an admin
 * is allowed through an owner-only or advertiser-only page rather than bounced. */
function satisfies(userRole: Role, required: Role): boolean {
  return userRole === required || userRole === "admin";
}

export function RequireRole({ role, fallback = "/", children }: RequireRoleProps) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (status === "authenticated" && !satisfies(user.role, role)) {
      router.replace(fallback);
    }
  }, [status, user, role, fallback, router, pathname]);

  if (status !== "authenticated" || !satisfies(user.role, role)) return null;
  return <>{children}</>;
}

export default RequireRole;
