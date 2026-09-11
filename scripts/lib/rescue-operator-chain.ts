import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  encodeDeployData,
  encodeFunctionData,
  formatEther,
  getContractAddress,
  http,
  keccak256,
  parseEther,
  parseGwei,
  parseTransaction,
  recoverTransactionAddress,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { rescueServices } from "../../packages/rescue-room/src/index";

export const rescueOperatorBudget = {
  maximumEth: "1",
  maximumModelUsd: 5,
  maxFeePerGas: parseGwei("10"),
  maxGas: 4_000_000n,
  roleFunding: parseEther("0.003"),
} as const;

export type RescueOperatorKeys = {
  schemaVersion: "rescue-operator-keys-v1";
  commander: Hex;
  executor: Hex;
  attestor: Hex;
  providers: Record<string, Hex>;
};

/** Generated secrets are saved BEFORE funding. Never include this return value in logs. */
export function loadOrCreateRescueOperatorKeys(file: string): RescueOperatorKeys {
  if (existsSync(file)) {
    const value = JSON.parse(readFileSync(file, "utf8")) as RescueOperatorKeys;
    if (value.schemaVersion !== "rescue-operator-keys-v1") throw new Error("KEY_SCHEMA_INVALID");
    if (
      !value.providers ||
      Object.keys(value.providers).sort().join(",") !==
        rescueServices
          .map((s) => s.id)
          .sort()
          .join(",")
    )
      throw new Error("KEY_PROVIDER_SET_INVALID");
    const keys = [
      value.commander,
      value.executor,
      value.attestor,
      ...rescueServices.map((s) => value.providers[s.id]),
    ];
    if (keys.some((k) => typeof k !== "string" || !/^0x[0-9a-f]{64}$/.test(k)))
      throw new Error("KEY_FORMAT_INVALID");
    if (new Set(keys).size !== keys.length) throw new Error("KEY_ROLES_OVERLAP");
    keys.forEach((k) => privateKeyToAccount(k!));
    return value;
  }
  const keys: RescueOperatorKeys = {
    schemaVersion: "rescue-operator-keys-v1",
    commander: generatePrivateKey(),
    executor: generatePrivateKey(),
    attestor: generatePrivateKey(),
    providers: Object.fromEntries(rescueServices.map((s) => [s.id, generatePrivateKey()])),
  };
  persistNewJson(file, keys);
  return keys;
}

