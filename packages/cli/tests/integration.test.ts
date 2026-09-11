import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli, type CliOptions } from "../src/index.js";
import { atomicJson, digest } from "../src/files.js";
import { makeManifest, starterZip, hash } from "./fixtures.js";
import type { CredentialStore } from "../src/credential-store.js";

const strategy = {
  schemaVersion: "2",
  name: "Strategy",
  primarySupplierOrder: ["harbor-aid", "northstar", "inland-works", "local-grid", "airbridge"],
  emergencySupplierOrder: ["harbor-aid", "northstar", "inland-works", "local-grid", "airbridge"],
  regionPolicy: "deadline-first",
  reserveKits: 50,
  emergencyBudgetUsd: 1000,
};
const submissionId = `0x${"2".repeat(64)}`;
const participant = {
  participantId: hash,
  challengeId: "disaster-response",
  userIdHash: hash,
  wallet: `0x${"1".repeat(40)}`,
  displayName: "Local test",
  joinedAt: "2026-01-01T00:00:00.000Z",
};
const session = {
  userId: "local-user",
  wallet: participant.wallet,
  scopes: [
    "disaster-response:read",
    "disaster-response:join",
    "disaster-response:submit",
    "disaster-response:entry",
  ],
  expiresAt: "2099-01-01T00:00:00.000Z",
  revoked: false,
};
class FakeStore implements CredentialStore {
  token: string | null = "test-secret";
  async get() {
    return this.token;
  }
  async set(_origin: string, token: string) {
    this.token = token;
  }
  async delete() {
    this.token = null;
  }
}
describe("CLI against local HTTP API", () => {
  let server: Server;
  let root: string;
  let baseUrl: string;
  let store: FakeStore;
  let manifest: ReturnType<typeof makeManifest>;
  let archive: Uint8Array;
  let requests: Array<{
    path: string;
    method: string;
    body: string;
    key?: string;
    context?: string;
    auth?: string;
  }>;
  let correct: boolean;
  let joined: boolean;
  let saved: Record<string, unknown> | null;
  let selected: Record<string, unknown> | null;
  let loseResponse: boolean;
  let failStatus: number;
  let authPoll: number;
  let rawExtra: Record<string, unknown>;
  const raw = () => ({
    state: "measured",
    contextHash: manifest.context.contextHash,
    manifestHash: hash,
    inputHash: hash,
    resultHash: hash,
    dataVersion: "1",
    evaluatorVersion: "1",
    correctness: correct,
    totalProcurementCost: 100,
    worstCaseDeliveredKits: 50,
    regionalFairnessPpm: 800000,
    strategy,
    ...rawExtra,
  });
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "frontier-cli-http-"));
    store = new FakeStore();
    manifest = makeManifest();
    manifest.artifact.sample = strategy;
    manifest.artifact.schema = {
      type: "object",
      required: ["name"],
      properties: { name: { type: "string" } },
    };
    manifest.context.metrics = [
      {
        key: "totalProcurementCost",
        name: "Cost",
        direction: "MINIMIZE",
        unit: "USD",
        lowerBound: 0,
        upperBound: 1000,
      },
    ];
    archive = starterZip(manifest);
    manifest.starter.sha256 = digest(archive);
    requests = [];
    correct = true;
    joined = false;
    saved = null;
    selected = null;
    loseResponse = false;
    failStatus = 0;
    authPoll = 0;
    rawExtra = {
      additionalEvidence: {
        source: "local-fake",
        state: "committed",
        retained: true,
      },
    };
    server = createServer(async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks).toString();
      const path = req.url!;
      requests.push({
        path,
        method: req.method!,
        body,
        key: req.headers["idempotency-key"] as string,
        context: req.headers["x-frontier-context-hash"] as string,
        auth: req.headers.authorization,
      });
      const reply = (value: unknown, status = 200) => {
        res.writeHead(status, {
          "content-type": "application/json",
          ...(status === 429 ? { "retry-after": "9" } : {}),
        });
        res.end(JSON.stringify(value));
      };
      if (failStatus)
        return reply(
          {
            error: {
              code: failStatus === 429 ? "RATE_LIMITED" : `HTTP_${failStatus}`,
              message: "test failure",
            },
          },
          failStatus,
        );
      if (path === "/v1/cli/arenas") return reply({ schemaVersion: "1", arenas: [manifest] });
      if (path === "/v1/cli/arenas/disaster-response") return reply(manifest);
      if (path === "/starter") {
        res.writeHead(200, { "content-type": "application/zip" });
        res.end(archive);
        return;
      }
      if (path === "/v1/disaster-response/evaluations") return reply(raw());
      if (path === "/v1/cli/auth/session") return reply(session);
      if (path === "/v1/cli/auth/device")
        return reply({
          device_code: "device-secret",
          user_code: "CODE-1234",
          verification_uri: `${baseUrl}/cli/authorize`,
          expires_in: 600,
          interval: 1,
        });
      if (path === "/v1/cli/auth/token") {
        authPoll++;
        if (authPoll === 1)
          return reply({ error: { code: "authorization_pending", message: "Pending" } }, 400);
        if (authPoll === 2)
          return reply({ error: { code: "slow_down", message: "Slow down" } }, 400);
        return reply({
          access_token: "new-test-secret",
          token_type: "Bearer",
          expires_in: 28800,
        });
      }
      if (path === "/v1/cli/auth/revoke") return reply({ revoked: true });
      if (path === "/v1/challenges/disaster-response/submissions/mine")
        return reply({
          participant: joined ? participant : null,
          submissions: saved ? [saved] : [],
          finalEntry: selected,
        });
      if (path === "/v1/challenges/disaster-response/join") {
        joined = true;
        return reply({ storage: "ephemeral-memory", participant });
      }
      if (path === "/v1/challenges/disaster-response/submissions") {
        if (!saved) {
          const input = JSON.parse(body);
          saved = {
            submissionId,
            participantId: hash,
            challengeId: "disaster-response",
            revision: 1,
            sourceHash: hash,
            inputHash: hash,
            artifact: { strategy: input.strategy },
            evaluation: raw(),
            submittedAt: "2026-01-01T00:00:00.000Z",
            ...Object.fromEntries(Object.entries(input).filter(([k]) => k !== "strategy")),
          };
        }
        if (loseResponse) {
          loseResponse = false;
          req.socket.destroy();
          return;
        }
        return reply({ storage: "ephemeral-memory", submission: saved });
      }
      if (path === "/v1/challenges/disaster-response/final-entry") {
        selected = {
          participantId: hash,
          challengeId: "disaster-response",
          submissionId: JSON.parse(body).submissionId,
          selectedAt: "2026-01-01T00:00:00.000Z",
        };
        return reply({ storage: "ephemeral-memory", finalEntry: selected });
      }
      return reply({ error: { code: "NOT_FOUND", message: path } }, 404);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterEach(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(root, { recursive: true, force: true });
  });
  async function cli(args: string[], overrides: CliOptions = {}) {
    let out = "";
    let err = "";
    const code = await runCli([...args, "--json", "--base-url", baseUrl], {
      cwd: root,
      env: {},
      store,
      interactive: false,
      stdout: (s) => (out += s),
      stderr: (s) => (err += s),
      ...overrides,
    });
    expect(out.trim().split("\n")).toHaveLength(1);
    expect(out + err).not.toContain("test-secret");
    expect(out + err).not.toContain("device-secret");
    return { code, value: JSON.parse(out), err };
  }
  async function init() {
    expect((await cli(["init", "disaster-response"])).code).toBe(0);
  }
  it("lists, initializes, checks offline, runs, preserves raw outcomes, compares and downloads", async () => {
    expect((await cli(["arenas", "list"])).value.data.arenas).toHaveLength(1);
    await init();
    const count = requests.length;
    expect(
      (
        await cli(["check"], {
          fetch: async () => {
            throw new Error("offline");
          },
        })
      ).value.data.correctness,
    ).toBe("not-evaluated");
    expect(requests).toHaveLength(count);
    const first = await cli(["practice", "--wait"]);
    expect(first.code).toBe(0);
    expect(first.value.data.raw.additionalEvidence).toEqual(rawExtra.additionalEvidence);
    const second = await cli(["practice"]);
    expect(second.value.data.resultHash).toBe(first.value.data.resultHash);
    expect((await cli(["runs", "list"])).value.data.runs).toHaveLength(2);
    expect((await cli(["runs", "inspect", first.value.data.runId])).value.data.raw).toEqual(
      first.value.data.raw,
    );
    expect(
      (await cli(["compare", first.value.data.runId, second.value.data.runId])).value.data.relation,
    ).toBe("equal");
    const submitted = await cli(["submit", "--yes"]);
    expect(submitted.code).toBe(0);
    expect(requests.find((r) => r.path.endsWith("/evaluations"))?.context).toBe(hash);
    expect(requests.filter((r) => r.path.startsWith("/v1/cli/arenas")).every((r) => !r.auth)).toBe(
      true,
    );
    expect((await cli(["submissions", "inspect", submissionId])).value.data.submissionId).toBe(
      submissionId,
    );
    expect(
      (await cli(["submissions", "download", submissionId, "--output", "download.json"])).code,
    ).toBe(0);
    expect(JSON.parse(await readFile(join(root, "download.json"), "utf8"))).toEqual(strategy);
    expect(
      (await cli(["submissions", "download", submissionId, "--output", "download.json"])).value
        .error.code,
    ).toBe("FILE_EXISTS");
    expect((await cli(["entry", "select", submissionId, "--yes"])).value.data.state).toBe(
      "selected",
    );
    expect(
      (
        await cli(["open", submissionId, "--print-url"], {
          open: async () => {
            throw new Error("must not open");
          },
        })
      ).value.data.url,
    ).toBe(`${baseUrl}/submissions/${submissionId}?arena=disaster-response`);
    expect((await cli(["open", first.value.data.runId])).value.error.code).toBe(
      "RESULT_NOT_PERSISTED",
    );
  });
  it("persists correctness failures as normal inspectable runs with exit 8", async () => {
    await init();
    correct = false;
    const result = await cli(["practice"]);
    expect(result.code).toBe(8);
    expect(result.value.ok).toBe(true);
    expect((await cli(["runs", "inspect", result.value.data.runId])).value.data.correctness).toBe(
      false,
    );
  });
  it("requires explicit consent before participation, submission, context update, or entry selection", async () => {
    await init();
    expect((await cli(["submit"])).code).toBe(3);
    expect(
      requests.filter((r) => r.method === "POST" && !r.path.startsWith("/v1/cli/auth")),
    ).toHaveLength(0);
    await cli(["submit", "--yes"]);
    expect((await cli(["entry", "select", submissionId])).code).toBe(3);
    expect(selected).toBeNull();
    manifest.context.dataVersion = "2";
    expect((await cli(["context", "update"])).code).toBe(3);
    expect((await cli(["context", "update", "--yes"])).value.data.lock.context.dataVersion).toBe(
      "2",
    );
  });
  it("resumes a lost response using identical bytes/key after artifact and context changes", async () => {
    await init();
    loseResponse = true;
    const failed = await cli(["submit", "--yes"]);
    expect(failed.code).toBe(7);
    const operationId = failed.value.error.details.operationId;
    await atomicJson(
      join(root, "strategy.json"),
      { ...strategy, name: "Edited after submit" },
      true,
    );
    manifest.context.contextHash = `0x${"3".repeat(64)}`;
    const beforeResume = requests.length;
    const result = await cli(["submit", "--resume", operationId]);
    expect(result.code).toBe(0);
    expect(result.value.data.submission.revision).toBe(1);
    const sent = requests.filter((r) => r.path === "/v1/challenges/disaster-response/submissions");
    expect(sent).toHaveLength(2);
    expect(sent[1].body).toBe(sent[0].body);
    expect(sent[1].key).toBe(sent[0].key);
    expect(sent[1].context).toBe(hash);
    expect(requests.slice(beforeResume).some((r) => r.path.startsWith("/v1/cli/arenas"))).toBe(
      false,
    );
    const operations = await readdir(join(root, ".frontier", "operations"));
    for (const name of operations)
      expect(await readFile(join(root, ".frontier", "operations", name), "utf8")).not.toContain(
        "test-secret",
      );
  });
  it("supports no-browser authorization, pending and slow-down without token output", async () => {
    store.token = null;
    let now = 0;
    const waits: number[] = [];
    const result = await cli(["auth", "login", "--no-browser"], {
      now: () => now,
      sleep: async (ms) => {
        waits.push(ms);
        now += ms;
      },
      open: async () => {
        throw new Error("must not open");
      },
    });
    expect(result.code).toBe(0);
    expect(result.err).toContain("CODE-1234");
    expect(store.token).toBe("new-test-secret");
    expect(waits).toEqual([1000, 1000, 6000]);
    expect((await cli(["auth", "status"])).value.data.userId).toBe(session.userId);
    expect((await cli(["auth", "logout"])).value.data.serverRevocation).toBe("revoked");
    expect(store.token).toBeNull();
  });
  it.each([
    [401, 3],
    [429, 6],
    [503, 5],
  ])("returns stable exit for HTTP %i", async (status, exit) => {
    failStatus = status;
    const result = await cli(["arenas", "list"]);
    expect(result.code).toBe(exit);
    if (status === 429) expect(result.value.error.details.retryAfter).toBe("9");
  });
  it("keeps timeout single-shot and reports unknown server completion", async () => {
    await init();
    let posts = 0;
    const result = await cli(["practice", "--timeout-ms", "10"], {
      fetch: async (url, init) => {
        if (String(url).endsWith("/evaluations")) {
          posts++;
          return new Promise<Response>(() => {});
        }
        return fetch(url, init);
      },
    });
    expect(result.code).toBe(7);
    expect(posts).toBe(1);
    expect(result.value.error.details.retryMayConsumePracticeRun).toBe(true);
  });
  it("saves response-context mismatches only as diagnostic evidence", async () => {
    await init();
    rawExtra.contextHash = `0x${"9".repeat(64)}`;
    const result = await cli(["practice"]);
    expect(result.code).toBe(4);
    expect(result.value.error.details.diagnosticId).toMatch(/^diagnostic_/);
    expect((await cli(["runs", "list"])).value.data.runs).toHaveLength(0);
    const diagnostic = JSON.parse(
      await readFile(
        join(root, ".frontier", "diagnostics", `${result.value.error.details.diagnosticId}.json`),
        "utf8",
      ),
    );
    expect(diagnostic.raw.contextHash).toBe(rawExtra.contextHash);
  });
  it("handles Rescue Room episodes and keeps simulated credit evidence intact", async () => {
    const rescue = makeManifest("rescue-room");
    rescue.context.metrics = [
      {
        key: "totalUserLossUsd",
        name: "Loss",
        direction: "MINIMIZE",
        unit: "USD",
        lowerBound: 0,
        upperBound: 1000,
      },
    ];
    rescue.episodes.push({
      id: "episode-2",
      headline: "Second public episode",
    });
    const bytes = starterZip(rescue);
    rescue.starter.sha256 = digest(bytes);
    let posts = 0;
    const fake: typeof fetch = async (url, init) => {
      const path = new URL(String(url)).pathname;
      if (path === "/v1/cli/arenas/rescue-room") return Response.json(rescue);
      if (path === "/starter") return new Response(new Uint8Array(bytes));
      if (path === "/v1/rescue-room/doctrine-evaluations") {
        posts++;
        const body = JSON.parse(String(init?.body));
        expect(new Headers(init?.headers).get("X-Frontier-Runtime-Context-Hash")).toBe(hash);
        return Response.json({
          state: "simulated",
          strategyState: "deterministic-rules",
          paymentState: "game-credits",
          contextHash: hash,
          doctrineContextHash: hash,
          manifestHash: hash,
          doctrineHash: hash,
          evaluationHash: hash,
          interpreterVersion: "1",
          doctrine: body.doctrine,
          episode: { id: body.episodeId },
          outcome: {
            correctness: true,
            resultHash: hash,
            userLossUsd: 42,
            servedProtocolDemandPpm: 750000,
            netResponseSpendCredits: 12,
          },
          rewardEligibility: { eligible: false, reason: "Controlled practice" },
          eventLog: [{ observed: true }],
        });
      }
      throw new Error(`Unexpected request: ${path}`);
    };
    expect((await cli(["init", "rescue-room"], { fetch: fake })).code).toBe(0);
    expect(JSON.parse(await readFile(join(root, "payment-contract.json"), "utf8"))).toMatchObject({
      state: "game-ledger-only",
      token: "rUSD-DEMO",
    });
    const first = await cli(["practice"], { fetch: fake });
    expect(first.code).toBe(0);
    expect(first.value.data.episodeId).toBe("episode-1");
    expect(first.value.data.values.totalUserLossUsd).toBe(42);
    expect(first.value.data.raw.paymentState).toBe("game-credits");
    expect(first.value.data.raw.rewardEligibility.eligible).toBe(false);
    const second = await cli(["practice", "--episode", "episode-2"], {
      fetch: fake,
    });
    expect(second.code).toBe(0);
    expect((await cli(["compare", first.value.data.runId, second.value.data.runId])).code).toBe(4);
    store.token = null;
    expect((await cli(["submit", "--yes"], { fetch: fake })).code).toBe(5);
    expect(posts).toBe(2);
  });
  it("rejects cross-origin tokens before any request and supports authenticated history without a project", async () => {
    const result = await cli(["auth", "status"], {
      env: {
        FRONTIER_TOKEN: "test-secret",
        FRONTIER_TOKEN_ORIGIN: "https://other.example",
      },
    });
    expect(result.code).toBe(3);
    expect(requests).toHaveLength(0);
    expect((await cli(["submissions", "list"])).value.data.submissions).toEqual([]);
  });
  it("deletes local credentials even when server revocation fails", async () => {
    const result = await cli(["auth", "logout"], {
      fetch: async () => {
        throw new Error("offline");
      },
    });
    expect(result.code).toBe(7);
    expect(result.value.error.details.localDeleted).toBe(true);
    expect(store.token).toBeNull();
  });
  it("reports unavailable keychains without creating authorization or plaintext files", async () => {
    const result = await cli(["auth", "login", "--no-browser"], {
      store: {
        get: async () => {
          throw Object.assign(new Error("locked"), {
            code: "CREDENTIAL_STORE_UNAVAILABLE",
          });
        },
        set: async () => {
          throw new Error("must not save");
        },
        delete: async () => {},
      },
    });
    expect(result.code).toBe(5);
    expect(requests).toHaveLength(0);
    expect(await readdir(root)).toEqual([]);
  });
  it("uses compact human listings while preserving the JSON envelope", async () => {
    let output = "";
    expect(
      await runCli(["arenas", "list", "--base-url", baseUrl], {
        cwd: root,
        env: {},
        stdout: (text) => (output += text),
        stderr: () => {},
      }),
    ).toBe(0);
    expect(output).toContain("Practice");
    expect(output).toContain("Submit");
    expect(output).toContain("disaster-response");
    expect(output).not.toContain("primarySupplierOrder");
    expect(output).not.toContain("schemaVersion");
    const json = await cli(["arenas", "list"]);
    expect(json.value.data.arenas[0].artifact.sample).toEqual(strategy);
  });
  it("rejects a partially updated cached manifest before reading the project as valid", async () => {
    await init();
    const changed = structuredClone(manifest);
    changed.context.dataVersion = "2";
    await atomicJson(join(root, ".frontier", "manifest.json"), changed, true);
    const result = await cli(["context", "inspect"]);
    expect(result.code).toBe(4);
    expect(result.value.error.code).toBe("PROJECT_UPDATE_INCOMPLETE");
    expect((await cli(["context", "update"])).code).toBe(3);
    expect((await cli(["context", "update", "--yes"])).code).toBe(0);
    expect((await cli(["context", "inspect"])).code).toBe(0);
  });
});
