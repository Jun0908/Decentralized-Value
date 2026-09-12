/** Explicit opt-in official CRE secret-input demo. Never broadcasts or calls AI. */
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { parseEnv } from "node:util";
import { build } from "esbuild";
import { keccak256, stringToHex } from "viem";
import {
  commitRescueSecretPack,
  evaluateRescueSecretPack,
  revealRescueSecretPack,
  replayRescueSecretPack,
} from "./lib/rescue-secret-pack";
import { runOfficialCre } from "./lib/cre-simulation";

async function main() {
  assert.deepEqual(
    process.argv.slice(2),
    ["--simulate", "--reveal"],
    "Use --simulate --reveal for the nonproduction demonstration",
  );
  const root = resolve(import.meta.dirname, "..");
  const folder = "rescue-envelope/secret-pack";
  const generated = join(root, "workflows/chainlink-cre", folder, "generated");
  await mkdir(generated, { recursive: true });
  const bundle = await build({
    absWorkingDir: root,
    stdin: {
      contents:
        'import { evaluateRescueSecretPack } from "./scripts/lib/rescue-secret-pack"; export function evaluateSecretPack(commitment, packJson, codeHash) { return JSON.stringify(evaluateRescueSecretPack(commitment, packJson, {codeHash})); }',
      resolveDir: root,
      sourcefile: "cre-secret-pack-entry.js",
    },
    bundle: true,
    write: false,
    platform: "browser",
    target: "es2022",
    format: "esm",
    legalComments: "none",
    logLevel: "silent",
  });
  const code = bundle.outputFiles[0]!.text;
  const runtime = { codeHash: keccak256(stringToHex(code)) };
  const input = {
    salt: `0x${randomBytes(32).toString("hex")}`,
    seeds: [randomBytes(32).toString("hex")],
    policyId: "simple-adaptive",
  };
  const pack = commitRescueSecretPack(JSON.stringify(input), runtime);
  const expected = evaluateRescueSecretPack(pack.commitment, pack.privatePackJson, runtime);
  await writeFile(join(generated, "evaluator.js"), code);
  await writeFile(
    join(generated, "evaluator.d.ts"),
    "export function evaluateSecretPack(commitment: string, packJson: string, codeHash: string): string;\n",
  );
  const config = {
    schedule: "0 0 * * * *",
    commitment: pack.commitment,
    evaluatorBundleHash: runtime.codeHash,
    scope: "nonproduction-secret-pack-simulation",
  };
  const publicConfig = JSON.stringify(config, null, 2);
  for (const secret of [input.salt, ...input.seeds]) assert(!publicConfig.includes(secret));
  await writeFile(join(generated, "config.json"), publicConfig);
  // Save the commitment BEFORE invoking CRE. Local timestamp is not onchain timestamping.
  await writeFile(
    join(generated, "commitment-before-run.json"),
    JSON.stringify({ committedAt: new Date().toISOString(), ...config }, null, 2),
  );
  const envFile = join(generated, ".env.private-pack");
  assert(!pack.privatePackJson.includes("'"));
  await writeFile(envFile, `CRE_RESCUE_PRIVATE_PACK='${pack.privatePackJson}'\n`, { mode: 0o600 });
  try {
    const env = parseEnv(await readFile(join(root, ".env"), "utf8"));
    const rpcUrl = process.env.SEPOLIA_RPC_URL ?? env.SEPOLIA_RPC_URL;
    assert(rpcUrl && new URL(rpcUrl).protocol === "https:");
    const executed = runOfficialCre({
      root,
      workflowFolder: folder,
      envFile,
      rpcUrl,
      triggerIndex: 0,
    });
    assert.equal(executed.result.schemaVersion, "frontier-cre-secret-pack-result-v1");
    assert.equal(executed.result.handlerKind, "confidential");
    assert.equal(executed.result.privateInputUsed, true);
    assert.equal(executed.result.liveTeeAttestationVerified, false);
    assert.equal(executed.result.onchainWrites, false);
    assert.equal(executed.result.rewardEligible, false);
    const receiptJson = executed.result.receiptJson;
    assert.equal(typeof receiptJson, "string");
    assert.deepEqual(JSON.parse(receiptJson as string), expected);
    for (const secret of [input.salt, ...input.seeds])
      assert(!(receiptJson as string).includes(secret));
    // --reveal explicitly permits publishing this demo pack only after CRE agreement.
    const reveal = revealRescueSecretPack(receiptJson as string, pack.privatePackJson, runtime);
    const replay = replayRescueSecretPack(receiptJson as string, reveal, runtime);
    const report = {
      schemaVersion: "frontier-cre-private-pack-evidence-v1",
      checkedAt: new Date().toISOString(),
      scope: config.scope,
      cliVersion: "1.33.0",
      sdkVersion: "1.20.1",
      simulation: "passed",
      handlerKind: "confidential",
      privateInputUsed: true,
      publicConfigContainsSecrets: false,
      receiptContainsSecrets: false,
      nodeReceiptMatches: true,
      explicitRevealReplayMatches: true,
      evaluatorBundleHash: runtime.codeHash,
      wasmSha256: createHash("sha256")
        .update(await readFile(join(generated, "workflow.wasm")))
        .digest("hex"),
      commitment: pack.commitment,
      receipt: expected,
      revealedPack: reveal,
      replay,
      liveTeeAttestationVerified: false,
      onchainCommitment: false,
      finalTournamentComplete: false,
      rewardEligible: false,
    };
    await writeFile(
      join(root, "Docs/deployments/chainlink-cre-private-pack.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      JSON.stringify(
        {
          simulation: "passed",
          handlerKind: "confidential",
          privateInputUsed: true,
          nodeReceiptMatches: true,
          explicitRevealReplayMatches: true,
          commitment: pack.commitment,
          liveTeeAttestationVerified: false,
          evidence: "Docs/deployments/chainlink-cre-private-pack.json",
        },
        null,
        2,
      ),
    );
  } finally {
    // Exact file created above, not a recursive directory deletion.
    await rm(envFile, { force: true });
  }
}
main().catch(() => {
  console.error(
    "CRE_PRIVATE_PACK_NOT_VERIFIED: no secret input or raw CLI output retained in this error",
  );
  process.exitCode = 1;
});
