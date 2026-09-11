import { appendFile, mkdtemp, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildRescueRunPaymentEvidence,
  createRescueEpisodeSession,
  generateRescueEpisode,
  rescueEpisodeHash,
  rescuePublicViewHash,
  rescueServiceManifestHash,
  type RescuePaymentPolicy,
  type RescuePaymentPurchase,
} from "@frontier/rescue-room";
import {
  encodeAbiParameters,
  encodeEventTopics,
  erc20Abi,
  keccak256,
  parseAbiParameters,
  parseTransaction,
  type Hex,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it, vi } from "vitest";
import {
  createRescuePaymentExecutor,
  type RescuePaymentChainPort,
  type RescuePaymentExecutorLimits,
  type RescuePaymentReceipt,
} from "./rescue-payment-executor";
import { createRescuePaymentFileStore } from "./rescue-payment-executor-store";
import {
  createRescuePaymentViemChain,
  rescuePaymentExecutorEscrowAbi,
} from "./rescue-payment-executor-viem";

// Public deterministic test keys only. These wallets must never receive real funds.
const commander = privateKeyToAccount(`0x${"1".repeat(64)}`);
const executorAccount = privateKeyToAccount(`0x${"2".repeat(64)}`);
const attestor = privateKeyToAccount(`0x${"3".repeat(64)}`);
const hash = `0x${"1".repeat(64)}` as const;
const otherHash = `0x${"2".repeat(64)}` as const;
const address = (n: number) => `0x${String(n).repeat(40)}`;
const now = 1_800_000_000;
const limits: RescuePaymentExecutorLimits = {
  maximumTotalFeeWei: "1000000000000000",
  maximumTransactionFeeWei: "100000000000000",
  maximumGas: "500000",
  maximumFeePerGasWei: "100000000",
  maximumPriorityFeePerGasWei: "10000000",
  requiredConfirmations: 2,
};

async function fixture(overrides: Partial<RescuePaymentExecutorLimits> = {}) {
  const episode = generateRescueEpisode("durable-payment-executor-test");
  const session = createRescueEpisodeSession(episode);
  const captures = [0, 1, 2].map(() => {
    const action = { type: "BUY_SERVICE" as const, serviceId: "pulse-monitor" as const };
    const view = session.getPublicView();
    const step = session.takeAction(action);
    return {
      accepted: step.accepted as true,
      action,
      decision: view.actions.length + 1,
      publicViewHash: rescuePublicViewHash(view),
    };
  });
  const evidence = buildRescueRunPaymentEvidence(session.finish(), hash);
  const purchases: RescuePaymentPurchase[] = captures.map((capture, i) => ({
    ...capture,
    order: evidence.orders[i]!,
    policyNonce: String(i),
    deadlineUnixSeconds: now + 120,
  }));
  const policy: RescuePaymentPolicy = {
    schemaVersion: "rescue-payment-policy-v0",
    chainId: 11155111,
    tokenAddress: address(2),
    escrowAddress: address(3),
    commanderWallet: commander.address,
    evaluationContextHash: hash,
    episodeHash: rescueEpisodeHash(episode),
    maximumOrderAmount: "5000000",
    maximumEpisodeAmount: "10000000",
    validFromUnixSeconds: now - 10,
    validUntilUnixSeconds: now + 600,
    maximumOrderLifetimeSeconds: 180,
    services: [
      {
        serviceId: "pulse-monitor",
        providerAddress: address(5),
        serviceManifestHash: rescueServiceManifestHash("pulse-monitor"),
      },
    ],
  };
  const directory = await mkdtemp(join(tmpdir(), "rescue-payment-executor-test-"));
  const store = createRescuePaymentFileStore(directory);
  const receipts = new Map<Hex, RescuePaymentReceipt>();
  const sent: Hex[] = [];
  const concrete = createRescuePaymentViemChain({
    publicClient: {} as PublicClient,
    accounts: { commander, policyExecutor: executorAccount, deliveryAttestor: attestor },
    expectedTokenCodeHash: hash,
    expectedEscrowCodeHash: hash,
  });
  const chain: RescuePaymentChainPort = {
    chainId: vi.fn(async () => 11155111),
    callFor: concrete.callFor,
    preflight: vi.fn(async () => {}),
    pendingNonce: vi.fn(async () => 0),
    prepareSigned: vi.fn(async (call, nonce) => {
      const account = [commander, executorAccount, attestor].find(
        (a) => a.address.toLowerCase() === call.from.toLowerCase(),
      )!;
      return account.signTransaction({
        chainId: 11155111,
        type: "eip1559",
        to: call.to,
        data: call.data,
        nonce,
        value: 0n,
        gas: 100000n,
        maxFeePerGas: 10000000n,
        maxPriorityFeePerGas: 1000000n,
      });
    }),
    broadcast: vi.fn(async (raw) => {
      sent.push(raw);
      return keccak256(raw);
    }),
    receipt: vi.fn(async (_record, tx) => receipts.get(tx.transactionHash) ?? null),
  };
  const options = { store, chain, limits: { ...limits, ...overrides } };
  const executor = createRescuePaymentExecutor(options);
  const record = await executor.reserve(policy, purchases[0]!, now);
  const confirm = (transactionHash: Hex, status: "confirmed" | "reverted" = "confirmed") =>
    receipts.set(transactionHash, {
      transactionHash,
      blockHash: hash,
      blockNumber: "10",
      status,
      verifiedEvent: status === "confirmed",
    });
  return {
    executor,
    options,
    policy,
    purchases,
    record,
    directory,
    chain,
    sent,
    receipts,
    confirm,
  };
}

