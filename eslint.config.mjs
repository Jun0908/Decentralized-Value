import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    settings: {
      next: {
        rootDir: "apps/web/",
      },
      react: {
        version: "19.2.8",
      },
    },
  },
  prettier,
  globalIgnores([
    "**/.next/**",
    "**/.vercel/**",
    "**/coverage/**",
    "**/dist/**",
    "**/node_modules/**",
    "**/next-env.d.ts",
    "workflows/chainlink-cre/**/generated/**",
    ".frontier/**",
    "**/scratchpad/**",
    "packages/contracts/lib/**",
    "packages/contracts/out/**",
  ]),
]);
