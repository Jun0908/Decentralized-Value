/** Official CRE compatibility preparation / opt-in local simulation. Never deploys or broadcasts. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { build } from "esbuild";
import { keccak256, stringToHex } from "viem";
import { publicRescueRoomScenario, rescueDoctrinePresets } from "../packages/rescue-room/src/index";
import {
  createRescueEnvelopeRequest,
  runRescueEnvelopePreflight,
} from "./lib/rescue-envelope-preflight";

const root = resolve(import.meta.dirname, "..");
const project = join(root, "workflows", "chainlink-cre");
const workflow = join(project, "rescue-envelope");
const generated = join(workflow, "generated");
await mkdir(generated, { recursive: true });
const evaluator = await build({
  absWorkingDir: root,
  stdin: {
    contents: `import { runRescueEnvelopePreflight } from "./scripts/lib/rescue-envelope-preflight";
export function evaluateFixture(inputJson) {
  const input = JSON.parse(inputJson);
  return JSON.stringify(runRescueEnvelopePreflight(input.request, input.artifact, input.runtime));
}`,
    resolveDir: root,
    sourcefile: "cre-rescue-evaluator-entry.js",
  },
  bundle: true,
  write: false,
  platform: "browser",
  target: "es2022",
  format: "esm",
  minify: false,
  legalComments: "none",
});
const evaluatorCode = evaluator.outputFiles[0]!.text;
const codeHash = keccak256(stringToHex(evaluatorCode));
const artifact = {
  episodeId: publicRescueRoomScenario().episodes[0]!.id,
  doctrine: rescueDoctrinePresets[1]!.doctrine,
};
const runtime = { jobId: "rescue-official-cre-compatibility", codeHash };
const request = createRescueEnvelopeRequest(artifact, runtime);
const expected = runRescueEnvelopePreflight(request, artifact, runtime);
const publicFixtureJson = JSON.stringify({ request, artifact, runtime });
const expectedEvaluationJson = JSON.stringify(expected);
await writeFile(join(generated, "evaluator.js"), evaluatorCode);
await writeFile(
  join(generated, "evaluator.d.ts"),
  "export function evaluateFixture(inputJson: string): string;\n",
);
await writeFile(
  join(generated, "config.json"),
  JSON.stringify(
    {
      schedule: "0 0 * * * *",
      publicFixtureJson,
      expectedEvaluationJson,
      evaluatorBundleHash: codeHash,
      scope: "public-practice-compatibility-only",
    },
    null,
    2,
  ) + "\n",
);
// Public fixture is not a credential. Use an explicit env file so root .env is never loaded.
await writeFile(
  join(generated, "public-fixture.env"),
  `CRE_RESCUE_PUBLIC_FIXTURE='${publicFixtureJson}'\n`,
);

const args = process.argv.slice(2);
if (args.some((argument) => !["--simulate", "--confidential"].includes(argument)))
  throw new Error("Supported flags: --simulate [--confidential]");
const confidential = args.includes("--confidential");
const cli =
  process.env.FRONTIER_CRE_CLI_PATH ??
  (process.platform === "win32"
    ? join(root, ".frontier", "tools", "cre-1.33.0", "bin", "cre_v1.33.0_windows_amd64.exe")
    : "cre");
const childEnv: NodeJS.ProcessEnv = {};
for (const name of [
  "PATH",
  "Path",
  "SystemRoot",
  "SYSTEMROOT",
  "WINDIR",
  "TEMP",
  "TMP",
  "USERPROFILE",
  "LOCALAPPDATA",
  "APPDATA",
  "HOME",
]) {
  if (process.env[name]) childEnv[name] = process.env[name];
}
const command = [
  "workflow",
  "simulate",
  "rescue-envelope",
  "--target",
  "local-simulation",
  "--non-interactive",
  "--trigger-index",
  confidential ? "1" : "0",
  "--env",
  join(generated, "public-fixture.env"),
];
let simulation: {
  state: string;
  exitCode: number | null;
  reason: string | null;
  result?: unknown;
} = {
  state: "not-run",
  exitCode: null,
  reason:
    "Run with --simulate to invoke the official CRE CLI; Node preparation is not CRE execution.",
};
if (args.includes("--simulate")) {
  const executed = spawnSync(cli, command, {
    cwd: project,
    env: childEnv,
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 4_000_000,
    windowsHide: true,
  });
  const output = `${executed.stdout ?? ""}\n${executed.stderr ?? ""}`;
  if (executed.status !== 0) {
    const reason =
      /not logged in|authentication required|failed to attach credentials|failed to load credentials/i.test(
        output,
      )
        ? "CRE CLI authentication is missing. Human must authenticate; no login or account creation attempted."
        : /private beta|not authorized|permission denied|access denied/i.test(output)
          ? "CRE access denied; account or Confidential Workflows access must be confirmed by a human."
          : (executed.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT"
            ? "Official CRE CLI executable is not installed at the configured path."
            : "Official CRE CLI failed before a verified result. Inspect the bounded public-fixture run locally; not a CRE success.";
    simulation = { state: "blocked", exitCode: executed.status, reason };
    // Never persist raw CLI stderr: authenticated failures can contain account/credential data.
    await writeFile(
      join(generated, confidential ? "confidential-diagnostic.json" : "ordinary-diagnostic.json"),
      JSON.stringify({ reason, rawCliOutputRetained: false }, null, 2) + "\n",
    );
  } else {
    const marker = output.indexOf("Workflow Simulation Result:");
    if (marker < 0)
      throw new Error("CRE exited zero without a workflow result; not accepted as success");
    const after = output.slice(marker + "Workflow Simulation Result:".length).trimStart();
    // A returned object is printed as one JSON value; progressively truncate only after complete JSON.
    let actual: unknown;
    for (let end = after.length; end > 0; end--) {
      if (after[end - 1] !== "}") continue;
      try {
        actual = JSON.parse(after.slice(0, end));
        break;
      } catch {
        /* non-JSON simulator suffix */
      }
    }
    assert(actual && typeof actual === "object", "CRE returned no parseable object");
    const result = actual as Record<string, unknown>;
    assert.equal(result.schemaVersion, "frontier-rescue-cre-compatibility-result-v0");
    assert.equal(result.handlerKind, confidential ? "confidential" : "ordinary");
    assert.equal(result.evaluatorBundleHash, codeHash);
    assert.deepEqual(result.evaluation, expected, "Official CRE result differs from native Node");
    assert.equal(result.liveTeeAttestationVerified, false);
    assert.equal(result.onchainWrites, false);
    simulation = { state: "passed", exitCode: 0, reason: null, result };
  }
}
const report = {
  schemaVersion: "frontier-rescue-cre-verification-v0",
  checkedAt: new Date().toISOString(),
  scope: "public-practice-compatibility-only",
  evaluatorBundleHash: codeHash,
  evaluatorBundleBytes: Buffer.byteLength(await readFile(join(generated, "evaluator.js"), "utf8")),
  expectedResultHash: expected.result.resultHash,
  legacy: expected.legacy,
  configuredCliVersion: "1.33.0",
  sdkVersion: "1.20.1",
  handlerKind: confidential ? "confidential" : "ordinary",
  simulation,
  liveTeeAttestationVerified: false,
  hiddenFinalUsed: false,
  committed: false,
  paid: false,
  command: [cli, ...command],
};
const reportPath = join(
  generated,
  confidential ? "confidential-report.json" : "ordinary-report.json",
);
await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ ...report, reportPath }, null, 2));
if (args.includes("--simulate") && simulation.state !== "passed") process.exitCode = 2;
