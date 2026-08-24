import { RouteGuard } from "@/components/route-guard";
import { ROLES } from "@/lib/inuka-pulse/roles";
import type { ReactNode } from "react";

export default function DirectorLayout({ children }: { children: ReactNode }) {
  return (
    <RouteGuard allowedRoles={[ROLES.PROGRAMME_DIRECTOR, ROLES.ADMIN]}>
      {children}
    </RouteGuard>
  );
}
