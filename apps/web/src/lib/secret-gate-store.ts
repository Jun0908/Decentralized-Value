import { createSecretGateSnapshot, type SecretGateGroupSnapshot } from "@frontier/secret-gate";
import { Redis } from "@upstash/redis";

export type SecretGateReceiptRecord = {
  schemaVersion: "1";
  gateId: string;
  epoch: string;
  root: string;
  nullifier: string;
  proofHash: string;
  state: "off-chain-verified";
};

export interface SecretGateStore {
  readonly durability: "local-memory" | "durable-redis";
  createSnapshot(commitment: string): Promise<SecretGateGroupSnapshot>;
  snapshot(root: string): Promise<SecretGateGroupSnapshot | null>;
  reserveNullifier(record: SecretGateReceiptRecord): Promise<boolean>;
}

const prefix = "frontier:secret-gate:v1";
const key = (...parts: string[]) => [prefix, ...parts].join(":");
const snapshotTtlSeconds = 30 * 60;
const nullifierTtlSeconds = 24 * 60 * 60;

export class MemorySecretGateStore implements SecretGateStore {
  readonly durability = "local-memory" as const;
  private readonly snapshots = new Map<string, SecretGateGroupSnapshot>();
  private readonly nullifiers = new Set<string>();

  async createSnapshot(commitment: string) {
    const snapshot = createSecretGateSnapshot(commitment);
    this.snapshots.set(snapshot.root, snapshot);
    return snapshot;
  }

  async snapshot(root: string) {
    const snapshot = this.snapshots.get(root) ?? null;
    if (!snapshot) return null;
    if (Date.parse(snapshot.expiresAt) <= Date.now()) {
      this.snapshots.delete(root);
      return null;
    }
    return snapshot;
  }

  async reserveNullifier(record: SecretGateReceiptRecord) {
    const nullifierKey = `${record.gateId}:${record.epoch}:${record.nullifier}`;
    if (this.nullifiers.has(nullifierKey)) return false;
    this.nullifiers.add(nullifierKey);
    return true;
  }
}

class RedisSecretGateStore implements SecretGateStore {
  readonly durability = "durable-redis" as const;

  constructor(private readonly redis: Redis) {}

  async createSnapshot(commitment: string) {
    const snapshot = createSecretGateSnapshot(commitment);
    await this.redis.set(key("root", snapshot.root), snapshot, { ex: snapshotTtlSeconds });
    return snapshot;
  }

  async snapshot(root: string) {
    return (await this.redis.get<SecretGateGroupSnapshot>(key("root", root))) ?? null;
  }

  async reserveNullifier(record: SecretGateReceiptRecord) {
    const result = await this.redis.set(
      key("nullifier", record.gateId, record.epoch, record.nullifier),
      record,
      { ex: nullifierTtlSeconds, nx: true },
    );
    return result === "OK";
  }
}

function redisFromEnvironment() {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

const globalStore = globalThis as typeof globalThis & {
  secretGateStore?: SecretGateStore;
};

export function createSecretGateStore(): SecretGateStore {
  const redis = redisFromEnvironment();
  if (redis) return new RedisSecretGateStore(redis);
  return new MemorySecretGateStore();
}

export const secretGateStore = globalStore.secretGateStore ?? createSecretGateStore();

if (process.env.NODE_ENV !== "production") globalStore.secretGateStore = secretGateStore;

export function requireDurableSecretGateStore() {
  if (process.env.NODE_ENV === "production" && secretGateStore.durability !== "durable-redis") {
    throw new Error("Durable Secret Gate storage is not configured");
  }
  return secretGateStore;
}
