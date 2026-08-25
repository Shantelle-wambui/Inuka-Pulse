import type { ReactNode } from "react";

/**
 * Analytics layout — no RouteGuard here.
 *
 * Access control is handled by:
 *   1. The global RouteGuard (reads ROUTE_ROLES from roles.ts)
 *   2. The sidebar (only shows links to permitted roles)
 *
 * This allows sub-routes like /analytics/disbursement-compliance to have
 * broader access (Director + Donor) than the general /analytics path.
 */
export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
