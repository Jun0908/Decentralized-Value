import { describe, expect, it } from "vitest";
import {
  defaultDisasterResponseStrategy,
  publicDisasterResponseScenario,
} from "@frontier/disaster-response";
import benchmark from "../../../benchmarks/evm-orderbook/results/latest.json";
import { createApi, MemoryPlan6CompetitionStore } from "./index";
import { CliAuthService, MemoryCliAuthStore, type CliAuthScope } from "./cli-auth";

function fixture() {
  let now = Date.now();
  const origin = "http://localhost";
  const identity = async (request: Request) => {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (
      !["fixture-alice", "fixture-bob"].includes(token ?? "") ||
      request.headers.get("x-privy-identity-token") !== token
    )
      throw new Error("Invalid fixture identity");
    return {
      userId: token!,
      wallet:
        token === "fixture-alice"
          ? ("0x1111111111111111111111111111111111111111" as const)
          : ("0x2222222222222222222222222222222222222222" as const),
    };
  };
  const store = new MemoryPlan6CompetitionStore();
  const cliAuth = new CliAuthService({
    store: new MemoryCliAuthStore(),
    identity,
    origin,
    now: () => now,
    production: false,
  });
  const api = createApi(benchmark, undefined, undefined, undefined, { store, identity, cliAuth });
  const call = (
    path: string,
    method = "GET",
    payload?: unknown,
    token?: string,
    headers?: Record<string, string>,
  ) =>
    api.fetch(
      new Request(`${origin}${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      }),
    );
  const login = async (user = "fixture-alice", scopes?: CliAuthScope[]) => {
    const deviceResponse = await call("/v1/cli/auth/device", "POST", scopes ? { scopes } : {});
    const device = await deviceResponse.json();
    expect(deviceResponse.status).toBe(200);
    const approval = await call(
      "/v1/cli/auth/approve",
      "POST",
      { user_code: device.user_code, decision: "approve" },
      user,
      {
        origin,
        "x-frontier-cli-csrf": "1",
        "x-privy-identity-token": user,
      },
    );
    expect(approval.status).toBe(200);
    const issued = await call("/v1/cli/auth/token", "POST", { device_code: device.device_code });
    expect(issued.status).toBe(200);
    return (await issued.json()).access_token as string;
  };
  return {
    api,
    store,
    call,
    login,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

const challenge = "/v1/challenges/disaster-response";
const submission = { strategy: defaultDisasterResponseStrategy, sourceMethod: "JSON" };
const keyHeaders = {
  "idempotency-key": "fixture-operation-001",
  "x-frontier-context-hash": publicDisasterResponseScenario().contextHash,
};

describe("CLI authentication and submission integration", () => {
  it("uses one account to join, submit, retrieve and select without granting payment authority", async () => {
    const f = fixture();
    const token = await f.login();
    const manifest = await (await f.call("/v1/cli/arenas/disaster-response")).json();
    expect(manifest.capabilities.submit.available).toBe(true);
    expect((await f.call(`${challenge}/join`, "POST", {}, token)).status).toBe(201);
    const saved = await f.call(`${challenge}/submissions`, "POST", submission, token, keyHeaders);
    expect(saved.status).toBe(201);
    const { submission: record } = await saved.json();
    const mine = await f.call(`${challenge}/submissions/mine`, "GET", undefined, token);
    expect(mine.headers.get("cache-control")).toBe("no-store");
    expect((await mine.json()).submissions[0].submissionId).toBe(record.submissionId);
    expect(
      (
        await f.call(
          `${challenge}/final-entry`,
          "PUT",
          { submissionId: record.submissionId },
          token,
          keyHeaders,
        )
      ).status,
    ).toBe(200);
    for (const path of [
      `${challenge}/demo-settlement`,
      `${challenge}/value-pools`,
      "/v1/challenges/emergency-supply/join",
    ]) {
      expect((await f.call(path, "POST", {}, token)).status).toBe(403);
    }
  });

  it("atomically returns one revision for concurrent retries and rejects a changed body", async () => {
    const f = fixture();
    const token = await f.login();
    await f.call(`${challenge}/join`, "POST", {}, token);
    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        f.call(`${challenge}/submissions`, "POST", submission, token, keyHeaders),
      ),
    );
    expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
    const records = await Promise.all(responses.map((r) => r.json()));
    expect(new Set(records.map((r) => r.submission.submissionId)).size).toBe(1);
    const changed = await f.call(
      `${challenge}/submissions`,
      "POST",
      {
        ...submission,
        strategy: { ...submission.strategy, reserveKits: submission.strategy.reserveKits + 1 },
      },
      token,
      keyHeaders,
    );
    expect(changed.status).toBe(409);
    expect((await changed.json()).error.code).toBe("IDEMPOTENCY_CONFLICT");
    const mine = await (
      await f.call(`${challenge}/submissions/mine`, "GET", undefined, token)
    ).json();
    expect(mine.submissions).toHaveLength(1);
  });

  it("returns saved operations before checking today's Context, but rejects unsaved stale operations", async () => {
    const f = fixture();
    const token = await f.login();
    await f.call(`${challenge}/join`, "POST", {}, token);
    const first = await (
      await f.call(`${challenge}/submissions`, "POST", submission, token, keyHeaders)
    ).json();
    const stale = { ...keyHeaders, "x-frontier-context-hash": `0x${"0".repeat(64)}` };
    const resumed = await f.call(`${challenge}/submissions`, "POST", submission, token, stale);
    expect(resumed.status).toBe(200);
    expect((await resumed.json()).submission.submissionId).toBe(first.submission.submissionId);
    const unsaved = await f.call(`${challenge}/submissions`, "POST", submission, token, {
      ...stale,
      "idempotency-key": "new-operation-stale",
    });
    expect(unsaved.status).toBe(409);
    expect((await unsaved.json()).error.code).toBe("CONTEXT_MISMATCH");
  });

  it("enforces token scope, expiry, revocation and no fallback into browser authentication", async () => {
    const f = fixture();
    const readOnly = await f.login("fixture-alice", ["disaster:read"]);
    expect((await f.call(`${challenge}/join`, "POST", {}, readOnly)).status).toBe(403);
    expect((await f.call(`${challenge}/submissions/mine`, "GET", undefined, readOnly)).status).toBe(
      200,
    );
    expect((await f.call("/v1/cli/auth/revoke", "POST", {}, readOnly)).status).toBe(200);
    expect((await f.call(`${challenge}/submissions/mine`, "GET", undefined, readOnly)).status).toBe(
      401,
    );
    const token = await f.login();
    f.advance(8 * 60 * 60 * 1000 + 1);
    expect((await f.call(`${challenge}/join`, "POST", {}, token)).status).toBe(401);
    expect((await f.call(`${challenge}/join`, "POST", {}, "frontier_cli_invalid")).status).toBe(
      401,
    );
  });

  it("keeps accounts separate and does not consume a new revision after an old retry", async () => {
    const f = fixture();
    const alice = await f.login();
    await f.call(`${challenge}/join`, "POST", {}, alice);
    const first = await (
      await f.call(`${challenge}/submissions`, "POST", submission, alice, keyHeaders)
    ).json();
    const bob = await f.login("fixture-bob");
    await f.call(`${challenge}/join`, "POST", {}, bob);
    const bobHistory = await (
      await f.call(`${challenge}/submissions/mine`, "GET", undefined, bob)
    ).json();
    expect(bobHistory.submissions).toHaveLength(0);
    expect(
      (
        await f.call(
          `${challenge}/final-entry`,
          "PUT",
          { submissionId: first.submission.submissionId },
          bob,
        )
      ).status,
    ).toBe(404);
    f.advance(25 * 60 * 60 * 1000);
    const newAliceSession = await f.login();
    const retry = await f.call(
      `${challenge}/submissions`,
      "POST",
      submission,
      newAliceSession,
      keyHeaders,
    );
    expect(retry.status).toBe(200);
    expect((await retry.json()).submission.revision).toBe(1);
  });
});
