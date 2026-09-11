import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  FrontierClient,
  FrontierError,
  compareRuns,
  cliArenaManifestSchema,
  cliRunSchema,
  type CliRun,
  type SubmissionBody,
} from "../packages/sdk/src/index.js";
import disasterFixture from "./fixtures/disaster-response.json";
import rescueFixture from "./fixtures/rescue-room.json";

const disaster = cliArenaManifestSchema.parse(disasterFixture.manifest);
const rescue = cliArenaManifestSchema.parse(rescueFixture.manifest);
const hash: `0x${string}` = `0x${"ab".repeat(32)}`;
const participant = {
  participantId: hash,
  challengeId: disaster.challengeId,
  userIdHash: hash,
  wallet: `0x${"12".repeat(20)}`,
  displayName: "Test",
  joinedAt: "2026-09-11T00:00:00.000Z",
};
const finalEntry = {
  participantId: hash,
  challengeId: disaster.challengeId,
  submissionId: hash,
  selectedAt: "2026-09-11T00:00:00.000Z",
};
const submission = {
  submissionId: hash,
  participantId: hash,
  challengeId: disaster.challengeId,
  revision: 1,
  sourceMethod: "JSON",
  sourceHash: hash,
  inputHash: disasterFixture.raw.inputHash,
  artifact: { strategy: disaster.artifact.sample },
  evaluation: disasterFixture.raw,
  repositoryUrl: null,
  sourceCommit: null,
  agentEvidence: null,
  submittedAt: "2026-09-11T00:00:00.000Z",
};

function fixtureClient(fixture = disasterFixture, override?: Record<string, unknown>) {
  const fetcher = vi.fn<typeof fetch>(async (url) =>
    String(url).includes("/cli/arenas/")
      ? Response.json(fixture.manifest)
      : Response.json({ ...fixture.raw, ...override }),
  );
  return {
    client: new FrontierClient({ baseUrl: "https://api.example", fetch: fetcher }),
    fetcher,
  };
}
const practiceInput = {
  arenaId: disaster.id,
  context: disaster.context,
  artifact: disaster.artifact.sample,
};

