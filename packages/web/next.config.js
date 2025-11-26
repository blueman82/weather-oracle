/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@weather-oracle/core"],
  experimental: {
    optimizePackageImports: ["@weather-oracle/core"],
  },
  eslint: {
    // ESLint rules are enforced via separate lint command;
    // ignore during build to avoid strict-mode warnings
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Type checking handled by separate typecheck command
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
