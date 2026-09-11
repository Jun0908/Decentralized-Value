import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CliAuthService, hashCliAuthSecret, type CliAuthDevice } from "../../../api/src/cli-auth";
import { RedisCliAuthStore, createCliAuthStore, type CliAuthRedisClient } from "./cli-auth-store";

vi.mock("server-only", () => ({}));

afterEach(() => vi.unstubAllEnvs());

function clearConfiguration() {
  for (const name of [
    "KV_REST_API_URL",
    "KV_REST_API_TOKEN",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
  ])
    vi.stubEnv(name, "");
}

describe("CLI authorization store configuration", () => {
  it("uses memory only for unconfigured nonproduction environments", () => {
    clearConfiguration();
    vi.stubEnv("NODE_ENV", "test");
    expect(createCliAuthStore()?.durability).toBe("ephemeral-memory");
    vi.stubEnv("NODE_ENV", "production");
    expect(createCliAuthStore()).toBeUndefined();
  });

  it("does not combine incomplete provider credentials or hide partial configuration", () => {
    clearConfiguration();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("KV_REST_API_URL", "https://unused.localhost");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "local-test-placeholder");
    expect(createCliAuthStore()).toBeUndefined();
  });

  it("constructs a durable adapter from configured credentials without contacting Redis", () => {
    clearConfiguration();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://unused.localhost");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "local-test-placeholder");
    expect(createCliAuthStore()).toBeInstanceOf(RedisCliAuthStore);
  });

  it("propagates Redis failure and never switches to memory", async () => {
    const redis = { eval: vi.fn().mockRejectedValue(new Error("Redis offline")) };
    const store = new RedisCliAuthStore(redis);
    await expect(store.session("a".repeat(64), Date.now())).rejects.toThrow("Redis offline");
    expect(store.durability).toBe("durable-redis");
  });

  it("accepts Upstash JSON decoding and preserves explicit null lookups", async () => {
    const evalMock = vi
      .fn()
      .mockResolvedValueOnce({ code: "authorization_pending", interval: 5 })
      .mockResolvedValueOnce('{"code":"slow_down","interval":10}')
      .mockResolvedValueOnce(null);
    const store = new RedisCliAuthStore({ eval: evalMock });
    expect(await store.poll("a".repeat(64), "b".repeat(64), 1000, 28800000)).toEqual({
      code: "authorization_pending",
      interval: 5,
    });
    expect(await store.poll("a".repeat(64), "c".repeat(64), 1000, 28800000)).toEqual({
      code: "slow_down",
      interval: 10,
    });
    expect(await store.session("b".repeat(64), 1000)).toBeNull();
    const keys = evalMock.mock.calls[0]![1] as string[];
    expect(keys).toHaveLength(2);
    expect(keys.every((key) => key.includes("{cli-auth}"))).toBe(true);
  });
});

// Opt in with a disposable local Docker Redis container, never a configured live Redis.
const container = process.env.CLI_AUTH_TEST_REDIS_CONTAINER;
const exec = promisify(execFile);
async function redisCommand(...args: string[]) {
  const { stdout } = await exec("docker", ["exec", container!, "redis-cli", "--json", ...args], {
    timeout: 15_000,
  });
  return JSON.parse(stdout.trim()) as unknown;
}
const realRedis: CliAuthRedisClient = {
  eval: (script, keys, args) =>
    redisCommand("EVAL", script, String(keys.length), ...keys, ...args.map(String)),
};

