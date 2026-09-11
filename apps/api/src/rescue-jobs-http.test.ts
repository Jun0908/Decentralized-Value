import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { publicRescueRoomScenario, rescueCommanderStarterPlaybook } from "@frontier/rescue-room";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLocalRescueJobStore, runRescueJob, type RescueJobStore } from "./rescue-jobs";
import {
  createRescueJobsHttpHandler,
  toPublicRescueJob,
  type PublicRescueJob,
} from "./rescue-jobs-http";

const prefix = "/operator/rescue/jobs";
const workflowRequest = {
  schemaVersion: "rescue-service-workflow-request-v0",
  episodeId: publicRescueRoomScenario().episodes[0]!.id,
  playbook: rescueCommanderStarterPlaybook,
};
const creation = { idempotencyKey: "request-1", request: workflowRequest };
const directories: string[] = [];
const authenticate = async (request: Request) => {
  if (request.headers.get("authorization") === "Bearer account-a-test-token") return "account-a";
  if (request.headers.get("authorization") === "Bearer account-b-test-token") return "account-b";
  return null;
};

function request(
  path = prefix,
  method = "GET",
  body?: unknown,
  extraHeaders: Record<string, string> = {},
) {
  return new Request(`http://127.0.0.1:3044${path}`, {
    method,
    headers: {
      authorization: "Bearer account-a-test-token",
      ...(method === "POST" ? { "content-type": "application/json" } : {}),
      ...extraHeaders,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "frontier-rescue-jobs-http-"));
  directories.push(directory);
  const store = createLocalRescueJobStore({ directory });
  const handler = createRescueJobsHttpHandler({ store, authenticate });
  return { store, handler };
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("loopback operator Rescue jobs HTTP adapter", () => {
  it("creates without executing, normalizes the playbook and preserves immutable idempotency", async () => {
    const { store } = await fixture();
    const executeJob = vi.fn(async () => undefined);
    const handler = createRescueJobsHttpHandler({ store, authenticate, executeJob });
    const first = await handler(request(prefix, "POST", creation));
    expect(first.status).toBe(201);
    const { job } = (await first.json()) as { job: PublicRescueJob };
    expect(job.status).toBe("queued");
    expect(job.request.playbook).toMatchObject({
      allowedServiceIds: [...rescueCommanderStarterPlaybook.allowedServiceIds].sort(),
    });
    expect(executeJob).not.toHaveBeenCalled();
    const again = await handler(request(prefix, "POST", creation));
    expect(again.status).toBe(200);
    expect((await again.json()).job.jobId).toBe(job.jobId);
    const conflict = await handler(
      request(prefix, "POST", {
        ...creation,
        request: {
          ...workflowRequest,
          playbook: { ...rescueCommanderStarterPlaybook, name: "Changed playbook" },
        },
      }),
    );
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).error.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("derives owner only from authentication and hides foreign records", async () => {
    const { handler } = await fixture();
    const { job } = await (await handler(request(prefix, "POST", creation))).json();
    const otherHeaders = { authorization: "Bearer account-b-test-token" };
    expect(
      (await handler(request(`${prefix}/${job.jobId}`, "GET", undefined, otherHeaders))).status,
    ).toBe(404);
    expect(
      (await handler(request(`${prefix}/${job.jobId}/run`, "POST", {}, otherHeaders))).status,
    ).toBe(404);
    expect(await (await handler(request(prefix, "GET", undefined, otherHeaders))).json()).toEqual({
      jobs: [],
    });
    expect(
      (await handler(request(prefix, "POST", { ...creation, ownerId: "account-b" }))).status,
    ).toBe(400);
    const mine = await (await handler(request(prefix))).json();
    expect(mine.jobs).toHaveLength(1);
    expect(mine.jobs[0].jobId).toBe(job.jobId);
  });

  it("fails closed when authentication is missing, rejected or throws", async () => {
    const { store } = await fixture();
    expect((await createRescueJobsHttpHandler({ store })(request())).status).toBe(503);
    expect(
      (
        await createRescueJobsHttpHandler({ store, authenticate })(
          request(prefix, "GET", undefined, { authorization: "wrong" }),
        )
      ).status,
    ).toBe(401);
    const failure = await createRescueJobsHttpHandler({
      store,
      authenticate: async () => {
        throw new Error("PRIVATE auth credential");
      },
    })(request());
    expect(failure.status).toBe(503);
    expect(await failure.text()).not.toContain("PRIVATE");
  });

  it("allows absent CLI origin or exactly one trusted origin, rejects null and hostile origins", async () => {
    const { store } = await fixture();
    const handler = createRescueJobsHttpHandler({
      store,
      authenticate,
      trustedOrigin: "http://127.0.0.1:3044",
    });
    expect((await handler(request())).status).toBe(200);
    expect(
      (await handler(request(prefix, "GET", undefined, { origin: "http://127.0.0.1:3044" })))
        .status,
    ).toBe(200);
    for (const origin of [
      "null",
      "https://attacker.example",
      "http://127.0.0.1:3044.attacker.example",
      "http://localhost:3044",
      "http://127.0.0.1:3044/",
    ]) {
      expect((await handler(request(prefix, "GET", undefined, { origin }))).status).toBe(403);
    }
    expect(
      (
        await createRescueJobsHttpHandler({ store, authenticate })(
          request(prefix, "GET", undefined, { origin: "http://127.0.0.1:3044" }),
        )
      ).status,
    ).toBe(403);
    expect(() =>
      createRescueJobsHttpHandler({
        store,
        authenticate,
        trustedOrigin: "http://127.0.0.1:3044/path",
      }),
    ).toThrow(/exact/);
  });

  it("requires JSON and enforces actual streamed byte limits without trusting Content-Length", async () => {
    const { handler } = await fixture();
    expect(
      (await handler(request(prefix, "POST", creation, { "content-type": "text/plain" }))).status,
    ).toBe(415);
    expect(
      (await handler(request(prefix, "POST", creation, { "content-length": "65537" }))).status,
    ).toBe(413);
    expect((await handler(request(prefix, "POST", { extra: "x".repeat(65_537) }))).status).toBe(
      413,
    );
    const invalid = new Request(`http://127.0.0.1:3044${prefix}`, {
      method: "POST",
      headers: { authorization: "Bearer account-a-test-token", "content-type": "application/json" },
      body: "{",
    });
    expect((await handler(invalid)).status).toBe(400);
    const streaming = new Request(`http://127.0.0.1:3044${prefix}`, {
      method: "POST",
      headers: {
        authorization: "Bearer account-a-test-token",
        "content-type": "application/json",
        "content-length": "1",
      },
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(40_000));
          controller.enqueue(new Uint8Array(40_000));
          controller.close();
        },
      }),
      duplex: "half",
    } as RequestInit);
    expect((await handler(streaming)).status).toBe(413);
  });

  it("validates only public episodes and canonical playbook constraints with no extra fields", async () => {
    const { handler } = await fixture();
    for (const body of [
      { ...creation, request: { ...workflowRequest, schemaVersion: "arbitrary-code-v0" } },
      { ...creation, request: { ...workflowRequest, episodeId: "hidden-final-1" } },
      { ...creation, request: { ...workflowRequest, privateKey: "never-accepted" } },
      {
        ...creation,
        request: {
          ...workflowRequest,
          playbook: { ...rescueCommanderStarterPlaybook, arbitraryCode: "bad" },
        },
      },
      {
        ...creation,
        request: {
          ...workflowRequest,
          playbook: { ...rescueCommanderStarterPlaybook, allowedServiceIds: ["invented-service"] },
        },
      },
      {
        ...creation,
        request: {
          ...workflowRequest,
          playbook: { ...rescueCommanderStarterPlaybook, maxServicePriceCredits: -1 },
        },
      },
      {
        ...creation,
        request: {
          ...workflowRequest,
          playbook: { ...rescueCommanderStarterPlaybook, instructions: "short" },
        },
      },
    ])
      expect((await handler(request(prefix, "POST", body))).status).toBe(400);
  });

  it("does not expose internal run tokens, worker IDs, owner IDs or idempotency keys", async () => {
    const { handler, store } = await fixture();
    const { job } = await (await handler(request(prefix, "POST", creation))).json();
    const running = await store.claim({
      ownerId: "account-a",
      jobId: job.jobId,
      workerId: "private-worker-identity",
    });
    const response = await handler(request(`${prefix}/${job.jobId}`));
    const body = await response.text();
    expect(body).not.toContain(running.runToken!);
    expect(body).not.toContain("private-worker-identity");
    for (const key of ["runToken", "workerId", "ownerId", "idempotencyKey"])
      expect(body).not.toContain(`"${key}"`);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(toPublicRescueJob(running).events.at(-1)?.data).toEqual({ attempt: 1 });
  });

  it("runs only after explicit POST, supervises completion and rejects terminal reruns", async () => {
    const { store } = await fixture();
    const executeJob = vi.fn(async (jobId: string, ownerId: string) => {
      await runRescueJob({
        store,
        jobId,
        ownerId,
        workerId: "worker",
        execute: async () => ({ paid: false, verification: "local-only" }),
      });
    });
    const handler = createRescueJobsHttpHandler({ store, authenticate, executeJob });
    const { job } = await (await handler(request(prefix, "POST", creation))).json();
    expect(executeJob).not.toHaveBeenCalled();
    expect((await handler(request(`${prefix}/${job.jobId}/run`, "POST", {}))).status).toBe(202);
    await handler.waitForIdle();
    expect(executeJob).toHaveBeenCalledExactlyOnceWith(job.jobId, "account-a");
    const completed = await (await handler(request(`${prefix}/${job.jobId}`))).json();
    expect(completed.job.status).toBe("succeeded");
    expect(completed.job.result).toEqual({ paid: false, verification: "local-only" });
    expect((await handler(request(`${prefix}/${job.jobId}/run`, "POST", {}))).status).toBe(409);
  });

  it("rejects missing executors and unexpected run parameters without launching", async () => {
    const { store, handler } = await fixture();
    const { job } = await (await handler(request(prefix, "POST", creation))).json();
    expect((await handler(request(`${prefix}/${job.jobId}/run`, "POST", {}))).status).toBe(503);
    const executeJob = vi.fn(async () => undefined);
    const enabled = createRescueJobsHttpHandler({ store, authenticate, executeJob });
    expect(
      (await enabled(request(`${prefix}/${job.jobId}/run`, "POST", { budget: 999 }))).status,
    ).toBe(400);
    expect(executeJob).not.toHaveBeenCalled();
  });

  it("deduplicates a pending launch even before its worker claims the job", async () => {
    const { store } = await fixture();
    let finish!: () => void;
    const barrier = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const executeJob = vi.fn(async (jobId: string, ownerId: string) => {
      await barrier;
      await runRescueJob({ store, jobId, ownerId, workerId: "worker", execute: async () => null });
    });
    const handler = createRescueJobsHttpHandler({ store, authenticate, executeJob });
    const { job } = await (await handler(request(prefix, "POST", creation))).json();
    const responses = await Promise.all(
      [1, 2].map(() => handler(request(`${prefix}/${job.jobId}/run`, "POST", {}))),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([202, 409]);
    finish();
    await handler.waitForIdle();
    expect(executeJob).toHaveBeenCalledTimes(1);
  });

  it("supervises rejected executors without leaking private error details or assuming safe retry", async () => {
    const { store } = await fixture();
    const onExecutionError = vi.fn();
    const handler = createRescueJobsHttpHandler({
      store,
      authenticate,
      onExecutionError,
      executeJob: async (jobId, ownerId) => {
        await store.claim({ jobId, ownerId, workerId: "interrupted-worker" });
        throw new Error("PRIVATE endpoint and credential");
      },
    });
    const { job } = await (await handler(request(prefix, "POST", creation))).json();
    expect((await handler(request(`${prefix}/${job.jobId}/run`, "POST", {}))).status).toBe(202);
    await handler.waitForIdle();
    expect(onExecutionError).toHaveBeenCalledExactlyOnceWith({
      jobId: job.jobId,
      code: "EXECUTOR_REJECTED",
    });
    const response = await handler(request(`${prefix}/${job.jobId}`));
    expect(await response.text()).not.toContain("PRIVATE");
    expect((await handler(request(`${prefix}/${job.jobId}/run`, "POST", {}))).status).toBe(409);
    expect((await store.get("account-a", job.jobId))?.status).toBe("running");
  });

  it("sanitizes unexpected storage errors and limits routes and methods", async () => {
    const { store, handler } = await fixture();
    const broken = {
      ...store,
      list: async () => {
        throw new Error("PRIVATE file path");
      },
    } satisfies RescueJobStore;
    const response = await createRescueJobsHttpHandler({ store: broken, authenticate })(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("PRIVATE");
    expect((await handler(request("/v1/rescue/jobs"))).status).toBe(404);
    expect((await handler(request(prefix, "DELETE"))).status).toBe(405);
    expect((await handler(request(prefix, "OPTIONS"))).status).toBe(405);
    expect((await handler(request(`${prefix}/not-a-job`))).status).toBe(404);
  });
});
