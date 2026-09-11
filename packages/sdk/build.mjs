import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
execFileSync(process.execPath, [require.resolve("typescript/bin/tsc"), "--emitDeclarationOnly"], {
  stdio: "inherit",
});
await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  external: ["viem", "zod"],
  format: "esm",
  platform: "neutral",
  target: "es2022",
  sourcemap: true,
});
