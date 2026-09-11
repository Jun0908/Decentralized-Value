import { build } from "esbuild";
import { readdir, readFile, writeFile } from "node:fs/promises";

await build({
  entryPoints: ["src/index.ts", "src/cli.ts", "src/multiobjective.ts", "src/manifest.ts"],
  outdir: "dist",
  bundle: true,
  splitting: true,
  packages: "external",
  format: "esm",
  platform: "neutral",
  target: "es2022",
});

// TypeScript preserves source module specifiers; published Node ESM declarations need extensions.
for (const file of await readdir("dist")) {
  if (!file.endsWith(".d.ts")) continue;
  const path = `dist/${file}`;
  const source = await readFile(path, "utf8");
  await writeFile(path, source.replace(/(from\s+["']\.\.?\/[^"']+)(["'])/g, "$1.js$2"));
}