describe("typed practice adapters", () => {
  it("sends a strategy directly and retains canonical input/result hashes and all evidence", async () => {
    const { client, fetcher } = fixtureClient();
    const a = await client.evaluations.practice(practiceInput);
    const b = await client.evaluations.practice(practiceInput);
    const request = fetcher.mock.calls[1]![1]!;
    expect(JSON.parse(String(request.body))).toEqual(disaster.artifact.sample);
    expect(new Headers(request.headers).get("x-frontier-context-hash")).toBe(
      disaster.context.contextHash,
    );
    expect(a.artifactHash).toBe(disasterFixture.raw.inputHash);
    expect(a.resultHash).toBe(disasterFixture.raw.resultHash);
    expect(a.raw).toEqual(disasterFixture.raw);
    expect(a.runId).not.toBe(b.runId);
    expect(a.resultHash).toBe(b.resultHash);
    expect(a.artifactHash).toBe(b.artifactHash);
    expect(cliRunSchema.safeParse(a).success).toBe(true);
  });

  it("wraps Doctrine, reads outcome correctness and maps the official single-Episode metrics", async () => {
    const fetcher = vi.fn<typeof fetch>(async (url) =>
      String(url).includes("/cli/arenas/")
        ? Response.json(rescue)
        : Response.json({
            ...rescueFixture.raw,
            correctness: true,
            outcome: { ...rescueFixture.raw.outcome, correctness: false },
          }),
    );
    const client = new FrontierClient({ baseUrl: "https://api.example", fetch: fetcher });
    const run = await client.evaluations.practice({
      arenaId: rescue.id,
      context: rescue.context,
      artifact: rescue.artifact.sample,
      episodeId: rescue.episodes[0]!.id,
    });
    const request = fetcher.mock.calls[1]![1]!;
    expect(JSON.parse(String(request.body))).toEqual({
      doctrine: rescue.artifact.sample,
      episodeId: rescue.episodes[0]!.id,
    });
    expect(new Headers(request.headers).get("x-frontier-runtime-context-hash")).toBe(
      rescue.context.runtimeContextHash,
    );
    expect(run.correctness).toBe(false);
    expect(run.values.totalUserLossUsd).toBe(rescueFixture.raw.outcome.userLossUsd);
    expect(run.values.servedProtocolDemandPpm).toBe(
      rescueFixture.raw.outcome.servedProtocolDemandPpm,
    );
    expect(run.artifactHash).toBe(rescueFixture.raw.doctrineHash);
    expect(run.resultHash).toBe(rescueFixture.raw.evaluationHash);
    expect(run.raw).toMatchObject({
      state: "simulated",
      paymentState: "game-credits",
      rewardEligibility: { eligible: false },
    });
  });

  it.each(["inputHash", "correctness", "contextHash", "totalProcurementCost"])(
    "rejects a response missing %s",
    async (key) => {
      const { client } = fixtureClient(disasterFixture, { [key]: undefined });
      await expect(client.evaluations.practice(practiceInput)).rejects.toMatchObject({
        code: "INVALID_RESPONSE",
      });
    },
  );
  it("rejects a context mismatch in the server response and preserves diagnostic evidence", async () => {
    const { client } = fixtureClient(disasterFixture, { contextHash: hash });
    await expect(client.evaluations.practice(practiceInput)).rejects.toMatchObject({
      code: "CONTEXT_MISMATCH",
      details: { raw: { contextHash: hash } },
    });
  });
  it("rejects a changed manifest before starting an evaluation", async () => {
    const { client, fetcher } = fixtureClient();
    await expect(
      client.evaluations.practice({
        ...practiceInput,
        context: { ...disaster.context, manifestHash: hash },
      }),
    ).rejects.toMatchObject({ code: "CONTEXT_MISMATCH" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not retry a context race rejected by the server", async () => {
    const fetcher = vi.fn<typeof fetch>(async (url) =>
      String(url).includes("/cli/arenas/")
        ? Response.json(disaster)
        : Response.json(
            { error: { code: "CONTEXT_MISMATCH", message: "Context changed" } },
            { status: 409 },
          ),
    );
    await expect(
      new FrontierClient({ baseUrl: "https://api.example", fetch: fetcher }).evaluations.practice(
        practiceInput,
      ),
    ).rejects.toMatchObject({ code: "CONTEXT_MISMATCH", status: 409 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("rejects unsupported Disaster Response Episodes", async () => {
    const { client, fetcher } = fixtureClient();
    await expect(
      client.evaluations.practice({ ...practiceInput, episodeId: "episode" }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_EPISODE" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("arena discovery and transport", () => {
  it("unwraps the versioned list without requesting credentials", async () => {
    const getHeaders = vi.fn(() => ({ Authorization: "Bearer secret" }));
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ schemaVersion: "1", arenas: [disaster, rescue] }),
    );
    const client = new FrontierClient({
      baseUrl: "https://api.example",
      fetch: fetcher,
      auth: { getHeaders },
    });
    expect(await client.arenas.list()).toEqual([disaster, rescue]);
    expect(getHeaders).not.toHaveBeenCalled();
    expect(fetcher.mock.calls[0]![1]).toMatchObject({ credentials: "omit", redirect: "manual" });
  });
  it("checks starter digest and never sends auth to the download", async () => {
    const bytes = new Uint8Array([80, 75, 3, 4]);
    const manifest = {
      ...disaster,
      starter: { path: "/starter.zip", sha256: createHash("sha256").update(bytes).digest("hex") },
    };
    const getHeaders = vi.fn(() => ({ Authorization: "Bearer secret" }));
    const client = new FrontierClient({
      baseUrl: "https://api.example",
      auth: { getHeaders },
      fetch: async () => new Response(bytes),
    });
    expect(await client.arenas.downloadStarter(disaster.id, manifest)).toEqual(bytes);
    expect(getHeaders).not.toHaveBeenCalled();
    await expect(
      client.arenas.downloadStarter(disaster.id, {
        ...manifest,
        starter: { ...manifest.starter, sha256: "00".repeat(32) },
      }),
    ).rejects.toMatchObject({ code: "STARTER_HASH_MISMATCH" });
  });
  it("rejects cross-origin starter paths before contacting either origin", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = new FrontierClient({ baseUrl: "https://api.example", fetch: fetcher });
    await expect(
      client.arenas.downloadStarter(disaster.id, {
        ...disaster,
        starter: { ...disaster.starter, path: "//other.example/kit" },
      }),
    ).rejects.toMatchObject({ code: "CROSS_ORIGIN_REQUEST" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("refuses redirects for authenticated operations", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(null, { status: 302, headers: { location: "https://other.example" } }),
    );
    const client = new FrontierClient({
      baseUrl: "https://api.example",
      fetch: fetcher,
      auth: { getHeaders: () => ({ Authorization: "Bearer secret" }) },
    });
    await expect(client.competitions.join()).rejects.toMatchObject({ code: "REDIRECT_REJECTED" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]![1]?.redirect).toBe("manual");
  });
  it.each([
    "http://example.com",
    "https://user:secret@example.com",
    "https://example.com?token=secret",
  ])("rejects unsafe base URL %s", (baseUrl) => {
    expect(() => new FrontierClient({ baseUrl })).toThrow(FrontierError);
  });
  it.each([401, 429, 503])("retains %s errors, retry-after and API codes", async (status) => {
    const client = new FrontierClient({
      baseUrl: "http://127.0.0.1:9876",
      fetch: async () =>
        Response.json(
          { error: { code: `TEST_${status}`, message: "Unavailable", details: { remaining: 0 } } },
          { status, headers: { "Retry-After": "5" } },
        ),
    });
    await expect(client.arenas.list()).rejects.toMatchObject({
      status,
      code: `TEST_${status}`,
      retryAfter: "5",
      retryable: status !== 401,
      details: { remaining: 0 },
    });
  });
  it("redacts reflected authentication headers in errors", async () => {
    const client = new FrontierClient({
      baseUrl: "https://api.example",
      auth: {
        getHeaders: () => ({
          Authorization: "Bearer super-secret",
          "x-privy-identity-token": "identity-secret",
        }),
      },
      fetch: async () =>
        Response.json(
          {
            error: {
              message: "Bearer super-secret identity-secret",
              details: { token: "super-secret" },
            },
          },
          { status: 401 },
        ),
    });
    await expect(client.competitions.join()).rejects.toMatchObject({
      message: "[REDACTED] [REDACTED]",
      details: { token: "[REDACTED]" },
    });
  });
  it("times out a pending fetch and aborts without retry", async () => {
    let signal: AbortSignal | null | undefined;
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      signal = init?.signal;
      return new Promise(() => {});
    });
    const client = new FrontierClient({
      baseUrl: "https://api.example",
      fetch: fetcher,
      timeoutMs: 10,
    });
    await expect(client.arenas.list()).rejects.toMatchObject({ code: "TIMEOUT" });
    expect(signal?.aborted).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("applies timeout while resolving auth and does not later send a request", async () => {
    let resolveHeaders: (headers: HeadersInit) => void = () => {};
    const fetcher = vi.fn<typeof fetch>();
    const client = new FrontierClient({
      baseUrl: "https://api.example",
      fetch: fetcher,
      timeoutMs: 10,
      auth: {
        getHeaders: () =>
          new Promise((resolve) => {
            resolveHeaders = resolve;
          }),
      },
    });
    await expect(client.competitions.join()).rejects.toMatchObject({ code: "TIMEOUT" });
    resolveHeaders({ Authorization: "Bearer secret" });
    await Promise.resolve();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("applies timeout to a stalled response body", async () => {
    const client = new FrontierClient({
      baseUrl: "https://api.example",
      timeoutMs: 10,
      fetch: async () => new Response(new ReadableStream({ start() {} })),
    });
    await expect(client.arenas.list()).rejects.toMatchObject({ code: "TIMEOUT" });
  });
  it("rejects non-JSON and oversized starters", async () => {
    const client = new FrontierClient({
      baseUrl: "https://api.example",
      fetch: async () => new Response("bad json"),
    });
    await expect(client.arenas.list()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    const huge = new FrontierClient({
      baseUrl: "https://api.example",
      fetch: async () =>
        new Response("zip", { headers: { "content-length": String(11 * 1024 * 1024) } }),
    });
    await expect(huge.arenas.downloadStarter(disaster.id, disaster)).rejects.toMatchObject({
      code: "STARTER_TOO_LARGE",
    });
  });
});

describe("participant submissions", () => {
  const body = { strategy: disaster.artifact.sample, sourceMethod: "JSON" } as SubmissionBody;
  it("injects both Privy headers and retains exact body/context/idempotency on repeat", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ storage: "ephemeral-memory", submission }),
    );
    const getHeaders = vi.fn(() => ({
      authorization: "Bearer access",
      "x-privy-identity-token": "identity",
    }));
    const client = new FrontierClient({
      baseUrl: "https://api.example",
      fetch: fetcher,
      auth: { getHeaders },
    });
    const input = {
      arenaId: disaster.id,
      body,
      context: disaster.context,
      idempotencyKey: "operation-123",
    };
    await client.submissions.create(input);
    await client.submissions.create(input);
    expect(getHeaders).toHaveBeenCalledTimes(2);
    for (const call of fetcher.mock.calls) {
      const request = call[1]!;
      expect(String(request.body)).toBe(JSON.stringify(body));
      const headers = new Headers(request.headers);
      expect(headers.get("authorization")).toBe("Bearer access");
      expect(headers.get("x-privy-identity-token")).toBe("identity");
      expect(headers.get("idempotency-key")).toBe(input.idempotencyKey);
      expect(headers.get("x-frontier-context-hash")).toBe(disaster.context.contextHash);
    }
  });
  it("permits lookup of an already saved operation even when its response context is old", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ storage: "ephemeral-memory", submission }),
    );
    const client = new FrontierClient({ baseUrl: "https://api.example", fetch: fetcher });
    const response = await client.submissions.create({
      arenaId: disaster.id,
      body,
      context: { ...disaster.context, contextHash: hash },
      idempotencyKey: "operation-old",
    });
    expect(response.submission.submissionId).toBe(hash);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(["artifact", "evaluation", "provenance"])(
    "rejects a returned submission with mismatched %s even on replay",
    async (field) => {
      const changed = structuredClone(submission);
      if (field === "artifact") changed.artifact.strategy.name = "Another strategy";
      if (field === "evaluation") changed.evaluation.strategy.name = "Another strategy";
      if (field === "provenance") changed.sourceMethod = "UPLOAD";
      const client = new FrontierClient({
        baseUrl: "https://api.example",
        fetch: async () => Response.json({ storage: "ephemeral-memory", submission: changed }),
      });
      await expect(
        client.submissions.create({
          arenaId: disaster.id,
          body,
          context: disaster.context,
          idempotencyKey: "operation-wrong",
        }),
      ).rejects.toMatchObject({ code: "SUBMISSION_RESPONSE_MISMATCH" });
    },
  );
  it("checks context on a fresh 201 response without treating it as a replay", async () => {
    const client = new FrontierClient({
      baseUrl: "https://api.example",
      fetch: async () =>
        Response.json({ storage: "ephemeral-memory", submission }, { status: 201 }),
    });
    await expect(
      client.submissions.create({
        arenaId: disaster.id,
        body,
        context: { ...disaster.context, contextHash: hash },
        idempotencyKey: "operation-new",
      }),
    ).rejects.toMatchObject({ code: "CONTEXT_MISMATCH" });
    expect(
      (
        await client.submissions.create({
          arenaId: disaster.id,
          body,
          context: disaster.context,
          idempotencyKey: "operation-valid",
        })
      ).submission.submissionId,
    ).toBe(hash);
  });
  it("rejects malformed source evidence and idempotency keys before sending", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = new FrontierClient({ baseUrl: "https://api.example", fetch: fetcher });
    await expect(
      client.submissions.create({
        arenaId: disaster.id,
        body: { ...body, sourceMethod: "AGENT_API" },
        context: disaster.context,
        idempotencyKey: "operation-1",
      }),
    ).rejects.toThrow();
    await expect(
      client.submissions.create({
        arenaId: disaster.id,
        body,
        context: disaster.context,
        idempotencyKey: "short",
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REQUIRED" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("lists participant history and resolves details only through that private history", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ participant, submissions: [submission], finalEntry }),
    );
    const client = new FrontierClient({ baseUrl: "https://api.example", fetch: fetcher });
    expect((await client.submissions.get(hash)).artifact.strategy).toEqual(
      disaster.artifact.sample,
    );
    await expect(client.submissions.get(`0x${"cd".repeat(32)}`)).rejects.toMatchObject({
      code: "SUBMISSION_NOT_FOUND",
    });
    expect(fetcher.mock.calls.every(([url]) => String(url).endsWith("submissions/mine"))).toBe(
      true,
    );
  });
  it("joins and selects a Final Entry without claiming payment or commitment", async () => {
    const fetcher = vi.fn<typeof fetch>(async (url) =>
      Response.json(
        String(url).endsWith("/join")
          ? { storage: "ephemeral-memory", participant }
          : { storage: "ephemeral-memory", finalEntry },
      ),
    );
    const client = new FrontierClient({ baseUrl: "https://api.example", fetch: fetcher });
    expect((await client.competitions.join()).participant.participantId).toBe(hash);
    const result = await client.entries.select(hash, disaster.context);
    expect(result).toEqual({ storage: "ephemeral-memory", finalEntry });
    expect(fetcher.mock.calls[1]![1]?.method).toBe("PUT");
    expect(JSON.parse(String(fetcher.mock.calls[1]![1]?.body))).toEqual({ submissionId: hash });
  });
  it("rejects every Rescue Room mutation locally", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = new FrontierClient({ baseUrl: "https://api.example", fetch: fetcher });
    await expect(client.competitions.join("rescue-room")).rejects.toMatchObject({
      code: "UNSUPPORTED_OPERATION",
    });
    await expect(
      client.submissions.create({
        arenaId: "rescue-room",
        body,
        context: rescue.context,
        idempotencyKey: "operation-1",
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_OPERATION" });
    await expect(client.entries.select(hash, rescue.context, "rescue-room")).rejects.toMatchObject({
      code: "UNSUPPORTED_OPERATION",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("deterministic comparison", () => {
  async function runs(): Promise<[CliRun, CliRun]> {
    const { client } = fixtureClient();
    const a = await client.evaluations.practice(practiceInput);
    return [a, structuredClone(a)];
  }
  it("reports each direction without weighted scores and gates incorrect candidates", async () => {
    const [a, b] = await runs();
    expect(compareRuns(a, b).relation).toBe("equal");
    b.values.totalProcurementCost! += 1;
    expect(compareRuns(a, b).relation).toBe("a-dominates");
    b.values.worstCaseDeliveredKits! += 1;
    expect(compareRuns(a, b).relation).toBe("tradeoff");
    a.correctness = false;
    expect(compareRuns(a, b)).toMatchObject({
      relation: "b-dominates",
      eligible: { a: false, b: true },
    });
    b.correctness = false;
    expect(compareRuns(a, b).eligible).toEqual({ a: false, b: false });
  });
  it.each([
    "contextHash",
    "runtimeContextHash",
    "manifestHash",
    "dataVersion",
    "evaluatorVersion",
    "evidenceState",
  ])("rejects different %s", async (key) => {
    const [a, b] = await runs();
    Object.assign(b.context, {
      [key]: key === "evidenceState" ? "simulated" : key.includes("Hash") ? hash : "changed",
    });
    expect(() => compareRuns(a, b)).toThrow();
  });
  it("rejects different origins, Episodes and metric definitions", async () => {
    const [a, b] = await runs();
    b.baseUrl = "https://other.example";
    expect(() => compareRuns(a, b)).toThrow();
    b.baseUrl = a.baseUrl;
    b.episodeId = "another";
    expect(() => compareRuns(a, b)).toThrow();
    b.episodeId = a.episodeId;
    b.context.metrics[0]!.upperBound += 1;
    expect(() => compareRuns(a, b)).toThrow();
  });
  it("rejects missing metrics and absent correctness", async () => {
    const [a, b] = await runs();
    delete b.values.totalProcurementCost;
    expect(() => compareRuns(a, b)).toThrow();
    expect(() => compareRuns(a, { ...a, correctness: undefined } as unknown as CliRun)).toThrow();
  });
});

describe("legacy 0.2 compatibility", () => {
  it("preserves the old constructor's relative API base path", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({}));
    await new FrontierClient("https://example.test/api", fetcher).getArenas();
    expect(String(fetcher.mock.calls[0]![0])).toBe("https://example.test/api/v1/arenas");
  });
  it("preserves explicit context IDs with the original constructor", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ contextId: "public-low-reuse", evidenceLevel: 0 }),
    );
    const client = new FrontierClient("https://example.test", fetcher);
    expect(
      await client.getCalldataContext<{ contextId: string; evidenceLevel: number }>(
        "public-low-reuse",
      ),
    ).toEqual({ contextId: "public-low-reuse", evidenceLevel: 0 });
    expect(String(fetcher.mock.calls[0]![0])).toContain("contextId=public-low-reuse");
  });
  it("surfaces original error messages", async () => {
    const client = new FrontierClient("https://example.test", async () =>
      Response.json({ error: { message: "Hard constraint failed" } }, { status: 400 }),
    );
    await expect(client.evaluate("v1/evaluations", {})).rejects.toThrow("Hard constraint failed");
  });
  it("preserves sandbox registration and never changes a simulated state", async () => {
    const fetcher = vi.fn<typeof fetch>(async (url) =>
      Response.json(
        String(url).includes("participants/register")
          ? { mode: "sandbox", storage: "ephemeral-memory", participant: {} }
          : { state: "simulated" },
      ),
    );
    const client = new FrontierClient("https://example.test", fetcher);
    await client.registerSandboxParticipant("example-v1", participant.wallet);
    expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body))).toEqual({
      challengeId: "example-v1",
      wallet: participant.wallet,
    });
    expect((await client.evaluate("v1/example", {})).state).toBe("simulated");
  });
});
