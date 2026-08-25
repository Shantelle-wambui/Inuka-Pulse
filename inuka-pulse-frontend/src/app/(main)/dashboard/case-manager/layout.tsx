import { RouteGuard } from "@/components/route-guard";
import { ROLES } from "@/lib/inuka-pulse/roles";
import type { ReactNode } from "react";

export default function CaseManagerLayout({ children }: { children: ReactNode }) {
  return (
    <RouteGuard allowedRoles={[ROLES.CASE_MANAGER, ROLES.ADMIN]}>
      {children}
    </RouteGuard>
  );
}
