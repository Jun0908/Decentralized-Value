import { Group } from "@semaphore-protocol/group";
import { Identity } from "@semaphore-protocol/identity";
import { generateProof } from "@semaphore-protocol/proof";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  aggregateSecretGateRun,
  createSecretGateSnapshot,
  proofExecutionStrategySchema,
  secretGateContextHash,
  secretGateEntrySchema,
  secretGateMessage,
  secretGateScope,
  verifySecretGateEntry,
} from "./index";

describe("Secret Gate contracts", () => {
  it("creates a fixed-depth synthetic group without exposing the member secret", () => {
    const identity = new Identity("test-secret-gate-identity");
    const snapshot = createSecretGateSnapshot(identity.commitment.toString());
    expect(snapshot.members).toHaveLength(8);
    expect(snapshot.memberIndex).toBe(7);
    expect(snapshot.treeDepth).toBe(3);
    expect(new Group(snapshot.members).root.toString()).toBe(snapshot.root);
    expect(JSON.stringify(snapshot)).not.toContain(identity.export());
  });

  it("rejects strategy fields outside the bounded schema", () => {
    expect(() =>
      proofExecutionStrategySchema.parse({
        schemaVersion: "proof-execution-strategy-v0",
        maxParallelProofs: 5,
        engineThreads: "sdk-default",
        artifactLoad: "eager",
        workerLifecycle: "reuse",
        arbitraryCode: "alert(1)",
      }),
    ).toThrow();
  });

  it("aggregates exact observations and commits the raw evidence", () => {
    const base = {
      strategy: {
        schemaVersion: "proof-execution-strategy-v0" as const,
        maxParallelProofs: 1,
        engineThreads: "sdk-default" as const,
        artifactLoad: "on-demand" as const,
        workerLifecycle: "reuse" as const,
      },
      contextHash: secretGateContextHash,
      observations: [
        {
          requestId: "one",
          workloadId: "cold-start" as const,
          arrivalMs: 0,
          dispatchMs: 5,
          completedMs: 105,
          proofVerified: true,
          proofHash: `0x${"11".repeat(32)}`,
        },
      ],
      memoryBaselineBytes: 100,
      memorySamplesBytes: [100, 1_048_676],
    };
    const result = aggregateSecretGateRun(base);
    expect(result.correctness).toBe(true);
    expect(result.outcomes).toEqual({ p95LatencyMs: 105, peakIncrementalMemoryMb: 1 });
    expect(result.resultHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(aggregateSecretGateRun(base)).toEqual(result);
  });

  it("generates a real proof and enforces the expected root, message, and scope", async () => {
    const identity = new Identity("real-secret-gate-proof-test");
    const snapshot = createSecretGateSnapshot(identity.commitment.toString());
    const proof = await generateProof(
      identity,
      new Group(snapshot.members),
      BigInt(secretGateMessage),
      BigInt(secretGateScope),
      snapshot.treeDepth,
      {
        wasm: fileURLToPath(
          new URL("../../../apps/web/public/semaphore/4.13.0/semaphore-3.wasm", import.meta.url),
        ),
        zkey: fileURLToPath(
          new URL("../../../apps/web/public/semaphore/4.13.0/semaphore-3.zkey", import.meta.url),
        ),
      },
    );
    const entry = secretGateEntrySchema.parse({
      gateId: snapshot.gateId,
      epoch: snapshot.epoch,
      proof,
    });
    await expect(verifySecretGateEntry(entry, snapshot.root)).resolves.toMatchObject({
      valid: true,
      failures: [],
    });
    await expect(verifySecretGateEntry(entry, "1")).resolves.toMatchObject({
      valid: false,
      failures: ["UNTRUSTED_GROUP_ROOT"],
    });
    await expect(
      verifySecretGateEntry({ ...entry, proof: { ...entry.proof, message: "1" } }, snapshot.root),
    ).resolves.toMatchObject({ valid: false, failures: ["WRONG_MESSAGE"] });
    await expect(
      verifySecretGateEntry({ ...entry, proof: { ...entry.proof, scope: "1" } }, snapshot.root),
    ).resolves.toMatchObject({ valid: false, failures: ["WRONG_SCOPE"] });
  }, 120_000);
});