describe("durable Rescue payment executor", () => {
  it("never races a prepared release against a timeout refund", async () => {
    const f = await fixture();
    await f.executor.execute(
      f.record.key,
      { kind: "release", deliverableHash: hash, receiptHash: hash, acceptanceHash: hash },
      now,
    );
    await expect(
      f.executor.execute(f.record.key, { kind: "refundExpired" }, now + 121),
    ).rejects.toThrow("Another payment disposition is signed");
  });

  it("fails closed on a torn journal append", async () => {
    const f = await fixture();
    await appendFile(join(f.directory, "payments.jsonl"), '{"sequence":2', "utf8");
    await expect(f.executor.inspect(f.record.key)).rejects.toThrow("Truncated payment journal");
  });

  it("fails closed on an invalid hash-chain entry", async () => {
    const f = await fixture();
    await appendFile(
      join(f.directory, "payments.jsonl"),
      JSON.stringify({
        sequence: 2,
        previousHash: "genesis",
        state: { version: 1, limits: null, records: {} },
        hash,
      }) + "\n",
      "utf8",
    );
    await expect(f.executor.inspect(f.record.key)).rejects.toThrow("Invalid payment journal");
  });
  it("persists reservation across independent instances and idempotent expired retries", async () => {
    const f = await fixture();
    const restarted = createRescuePaymentExecutor({
      ...f.options,
      store: createRescuePaymentFileStore(f.directory),
    });
    expect(await restarted.reserve(f.policy, f.purchases[0]!, now + 9999)).toEqual(f.record);
    expect(await restarted.inspect(f.record.key)).toEqual(f.record);
    expect(f.chain.prepareSigned).not.toHaveBeenCalled();
  });

  it("retains cumulative budget after restart and rejects a third purchase", async () => {
    const f = await fixture();
    await f.executor.reserve(f.policy, f.purchases[1]!, now);
    const restarted = createRescuePaymentExecutor(f.options);
    await expect(restarted.reserve(f.policy, f.purchases[2]!, now)).rejects.toThrow(
      "Episode limit exceeded",
    );
  });

  it("cannot reset wallet+episode budget through a different policy or Escrow", async () => {
    const f = await fixture();
    await expect(
      f.executor.reserve({ ...f.policy, escrowAddress: address(6) }, f.purchases[1]!, now),
    ).rejects.toThrow("different payment policy");
  });

  it("rejects forged order and conflicting retry input without signing", async () => {
    const f = await fixture();
    const purchase = structuredClone(f.purchases[1]!);
    purchase.order.amountCredits += 1;
    await expect(f.executor.reserve(f.policy, purchase, now)).rejects.toThrow(
      "price or delivery time mismatch",
    );
    await expect(
      f.executor.reserve(f.policy, { ...f.purchases[0]!, deadlineUnixSeconds: now + 121 }, now),
    ).rejects.toThrow("Conflicting Payment Order retry");
    expect(f.chain.prepareSigned).not.toHaveBeenCalled();
  });

  it("durably saves the signed bytes before the first broadcast", async () => {
    const f = await fixture();
    f.chain.broadcast = vi.fn(async (raw) => {
      const journal = await readFile(join(f.directory, "payments.jsonl"), "utf8");
      expect(journal).toContain(raw);
      expect(journal).toContain('"status":"prepared"');
      return keccak256(raw);
    });
    const result = await f.executor.execute(f.record.key, { kind: "fund" }, now);
    expect(result.status).toBe("broadcast");
    expect(parseTransaction(result.rawTransaction).chainId).toBe(11155111);
  });

  it("replays identical signed bytes after ambiguous send failure and restart", async () => {
    const f = await fixture();
    let first = "";
    f.chain.broadcast = vi.fn(async (raw) => {
      first = raw;
      throw new Error("RPC response lost after acceptance");
    });
    await expect(f.executor.execute(f.record.key, { kind: "fund" }, now)).rejects.toThrow(
      "RPC response lost",
    );
    f.chain.broadcast = vi.fn(async (raw) => {
      expect(raw).toBe(first);
      return keccak256(raw);
    });
    const restarted = createRescuePaymentExecutor(f.options);
    await restarted.execute(f.record.key, { kind: "fund" }, now + 1);
    expect(f.chain.prepareSigned).toHaveBeenCalledTimes(1);
  });

  it("reconciles mined success after a lost response without rebroadcast", async () => {
    const f = await fixture();
    f.chain.broadcast = vi.fn(async (raw) => {
      f.confirm(keccak256(raw));
      throw new Error("response lost");
    });
    await expect(f.executor.execute(f.record.key, { kind: "fund" }, now)).rejects.toThrow();
    const result = await f.executor.execute(f.record.key, { kind: "fund" }, now + 1);
    expect(result.status).toBe("confirmed");
    expect(f.chain.broadcast).toHaveBeenCalledTimes(1);
  });

  it("does not prepare another transaction for a reverted operation", async () => {
    const f = await fixture();
    const first = await f.executor.execute(f.record.key, { kind: "fund" }, now);
    f.confirm(first.transactionHash, "reverted");
    expect((await f.executor.execute(f.record.key, { kind: "fund" }, now)).status).toBe("reverted");
    expect(f.chain.prepareSigned).toHaveBeenCalledTimes(1);
    expect(f.sent).toHaveLength(1);
  });

  it("downgrades a previously confirmed receipt removed by a reorg", async () => {
    const f = await fixture();
    const first = await f.executor.execute(f.record.key, { kind: "fund" }, now);
    f.confirm(first.transactionHash);
    await f.executor.execute(f.record.key, { kind: "fund" }, now);
    f.receipts.clear();
    const result = await f.executor.execute(f.record.key, { kind: "fund" }, now);
    expect(result.status).toBe("broadcast");
    expect(result.receipt).toBeUndefined();
    expect(f.chain.prepareSigned).toHaveBeenCalledTimes(1);
  });

  it("rejects changed evidence on a delivery operation retry", async () => {
    const f = await fixture();
    await f.executor.execute(
      f.record.key,
      { kind: "recordDelivery", deliverableHash: hash, receiptHash: hash },
      now,
    );
    await expect(
      f.executor.execute(
        f.record.key,
        { kind: "recordDelivery", deliverableHash: otherHash, receiptHash: hash },
        now,
      ),
    ).rejects.toThrow("Conflicting payment operation retry");
  });

  it("rejects the wrong chain before signing or broadcasting", async () => {
    const f = await fixture();
    f.chain.chainId = async () => 1;
    await expect(f.executor.execute(f.record.key, { kind: "fund" }, now)).rejects.toThrow(
      "Sepolia",
    );
    expect(f.chain.prepareSigned).not.toHaveBeenCalled();
    expect(f.sent).toHaveLength(0);
  });

  it("refuses new expired actions and premature refunds", async () => {
    const f = await fixture();
    await expect(f.executor.execute(f.record.key, { kind: "fund" }, now + 120)).rejects.toThrow(
      "expired",
    );
    await expect(
      f.executor.execute(f.record.key, { kind: "refundExpired" }, now + 120),
    ).rejects.toThrow("deadline not reached");
    await expect(
      f.executor.execute(
        f.record.key,
        { kind: "release", deliverableHash: hash, receiptHash: hash, acceptanceHash: hash },
        now + 120,
      ),
    ).rejects.toThrow("must be refunded");
  });

  it("rejects zero delivery hashes and unknown operation properties", async () => {
    const f = await fixture();
    await expect(
      f.executor.execute(
        f.record.key,
        { kind: "recordDelivery", deliverableHash: `0x${"0".repeat(64)}`, receiptHash: hash },
        now,
      ),
    ).rejects.toThrow("evidence hash");
    await expect(
      f.executor.execute(f.record.key, { kind: "fund", value: "100" } as never, now),
    ).rejects.toThrow("Invalid payment operation");
  });

  it("reserves signer nonces across orders, even before broadcast acceptance", async () => {
    const f = await fixture();
    const second = await f.executor.reserve(f.policy, f.purchases[1]!, now);
    const a = await f.executor.execute(f.record.key, { kind: "fund" }, now);
    const b = await f.executor.execute(second.key, { kind: "fund" }, now);
    expect([a.nonce, b.nonce]).toEqual([0, 1]);
  });

  it("isolates signer nonces between Commander and Attestor", async () => {
    const f = await fixture();
    const a = await f.executor.execute(f.record.key, { kind: "fund" }, now);
    const b = await f.executor.execute(
      f.record.key,
      { kind: "recordDelivery", deliverableHash: hash, receiptHash: hash },
      now,
    );
    expect([a.nonce, b.nonce]).toEqual([0, 0]);
    expect(a.call.from).not.toEqual(b.call.from);
  });

  it("reserves worst-case gas cumulatively across all roles", async () => {
    const f = await fixture({
      maximumTransactionFeeWei: "1000000000000",
      maximumTotalFeeWei: "1000000000000",
    });
    await f.executor.execute(f.record.key, { kind: "fund" }, now);
    await expect(
      f.executor.execute(
        f.record.key,
        { kind: "recordDelivery", deliverableHash: hash, receiptHash: hash },
        now,
      ),
    ).rejects.toThrow("gas budget exceeded");
    expect(f.sent).toHaveLength(1);
  });

  it("refuses changed fee limits when reopening a journal", async () => {
    const f = await fixture();
    const changed = createRescuePaymentExecutor({
      ...f.options,
      limits: { ...limits, maximumTotalFeeWei: "2000000000000000" },
    });
    await expect(changed.execute(f.record.key, { kind: "fund" }, now)).rejects.toThrow(
      "limits changed",
    );
  });

  it.each(["to", "data", "value", "chainId", "nonce", "gas", "maxFeePerGas"])(
    "rejects a signer changing %s",
    async (field) => {
      const f = await fixture();
      f.chain.prepareSigned = async (call, nonce) =>
        commander.signTransaction({
          chainId: field === "chainId" ? 1 : 11155111,
          type: "eip1559",
          to: field === "to" ? (address(7) as Hex) : call.to,
          data: field === "data" ? "0x1234" : call.data,
          value: field === "value" ? 1n : 0n,
          nonce: field === "nonce" ? nonce + 1 : nonce,
          gas: field === "gas" ? 10000000n : 100000n,
          maxFeePerGas: field === "maxFeePerGas" ? 999999999n : 10000000n,
          maxPriorityFeePerGas: 1000000n,
        });
      await expect(f.executor.execute(f.record.key, { kind: "fund" }, now)).rejects.toThrow(
        "violates",
      );
      expect(f.sent).toHaveLength(0);
    },
  );

  it("rejects a receipt that has no verified expected event", async () => {
    const f = await fixture();
    const first = await f.executor.execute(f.record.key, { kind: "fund" }, now);
    f.receipts.set(first.transactionHash, {
      transactionHash: first.transactionHash,
      blockHash: hash,
      blockNumber: "10",
      status: "confirmed",
      verifiedEvent: false,
    });
    await expect(f.executor.execute(f.record.key, { kind: "fund" }, now)).rejects.toThrow(
      "receipt evidence mismatch",
    );
  });

  it("rejects concurrent access instead of allocating the same nonce twice", async () => {
    const f = await fixture();
    let unlock!: () => void;
    let locked!: () => void;
    const entered = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const pending = createRescuePaymentFileStore(f.directory).exclusive(async () => {
      locked();
      await new Promise<void>((resolve) => {
        unlock = resolve;
      });
    });
    await entered;
    await expect(f.executor.execute(f.record.key, { kind: "fund" }, now)).rejects.toThrow(
      "journal locked",
    );
    unlock();
    await pending;
    expect((await f.executor.execute(f.record.key, { kind: "fund" }, now)).nonce).toBe(0);
  });

  it("does not reclaim an abandoned lock automatically", async () => {
    const f = await fixture();
    await mkdir(join(f.directory, "executor.lock"));
    await expect(f.executor.inspect(f.record.key)).rejects.toThrow("abandoned lock");
  });

  it("leaves no broadcast when durable persistence fails", async () => {
    const f = await fixture();
    const failing = createRescuePaymentExecutor({
      ...f.options,
      store: {
        exclusive: (run) =>
          f.options.store.exclusive((state) =>
            run(state, async () => {
              throw new Error("disk full");
            }),
          ),
      },
    });
    await expect(failing.execute(f.record.key, { kind: "fund" }, now)).rejects.toThrow("disk full");
    expect(f.sent).toHaveLength(0);
    expect((await f.executor.inspect(f.record.key))?.transactions.fund).toBeUndefined();
  });
});

