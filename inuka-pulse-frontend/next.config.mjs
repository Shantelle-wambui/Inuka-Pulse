/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output copies only the files needed to run the app.
  // This keeps the Docker image small — no full node_modules in the runtime stage.
  output: "standalone",

  // allowedDevOrigins is dev-only — safe to leave but has no effect in production
  allowedDevOrigins: ["*"],
  reactCompiler: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/dashboard/default",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