export function persistNewJson(file: string, value: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  const fd = openSync(file, "wx", 0o600);
  try {
    writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

export async function compileRescuePaymentContracts(root: string) {
  const contractRoot = resolve(root, "packages/contracts");
  const solc = (await import("solc")).default as {
    version(): string;
    compile(
      input: string,
      callbacks: { import(path: string): { contents?: string; error?: string } },
    ): string;
  };
  if (!solc.version().startsWith("0.8.30+")) throw new Error("UNEXPECTED_SOLC_VERSION");
  const sources = Object.fromEntries(
    ["RescueUSDDemo.sol", "RescueServiceEscrow.sol"].map((name) => [
      name,
      { content: readFileSync(resolve(contractRoot, "src", name), "utf8") },
    ]),
  );
  const input = {
    language: "Solidity",
    sources,
    settings: {
      evmVersion: "cancun",
      optimizer: { enabled: true, runs: 200 },
      metadata: { appendCBOR: false, bytecodeHash: "none" },
      outputSelection: {
        "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] },
      },
    },
  };
  const importedSources: Record<string, string> = {};
  const output = JSON.parse(
    solc.compile(JSON.stringify(input), {
      import(path) {
        for (const candidate of [
          resolve(contractRoot, "src", path),
          resolve(contractRoot, "node_modules", path),
        ]) {
          if (existsSync(candidate)) {
            const contents = readFileSync(candidate, "utf8");
            importedSources[path] = contents;
            return { contents };
          }
        }
        return { error: "Import unavailable" };
      },
    }),
  ) as {
    errors?: { severity: string }[];
    contracts: Record<
      string,
      Record<
        string,
        {
          abi: Abi;
          evm: { bytecode: { object: string }; deployedBytecode: { object: string } };
        }
      >
    >;
  };
  if (output.errors?.some((e) => e.severity === "error"))
    throw new Error("RESCUE_CONTRACT_COMPILATION_FAILED");
  const artifact = (name: string) => {
    const result = output.contracts[`${name}.sol`]?.[name];
    if (!result?.evm.bytecode.object) throw new Error("NO_DEPLOYABLE_BYTECODE");
    return { abi: result.abi, bytecode: `0x${result.evm.bytecode.object}` as Hex };
  };
  return {
    token: artifact("RescueUSDDemo"),
    escrow: artifact("RescueServiceEscrow"),
    compiler: solc.version(),
    sourceHash: `0x${createHash("sha256")
      .update(
        JSON.stringify({
          input,
          importedSources: Object.fromEntries(
            Object.entries(importedSources).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
          ),
        }),
      )
      .digest("hex")}`,
  };
}

type TransactionRequest = { to?: Address; data?: Hex; value?: bigint };
type SavedTransaction = {
  schemaVersion: "rescue-operator-transaction-v1";
  key: string;
  from: Address;
  to: Address | null;
  data: Hex;
  value: string;
  nonce: number;
  maximumCostWei: string;
  transactionHash: Hex;
  serializedTransaction: Hex;
};

export async function validateRescueOperatorTransaction(value: unknown): Promise<SavedTransaction> {
  const saved = value as SavedTransaction;
  if (
    !saved ||
    saved.schemaVersion !== "rescue-operator-transaction-v1" ||
    !/^[a-z0-9-]{1,100}$/.test(saved.key) ||
    !Number.isSafeInteger(saved.nonce) ||
    saved.nonce < 0 ||
    !/^(0|[1-9][0-9]*)$/.test(saved.value) ||
    !/^[1-9][0-9]*$/.test(saved.maximumCostWei)
  )
    throw new Error("TRANSACTION_JOURNAL_INVALID");
  const tx = parseTransaction(saved.serializedTransaction);
  if (!saved.serializedTransaction.startsWith("0x02")) throw new Error("TRANSACTION_TYPE_INVALID");
  const sender = await recoverTransactionAddress({
    serializedTransaction: saved.serializedTransaction as `0x02${string}`,
  });
  if (
    tx.type !== "eip1559" ||
    tx.chainId !== sepolia.id ||
    sender.toLowerCase() !== saved.from.toLowerCase() ||
    tx.to?.toLowerCase() !== saved.to?.toLowerCase() ||
    (tx.data ?? "0x") !== saved.data ||
    (tx.value ?? 0n) !== BigInt(saved.value) ||
    tx.nonce !== saved.nonce ||
    !tx.gas ||
    tx.gas > rescueOperatorBudget.maxGas ||
    !tx.maxFeePerGas ||
    tx.maxFeePerGas > rescueOperatorBudget.maxFeePerGas ||
    tx.maxPriorityFeePerGas === undefined ||
    tx.maxPriorityFeePerGas > tx.maxFeePerGas ||
    BigInt(saved.maximumCostWei) !== (tx.value ?? 0n) + tx.gas * tx.maxFeePerGas ||
    keccak256(saved.serializedTransaction) !== saved.transactionHash
  )
    throw new Error("TRANSACTION_JOURNAL_SIGNATURE_MISMATCH");
  return saved;
}

type OperatorNonceReservation = Pick<SavedTransaction, "from" | "nonce">;

/** Call only after each journal entry's serialized transaction/signature was verified. */
export function assertRescueOperatorJournalNonces(
  journal: readonly OperatorNonceReservation[],
): void {
  const occupied = new Set<string>();
  for (const saved of journal) {
    if (!Number.isSafeInteger(saved.nonce) || saved.nonce < 0)
      throw new Error("TRANSACTION_JOURNAL_NONCE_INVALID");
    const key = `${saved.from.toLowerCase()}:${saved.nonce}`;
    if (occupied.has(key)) throw new Error("TRANSACTION_JOURNAL_DUPLICATE_SIGNER_NONCE");
    occupied.add(key);
  }
}

/**
 * New labels never replace or skip over a durable signed transaction. If the RPC pending
 * nonce has not passed every saved reservation for this signer, stop for reconciliation.
 * Retrying an existing label uses its exact saved bytes and does not call this selector.
 */
export function rescueOperatorNewTransactionNonce(
  journal: readonly OperatorNonceReservation[],
  signer: Address,
  pendingNonce: number,
): number {
  assertRescueOperatorJournalNonces(journal);
  if (!Number.isSafeInteger(pendingNonce) || pendingNonce < 0)
    throw new Error("INVALID_PENDING_SIGNER_NONCE");
  if (
    journal.some(
      (saved) => saved.from.toLowerCase() === signer.toLowerCase() && saved.nonce >= pendingNonce,
    )
  )
    throw new Error("UNRESOLVED_SIGNER_NONCE_RECONCILE_REQUIRED");
  return pendingNonce;
}

/**
 * Single-operator deployment journal, not the participant payment executor.
 * Caller holds the whole-operation exclusive lock. Every signed tx is durable before send.
 * All prepared maximum fees + value remain reserved, even after a cheap confirmed receipt.
 */
export function createRescueOperatorChain(rpcUrl: string, directory: string) {
  const client = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl, { retryCount: 0, timeout: 15_000 }),
  });
  mkdirSync(directory, { recursive: true });
  const publicReceipts: {
    key: string;
    transactionHash: Hex;
    blockNumber: string;
    gasCostWei: string;
    valueWei: string;
  }[] = [];

  async function send(key: string, account: PrivateKeyAccount, request: TransactionRequest) {
    if (!/^[a-z0-9-]{1,100}$/.test(key)) throw new Error("INVALID_TRANSACTION_LABEL");
    if ((await client.getChainId()) !== sepolia.id) throw new Error("NOT_SEPOLIA");
    const { readdirSync } = await import("node:fs");
    const journal = await Promise.all(
      readdirSync(directory)
        .filter((f) => f.endsWith(".json"))
        .map(async (f) => {
          const record = await validateRescueOperatorTransaction(
            JSON.parse(readFileSync(resolve(directory, f), "utf8")),
          );
          if (f !== `${record.key}.json`) throw new Error("JOURNAL_FILENAME_MISMATCH");
          return record;
        }),
    );
    assertRescueOperatorJournalNonces(journal);
    const reserved = journal.reduce((total, tx) => total + BigInt(tx.maximumCostWei), 0n);
    if (reserved > parseEther("0.75")) throw new Error("OPERATOR_BUDGET_EXCEEDED");
    const path = resolve(directory, `${key}.json`);
    let saved: SavedTransaction;
    if (existsSync(path)) {
      saved = await validateRescueOperatorTransaction(JSON.parse(readFileSync(path, "utf8")));
      if (
        saved.from.toLowerCase() !== account.address.toLowerCase() ||
        saved.to?.toLowerCase() !== request.to?.toLowerCase() ||
        saved.data !== (request.data ?? "0x") ||
        saved.value !== String(request.value ?? 0n) ||
        saved.key !== key ||
        saved.schemaVersion !== "rescue-operator-transaction-v1" ||
        keccak256(saved.serializedTransaction) !== saved.transactionHash
      )
        throw new Error("TRANSACTION_JOURNAL_CONFLICT");
    } else {
      const gas = ((await client.estimateGas({ account, ...request })) * 12n) / 10n + 10_000n;
      if (gas > rescueOperatorBudget.maxGas) throw new Error("GAS_LIMIT_EXCEEDED");
      const fee = await client.estimateFeesPerGas();
      if (fee.maxFeePerGas > rescueOperatorBudget.maxFeePerGas)
        throw new Error("GAS_PRICE_LIMIT_EXCEEDED");
      const maxFeePerGas = rescueOperatorBudget.maxFeePerGas;
      const maxPriorityFeePerGas =
        fee.maxPriorityFeePerGas > parseGwei("1") ? parseGwei("1") : fee.maxPriorityFeePerGas;
      const maximumCost = gas * maxFeePerGas + (request.value ?? 0n);
      // Leave a separate 0.25 ETH envelope for the delegated service-payment executor.
      if (reserved + maximumCost > parseEther("0.75")) throw new Error("OPERATOR_BUDGET_EXCEEDED");
      if ((await client.getBalance({ address: account.address })) < maximumCost)
        throw new Error("INSUFFICIENT_ROLE_BALANCE");
      const nonce = rescueOperatorNewTransactionNonce(
        journal,
        account.address,
        await client.getTransactionCount({ address: account.address, blockTag: "pending" }),
      );
      const wallet = createWalletClient({
        account,
        chain: sepolia,
        transport: http(rpcUrl, { retryCount: 0 }),
      });
      const serializedTransaction = await wallet.signTransaction({
        ...request,
        gas,
        nonce,
        maxFeePerGas,
        maxPriorityFeePerGas,
        type: "eip1559",
      });
      saved = {
        schemaVersion: "rescue-operator-transaction-v1",
        key,
        from: account.address,
        to: request.to ?? null,
        data: request.data ?? "0x",
        value: String(request.value ?? 0n),
        nonce,
        maximumCostWei: String(maximumCost),
        serializedTransaction,
        transactionHash: keccak256(serializedTransaction),
      };
      persistNewJson(path, saved);
    }
    let receipt = await client
      .getTransactionReceipt({ hash: saved.transactionHash })
      .catch(() => null);
    if (!receipt) {
      // A dropped response may mean the node already accepted this SAME signed transaction.
      await client
        .sendRawTransaction({ serializedTransaction: saved.serializedTransaction })
        .catch(() => undefined);
      receipt = await client.waitForTransactionReceipt({
        hash: saved.transactionHash,
        confirmations: 2,
        timeout: 120_000,
      });
    }
    receipt = await client.waitForTransactionReceipt({
      hash: saved.transactionHash,
      confirmations: 2,
      timeout: 120_000,
    });
    if (receipt.status !== "success") throw new Error("TRANSACTION_REVERTED_RECONCILE_REQUIRED");
    publicReceipts.push({
      key,
      transactionHash: receipt.transactionHash,
      blockNumber: String(receipt.blockNumber),
      gasCostWei: String(receipt.gasUsed * receipt.effectiveGasPrice),
      valueWei: saved.value,
    });
    return {
      receipt,
      expectedContractAddress: getContractAddress({
        from: account.address,
        nonce: BigInt(saved.nonce),
      }),
    };
  }
  return { client, send, publicReceipts };
}

