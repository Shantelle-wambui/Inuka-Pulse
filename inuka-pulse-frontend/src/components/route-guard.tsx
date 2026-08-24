"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth/auth-store";
import { isRouteAllowed, getRoleHomeRoute } from "@/lib/inuka-pulse/roles";

interface RouteGuardProps {
  readonly children: React.ReactNode;
  /** Roles explicitly allowed on this route. Takes priority over ROUTE_ROLES lookup. */
  readonly allowedRoles?: string[];
}

/**
 * RouteGuard — client-side role-based access control.
 *
 * Usage (in a layout.tsx or page.tsx):
 *   <RouteGuard allowedRoles={["Programme Director", "Admin"]}>
 *     {children}
 *   </RouteGuard>
 *
 * If no allowedRoles prop is passed, falls back to ROUTE_ROLES path matching.
 *
 * Unauthenticated users are redirected to /auth/v2/login.
 * Authenticated users without the required role are redirected to their
 * own home route so they land somewhere valid.
 */
export function RouteGuard({ children, allowedRoles }: RouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Not logged in — send to login
    if (!isAuthenticated || !user) {
      router.replace("/auth/v2/login");
      return;
    }

    const role = user.role;

    // Check explicit allowedRoles prop first
    if (allowedRoles) {
      if (!allowedRoles.includes(role)) {
        router.replace(getRoleHomeRoute(role));
      }
      return;
    }

    // Fall back to ROUTE_ROLES path matching
    if (!isRouteAllowed(pathname, role)) {
      router.replace(getRoleHomeRoute(role));
    }
  }, [isAuthenticated, user, pathname, router, allowedRoles]);

  // Render nothing until auth check completes to prevent flash of protected content
  if (!isAuthenticated || !user) return null;

  if (allowedRoles && !allowedRoles.includes(user.role)) return null;

  if (!allowedRoles && !isRouteAllowed(pathname, user.role)) return null;

  return <>{children}</>;
}
