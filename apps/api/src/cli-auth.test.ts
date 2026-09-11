import { describe, expect, it, vi } from "vitest";
import { CliAuthService, MemoryCliAuthStore, cliAuthScopes } from "./cli-auth";

const origin = "http://localhost:3000";
const identity = {
  userId: "did:privy:local-test",
  wallet: "0x1111111111111111111111111111111111111111" as const,
};
const browserHeaders = {
  origin,
  authorization: "Bearer local-privy-access",
  "x-privy-identity-token": "local-identity",
  "x-frontier-cli-csrf": "1",
  "sec-fetch-site": "same-origin",
};

function setup(overrides: Partial<ConstructorParameters<typeof CliAuthService>[0]> = {}) {
  let now = 1_800_000_000_000;
  const store = new MemoryCliAuthStore();
  const resolver = vi.fn(async () => identity);
  const service = new CliAuthService({
    store,
    identity: resolver,
    origin,
    production: false,
    now: () => now,
    ...overrides,
  });
  async function call(
    action: string,
    input: unknown = {},
    headers: Record<string, string> = {},
    method = "POST",
  ) {
    const response = await service.handle(
      new Request(`${origin}/v1/cli/auth/${action}`, {
        method,
        headers: { "content-type": "application/json", ...headers },
        ...(method === "GET" ? {} : { body: JSON.stringify(input) }),
      }),
    );
    expect(response).not.toBeNull();
    return { response: response!, data: await response!.json() };
  }
  async function login(scopes?: string[]) {
    const device = (await call("device", scopes ? { scopes } : {})).data;
    expect(
      (await call("approve", { user_code: device.user_code, decision: "approve" }, browserHeaders))
        .response.status,
    ).toBe(200);
    const token = (await call("token", { device_code: device.device_code })).data
      .access_token as string;
    return { device, token, headers: { authorization: `Bearer ${token}` } };
  }
  return {
    store,
    resolver,
    service,
    call,
    login,
    advance: (milliseconds: number) => {
      now += milliseconds;
    },
  };
}

