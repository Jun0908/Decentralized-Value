import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createPublicClient, http, parseEther, toHex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { deployRescueOperator, loadOrCreateRescueOperatorKeys } from "./lib/rescue-operator-chain";

// Isolated Anvil ONLY. No .env, no existing wallets, no external RPC permitted.
const rpcUrl = "http://127.0.0.1:8547";
const client = createPublicClient({ transport: http(rpcUrl) });
const directory = mkdtempSync(resolve(tmpdir(), "rescue-deploy-local-"));
const deployer = privateKeyToAccount(generatePrivateKey());
await client.request({
  method: "anvil_setBalance" as never,
  params: [deployer.address, toHex(parseEther("2"))] as never,
});
const keys = loadOrCreateRescueOperatorKeys(resolve(directory, "keys.json"));
const options = { root: resolve(import.meta.dirname, ".."), rpcUrl, deployer, keys, directory };
const first = await deployRescueOperator(options);
const nonceBefore = await client.getTransactionCount({ address: deployer.address });
const second = await deployRescueOperator(options);
const nonceAfter = await client.getTransactionCount({ address: deployer.address });
if (
  first.token.address !== second.token.address ||
  first.escrow.address !== second.escrow.address ||
  nonceBefore !== nonceAfter
)
  throw new Error("Deployment retry changed state");
console.log(
  JSON.stringify({
    status: "pass",
    network: "isolated-local-anvil-not-sepolia",
    transactionCount: first.transactions.length,
    retryCreatedTransactions: nonceAfter - nonceBefore,
    evidenceDirectory: directory,
  }),
);
