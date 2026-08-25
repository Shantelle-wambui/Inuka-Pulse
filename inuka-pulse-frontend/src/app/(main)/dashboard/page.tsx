import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getRoleHomeRoute } from "@/lib/inuka-pulse/roles";

/**
 * /dashboard root — SSR role-aware redirect.
 *
 * Reads the JWT from the inuka-token cookie, decodes the role claim
 * (no signature verification needed — just routing), and redirects
 * to the correct role-specific dashboard.
 *
 * Falls back to /dashboard/director if the token is missing or invalid.
 * The RouteGuard on each sub-route handles actual auth enforcement.
 */
export default async function DashboardRootPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("inuka-token")?.value;

  if (!token) {
    redirect("/auth/v2/login");
  }

  try {
    // Decode JWT payload without verification — routing only, not a security gate.
    // The RouteGuard client component enforces role access on each protected route.
    const [, payloadB64] = token.split(".");
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf-8"),
    );
    const role: string = payload?.role ?? "";
    redirect(getRoleHomeRoute(role));
  } catch {
    // Malformed token — send to login
    redirect("/auth/v2/login");
  }
}
