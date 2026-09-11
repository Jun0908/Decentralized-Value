import { closeSync, existsSync, openSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import {
  compileRescuePaymentContracts,
  deployRescueOperator,
  loadOrCreateRescueOperatorKeys,
} from "./lib/rescue-operator-chain";

const root = resolve(import.meta.dirname, "..");
const execute = process.argv.includes("--execute-approved-sepolia");
try {
  const artifacts = await compileRescuePaymentContracts(root);
  if (!execute) {
    console.log(
      JSON.stringify({
        status: "compiled-no-transactions",
        compiler: artifacts.compiler,
        compilerInputHash: artifacts.sourceHash,
      }),
    );
  } else {
    config({
      path: resolve(root, existsSync(resolve(root, ".env.local")) ? ".env.local" : ".env"),
      quiet: true,
    });
    const rpcUrl = process.env.SEPOLIA_RPC_URL;
    const raw = process.env.DEPLOYER_PRIVATE_KEY;
    if (!rpcUrl || !raw) throw new Error("MISSING_DEPLOYMENT_CONFIGURATION");
    const deployer = privateKeyToAccount((raw.startsWith("0x") ? raw : `0x${raw}`) as Hex);
    const directory = resolve(root, ".frontier/rescue-operator");
    const keys = loadOrCreateRescueOperatorKeys(
      resolve(root, "secrets/rescue-operator-wallets.json"),
    );
    const { mkdirSync } = await import("node:fs");
    mkdirSync(directory, { recursive: true });
    const lockPath = resolve(directory, "operator.lock");
    const lock = openSync(lockPath, "wx", 0o600);
    try {
      const evidence = await deployRescueOperator({ root, directory, rpcUrl, deployer, keys });
      console.log(JSON.stringify(evidence, null, 2));
    } finally {
      closeSync(lock);
      unlinkSync(lockPath);
    }
  }
} catch {
  // RPC/provider error objects can contain credentials. Inspect local state, never dump them.
  console.error(
    "Rescue deployment stopped safely. No automatic replacement transactions. Inspect local operator journal/configuration.",
  );
  process.exitCode = 1;
}