describe.skipIf(!container)("CLI authorization Lua against local Redis", () => {
  const identity = {
    userId: "local-redis-test",
    wallet: "0x1111111111111111111111111111111111111111" as const,
  };
  function fixture() {
    const now = Date.now();
    const device: CliAuthDevice = {
      deviceHash: hashCliAuthSecret("test-device", randomBytes(32).toString("hex")),
      userCodeHash: hashCliAuthSecret("test-code", randomBytes(32).toString("hex")),
      origin: "http://localhost:3000",
      scopes: ["disaster:read", "disaster:submit"],
      status: "pending",
      expiresAt: now + 600000,
      interval: 5,
      nextPollAt: now,
    };
    const store = new RedisCliAuthStore(realRedis);
    const tokenHash = () => hashCliAuthSecret("test-token", randomBytes(32).toString("hex"));
    return { now, device, store, tokenHash };
  }

  it("atomically creates grants, decides once, and consumes once across adapters", async () => {
    const { now, device, store, tokenHash } = fixture();
    const second = new RedisCliAuthStore(realRedis);
    const creation = await Promise.all([store.create(device, now), second.create(device, now)]);
    expect(creation.sort()).toEqual([false, true]);
    expect(await second.inspect(device.userCodeHash, now)).toEqual(device);
    const decisions = await Promise.all([
      store.decide(device.userCodeHash, identity, "approve", now),
      second.decide(device.userCodeHash, identity, "approve", now),
    ]);
    expect(decisions.filter((result) => result === "invalid_grant")).toHaveLength(1);
    const hashes = [tokenHash(), tokenHash(), tokenHash()];
    const polls = await Promise.all(
      hashes.map((hash) =>
        new RedisCliAuthStore(realRedis).poll(device.deviceHash, hash, now, 28800000),
      ),
    );
    expect(polls.filter((result) => result.code === "issued")).toHaveLength(1);
    expect(polls.filter((result) => result.code === "invalid_grant")).toHaveLength(2);
    const issued = polls.find((result) => result.code === "issued");
    expect(issued?.code).toBe("issued");
    if (issued?.code !== "issued") throw new Error("Expected issued session");
    expect(await second.session(issued.session.tokenHash, now)).toMatchObject(identity);
    const ttl = await redisCommand(
      "PTTL",
      `frontier:{cli-auth}:v1:session:${issued.session.tokenHash}`,
    );
    expect(ttl).toBeGreaterThan(28700000);
    expect(ttl).toBeLessThanOrEqual(28800000);
    await second.revoke(issued.session.tokenHash, now);
    expect(await store.session(issued.session.tokenHash, now)).toBeNull();
  }, 30000);

  it("keeps denial final and expires issued sessions at the exact deadline", async () => {
    const { now, device, store, tokenHash } = fixture();
    await store.create(device, now);
    expect(await store.decide(device.userCodeHash, identity, "deny", now)).toBe("denied");
    expect(await store.decide(device.userCodeHash, identity, "approve", now)).toBe("invalid_grant");
    expect(await store.poll(device.deviceHash, tokenHash(), now, 28800000)).toEqual({
      code: "access_denied",
    });
    const second = fixture();
    await second.store.create(second.device, second.now);
    await second.store.decide(second.device.userCodeHash, identity, "approve", second.now);
    const hash = second.tokenHash();
    expect(
      (await second.store.poll(second.device.deviceHash, hash, second.now, 28800000)).code,
    ).toBe("issued");
    expect(await second.store.session(hash, second.now + 28800000)).toBeNull();
  }, 30000);

  it("shares polling backoff, expiry, and rate limits between processes", async () => {
    const { now, device, store, tokenHash } = fixture();
    const second = new RedisCliAuthStore(realRedis);
    await store.create(device, now);
    expect(await store.poll(device.deviceHash, tokenHash(), now, 28800000)).toEqual({
      code: "authorization_pending",
      interval: 5,
    });
    expect(await second.poll(device.deviceHash, tokenHash(), now, 28800000)).toEqual({
      code: "slow_down",
      interval: 10,
    });
    expect(await second.poll(device.deviceHash, tokenHash(), now + 10000, 28800000)).toEqual({
      code: "authorization_pending",
      interval: 10,
    });
    expect(await second.decide(device.userCodeHash, identity, "approve", device.expiresAt)).toBe(
      "expired_token",
    );
    expect(await store.poll(device.deviceHash, tokenHash(), device.expiresAt, 28800000)).toEqual({
      code: "expired_token",
    });
    const hash = tokenHash();
    expect(await store.rateLimit(hash, now, 60000, 1)).toBe(true);
    expect(await second.rateLimit(hash, now, 60000, 1)).toBe(false);
  }, 30000);

  it("persists a complete service login without exposing bearer material to Redis", async () => {
    const origin = "http://localhost:3000";
    const calls: unknown[] = [];
    const store = new RedisCliAuthStore({
      eval: (script, keys, args) => {
        calls.push({ keys, args });
        return realRedis.eval(script, keys, args);
      },
    });
    const service = new CliAuthService({
      origin,
      store,
      identity: async () => identity,
      production: true,
    });
    const call = async (action: string, body: unknown, headers: Record<string, string> = {}) => {
      const result = await service.handle(
        new Request(`${origin}/v1/cli/auth/${action}`, {
          method: "POST",
          headers: { "content-type": "application/json", ...headers },
          body: JSON.stringify(body),
        }),
      );
      expect(result!.status).toBe(200);
      return result!.json();
    };
    const device = await call("device", {});
    await call(
      "approve",
      { user_code: device.user_code, decision: "approve" },
      {
        origin,
        authorization: "Bearer local-test-privy",
        "x-privy-identity-token": "local-test-identity",
        "x-frontier-cli-csrf": "1",
      },
    );
    const issued = await call("token", { device_code: device.device_code });
    const restarted = new CliAuthService({
      origin,
      store: new RedisCliAuthStore(realRedis),
      identity: async () => identity,
      production: true,
    });
    expect(
      await restarted.resolve(
        new Request(origin, { headers: { authorization: `Bearer ${issued.access_token}` } }),
        "disaster:submit",
      ),
    ).toEqual(identity);
    const persisted = JSON.stringify(calls);
    expect(persisted).not.toContain(issued.access_token);
    expect(persisted).not.toContain(device.device_code);
    expect(persisted).not.toContain(device.user_code.replaceAll("-", ""));
  }, 30000);
});
