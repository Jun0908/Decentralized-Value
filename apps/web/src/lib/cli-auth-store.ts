import "server-only";

import { Redis } from "@upstash/redis";
import {
  MemoryCliAuthStore,
  type CliAuthStore,
  type CliAuthDevice,
  type CliAuthSession,
  type CliAuthPollResult,
  type CliAuthDecisionResult,
} from "../../../api/src/cli-auth";
import type { Plan5Identity } from "../../../api/src/plan5-competition";

export interface CliAuthRedisClient {
  eval(script: string, keys: string[], args: (string | number)[]): Promise<unknown>;
}

// All script keys share a hash slot. No plaintext code or bearer enters Redis.
const prefix = "frontier:{cli-auth}:v1:";
const key = (kind: string, hash: string) => `${prefix}${kind}:${hash}`;

const createScript = `
if redis.call('EXISTS', KEYS[1]) == 1 or redis.call('EXISTS', KEYS[2]) == 1 then return 0 end
redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2])
redis.call('SET', KEYS[2], ARGV[3], 'PX', ARGV[2])
return 1`;

const inspectScript = `
local raw = redis.call('GET', KEYS[1])
if not raw then return false end
local device = cjson.decode(raw)
if device.expiresAt <= tonumber(ARGV[1]) then return false end
return raw`;

const decideScript = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 'expired_token' end
local device = cjson.decode(raw)
if device.expiresAt <= tonumber(ARGV[1]) then return 'expired_token' end
if device.status ~= 'pending' then return 'invalid_grant' end
if ARGV[2] == 'approve' then
  device.status = 'approved'
  device.identity = cjson.decode(ARGV[3])
else
  device.status = 'denied'
end
redis.call('SET', KEYS[1], cjson.encode(device), 'KEEPTTL')
return device.status`;

const pollScript = `
local raw = redis.call('GET', KEYS[1])
if not raw then return cjson.encode({code='expired_token'}) end
local device = cjson.decode(raw)
local now = tonumber(ARGV[1])
if device.expiresAt <= now then return cjson.encode({code='expired_token'}) end
if device.status == 'consumed' then return cjson.encode({code='invalid_grant'}) end
if device.status == 'denied' then return cjson.encode({code='access_denied'}) end
if now < device.nextPollAt then
  device.interval = device.interval + 5
  device.nextPollAt = now + device.interval * 1000
  redis.call('SET', KEYS[1], cjson.encode(device), 'KEEPTTL')
  return cjson.encode({code='slow_down', interval=device.interval})
end
device.nextPollAt = now + device.interval * 1000
if device.status == 'pending' then
  redis.call('SET', KEYS[1], cjson.encode(device), 'KEEPTTL')
  return cjson.encode({code='authorization_pending', interval=device.interval})
end
if not device.identity or redis.call('EXISTS', KEYS[2]) == 1 then return cjson.encode({code='invalid_grant'}) end
local session = {userId=device.identity.userId, wallet=device.identity.wallet,
  tokenHash=ARGV[2], origin=device.origin, scopes=device.scopes,
  expiresAt=now+tonumber(ARGV[3]), revoked=false}
device.status = 'consumed'
device.identity = nil
redis.call('SET', KEYS[2], cjson.encode(session), 'PX', ARGV[3])
redis.call('SET', KEYS[1], cjson.encode(device), 'KEEPTTL')
return cjson.encode({code='issued', session=session})`;

const sessionScript = `
local raw = redis.call('GET', KEYS[1])
if not raw then return false end
local session = cjson.decode(raw)
if session.expiresAt <= tonumber(ARGV[1]) or session.revoked then return false end
return raw`;

const revokeScript = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local session = cjson.decode(raw)
if session.expiresAt <= tonumber(ARGV[1]) then return 0 end
session.revoked = true
redis.call('SET', KEYS[1], cjson.encode(session), 'KEEPTTL')
return 1`;

const rateScript = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
if count > tonumber(ARGV[2]) then return 0 end
return 1`;

function decode<T>(value: unknown): T | null {
  if (value === null || value === false || value === undefined) return null;
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

export class RedisCliAuthStore implements CliAuthStore {
  readonly durability = "durable-redis" as const;
  constructor(private readonly redis: CliAuthRedisClient) {}

  async create(device: CliAuthDevice, now: number) {
    if (device.expiresAt <= now) return false;
    return (
      Number(
        await this.redis.eval(
          createScript,
          [key("device", device.deviceHash), key("code", device.userCodeHash)],
          [JSON.stringify(device), device.expiresAt - now, device.deviceHash],
        ),
      ) === 1
    );
  }

  private async deviceHash(userCodeHash: string) {
    const result = await this.redis.eval(
      "return redis.call('GET', KEYS[1])",
      [key("code", userCodeHash)],
      [],
    );
    return typeof result === "string" && /^[a-f0-9]{64}$/.test(result) ? result : null;
  }

  async inspect(userCodeHash: string, now: number) {
    const hash = await this.deviceHash(userCodeHash);
    return hash
      ? decode<CliAuthDevice>(await this.redis.eval(inspectScript, [key("device", hash)], [now]))
      : null;
  }

  async decide(
    userCodeHash: string,
    identity: Plan5Identity,
    decision: "approve" | "deny",
    now: number,
  ): Promise<CliAuthDecisionResult> {
    const hash = await this.deviceHash(userCodeHash);
    if (!hash) return "expired_token";
    return (await this.redis.eval(
      decideScript,
      [key("device", hash)],
      [now, decision, JSON.stringify(identity)],
    )) as CliAuthDecisionResult;
  }

  async poll(deviceHash: string, tokenHash: string, now: number, sessionLifetimeMs: number) {
    const result = decode<CliAuthPollResult>(
      await this.redis.eval(
        pollScript,
        [key("device", deviceHash), key("session", tokenHash)],
        [now, tokenHash, sessionLifetimeMs],
      ),
    );
    if (!result) throw new Error("CLI authorization exchange failed");
    return result;
  }

  async session(tokenHash: string, now: number) {
    return decode<CliAuthSession>(
      await this.redis.eval(sessionScript, [key("session", tokenHash)], [now]),
    );
  }

  async revoke(tokenHash: string, now: number) {
    await this.redis.eval(revokeScript, [key("session", tokenHash)], [now]);
  }

  async rateLimit(hash: string, _now: number, windowMs: number, limit: number) {
    return Number(await this.redis.eval(rateScript, [key("rate", hash)], [windowMs, limit])) === 1;
  }
}

export function createCliAuthStore(): CliAuthStore | undefined {
  // Credential pairs must come from the same provider configuration.
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (url && token) return new RedisCliAuthStore(new Redis({ url, token }));
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (upstashUrl && upstashToken)
    return new RedisCliAuthStore(new Redis({ url: upstashUrl, token: upstashToken }));
  // Partial configuration is an error, even locally; never hide a broken durable setup.
  if (url || token || upstashUrl || upstashToken || process.env.NODE_ENV === "production")
    return undefined;
  return new MemoryCliAuthStore();
}
