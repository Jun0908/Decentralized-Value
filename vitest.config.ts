import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["**/.next/**", "**/dist/**", "**/node_modules/**"],
    include: ["**/*.test.ts"],
  },
});
