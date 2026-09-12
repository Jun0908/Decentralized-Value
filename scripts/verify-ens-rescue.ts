/** Read-only repeatable filming check. Never constructs a signer or signs a transaction. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import {
  createPublicClient,
  http,
  namehash,
  parseAbi,
  BaseError,
  ContractFunctionRevertedError,
} from "viem";
import { sepolia } from "viem/chains";
import { EnsRescueServiceDirectory } from "../packages/ens-adapter/src/index";
import { checkRescuePracticeOnboarding } from "./lib/rescue-practice-preflight";
import recorded from "../Docs/deployments/ensv2-rescue-demo.json";

async function main() {
  const env = parseEnv(await readFile(resolve(import.meta.dirname, "../.env"), "utf8"));
  const rpc = process.env.SEPOLIA_RPC_URL ?? env.SEPOLIA_RPC_URL;
  assert(rpc && new URL(rpc).protocol === "https:");
  const client = createPublicClient({
    chain: sepolia,
    transport: http(rpc, { timeout: 15_000, retryCount: 0 }),
  });
  assert.equal(await client.getChainId(), sepolia.id);
  const block = await client.getBlockNumber();
  const resolver = await client.getEnsResolver({ name: recorded.parent, blockNumber: block });
  assert.equal(resolver?.toLowerCase(), recorded.resolver.toLowerCase());
  const directory = new EnsRescueServiceDirectory(
    { getText: (name, key) => client.getEnsText({ name, key, blockNumber: block }) },
    [recorded.finalRecord.apiOrigin],
  );
  const discovery = await directory.resolve(recorded.parent);
  const onboarding = await checkRescuePracticeOnboarding(discovery.apiOrigin);
  assert(onboarding.verified);
  let revokedWriteRejected = false;
  try {
    await client.simulateContract({
      account: recorded.delegate as `0x${string}`,
      address: resolver!,
      blockNumber: block,
      abi: parseAbi(["function setText(bytes32 node, string key, string value)"]),
      functionName: "setText",
      args: [
        namehash(recorded.parent),
        recorded.recordKey,
        JSON.stringify({ ...recorded.finalRecord, status: "paused" }),
      ],
    });
  } catch (error) {
    revokedWriteRejected =
      error instanceof BaseError &&
      error.walk((e) => e instanceof ContractFunctionRevertedError) instanceof
        ContractFunctionRevertedError;
  }
  assert(revokedWriteRejected);
  console.log(
    JSON.stringify(
      {
        verified: true,
        checkedAt: new Date().toISOString(),
        block: String(block),
        discovery,
        publicPracticeVerified: onboarding.verified,
        revokedWriteRejected,
        rejectionMethod: "eth_call",
        transactionsSent: 0,
      },
      null,
      2,
    ),
  );
}
main().catch(() => {
  console.error("ENS_RESCUE_READONLY_CHECK_FAILED: no credentials or raw RPC errors printed");
  process.exitCode = 1;
});
