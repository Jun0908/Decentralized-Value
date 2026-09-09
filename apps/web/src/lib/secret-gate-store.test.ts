import { describe, expect, it } from "vitest";
import { MemorySecretGateStore, type SecretGateReceiptRecord } from "./secret-gate-store";

describe("Secret Gate storage", () => {
  it("creates a trusted snapshot and atomically accepts one nullifier use", async () => {
    const store = new MemorySecretGateStore();
    const snapshot = await store.createSnapshot("123456789");
    await expect(store.snapshot(snapshot.root)).resolves.toEqual(snapshot);

    const receipt = {
      schemaVersion: "1",
      gateId: snapshot.gateId,
      epoch: snapshot.epoch,
      root: snapshot.root,
      nullifier: "987654321",
      proofHash: `0x${"12".repeat(32)}`,
      state: "off-chain-verified",
    } satisfies SecretGateReceiptRecord;

    const results = await Promise.all([
      store.reserveNullifier(receipt),
      store.reserveNullifier(receipt),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});
