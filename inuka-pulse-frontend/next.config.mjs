/** @type {import('next').NextConfig} */
const nextConfig = {
  // allowedDevOrigins is dev-only — safe to leave but has no effect in production
  allowedDevOrigins: ["*"],
  reactCompiler: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  async redirects() {
    return [
      // Original redirect
      { source: "/dashboard/default", destination: "/dashboard", permanent: false },
      // Early Warning branch (alerts moved from inuka)
      { source: "/dashboard/inuka/alerts", destination: "/dashboard/early-warning/alerts", permanent: false },
      // Risk Analysis (what-if extracted from overview)
      { source: "/dashboard/risk-analysis", destination: "/dashboard/early-warning/risk-analysis", permanent: false },
      // Analytics routes (moved from inuka)
      { source: "/dashboard/inuka/analytics", destination: "/dashboard/analytics", permanent: false },
      { source: "/dashboard/inuka/roi", destination: "/dashboard/analytics/roi", permanent: false },
      // Sites to Locations (future)
      { source: "/dashboard/sites", destination: "/dashboard/locations", permanent: false },
      // Old maintenance routes to disbursements (future)
      { source: "/dashboard/maintenance/work-orders", destination: "/dashboard/disbursements/pending", permanent: false },
      { source: "/dashboard/maintenance/history", destination: "/dashboard/disbursements/history", permanent: false },
    ];
  },
};

export default nextConfig;
