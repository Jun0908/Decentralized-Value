import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createLocalRescueJobStore,
  RescueJobSafeFailure,
  runRescueJob,
  type RescueJob,
  type RescueJobJson,
} from "./rescue-jobs";

const directories: string[] = [];
async function fixture(maxEvents = 128) {
  const directory = await mkdtemp(join(tmpdir(), "frontier-rescue-jobs-"));
  directories.push(directory);
  const store = createLocalRescueJobStore({ directory, maxEvents, now: () => 1000 });
  return { directory, store };
}
const createInput = {
  ownerId: "account-a",
  idempotencyKey: "request-1",
  request: { incident: "public-1", budget: 30 },
};
const refFor = (job: RescueJob) => ({
  ownerId: job.ownerId,
  jobId: job.jobId,
  runToken: job.runToken!,
});

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("local durable Rescue jobs", () => {
  it("persists immutable request bindings and survives a new store instance", async () => {
    const { store, directory } = await fixture();
    const request = { budget: 30, nested: { incident: "public-1" } };
    const { job, created } = await store.create({ ...createInput, request });
    request.nested.incident = "changed";
    job.request.budget = 99;
    expect(created).toBe(true);
    const restarted = createLocalRescueJobStore({ directory });
    const persisted = await restarted.get(job.ownerId, job.jobId);
    expect(persisted?.request).toEqual({ budget: 30, nested: { incident: "public-1" } });
    expect(persisted?.schemaVersion).toBe("rescue-job-v1");
    expect(persisted?.status).toBe("queued");
  });

  it("canonicalizes key order and rejects changing an idempotent request", async () => {
    const { store } = await fixture();
    const first = await store.create(createInput);
    const second = await store.create({
      ...createInput,
      request: { budget: 30, incident: "public-1" },
    });
    expect(second).toEqual({ job: first.job, created: false });
    await expect(store.create({ ...createInput, request: { budget: 31 } })).rejects.toMatchObject({
      code: "IDEMPOTENCY_CONFLICT",
    });
  });

  it("atomically deduplicates cross-store concurrent creation", async () => {
    const { directory } = await fixture();
    const responses = await Promise.all(
      Array.from({ length: 4 }, () => createLocalRescueJobStore({ directory }).create(createInput)),
    );
    expect(responses.filter((result) => result.created)).toHaveLength(1);
    expect(new Set(responses.map((result) => result.job.jobId)).size).toBe(1);
    expect((await readdir(directory)).filter((name) => name.endsWith(".json"))).toHaveLength(1);
  });

  it("permits only one claimant across store instances", async () => {
    const { store, directory } = await fixture();
    const { job } = await store.create(createInput);
    const attempts = await Promise.allSettled(
      ["worker-a", "worker-b"].map((workerId) =>
        createLocalRescueJobStore({ directory }).claim({ ...refFor(job), workerId }),
      ),
    );
    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    const rejected = attempts.find((attempt) => attempt.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason).toMatchObject({
      code: "INVALID_STATE",
    });
    expect((await store.get(job.ownerId, job.jobId))?.attempt).toBe(1);
  });

  it("isolates owner reads, lists, mutations and idempotency keys", async () => {
    const { store } = await fixture();
    const a = (await store.create(createInput)).job;
    const b = (await store.create({ ...createInput, ownerId: "account-b" })).job;
    expect(a.jobId).not.toBe(b.jobId);
    expect(await store.get("account-b", a.jobId)).toBeNull();
    expect((await store.list("account-b")).map((job) => job.jobId)).toEqual([b.jobId]);
    await expect(
      store.claim({ ownerId: "account-b", jobId: a.jobId, workerId: "worker" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("persists monotonic bounded event cursors and final results", async () => {
    const { store, directory } = await fixture(3);
    const job = await store.claim({ ...(await store.create(createInput)).job, workerId: "worker" });
    for (let step = 0; step < 5; step++)
      await store.appendEvent({ ...refFor(job), event: { type: "step", data: { step } } });
    const result = await store.complete({
      ...refFor(job),
      result: { evidenceHash: "public-evidence", paid: false },
    });
    expect(result.status).toBe("succeeded");
    expect(result.events.map((event) => event.sequence)).toEqual([6, 7, 8]);
    expect(result.nextEventSequence).toBe(9);
    expect(result.runToken).toBeNull();
    expect(await createLocalRescueJobStore({ directory }).get(job.ownerId, job.jobId)).toEqual(
      result,
    );
  });

  it("does not rerun an interrupted running job after reopening", async () => {
    const { store, directory } = await fixture();
    const job = await store.claim({
      ...(await store.create(createInput)).job,
      workerId: "interrupted-worker",
    });
    const restarted = createLocalRescueJobStore({ directory });
    const execute = vi.fn(async () => null);
    await expect(
      runRescueJob({ store: restarted, ...refFor(job), workerId: "replacement", execute }),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(execute).not.toHaveBeenCalled();
    expect((await restarted.get(job.ownerId, job.jobId))?.status).toBe("running");
  });

  it("fences stale workers after explicit reconciliation and safe retry", async () => {
    const { store } = await fixture();
    const old = await store.claim({
      ...(await store.create(createInput)).job,
      workerId: "old-worker",
    });
    const recon = await store.requireReconciliation({
      ...refFor(old),
      failureCode: "PROCESS_INTERRUPTED",
    });
    await expect(store.complete({ ...refFor(old), result: "stale" })).rejects.toMatchObject({
      code: "STALE_RUN",
    });
    await expect(
      store.resolveReconciliation({
        ...refFor(old),
        expectedRevision: recon.revision - 1,
        resolution: "retry-safe",
        operatorEvidence: "checked-no-side-effects",
        confirmNoActiveRunner: true,
      }),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
    await store.resolveReconciliation({
      ...refFor(old),
      expectedRevision: recon.revision,
      resolution: "retry-safe",
      operatorEvidence: "checked-no-side-effects",
      confirmNoActiveRunner: true,
    });
    const next = await store.claim({ ...refFor(old), workerId: "new-worker" });
    expect(next.attempt).toBe(2);
    expect(next.runToken).not.toBe(old.runToken);
    await expect(
      store.appendEvent({ ...refFor(old), event: { type: "stale" } }),
    ).rejects.toMatchObject({ code: "STALE_RUN" });
    expect((await store.complete({ ...refFor(next), result: "current" })).result).toBe("current");
  });

  it("keeps safe failures terminal for the same idempotency key", async () => {
    const { store } = await fixture();
    const { job } = await store.create(createInput);
    const result = await runRescueJob({
      store,
      ...refFor(job),
      workerId: "worker",
      execute: async () => {
        throw new RescueJobSafeFailure("INVALID_DOCTRINE");
      },
    });
    expect(result.status).toBe("failed");
    expect(result.failureCode).toBe("INVALID_DOCTRINE");
    expect((await store.create(createInput)).job.status).toBe("failed");
    await expect(store.claim({ ...refFor(job), workerId: "retry" })).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
    expect(
      (await store.create({ ...createInput, idempotencyKey: "new-explicit-request" })).job.status,
    ).toBe("queued");
  });

  it("marks unknown handler errors uncertain without persisting private error messages", async () => {
    const { store, directory } = await fixture();
    const { job } = await store.create(createInput);
    const result = await runRescueJob({
      store,
      ...refFor(job),
      workerId: "worker",
      execute: async ({ recordEvent }) => {
        await recordEvent({ type: "service-requested", data: { orderId: "order-1" } });
        throw new Error("PRIVATE credential or endpoint detail");
      },
    });
    expect(result.status).toBe("needs-reconciliation");
    expect(result.failureCode).toBe("EXECUTION_OUTCOME_UNCERTAIN");
    expect(await readFile(join(directory, `${job.jobId}.json`), "utf8")).not.toContain("PRIVATE");
    expect(result.events.some((event) => event.type === "service-requested")).toBe(true);
  });

  it("can close an uncertain outcome as failed without executing again", async () => {
    const { store } = await fixture();
    const job = await store.claim({ ...(await store.create(createInput)).job, workerId: "worker" });
    const uncertain = await store.requireReconciliation({
      ...refFor(job),
      failureCode: "RPC_RESPONSE_LOST",
    });
    const closed = await store.resolveReconciliation({
      ...refFor(job),
      expectedRevision: uncertain.revision,
      resolution: "failed",
      operatorEvidence: "receipt-checked-and-refunded",
      confirmNoActiveRunner: true,
    });
    expect(closed.status).toBe("failed");
    expect(closed.events.at(-1)?.data).toEqual({
      resolution: "failed",
      operatorEvidence: "receipt-checked-and-refunded",
    });
  });

  it("runs an injected task once and snapshots its request independently", async () => {
    const { store } = await fixture();
    const { job } = await store.create(createInput);
    const result = await runRescueJob({
      store,
      ...refFor(job),
      workerId: "worker",
      execute: async ({ request, recordEvent }) => {
        request.budget = 999;
        await recordEvent({ type: "delivery-verified", data: { verification: "local-only" } });
        return { measured: true, paid: false };
      },
    });
    expect(result.result).toEqual({ measured: true, paid: false });
    expect(result.request.budget).toBe(30);
    expect((await store.create(createInput)).job.result).toEqual(result.result);
  });

  it("rejects getters without running them and rejects nonfinite, cyclic or oversized input", async () => {
    const { store } = await fixture();
    let getterCalls = 0;
    const getterInput = Object.defineProperty({}, "secret", {
      enumerable: true,
      get() {
        getterCalls++;
        return "never";
      },
    });
    const cyclic: Record<string, RescueJobJson> = {};
    cyclic.self = cyclic;
    for (const request of [
      getterInput,
      { n: NaN },
      { date: new Date() },
      cyclic,
      { text: "a".repeat(65_537) },
      { missing: undefined },
      { decorated: Object.assign([1], { extra: true }) },
    ]) {
      await expect(
        store.create({ ...createInput, request: request as Record<string, RescueJobJson> }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    }
    expect(getterCalls).toBe(0);
  });

  it("fails closed on corrupt or unsupported-schema records instead of resetting jobs", async () => {
    const { store, directory } = await fixture();
    const { job } = await store.create(createInput);
    const path = join(directory, `${job.jobId}.json`);
    for (const data of [
      "{",
      JSON.stringify({ ...job, schemaVersion: "rescue-job-v2" }),
      JSON.stringify({ ...job, request: { budget: 999 } }),
    ]) {
      await writeFile(path, data);
      await expect(store.get(job.ownerId, job.jobId)).rejects.toMatchObject({
        code: "CORRUPT_STORE",
      });
      await expect(store.create(createInput)).rejects.toMatchObject({ code: "CORRUPT_STORE" });
      expect(await readFile(path, "utf8")).toBe(data);
    }
  });

  it("does not treat a leftover temporary file as a committed job", async () => {
    const { store, directory } = await fixture();
    const { job } = await store.create(createInput);
    await writeFile(join(directory, `${job.jobId}.interrupted.tmp`), "partial");
    expect(await createLocalRescueJobStore({ directory }).list(job.ownerId)).toEqual([job]);
  });

  it("never steals an old lock and remains readable while mutations fail closed", async () => {
    const { store, directory } = await fixture();
    const { job } = await store.create(createInput);
    const lockPath = join(directory, "writer.lock");
    await writeFile(lockPath, JSON.stringify({ pid: 0, token: "abandoned-or-slow" }));
    await expect(store.claim({ ...refFor(job), workerId: "worker" })).rejects.toMatchObject({
      code: "STORE_BUSY",
    });
    expect((await store.get(job.ownerId, job.jobId))?.status).toBe("queued");
    expect(await readFile(lockPath, "utf8")).toContain("abandoned-or-slow");
  });

  it("does not permit path traversal or unsafe directory defaults", async () => {
    const { store } = await fixture();
    await expect(store.get("account-a", "../../.env")).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    expect(() => createLocalRescueJobStore({ directory: "" })).toThrow(/directory/);
    expect(() => createLocalRescueJobStore({ directory: "unused", maxEvents: 999 })).toThrow(
      /maxEvents/,
    );
  });

  it("does not let a stale handler completion overwrite operator reconciliation", async () => {
    const { store } = await fixture();
    const { job } = await store.create(createInput);
    await expect(
      runRescueJob({
        store,
        ...refFor(job),
        workerId: "old-worker",
        execute: async ({ job: running }) => {
          await store.requireReconciliation({
            ...refFor(running),
            failureCode: "OPERATOR_STOPPED_WORKER",
          });
          return { stale: true };
        },
      }),
    ).rejects.toMatchObject({ code: "STALE_RUN" });
    expect((await store.get(job.ownerId, job.jobId))?.status).toBe("needs-reconciliation");
  });
});
