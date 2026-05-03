import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: false,
  transpilePackages: ["@agentforge/shared"],
};

export default nextConfig;