describe("CLI device authorization", () => {
  it("issues only a hashed, origin-bound session after explicit browser approval", async () => {
    const s = setup();
    const created = vi.spyOn(s.store, "create");
    const polled = vi.spyOn(s.store, "poll");
    const { device, token, headers } = await s.login();
    expect(device).toMatchObject({
      expires_in: 600,
      interval: 5,
      verification_uri: `${origin}/cli/authorize`,
    });
    expect(device.device_code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(device.user_code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(token).toMatch(/^frontier_cli_[A-Za-z0-9_-]{43}$/);
    const record = JSON.stringify(created.mock.calls);
    expect(record).not.toContain(device.device_code);
    expect(record).not.toContain(device.user_code.replaceAll("-", ""));
    expect(JSON.stringify(polled.mock.calls)).not.toContain(token);
    const session = await s.call("session", {}, headers, "GET");
    expect(session.data).toMatchObject({ ...identity, scopes: [...cliAuthScopes], revoked: false });
    expect(JSON.stringify(session.data)).not.toContain(token);
    expect(session.response.headers.get("cache-control")).toBe("no-store");
    expect(
      await s.service.resolve(
        new Request(`${origin}/v1/challenges/disaster-response/join`, { headers }),
        "disaster:join",
      ),
    ).toEqual(identity);
  });

  it("throttles polling with persistent five-second slowdowns, including after approval", async () => {
    const s = setup();
    const device = (await s.call("device")).data;
    const poll = () => s.call("token", { device_code: device.device_code });
    expect((await poll()).data.error.code).toBe("authorization_pending");
    const early = await poll();
    expect(early.data.error.code).toBe("slow_down");
    expect(early.response.headers.get("retry-after")).toBe("10");
    await s.call("approve", { user_code: device.user_code, decision: "approve" }, browserHeaders);
    s.advance(5000);
    expect((await poll()).response.headers.get("retry-after")).toBe("15");
    s.advance(15000);
    expect((await poll()).data.token_type).toBe("Bearer");
  });

  it("allows exactly one concurrent decision and one token exchange", async () => {
    const s = setup();
    const device = (await s.call("device")).data;
    const decisions = await Promise.all(
      Array.from({ length: 6 }, () =>
        s.call("approve", { user_code: device.user_code, decision: "approve" }, browserHeaders),
      ),
    );
    expect(decisions.filter(({ response }) => response.status === 200)).toHaveLength(1);
    expect(decisions.filter(({ data }) => data.error?.code === "invalid_grant")).toHaveLength(5);
    const tokens = await Promise.all(
      Array.from({ length: 6 }, () => s.call("token", { device_code: device.device_code })),
    );
    expect(tokens.filter(({ data }) => data.access_token)).toHaveLength(1);
    expect(tokens.filter(({ data }) => data.error?.code === "invalid_grant")).toHaveLength(5);
  });

  it("denial is final and cannot issue a session", async () => {
    const s = setup();
    const device = (await s.call("device")).data;
    expect(
      (await s.call("approve", { user_code: device.user_code, decision: "deny" }, browserHeaders))
        .data.status,
    ).toBe("denied");
    expect(
      (
        await s.call(
          "approve",
          { user_code: device.user_code, decision: "approve" },
          browserHeaders,
        )
      ).data.error.code,
    ).toBe("invalid_grant");
    expect((await s.call("token", { device_code: device.device_code })).data.error.code).toBe(
      "access_denied",
    );
  });

  it("expires device grants at ten minutes and sessions at eight hours", async () => {
    const s = setup();
    const pending = (await s.call("device")).data;
    const { headers } = await s.login();
    s.advance(600_000);
    expect((await s.call("token", { device_code: pending.device_code })).data.error.code).toBe(
      "expired_token",
    );
    expect(
      (
        await s.call(
          "approve",
          { user_code: pending.user_code, decision: "approve" },
          browserHeaders,
        )
      ).data.error.code,
    ).toBe("expired_token");
    s.advance(28_200_000);
    expect((await s.call("session", {}, headers, "GET")).data.error.code).toBe("invalid_token");
  });

  it("revokes immediately and idempotently", async () => {
    const s = setup();
    const { headers } = await s.login();
    expect((await s.call("revoke", {}, headers)).data).toEqual({ revoked: true });
    expect((await s.call("revoke", {}, headers)).data).toEqual({ revoked: true });
    await expect(
      s.service.resolve(new Request(origin, { headers }), "disaster:read"),
    ).rejects.toMatchObject({ code: "invalid_token" });
  });

  it("rejects unsupported scopes and enforces granted scopes", async () => {
    const s = setup();
    for (const scopes of [["demo-settlement"], [], ["disaster:read", "classic:submit"]])
      expect((await s.call("device", { scopes })).data.error.code).toBe("invalid_scope");
    const { headers } = await s.login(["disaster:read"]);
    await expect(
      s.service.resolve(new Request(origin, { headers }), "disaster:submit"),
    ).rejects.toMatchObject({ code: "insufficient_scope", status: 403 });
    expect(s.resolver).toHaveBeenCalledTimes(1);
  });

  it("requires JSON, same-origin CSRF intent and both Privy headers", async () => {
    const s = setup();
    const device = (await s.call("device")).data;
    for (const removed of [
      "origin",
      "authorization",
      "x-privy-identity-token",
      "x-frontier-cli-csrf",
    ]) {
      const headers: Record<string, string> = { ...browserHeaders };
      delete headers[removed];
      expect(
        (await s.call("approve", { user_code: device.user_code, decision: "approve" }, headers))
          .response.status,
      ).toBeGreaterThanOrEqual(400);
    }
    for (const headers of [
      { ...browserHeaders, origin: "https://attacker.example" },
      { ...browserHeaders, "sec-fetch-site": "cross-site" },
      { ...browserHeaders, authorization: `Bearer frontier_cli_${"a".repeat(43)}` },
      { ...browserHeaders, "content-type": "text/plain" },
    ])
      expect(
        (await s.call("approve", { user_code: device.user_code, decision: "approve" }, headers))
          .response.status,
      ).toBeGreaterThanOrEqual(400);
    expect(s.resolver).not.toHaveBeenCalled();
  });

  it("inspect returns only review information and never approves", async () => {
    const s = setup();
    const device = (await s.call("device", { scope: "disaster:read disaster:join" })).data;
    const review = await s.call(
      "inspect",
      { user_code: device.user_code.toLowerCase() },
      browserHeaders,
    );
    expect(review.data).toMatchObject({
      origin,
      scopes: ["disaster:read", "disaster:join"],
      session_expires_in: 28800,
    });
    expect(review.data.deviceHash).toBeUndefined();
    expect((await s.call("token", { device_code: device.device_code })).data.error.code).toBe(
      "authorization_pending",
    );
  });

  it("rate-limits issuance and approval guessing across service instances", async () => {
    const s = setup();
    for (let i = 0; i < 20; i++) expect((await s.call("device")).response.status).toBe(200);
    expect((await s.call("device")).response.status).toBe(429);
    s.advance(60_000);
    expect((await s.call("device")).response.status).toBe(200);
    for (let i = 0; i < 20; i++)
      await s.call("approve", { user_code: "AAAA-AAAA-AAAA", decision: "approve" }, browserHeaders);
    expect(
      (
        await s.call(
          "approve",
          { user_code: "AAAA-AAAA-AAAA", decision: "approve" },
          browserHeaders,
        )
      ).response.status,
    ).toBe(429);
  });

  it("keeps sessions and device grants isolated by origin even on a shared store", async () => {
    const s = setup();
    const { headers, device } = await s.login();
    const other = new CliAuthService({
      store: s.store,
      identity: async () => identity,
      origin: "http://localhost:4000",
      production: false,
    });
    await expect(
      other.resolve(new Request("http://localhost:4000", { headers }), "disaster:read"),
    ).rejects.toMatchObject({ code: "invalid_token" });
    const response = await other.handle(
      new Request("http://localhost:4000/v1/cli/auth/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ device_code: device.device_code }),
      }),
    );
    expect((await response!.json()).error.code).toBe("expired_token");
  });

  it("fails closed without trusted configuration or on store failure", async () => {
    for (const overrides of [
      { production: true },
      { origin: "http://remote.example" },
      { origin: "https://user:password@example.com" },
    ]) {
      const s = setup(overrides);
      expect(s.service.available).toBe(false);
      expect((await s.call("device")).response.status).toBe(503);
    }
    expect(new CliAuthService({ origin, store: new MemoryCliAuthStore() }).available).toBe(false);
    expect(new CliAuthService({ origin, identity: async () => identity }).available).toBe(false);
    const s = setup();
    vi.spyOn(s.store, "rateLimit").mockRejectedValue(new Error("secret connection detail"));
    const failure = await s.call("device");
    expect(failure.response.status).toBe(503);
    expect(JSON.stringify(failure.data)).not.toContain("secret");
  });

  it("handles malformed bodies, query secrets, unsupported methods and unrelated routes", async () => {
    const s = setup();
    expect(await s.service.handle(new Request(`${origin}/v1/arenas`))).toBeNull();
    expect((await s.call("device", {}, {}, "GET")).response.headers.get("allow")).toBe("POST");
    expect((await s.call("device?device_code=secret")).data.error.code).toBe("invalid_request");
    expect((await s.call("device", { unexpected: true })).response.status).toBe(400);
    expect((await s.call("device", { scope: "x".repeat(5000) })).response.status).toBe(413);
    expect((await s.call("unknown")).response.status).toBe(404);
    expect((await s.call("token", { device_code: "guess" })).response.status).toBe(400);
  });
});
