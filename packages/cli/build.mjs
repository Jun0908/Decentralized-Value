import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { build } from "esbuild";

const require = createRequire(import.meta.url);

execFileSync(process.execPath, [require.resolve("typescript/bin/tsc"), "-p", "tsconfig.json"], {
  stdio: "inherit",
});

await build({
  entryPoints: {
    bin: "src/bin.ts",
    index: "src/index.ts",
  },
  outdir: "dist",
  bundle: true,
  external: ["@napi-rs/keyring", "ajv", "ajv/*", "open", "yauzl"],
  format: "esm",
  platform: "node",
  target: "node22",
  sourcemap: true,
});
