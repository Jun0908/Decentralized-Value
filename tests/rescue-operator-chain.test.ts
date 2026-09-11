import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, type Address } from "viem";
import {
  compileRescuePaymentContracts,
  createRescueOperatorChain,
  assertRescueOperatorJournalNonces,
  loadOrCreateRescueOperatorKeys,
  persistNewJson,
  rescueOperatorBudget,
  rescueOperatorNewTransactionNonce,
  validateRescueOperatorTransaction,
} from "../scripts/lib/rescue-operator-chain";

describe("Rescue isolated operator deployment preparation", () => {
  const signer = `0x${"ab".repeat(20)}` as Address;
  const otherSigner = `0x${"cd".repeat(20)}` as Address;

  it("rejects two journal labels occupying the same signer nonce, case-insensitively", () => {
    expect(() =>
      assertRescueOperatorJournalNonces([
        { from: signer, nonce: 4 },
        { from: signer.toUpperCase() as Address, nonce: 4 },
      ]),
    ).toThrow("DUPLICATE_SIGNER_NONCE");
  });

  it("allows the same nonce for different role signers", () => {
    expect(() =>
      assertRescueOperatorJournalNonces([
        { from: signer, nonce: 4 },
        { from: otherSigner, nonce: 4 },
      ]),
    ).not.toThrow();
  });

  it.each([0, 3, 4])(
    "does not replace or gap-queue past a prepared nonce 4 when RPC pending is %s",
    (pending) => {
      expect(() =>
        rescueOperatorNewTransactionNonce([{ from: signer, nonce: 4 }], signer, pending),
      ).toThrow("UNRESOLVED_SIGNER_NONCE_RECONCILE_REQUIRED");
    },
  );

  it("permits the RPC nonce only after it passes all same-signer journal reservations", () => {
    expect(
      rescueOperatorNewTransactionNonce(
        [
          { from: signer, nonce: 3 },
          { from: signer, nonce: 4 },
          { from: otherSigner, nonce: 9 },
        ],
        signer,
        5,
      ),
    ).toBe(5);
    expect(rescueOperatorNewTransactionNonce([], signer, 0)).toBe(0);
  });

  it.each([-1, 0.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid pending nonce %s",
    (pending) => {
      expect(() => rescueOperatorNewTransactionNonce([], signer, pending)).toThrow(
        "INVALID_PENDING_SIGNER_NONCE",
      );
    },
  );

  it("retries an existing signed label using exactly its saved bytes without a fresh nonce or signature", async () => {
    const directory = mkdtempSync(resolve(tmpdir(), "rescue-operator-nonce-retry-"));
    // Public deterministic test-only account. No network calls or real wallet access.
    const account = privateKeyToAccount(`0x${"1".repeat(64)}`);
    const raw = await account.signTransaction({
      type: "eip1559",
      chainId: 11155111,
      to: otherSigner,
      nonce: 4,
      value: 1n,
      gas: 21000n,
      maxFeePerGas: 100n,
      maxPriorityFeePerGas: 1n,
    });
    const hash = keccak256(raw);
    persistNewJson(resolve(directory, "existing.json"), {
      schemaVersion: "rescue-operator-transaction-v1",
      key: "existing",
      from: account.address,
      to: otherSigner,
      data: "0x",
      value: "1",
      nonce: 4,
      maximumCostWei: "2100001",
      transactionHash: hash,
      serializedTransaction: raw,
    });
    const chain = createRescueOperatorChain("http://invalid.invalid", directory);
    vi.spyOn(chain.client, "getChainId").mockResolvedValue(11155111);
    vi.spyOn(chain.client, "getTransactionReceipt").mockRejectedValue(
      new Error("local fixture pending"),
    );
    const broadcast = vi.spyOn(chain.client, "sendRawTransaction").mockResolvedValue(hash);
    const receipt = {
      status: "success",
      transactionHash: hash,
      blockNumber: 10n,
      gasUsed: 21000n,
      effectiveGasPrice: 100n,
    };
    vi.spyOn(chain.client, "waitForTransactionReceipt").mockResolvedValue(receipt as never);
    const nonceRead = vi
      .spyOn(chain.client, "getTransactionCount")
      .mockRejectedValue(new Error("must not read a new nonce"));
    const estimate = vi
      .spyOn(chain.client, "estimateGas")
      .mockRejectedValue(new Error("must not prepare another transaction"));
    const result = await chain.send("existing", account, { to: otherSigner, value: 1n });
    expect(result.receipt.transactionHash).toBe(hash);
    expect(broadcast).toHaveBeenCalledExactlyOnceWith({ serializedTransaction: raw });
    expect(nonceRead).not.toHaveBeenCalled();
    expect(estimate).not.toHaveBeenCalled();
  });
  it("authenticates saved raw transactions and recomputes fee/value reservations", async () => {
    const directory = mkdtempSync(resolve(tmpdir(), "rescue-signature-test-"));
    const keys = loadOrCreateRescueOperatorKeys(resolve(directory, "keys.json"));
    const account = privateKeyToAccount(keys.commander);
    const recipient = privateKeyToAccount(keys.executor).address;
    const raw = await account.signTransaction({
      type: "eip1559",
      chainId: 11155111,
      nonce: 0,
      to: recipient,
      value: 1n,
      gas: 21_000n,
      maxFeePerGas: 100n,
      maxPriorityFeePerGas: 1n,
    });
    const saved = {
      schemaVersion: "rescue-operator-transaction-v1",
      key: "test",
      from: account.address,
      to: recipient,
      data: "0x",
      value: "1",
      nonce: 0,
      maximumCostWei: "2100001",
      serializedTransaction: raw,
      transactionHash: keccak256(raw),
    };
    await expect(validateRescueOperatorTransaction(saved)).resolves.toEqual(saved);
    for (const tampered of [
      { ...saved, value: "2" },
      { ...saved, maximumCostWei: "1" },
      { ...saved, nonce: 1 },
      { ...saved, from: recipient },
      { ...saved, maximumCostWei: "-1" },
      { ...saved, to: account.address },
    ]) {
      await expect(validateRescueOperatorTransaction(tampered)).rejects.toThrow();
    }
  });
  it("persists distinct role keys once and reuses them before any funding", () => {
    const directory = mkdtempSync(resolve(tmpdir(), "rescue-key-test-"));
    const path = resolve(directory, "keys.json");
    const keys = loadOrCreateRescueOperatorKeys(path);
    expect(loadOrCreateRescueOperatorKeys(path)).toEqual(keys);
    const addresses = [
      keys.commander,
      keys.executor,
      keys.attestor,
      ...Object.values(keys.providers),
    ].map((key) => privateKeyToAccount(key).address);
    expect(new Set(addresses).size).toBe(9);
    expect(Object.keys(keys.providers)).toHaveLength(6);
    expect(readFileSync(path, "utf8")).toContain("rescue-operator-keys-v1");
  });

  it("never overwrites an existing artifact or silently regenerates corrupt wallet state", () => {
    const directory = mkdtempSync(resolve(tmpdir(), "rescue-key-invalid-"));
    const path = resolve(directory, "keys.json");
    persistNewJson(path, { schemaVersion: "wrong" });
    expect(() => loadOrCreateRescueOperatorKeys(path)).toThrow("KEY_SCHEMA_INVALID");
    expect(() => persistNewJson(path, { replaced: true })).toThrow();
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({ schemaVersion: "wrong" });
  });

  it("compiles the exact existing test contracts without a key or RPC", async () => {
    const artifacts = await compileRescuePaymentContracts(resolve(import.meta.dirname, ".."));
    expect(artifacts.compiler).toMatch(/^0\.8\.30\+/);
    expect(artifacts.token.bytecode).toMatch(/^0x[0-9a-f]+$/);
    expect(artifacts.escrow.bytecode.length).toBeGreaterThan(1000);
    expect(artifacts.sourceHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(rescueOperatorBudget.maximumEth).toBe("1");
    expect(rescueOperatorBudget.maximumModelUsd).toBe(5);
  });
});
