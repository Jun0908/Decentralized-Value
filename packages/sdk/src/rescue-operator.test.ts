import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  publicRescueRoomScenario,
  rescueCommanderStarterPlaybook,
} from "../../rescue-room/src/index";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLocalRescueJobStore, runRescueJob } from "../../../apps/api/src/rescue-jobs";
import { createRescueJobsHttpHandler } from "../../../apps/api/src/rescue-jobs-http";
import { runRescueJobsCli } from "../../../scripts/rescue-jobs-cli";
import { RescueOperatorClient } from "./rescue-operator";

const baseUrl = "http://127.0.0.1:4318";
const token = "a".repeat(64);
const auth = { getHeaders: () => ({ authorization: `Bearer ${token}` }) };
const creation = {
  idempotencyKey: "request-1",
  request: {
    schemaVersion: "rescue-service-workflow-request-v0" as const,
    episodeId: publicRescueRoomScenario().episodes[0]!.id,
    playbook: rescueCommanderStarterPlaybook,
  },
};
const directories: string[] = [];

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "frontier-rescue-sdk-"));
  directories.push(root);
  const store = createLocalRescueJobStore({ directory: join(root, "jobs") });
  const executeJob = vi.fn(async (jobId: string, ownerId: string) => {
    await runRescueJob({
      store,
      jobId,
      ownerId,
      workerId: "private-worker",
      execute: async () => ({ paid: false, verification: "local-only" }),
    });
  });
  const handler = createRescueJobsHttpHandler({
    store,
    executeJob,
    authenticate: async (request) =>
      request.headers.get("authorization") === `Bearer ${token}` ? "owner-a" : null,
  });
  const fetcher = vi.fn<typeof fetch>(async (url, init) => handler(new Request(url, init)));
  const client = new RescueOperatorClient({ baseUrl, auth, fetch: fetcher });
  return { root, store, handler, client, fetcher, executeJob };
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("RescueOperatorClient local pilot", () => {
  it("uses the actual injected HTTP adapter for create/list/get/run, preserving created status", async () => {
    const { client, handler, executeJob } = await fixture();
    const first = await client.create(creation);
    expect(first.created).toBe(true);
    expect(first.job.status).toBe("queued");
    expect(executeJob).not.toHaveBeenCalled();
    expect((await client.create(creation)).created).toBe(false);
    expect((await client.list()).map((job) => job.jobId)).toEqual([first.job.jobId]);
    expect((await client.get(first.job.jobId)).jobId).toBe(first.job.jobId);
    expect((await client.run(first.job.jobId)).status).toBe("queued");
    await handler.waitForIdle();
    const completed = await client.get(first.job.jobId);
    expect(completed.status).toBe("succeeded");
    expect(completed.result).toEqual({ paid: false, verification: "local-only" });
    await expect(client.run(first.job.jobId)).rejects.toMatchObject({
      code: "INVALID_STATE",
      status: 409,
    });
    expect(executeJob).toHaveBeenCalledExactlyOnceWith(first.job.jobId, "owner-a");
  });

  it("requires an explicit canonical loopback origin, no remote fallback", () => {
    for (const bad of [
      "https://frontier.example",
      "http://127.0.0.1.attacker.example",
      "https://localhost.attacker.example",
      "http://127.0.0.1:4318/path",
      "http://user:pass@127.0.0.1:4318",
      "http://127.0.0.1:4318?token=PRIVATE",
      "http://127.0.0.1:4318#PRIVATE",
      "http://2130706433:4318",
      "http://localhost.:4318",
    ]) {
      expect(() => new RescueOperatorClient({ baseUrl: bad, auth })).toThrow(/loopback/);
    }
    for (const good of [baseUrl, `${baseUrl}/`, "http://localhost:4318", "http://[::1]:4318"]) {
      expect(new RescueOperatorClient({ baseUrl: good, auth }).baseUrl).toBe(new URL(good).origin);
    }
  });

  it("requires Bearer authentication, strips unrelated credentials and never follows redirects", async () => {
    const { fetcher } = await fixture();
    const missing = new RescueOperatorClient({
      baseUrl,
      auth: { getHeaders: () => ({ "x-api-key": "PRIVATE" }) },
      fetch: fetcher,
    });
    await expect(missing.list()).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    expect(fetcher).not.toHaveBeenCalled();
    const client = new RescueOperatorClient({
      baseUrl,
      auth: {
        getHeaders: () => ({
          authorization: `Bearer ${token}`,
          cookie: "PRIVATE_COOKIE",
          "x-api-key": "PRIVATE_KEY",
        }),
      },
      fetch: fetcher,
    });
    await client.list();
    const options = fetcher.mock.calls[0]![1]!;
    expect(new Headers(options.headers).get("authorization")).toBe(`Bearer ${token}`);
    expect(new Headers(options.headers).get("cookie")).toBeNull();
    expect(new Headers(options.headers).get("x-api-key")).toBeNull();
    expect(options.redirect).toBe("manual");
    expect(options.credentials).toBe("omit");
    const redirect = new RescueOperatorClient({
      baseUrl,
      auth,
      fetch: async () =>
        new Response(null, { status: 302, headers: { location: "https://attacker.example" } }),
    });
    await expect(redirect.list()).rejects.toMatchObject({ code: "REDIRECT_REJECTED" });
  });

  it("rejects malformed IDs and request envelopes before any fetch", async () => {
    const { client, fetcher } = await fixture();
    for (const id of [
      "../.env",
      "https://attacker.example",
      "rjob_abc",
      "rjob_" + "z".repeat(64),
    ]) {
      await expect(client.get(id)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
      await expect(client.run(id)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    }
    await expect(
      client.create({
        ...creation,
        request: { ...creation.request, schemaVersion: "wrong" as never },
      }),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(
      client.create({
        ...creation,
        request: { ...creation.request, playbook: { text: "x".repeat(65_537) } },
      }),
    ).rejects.toMatchObject({ code: "BODY_TOO_LARGE" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("lets server canonical validation reject invalid episodes and playbooks", async () => {
    const { client } = await fixture();
    await expect(
      client.create({ ...creation, request: { ...creation.request, episodeId: "hidden-final" } }),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST", status: 400 });
    await expect(
      client.create({
        ...creation,
        request: {
          ...creation.request,
          playbook: { ...rescueCommanderStarterPlaybook, maxServicePriceCredits: -1 },
        },
      }),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST", status: 400 });
  });

  it("rejects leaked fencing capabilities and responses for the wrong job", async () => {
    const { client } = await fixture();
    const { job } = await client.create(creation);
    for (const unsafe of [
      { ...job, runToken: "PRIVATE_RUN_TOKEN" },
      {
        ...job,
        events: [
          ...job.events,
          { sequence: 2, at: 1, type: "running", data: { workerId: "PRIVATE_WORKER" } },
        ],
      },
      { ...job, jobId: `rjob_${"f".repeat(64)}` },
    ]) {
      const injected = new RescueOperatorClient({
        baseUrl,
        auth,
        fetch: async () => Response.json({ job: unsafe }),
      });
      await expect(injected.get(job.jobId)).rejects.toMatchObject({
        code: "INVALID_RESPONSE",
        details: null,
      });
    }
  });

  it("never echoes remote error code/message/details or auth-provider secrets", async () => {
    const remote = new RescueOperatorClient({
      baseUrl,
      auth,
      fetch: async () =>
        Response.json(
          {
            error: {
              code: `PRIVATE_${token}`,
              message: `PRIVATE_PROVIDER_SECRET ${token}`,
              details: { nested: "PRIVATE_DETAILS" },
            },
          },
          { status: 500 },
        ),
    });
    try {
      await remote.list();
      throw new Error("Expected rejection");
    } catch (error) {
      expect(error).toMatchObject({ code: "OPERATOR_REQUEST_FAILED", status: 500, details: null });
      expect(String(error)).not.toContain("PRIVATE");
      expect(String(error)).not.toContain(token);
    }
    const provider = new RescueOperatorClient({
      baseUrl,
      auth: {
        getHeaders: async () => {
          throw new Error("PRIVATE_CREDENTIAL_SOURCE");
        },
      },
    });
    await expect(provider.list()).rejects.toMatchObject({ code: "NETWORK_ERROR", details: null });
  });

  it("does not retry an ambiguous timed-out operator request", async () => {
    const fetcher = vi.fn<typeof fetch>(() => new Promise(() => undefined));
    const client = new RescueOperatorClient({ baseUrl, auth, fetch: fetcher, timeoutMs: 10 });
    await expect(client.run(`rjob_${"1".repeat(64)}`)).rejects.toMatchObject({
      code: "TIMEOUT",
      retryable: false,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects an unexpected successful status for run", async () => {
    const { client } = await fixture();
    const { job } = await client.create(creation);
    const unexpected = new RescueOperatorClient({
      baseUrl,
      auth,
      fetch: async () => Response.json({ job }, { status: 200 }),
    });
    await expect(unexpected.run(job.jobId)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});

describe("local rescue-jobs CLI", () => {
  it("runs create/list/get/run through injected HTTP without printing credentials or raw playbooks", async () => {
    const { root, fetcher, handler, executeJob } = await fixture();
    await mkdir(join(root, "secrets"));
    await writeFile(
      join(root, "secrets/rescue-operator-http.json"),
      JSON.stringify({ schemaVersion: "rescue-operator-http-v1", token }),
    );
    const file = join(root, "request.json");
    await writeFile(file, JSON.stringify(creation));
    const output: string[] = [];
    const options = {
      root,
      fetch: fetcher,
      write: (message: string) => {
        output.push(message);
      },
    };
    expect(await runRescueJobsCli(["create", "--file", file], options)).toBe(0);
    const jobId = JSON.parse(output[0]!).job.jobId as string;
    expect(executeJob).not.toHaveBeenCalled();
    expect(await runRescueJobsCli(["list"], options)).toBe(0);
    expect(await runRescueJobsCli(["get", "--job", jobId], options)).toBe(0);
    expect(await runRescueJobsCli(["run", "--job", jobId], options)).toBe(0);
    await handler.waitForIdle();
    expect(executeJob).toHaveBeenCalledTimes(1);
    expect(output.join("\n")).not.toContain(token);
    expect(output.join("\n")).not.toContain("instructions");
    expect(output.join("\n")).not.toContain("private-worker");
    for (const [url] of fetcher.mock.calls) expect(new URL(String(url)).origin).toBe(baseUrl);
  });

  it("keeps help offline and rejects remote overrides, missing credentials and malformed files safely", async () => {
    const { root, fetcher } = await fixture();
    const output: string[] = [];
    const options = {
      root,
      fetch: fetcher,
      write: (message: string) => {
        output.push(message);
      },
    };
    expect(await runRescueJobsCli(["--help"], options)).toBe(0);
    expect(
      await runRescueJobsCli(["list", "--base-url", "https://attacker.example"], options),
    ).toBe(1);
    expect(await runRescueJobsCli(["list"], options)).toBe(1);
    await mkdir(join(root, "secrets"));
    await writeFile(
      join(root, "secrets/rescue-operator-http.json"),
      JSON.stringify({ schemaVersion: "wrong", token: "PRIVATE_INVALID_TOKEN" }),
    );
    expect(await runRescueJobsCli(["list"], options)).toBe(1);
    expect(output.join("\n")).not.toContain("PRIVATE");
    expect(output.join("\n")).not.toContain(root);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
