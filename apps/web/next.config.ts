import type { NextConfig } from "next";
import { resolve } from "node:path";

const monorepoRoot = resolve(import.meta.dirname, "../..");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: {
    root: monorepoRoot,
  },
};

export default nextConfig;
