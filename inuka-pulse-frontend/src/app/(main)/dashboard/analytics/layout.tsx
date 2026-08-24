import { RouteGuard } from "@/components/route-guard";
import { ROLES } from "@/lib/inuka-pulse/roles";
import type { ReactNode } from "react";

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  return (
    <RouteGuard allowedRoles={[ROLES.ANALYST, ROLES.ML_ADMIN, ROLES.ADMIN]}>
      {children}
    </RouteGuard>
  );
}
