/** Local-only nonproduction preparation. No CLI/login/AI/RPC/files/transactions. */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { build } from "esbuild";
import { keccak256, stringToHex } from "viem";
import {
  commitRescueSecretPack,
  evaluateRescueSecretPack,
  replayRescueSecretPack,
  revealRescueSecretPack,
  verifyRescueSecretPack,
} from "./lib/rescue-secret-pack";

async function main() {
  assert.equal(process.argv.length, 2, "No arguments supported");
  const root = resolve(import.meta.dirname, "..");
  const bundle = await build({
    absWorkingDir: root,
    stdin: {
      contents: 'export { evaluateRescuePolicy } from "./packages/rescue-room/src/index";',
      resolveDir: root,
      sourcefile: "rescue-secret-pack-evaluator-entry.js",
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
  const seeds = Array.from({ length: 3 }, () => randomBytes(32).toString("hex"));
  const input = {
    salt: `0x${randomBytes(32).toString("hex")}`,
    seeds,
    policyId: "simple-adaptive",
  };
  const pack = commitRescueSecretPack(JSON.stringify(input), runtime);
  assert.equal(verifyRescueSecretPack(pack.commitment, pack.privatePackJson, runtime), true);
  const receipt = evaluateRescueSecretPack(pack.commitment, pack.privatePackJson, runtime);
  const receiptJson = JSON.stringify(receipt);
  // Intentional reveal only into memory, not console or generated public files.
  const reveal = revealRescueSecretPack(receiptJson, pack.privatePackJson, runtime);
  const replay = replayRescueSecretPack(receiptJson, reveal, runtime);
  // Execute exactly the browser-target JavaScript bundle identified by codeHash,
  // inside Node's V8 (NOT official CRE/QuickJS), independently of native imports.
  const bundled = await import(
    `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
  );
  assert.deepEqual(replay.evaluation, bundled.evaluateRescuePolicy(input.policyId, seeds));
  for (const secret of [
    input.salt,
    ...seeds,
    replay.evaluation.contextHash,
    replay.evaluation.resultHash,
  ])
    assert.equal(receiptJson.includes(secret), false);
  console.log(
    JSON.stringify(
      {
        verification: "passed",
        scope: "nonproduction-local-preparation",
        nodeBundleReplayMatched: true,
        explicitInMemoryRevealReplayed: true,
        publicReceiptLeakCheck: "passed",
        secretsPersisted: false,
        evaluatorBundleHash: runtime.codeHash,
        receipt,
      },
      null,
      2,
    ),
  );
}

try {
  await main();
} catch {
  // Never print an assertion diff, stack, input or evaluator error containing pack data.
  console.error("RESCUE_SECRET_PACK_LOCAL_VERIFICATION_FAILED");
  process.exitCode = 1;
}
