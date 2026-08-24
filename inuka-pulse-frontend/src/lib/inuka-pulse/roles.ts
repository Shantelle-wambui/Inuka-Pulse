/**
 * Role-based routing utilities for Inuka Pulse.
 *
 * Role names must match exactly what the backend returns in the JWT:
 *   "Programme Director" | "Case Manager" | "Analyst" | "Admin" | "ML Admin" | "Viewer"
 *
 * Use getRoleHomeRoute() after login to redirect each user to their
 * role-appropriate dashboard.
 */

export const ROLES = {
  ADMIN: "Admin",
  PROGRAMME_DIRECTOR: "Programme Director",
  CASE_MANAGER: "Case Manager",
  ANALYST: "Analyst",
  ML_ADMIN: "ML Admin",
  VIEWER: "Viewer",
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

/** Maps each role to its home dashboard route. */
export const ROLE_HOME_ROUTES: Record<string, string> = {
  [ROLES.PROGRAMME_DIRECTOR]: "/dashboard/director",
  [ROLES.CASE_MANAGER]:       "/dashboard/case-manager",
  [ROLES.ANALYST]:            "/dashboard/analytics",
  [ROLES.ML_ADMIN]:           "/dashboard/analytics",
  [ROLES.ADMIN]:              "/dashboard/director",
  [ROLES.VIEWER]:             "/dashboard/director",
};

/** Returns the home route for a given role. Falls back to /dashboard/director. */
export function getRoleHomeRoute(role: string): string {
  return ROLE_HOME_ROUTES[role] ?? "/dashboard/director";
}

/**
 * Returns a human-readable label for each role displayed in the UI.
 * Keeps internal role names separate from display names.
 */
export const ROLE_LABELS: Record<string, string> = {
  [ROLES.PROGRAMME_DIRECTOR]: "Programme Director",
  [ROLES.CASE_MANAGER]:       "Case Manager",
  [ROLES.ANALYST]:            "Analyst",
  [ROLES.ML_ADMIN]:           "ML Admin",
  [ROLES.ADMIN]:              "Administrator",
  [ROLES.VIEWER]:             "Viewer",
};

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

/**
 * Route access control — which roles can access each protected route prefix.
 * RouteGuard uses this to redirect unauthorised users.
 */
export const ROUTE_ROLES: { path: string; roles: string[] }[] = [
  {
    path: "/dashboard/director",
    roles: [ROLES.PROGRAMME_DIRECTOR, ROLES.ADMIN],
  },
  {
    path: "/dashboard/case-manager",
    roles: [ROLES.CASE_MANAGER, ROLES.ADMIN],
  },
  {
    path: "/dashboard/analytics",
    roles: [ROLES.ANALYST, ROLES.ML_ADMIN, ROLES.ADMIN],
  },
  {
    path: "/dashboard/ml-admin",
    roles: [ROLES.ANALYST, ROLES.ML_ADMIN, ROLES.ADMIN],
  },
  // Shared sections accessible to all authenticated users
  {
    path: "/dashboard/inuka",
    roles: [ROLES.PROGRAMME_DIRECTOR, ROLES.ADMIN, ROLES.ANALYST, ROLES.ML_ADMIN, ROLES.VIEWER],
  },
];

/**
 * Returns true if the given role is allowed to access the given pathname.
 * Returns true for paths not listed in ROUTE_ROLES (unprotected routes).
 */
export function isRouteAllowed(pathname: string, role: string): boolean {
  const match = ROUTE_ROLES.find((r) => pathname.startsWith(r.path));
  if (!match) return true;
  return match.roles.includes(role);
}