export async function deployRescueOperator(input: {
  root: string;
  rpcUrl: string;
  deployer: PrivateKeyAccount;
  keys: RescueOperatorKeys;
  directory: string;
}) {
  const { root, rpcUrl, deployer, keys, directory } = input;
  const artifacts = await compileRescuePaymentContracts(root);
  const chain = createRescueOperatorChain(rpcUrl, resolve(directory, "deployment-transactions"));
  const commander = privateKeyToAccount(keys.commander);
  const executor = privateKeyToAccount(keys.executor);
  const attestor = privateKeyToAccount(keys.attestor);
  const providers = Object.fromEntries(
    Object.entries(keys.providers).map(([id, key]) => [id, privateKeyToAccount(key).address]),
  );
  if (
    Object.values(providers).some(
      (address) => address.toLowerCase() === deployer.address.toLowerCase(),
    )
  )
    throw new Error("DEPLOYER_PROVIDER_OVERLAP");
  if ([commander, executor, attestor].some((a) => a.address === deployer.address))
    throw new Error("DEPLOYER_ROLE_OVERLAP");
  const tokenResult = await chain.send("deploy-token", deployer, {
    data: encodeDeployData({ ...artifacts.token, args: [deployer.address] }),
  });
  const token = tokenResult.receipt.contractAddress;
  if (!token || token.toLowerCase() !== tokenResult.expectedContractAddress.toLowerCase())
    throw new Error("TOKEN_ADDRESS_MISMATCH");
  const escrowResult = await chain.send("deploy-escrow", deployer, {
    data: encodeDeployData({
      ...artifacts.escrow,
      args: [
        deployer.address,
        token,
        executor.address,
        attestor.address,
        50_000_000n,
        100_000_000n,
      ],
    }),
  });
  const escrow = escrowResult.receipt.contractAddress;
  if (!escrow || escrow.toLowerCase() !== escrowResult.expectedContractAddress.toLowerCase())
    throw new Error("ESCROW_ADDRESS_MISMATCH");
  for (const [id, address] of Object.entries(providers)) {
    await chain.send(`allow-${id}`, deployer, {
      to: escrow,
      data: encodeFunctionData({
        abi: artifacts.escrow.abi,
        functionName: "setProvider",
        args: [address, true],
      }),
    });
  }
  await chain.send("mint-commander-demo-token", deployer, {
    to: token,
    data: encodeFunctionData({
      abi: artifacts.token.abi,
      functionName: "mint",
      args: [commander.address, 100_000_000n],
    }),
  });
  for (const [role, account] of [
    ["commander", commander],
    ["executor", executor],
    ["attestor", attestor],
  ] as const) {
    await chain.send(`fund-${role}-gas`, deployer, {
      to: account.address,
      value: rescueOperatorBudget.roleFunding,
    });
  }
  const read = (address: Address, abi: Abi, functionName: string, args: unknown[] = []) =>
    chain.client.readContract({ address, abi, functionName, args });
  if (
    String(await read(escrow, artifacts.escrow.abi, "paymentToken")).toLowerCase() !==
      token.toLowerCase() ||
    String(await read(escrow, artifacts.escrow.abi, "policyExecutor")).toLowerCase() !==
      executor.address.toLowerCase() ||
    String(await read(escrow, artifacts.escrow.abi, "deliveryAttestor")).toLowerCase() !==
      attestor.address.toLowerCase() ||
    (await read(token, artifacts.token.abi, "decimals")) !== 6
  )
    throw new Error("DEPLOYMENT_CONFIG_MISMATCH");
  const tokenCode = await chain.client.getCode({ address: token });
  const escrowCode = await chain.client.getCode({ address: escrow });
  if (!tokenCode || tokenCode === "0x" || !escrowCode || escrowCode === "0x")
    throw new Error("MISSING_CONTRACT_CODE");
  const evidence = {
    schemaVersion: "rescue-sepolia-operator-deployment-v1",
    network: "sepolia",
    chainId: sepolia.id,
    evidenceState: "committed",
    operatorControlledRoles: true,
    monetaryValueClaim: false,
    token: { address: token, symbol: "rUSD-DEMO", decimals: 6, codeHash: keccak256(tokenCode) },
    escrow: { address: escrow, codeHash: keccak256(escrowCode) },
    owner: deployer.address,
    commander: commander.address,
    executor: executor.address,
    attestor: attestor.address,
    providers,
    compiler: artifacts.compiler,
    compilerInputHash: artifacts.sourceHash,
    transactions: chain.publicReceipts,
    deploymentGasCostEth: formatEther(
      chain.publicReceipts.reduce((n, t) => n + BigInt(t.gasCostWei), 0n),
    ),
    roleGasFundingEth: "0.009",
  };
  const evidencePath = resolve(directory, "deployment.json");
  if (!existsSync(evidencePath)) persistNewJson(evidencePath, evidence);
  return evidence;
}
