import { existsSync } from "node:fs";
import type { NextConfig } from "next";
import { resolve } from "node:path";
import { config } from "dotenv";

const monorepoRoot = resolve(import.meta.dirname, "../..");
const rescueRoomEnvironment: Record<string, string> = {};
for (const filename of [".env.local", ".env"]) {
  const path = resolve(monorepoRoot, filename);
  if (existsSync(path)) {
    config({ path, override: false, quiet: true, processEnv: rescueRoomEnvironment });
  }
}
if (!process.env.OPENAI_API_KEY && rescueRoomEnvironment.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = rescueRoomEnvironment.OPENAI_API_KEY;
}
if (!process.env.OPENAI_BASE_URL && rescueRoomEnvironment.OPENAI_BASE_URL) {
  process.env.OPENAI_BASE_URL = rescueRoomEnvironment.OPENAI_BASE_URL;
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: {
    root: monorepoRoot,
  },
};

export default nextConfig;
