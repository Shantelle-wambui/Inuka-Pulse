import { redirect } from "next/navigation";

/**
 * /dashboard root — immediate redirect to main dashboard.
 *
 * Sends all users to /dashboard/inuka (the universal Inuka Pulse overview),
 * which is accessible to all authenticated roles. The RouteGuard component
 * on each sub-route handles auth enforcement and role-based access control.
 *
 * This avoids blank-page issues during demos and removes fragile JWT parsing
 * from the routing layer.
 */
export default function DashboardRootPage() {
  redirect("/dashboard/inuka");
}
