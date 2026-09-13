/** Scoped ENSv2 Sepolia demonstration. Default is read-only; --execute opts in. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { resolve, join } from "node:path";
import { parseEnv } from "node:util";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  namehash,
  toHex,
  parseEther,
  keccak256,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { packetToBytes } from "viem/ens";
import {
  EnsRescueServiceDirectory,
  rescueServiceRecordKey,
} from "../packages/ens-adapter/src/index";
import { checkRescuePracticeOnboarding } from "./lib/rescue-practice-preflight";

const parent = "frontierdemo.eth";
const confirmedOwner = "0x5A6A8964B044fdf18920ac4af64c18e88792261D";
const apiOrigin = "https://web-rho-seven-d6te7t3f0y.vercel.app";
const registry = "0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2";
const abi = parseAbi([
  "function text(bytes32 node, string key) view returns (string)",
  "function setText(bytes32 node, string key, string value)",
  "function authorizeTextRoles(bytes name, string key, address account, bool grant)",
]);
const record = (status: "active" | "paused") =>
  JSON.stringify({
    schemaVersion: "frontier-rescue-service-v1",
    capability: "rescue-doctrine-public-practice",
    apiOrigin,
    status,
  });

async function main() {
  const execute = process.argv.slice(2).join(" ") === "--execute";
  assert(execute || process.argv.length === 2, "Only --execute is supported");
  const root = resolve(import.meta.dirname, "..");
  const env = parseEnv(await readFile(join(root, ".env"), "utf8"));
  const rawKey = env.DEPLOYER_PRIVATE_KEY?.trim();
  assert(rawKey);
  const owner = privateKeyToAccount((rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as Hex);
  assert.equal(owner.address.toLowerCase(), confirmedOwner.toLowerCase());
  const client = createPublicClient({
    chain: sepolia,
    transport: http(env.SEPOLIA_RPC_URL, { timeout: 15_000, retryCount: 0 }),
  });
  assert.equal(await client.getChainId(), sepolia.id);
  const blockBefore = await client.getBlockNumber();
  const onchainOwner = await client.readContract({
    address: registry,
    abi: parseAbi(["function findOwner(string label) view returns (address)"]),
    functionName: "findOwner",
    args: ["frontierdemo"],
    blockNumber: blockBefore,
  });
  assert.equal(onchainOwner.toLowerCase(), owner.address.toLowerCase());
  const resolver = await client.getEnsResolver({ name: parent, blockNumber: blockBefore });
  assert(resolver);
  const node = namehash(parent),
    dnsName = toHex(packetToBytes(parent));
  const before = await client.readContract({
    address: resolver,
    abi,
    functionName: "text",
    args: [node, rescueServiceRecordKey],
    blockNumber: blockBefore,
  });
  assert.equal(
    before,
    "",
    "Dedicated Rescue record already exists; inspect it before any overwrite",
  );
  await client.simulateContract({
    account: owner.address,
    address: resolver,
    abi,
    functionName: "setText",
    args: [node, rescueServiceRecordKey, record("paused")],
  });
  const balance = await client.getBalance({ address: owner.address });
  assert(balance >= parseEther("0.01"), "Insufficient bounded Sepolia demonstration budget");
  console.log(
    JSON.stringify({
      stage: "preflight",
      verified: true,
      parent,
      owner: owner.address,
      resolver,
      recordKey: rescueServiceRecordKey,
      existingRecordEmpty: true,
      ownerCanWrite: true,
      block: String(blockBefore),
      execute,
    }),
  );
  if (!execute) return;

  const journalDir = join(root, ".frontier/ens-rescue-demo");
  const journalPath = join(journalDir, "journal.json");
  assert.equal(
    await access(journalPath).then(
      () => true,
      () => false,
    ),
    false,
    "An existing journal requires reconciliation; do not automatically repeat transactions",
  );
  await mkdir(journalDir, { recursive: true });
  await mkdir(join(root, "secrets"), { recursive: true });
  const delegateKey = generatePrivateKey();
  const delegate = privateKeyToAccount(delegateKey);
  await writeFile(
    join(root, "secrets/ens-rescue-demo-delegate.json"),
    JSON.stringify({ privateKey: delegateKey }),
    { flag: "wx", mode: 0o600 },
  );
  const journal: {
    steps: { label: string; hash: Hex; rawTransaction: Hex; confirmed: boolean }[];
  } = { steps: [] };
  const save = () => writeFile(journalPath, JSON.stringify(journal, null, 2), { mode: 0o600 });
  await save();
  let reservedWei = 0n;
  const transactions: { label: string; hash: Hex; block: string; gasUsed: string }[] = [];
  async function send(
    label: string,
    signer: typeof owner,
    transaction: { to: Hex; data?: Hex; value?: bigint },
  ) {
    const wallet = createWalletClient({
      account: signer,
      chain: sepolia,
      transport: http(env.SEPOLIA_RPC_URL, { retryCount: 0 }),
    });
    const prepared = await wallet.prepareTransactionRequest({
      ...transaction,
      account: signer,
      chain: sepolia,
    });
    const maximum =
      prepared.gas * (prepared.maxFeePerGas ?? prepared.gasPrice ?? 0n) + (transaction.value ?? 0n);
    assert(
      maximum <= parseEther("0.005") && reservedWei + maximum <= parseEther("0.01"),
      "Sepolia fee cap exceeded",
    );
    reservedWei += maximum;
    const rawTransaction = await wallet.signTransaction(prepared);
    const hash = keccak256(rawTransaction);
    const step = { label, hash, rawTransaction, confirmed: false };
    journal.steps.push(step);
    await save();
    assert.equal(await client.sendRawTransaction({ serializedTransaction: rawTransaction }), hash);
    const receipt = await client.waitForTransactionReceipt({
      hash,
      confirmations: 1,
      timeout: 60_000,
    });
    assert.equal(receipt.status, "success");
    step.confirmed = true;
    await save();
    transactions.push({
      label,
      hash,
      block: String(receipt.blockNumber),
      gasUsed: String(receipt.gasUsed),
    });
    console.log(JSON.stringify({ stage: label, hash, status: receipt.status }));
  }
  const { encodeFunctionData } = await import("viem");
  const set = (status: "active" | "paused") => ({
    to: resolver,
    data: encodeFunctionData({
      abi,
      functionName: "setText",
      args: [node, rescueServiceRecordKey, record(status)],
    }),
  });
  const authorize = (grant: boolean) => ({
    to: resolver,
    data: encodeFunctionData({
      abi,
      functionName: "authorizeTextRoles",
      args: [dnsName, rescueServiceRecordKey, delegate.address, grant],
    }),
  });
  let granted = false;
  let report: Record<string, unknown> | undefined;
  try {
    await send("owner-initializes-paused-service", owner, set("paused"));
    await send("fund-delegate-test-gas", owner, {
      to: delegate.address,
      value: parseEther("0.001"),
    });
    await client.simulateContract({
      account: owner.address,
      address: resolver,
      abi,
      functionName: "authorizeTextRoles",
      args: [dnsName, rescueServiceRecordKey, delegate.address, true],
    });
    await send("grant-one-text-key", owner, authorize(true));
    granted = true;
    await send("delegate-activates-service", delegate, set("active"));
    const directory = new EnsRescueServiceDirectory(
      {
        getText: async (name, key) =>
          client.getEnsText({ name, key, blockNumber: await client.getBlockNumber() }),
      },
      [apiOrigin],
    );
    const discovered = await directory.resolve(parent);
    const onboarding = await checkRescuePracticeOnboarding(discovered.apiOrigin);
    assert.equal(onboarding.verified, true);
    await send("delegate-pauses-service", delegate, set("paused"));
    await assert.rejects(directory.resolve(parent), /ENS_RESCUE_SERVICE_PAUSED/);
    await send("delegate-restores-active-service", delegate, set("active"));
    report = {
      schemaVersion: "frontier-ensv2-rescue-demo-v1",
      parent,
      owner: owner.address,
      resolver,
      delegate: delegate.address,
      recordKey: rescueServiceRecordKey,
      beforeRecord: before,
      finalRecord: JSON.parse(record("active")),
      blockBefore: String(blockBefore),
      discovery: discovered,
      onboarding,
      pausedServiceRejected: true,
      otherRecordsChanged: false,
      independentThirdPartyProvider: false,
      paymentsRequested: false,
    };
  } finally {
    if (granted) await send("revoke-one-text-key", owner, authorize(false));
  }
  // Use an eth_call, not a deliberately failing transaction. Only a contract revert
  // is evidence of denial; network errors must not be accepted as permission tests.
  let revokedWriteRejected = false;
  try {
    await client.simulateContract({
      account: delegate.address,
      address: resolver,
      abi,
      functionName: "setText",
      args: [node, rescueServiceRecordKey, record("paused")],
    });
  } catch (error) {
    const { BaseError, ContractFunctionRevertedError } = await import("viem");
    revokedWriteRejected =
      error instanceof BaseError &&
      error.walk((e) => e instanceof ContractFunctionRevertedError) instanceof
        ContractFunctionRevertedError;
  }
  assert(revokedWriteRejected);
  await writeFile(
    join(root, "Docs/evidence/deployments/ensv2-rescue-demo.json"),
    JSON.stringify(
      {
        ...report,
        checkedAt: new Date().toISOString(),
        transactions,
        revokedWriteRejected,
        rejectionMethod: "eth_call",
        finalDelegatePermission: "revoked",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify({
      verified: true,
      revokedWriteRejected,
      evidence: "Docs/evidence/deployments/ensv2-rescue-demo.json",
    }),
  );
}
main().catch(() => {
  console.error(
    "ENS_RESCUE_DEMO_STOPPED: inspect the scoped journal before retry; no key or raw RPC error printed",
  );
  process.exitCode = 1;
});
