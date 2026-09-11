// Adapted from SDK-Decentralized-Value f84d825 scripts/verify-package.ts.
// Build and pack the CURRENT workspace; never publish or contact a Frontier API.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
type PackageManifest = {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

export function validatePackedManifest(
  installed: PackageManifest,
  expected: PackageManifest,
  versions: ReadonlyMap<string, string>,
): void {
  if (installed.name !== expected.name || installed.version !== expected.version) {
    throw new Error(`Packed identity mismatch: ${expected.name}`);
  }
  for (const section of ["dependencies", "optionalDependencies", "peerDependencies"] as const) {
    const declared = expected[section] ?? {};
    const packed = installed[section] ?? {};
    if (Object.keys(declared).sort().join() !== Object.keys(packed).sort().join()) {
      throw new Error(`Packed dependency names changed: ${expected.name}/${section}`);
    }
    for (const [name, value] of Object.entries(packed)) {
      if (
        typeof value !== "string" ||
        /^(?:workspace:|file:|link:|\.\.?[\\/]|[A-Za-z]:[\\/]|\/)/.test(value)
      ) {
        throw new Error(`Nonportable packed dependency: ${expected.name}/${name}`);
      }
      const wanted = declared[name]!;
      const version = wanted === "workspace:*" ? versions.get(name) : wanted;
      if (!version || value !== version)
        throw new Error(`Packed dependency version mismatch: ${expected.name}/${name}`);
    }
  }
}

async function packageManagerScript(name: "npm" | "pnpm"): Promise<string> {
  const executable = process.env.npm_execpath;
  const folders = [
    join(dirname(process.execPath), "node_modules"),
    join(dirname(process.execPath), "../lib/node_modules"),
  ];
  const candidates = [
    ...(executable && new RegExp(`(?:^|[/\\\\])${name}(?:\\.c?js|-cli\\.js)$`).test(executable)
      ? [executable]
      : []),
    ...folders.flatMap((folder) =>
      name === "npm"
        ? [join(folder, "npm/bin/npm-cli.js")]
        : [join(folder, "pnpm/bin/pnpm.cjs"), join(folder, "corepack/dist/pnpm.js")],
    ),
  ];
  for (const candidate of candidates) {
    if (
      await access(candidate).then(
        () => true,
        () => false,
      )
    )
      return candidate;
  }
  throw new Error(
    `${name} JavaScript entry point not found. Run through pnpm with npm installed alongside Node.`,
  );
}

export async function verifyPackages(root: string): Promise<string> {
  const require = createRequire(join(root, "package.json"));
  const npm = await packageManagerScript("npm");
  const pnpm = await packageManagerScript("pnpm");
  const temporary = await mkdtemp(join(tmpdir(), "frontier-package-verification-"));
  const artifactDir = join(temporary, "packages");
  const consumer = join(temporary, "consumer");
  await mkdir(artifactDir);
  await mkdir(consumer);
  // No lifecycle hooks, audit/fund requests, shell interpolation or long-lived helper process.
  const run = async (args: string[], cwd: string) => {
    const result = await exec(process.execPath, args, {
      cwd,
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
      timeout: 180_000,
      env: { ...process.env, npm_config_ignore_scripts: "true" },
    });
    return result.stdout;
  };
  console.log(`Isolated package verification: ${temporary}`);
  const manifests: PackageManifest[] = [];
  const tarballs: string[] = [];
  for (const folder of ["shared", "sdk", "cli"]) {
    const cwd = join(root, "packages", folder);
    const manifest: PackageManifest = JSON.parse(await readFile(join(cwd, "package.json"), "utf8"));
    manifests.push(manifest);
    if (folder === "shared")
      await run([require.resolve("typescript/bin/tsc"), "-p", "tsconfig.build.json"], cwd);
    await run(["build.mjs"], cwd);
    const tarball = join(
      artifactDir,
      `${manifest.name.replace(/^@/, "").replaceAll("/", "-")}-${manifest.version}.tgz`,
    );
    // pnpm rewrites workspace:* and publishConfig.exports; npm pack does not.
    await run([pnpm, "pack", "--out", tarball], cwd);
    await access(tarball);
    tarballs.push(tarball);
    console.log(`Built and packed ${manifest.name}@${manifest.version}`);
  }
  const versions = new Map(manifests.map((manifest) => [manifest.name, manifest.version]));
  const rootManifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  await writeFile(
    join(consumer, "package.json"),
    JSON.stringify({
      name: "frontier-isolated-consumer",
      version: "1.0.0",
      private: true,
      type: "module",
    }),
  );
  // All Frontier packages come from these tarballs. Only declared third-party dependencies
  // and the CURRENT compiler/types are fetched from npm, with lifecycle scripts disabled.
  await run(
    [
      npm,
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      ...tarballs,
      `typescript@${rootManifest.devDependencies.typescript}`,
      `@types/node@${rootManifest.devDependencies["@types/node"]}`,
    ],
    consumer,
  );
  for (const manifest of manifests) {
    const installed = JSON.parse(
      await readFile(join(consumer, "node_modules", manifest.name, "package.json"), "utf8"),
    );
    validatePackedManifest(installed, manifest, versions);
  }
  await writeFile(
    join(consumer, "smoke.mjs"),
    `import assert from "node:assert/strict";
import { FrontierClient, frontierSdkVersion, compareRuns } from "@frontier/sdk";
import { cliRunSchema } from "@frontier/shared/cli";
import { dominatesOutcome } from "@frontier/shared/multiobjective";
import { canonicalProtocolJson } from "@frontier/shared/manifest";
assert.equal(frontierSdkVersion, ${JSON.stringify(versions.get("@frontier/sdk"))});
assert.equal(typeof compareRuns, "function");
assert.equal(typeof dominatesOutcome, "function");
assert.equal(canonicalProtocolJson({ b: 2, a: 1 }), '{"a":1,"b":2}');
assert.ok(cliRunSchema);
const client = new FrontierClient({ baseUrl: "https://consumer.invalid", fetch: async () => Response.json({ schemaVersion: "1", arenas: [] }) });
assert.deepEqual(await client.arenas.list(), []);
console.log("Standalone ESM import and injected SDK request passed");
`,
  );
  console.log((await run(["smoke.mjs"], consumer)).trim());
  await writeFile(
    join(consumer, "consumer.ts"),
    `import { FrontierClient, type CliContext, type PracticeRun, type SubmissionBody } from "@frontier/sdk";
const sdk = new FrontierClient({ baseUrl: "https://consumer.invalid", auth: { getHeaders: async () => ({ Authorization: "Bearer test" }) } });
async function example(context: CliContext, artifact: Record<string, unknown>, body: SubmissionBody): Promise<PracticeRun> {
  await sdk.submissions.create({ arenaId: "disaster-response", body, context, idempotencyKey: "test-operation" });
  return sdk.evaluations.practice({ arenaId: "disaster-response", artifact, context });
}
void example;
`,
  );
  await run(
    [
      "node_modules/typescript/bin/tsc",
      "--noEmit",
      "--strict",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      "--target",
      "ES2022",
      "consumer.ts",
    ],
    consumer,
  );
  const help = await run(["node_modules/@frontier/cli/dist/bin.js", "--help"], consumer);
  if (!help.includes("frontier") || !help.includes("practice"))
    throw new Error("Packaged CLI help did not run");
  const cliVersion = (
    await run(["node_modules/@frontier/cli/dist/bin.js", "--version"], consumer)
  ).trim();
  if (cliVersion !== versions.get("@frontier/cli"))
    throw new Error("Packaged CLI version mismatch");
  const hashes: Record<string, string> = {};
  for (const tarball of tarballs)
    hashes[tarball] = createHash("sha256")
      .update(await readFile(tarball))
      .digest("hex");
  await writeFile(
    join(temporary, "verification.json"),
    JSON.stringify(
      {
        schemaVersion: "1",
        verifiedAt: new Date().toISOString(),
        node: process.version,
        platform: process.platform,
        architecture: process.arch,
        consumerDirectory: consumer,
        checks: {
          standaloneEsmImport: true,
          nodeNextConsumerTypecheck: true,
          cliHelp: true,
          cliVersion: true,
        },
        packages: hashes,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `Standalone NodeNext and CLI checks passed. Report: ${join(temporary, "verification.json")}`,
  );
  return temporary;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await verifyPackages(resolve(import.meta.dirname, ".."));
}
