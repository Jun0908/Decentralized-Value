/** Local portability preflight only: Node/V8 and, when installed, Bun/JSC.
 * A browser-target bundle is NOT a CRE/QuickJS compatibility attestation.
 * No RPC, model credentials, signatures, payments or hidden Final are used. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { keccak256, stringToHex, type Hex } from "viem";
import { publicRescueRoomScenario, rescueDoctrinePresets } from "../packages/rescue-room/src/index";
import {
  createRescueEnvelopeRequest,
  runRescueEnvelopePreflight,
} from "./lib/rescue-envelope-preflight";

const root = resolve(import.meta.dirname, "..");
const bundled = await build({
  absWorkingDir: root,
  entryPoints: ["scripts/lib/rescue-envelope-preflight.ts"],
  bundle: true,
  write: false,
  format: "iife",
  globalName: "FrontierRescuePreflight",
  platform: "browser",
  target: "es2022",
  sourcemap: false,
  legalComments: "none",
});
const code = bundled.outputFiles[0]!.text;
const codeHash: Hex = keccak256(stringToHex(code));
const artifact = {
  episodeId: publicRescueRoomScenario().episodes[0]!.id,
  doctrine: rescueDoctrinePresets[1]!.doctrine,
};
const runtime = { jobId: "rescue-portability-preflight", codeHash };
const request = createRescueEnvelopeRequest(artifact, runtime);
const expected = runRescueEnvelopePreflight(request, artifact, runtime);
const payload = JSON.stringify({ request, artifact, runtime });
const invocation = `(() => {
const input = JSON.parse(payload);
return JSON.stringify(FrontierRescuePreflight.runRescueEnvelopePreflight(input.request, input.artifact, input.runtime));
})()`;
// VM isolates globals to detect accidental Node dependencies. It is not a
// security sandbox and this script runs only repository-owned evaluator code.
const portable = JSON.parse(
  runInNewContext(
    `${code}\n${invocation}`,
    { payload, TextEncoder, TextDecoder },
    { timeout: 30_000 },
  ) as string,
) as unknown;
assert.deepEqual(portable, expected, "Browser-target bundle differs from native Node evaluator");

const outputDirectory = await mkdtemp(join(tmpdir(), "frontier-rescue-envelope-"));
const bunProgram = join(outputDirectory, "rescue-preflight.cjs");
await writeFile(
  bunProgram,
  `${code}\nconst payload = ${JSON.stringify(payload)};\nconsole.log(${invocation});\n`,
);
let bun: { state: "passed" | "unavailable"; version: string | null };
let bunVersion: string | null = null;
try {
  bunVersion = execFileSync("bun", ["--version"], {
    encoding: "utf8",
    timeout: 10_000,
    windowsHide: true,
  }).trim();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
if (bunVersion === null) {
  bun = { state: "unavailable", version: null };
} else {
  const actual = JSON.parse(
    execFileSync("bun", [bunProgram], {
      encoding: "utf8",
      timeout: 30_000,
      maxBuffer: 2_000_000,
      windowsHide: true,
    }),
  ) as unknown;
  assert.deepEqual(actual, expected, "Bun/JSC differs from Node/V8 evaluator");
  bun = { state: "passed", version: bunVersion };
}
const report = {
  schemaVersion: "rescue-envelope-local-preflight-v1",
  scope: "public-single-episode-local-reproduction",
  evaluatorBundleHash: codeHash,
  episodeId: artifact.episodeId,
  artifactHash: request.artifactHash,
  contextHash: request.contextHash,
  resultHash: expected.result.resultHash,
  legacy: expected.legacy,
  node: { state: "passed", version: process.version },
  browserTargetV8: { state: "passed", nodeGlobalsAvailable: false },
  bun,
  cre: {
    state: "not-run",
    reason: "Requires the official CRE runtime and its own compatibility gate.",
  },
  boundary: expected.boundary,
};
const reportPath = join(outputDirectory, "report.json");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ...report, reportPath }, null, 2));
