import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mongoose"],
  poweredByHeader: false,
  // This repo lives next to other projects with their own lockfiles; pin the root.
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