describe("actual viem adapter validation with local RPC fixtures only", () => {
  async function adapterFixture() {
    const f = await fixture();
    const code = "0x6000" as const;
    const rpc = {
      getCode: vi.fn(async () => code),
      getBlock: vi.fn(async () => ({ timestamp: BigInt(now), hash, number: 10n })),
      getBlockNumber: vi.fn(async () => 11n),
      readContract: vi.fn(async ({ functionName }: { functionName: string }): Promise<unknown> => {
        switch (functionName) {
          case "paymentToken":
            return f.policy.tokenAddress;
          case "policyExecutor":
            return executorAccount.address;
          case "deliveryAttestor":
            return attestor.address;
          case "maximumOrderAmount":
            return 5000000n;
          case "maximumEpisodeAmount":
            return 10000000n;
          case "allowedProviders":
            return true;
          case "decimals":
            return 6;
          case "getOrder":
            return { state: 0 };
          case "balanceOf":
            return 10000000n;
          case "allowance":
            return 10000000n;
          default:
            throw new Error("Unexpected fixture read");
        }
      }),
      getTransactionReceipt: vi.fn(),
      sendRawTransaction: vi.fn(),
      getTransaction: vi.fn(),
    };
    const chain = createRescuePaymentViemChain({
      publicClient: rpc as unknown as PublicClient,
      accounts: { commander, policyExecutor: executorAccount, deliveryAttestor: attestor },
      expectedTokenCodeHash: keccak256(code),
      expectedEscrowCodeHash: keccak256(code),
    });
    return { ...f, rpc, adapter: chain };
  }

  it("checks deployed bytecode, operator roles, decimals, provider, allowance and limits", async () => {
    const f = await adapterFixture();
    await expect(f.adapter.preflight(f.record, { kind: "fund" })).resolves.toBeUndefined();
    expect(f.rpc.readContract.mock.calls.map(([call]) => call.functionName)).toContain("allowance");
    expect(f.rpc.getCode).toHaveBeenCalledTimes(2);
  });

  it("rejects a runtime different from the trusted deployment", async () => {
    const f = await adapterFixture();
    f.rpc.getCode.mockResolvedValue("0x6001" as "0x6000");
    await expect(f.adapter.preflight(f.record, { kind: "fund" })).rejects.toThrow(
      "runtime code hash mismatch",
    );
  });

  it.each([
    "paymentToken",
    "policyExecutor",
    "deliveryAttestor",
    "allowedProviders",
    "decimals",
    "allowance",
  ])("fails closed on wrong %s", async (wrong) => {
    const f = await adapterFixture();
    const original = f.rpc.readContract.getMockImplementation()!;
    f.rpc.readContract.mockImplementation(async (call) => {
      if (call.functionName !== wrong) return original(call);
      if (wrong === "allowedProviders") return false;
      if (wrong === "decimals") return 18;
      if (wrong === "allowance") return 0n;
      return address(9);
    });
    await expect(f.adapter.preflight(f.record, { kind: "fund" })).rejects.toThrow(
      /mismatch|Insufficient/,
    );
  });

  it("checks chain time independently of the caller's wall clock", async () => {
    const f = await adapterFixture();
    f.rpc.getBlock.mockResolvedValue({ timestamp: BigInt(now + 121), hash, number: 10n });
    await expect(f.adapter.preflight(f.record, { kind: "fund" })).rejects.toThrow(
      "expired at chain time",
    );
  });

  it("rejects collapsed operator role wallets", () => {
    expect(() =>
      createRescuePaymentViemChain({
        publicClient: {} as PublicClient,
        accounts: { commander, policyExecutor: commander, deliveryAttestor: attestor },
        expectedTokenCodeHash: hash,
        expectedEscrowCodeHash: hash,
      }),
    ).toThrow("distinct wallets");
  });

  it("verifies release event AND token transfer AND reads recipient balance", async () => {
    const f = await adapterFixture();
    const tx = await f.executor.execute(
      f.record.key,
      { kind: "release", deliverableHash: hash, receiptHash: hash, acceptanceHash: otherHash },
      now,
    );
    const a = f.record.intent.args;
    const releaseLog = {
      address: f.policy.escrowAddress,
      topics: encodeEventTopics({
        abi: rescuePaymentExecutorEscrowAbi,
        eventName: "ServicePaymentReleased",
        args: { orderId: a.orderId, commander: commander.address, provider: a.provider as Hex },
      }),
      data: encodeAbiParameters(parseAbiParameters("uint256, bytes32"), [
        BigInt(a.amount),
        otherHash,
      ]),
    };
    const transferLog = {
      address: f.policy.tokenAddress,
      topics: encodeEventTopics({
        abi: erc20Abi,
        eventName: "Transfer",
        args: { from: f.policy.escrowAddress as Hex, to: a.provider as Hex },
      }),
      data: encodeAbiParameters(parseAbiParameters("uint256"), [BigInt(a.amount)]),
    };
    f.rpc.getTransactionReceipt.mockResolvedValue({
      transactionHash: tx.transactionHash,
      blockHash: hash,
      blockNumber: 10n,
      status: "success",
      logs: [releaseLog, transferLog],
    });
    expect(await f.adapter.receipt(f.record, tx, 2)).toMatchObject({
      status: "confirmed",
      verifiedEvent: true,
      recipientBalanceAfter: "10000000",
    });
    f.rpc.getTransactionReceipt.mockResolvedValue({
      transactionHash: tx.transactionHash,
      blockHash: hash,
      blockNumber: 10n,
      status: "success",
      logs: [releaseLog],
    });
    await expect(f.adapter.receipt(f.record, tx, 2)).rejects.toThrow("token Transfer");
  });

  it("does not label a mined but underconfirmed receipt confirmed", async () => {
    const f = await adapterFixture();
    const tx = await f.executor.execute(f.record.key, { kind: "fund" }, now);
    f.rpc.getTransactionReceipt.mockResolvedValue({
      transactionHash: tx.transactionHash,
      blockHash: hash,
      blockNumber: 11n,
      status: "success",
      logs: [],
    });
    expect(await f.adapter.receipt(f.record, tx, 2)).toBeNull();
  });

  it("rejects a receipt whose block hash was reorganized out", async () => {
    const f = await adapterFixture();
    const tx = await f.executor.execute(f.record.key, { kind: "fund" }, now);
    f.rpc.getTransactionReceipt.mockResolvedValue({
      transactionHash: tx.transactionHash,
      blockHash: otherHash,
      blockNumber: 10n,
      status: "success",
      logs: [],
    });
    expect(await f.adapter.receipt(f.record, tx, 2)).toBeNull();
  });

  it("handles already-known broadcast only after finding the exact transaction hash", async () => {
    const f = await adapterFixture();
    const tx = await f.executor.execute(f.record.key, { kind: "fund" }, now);
    f.rpc.sendRawTransaction.mockRejectedValue(new Error("already known"));
    f.rpc.getTransaction.mockResolvedValue({ hash: tx.transactionHash });
    expect(await f.adapter.broadcast(tx.rawTransaction)).toBe(tx.transactionHash);
    f.rpc.getTransaction.mockResolvedValue({ hash: otherHash });
    await expect(f.adapter.broadcast(tx.rawTransaction)).rejects.toThrow("already known");
  });
});
