import "server-only";

import {
  MemoryPlan6CompetitionStore,
  createPlan6Participant,
  plan6ChallengeId,
  type Plan5Identity,
  type Plan6CompetitionStore,
  type Plan6FinalEntry,
  type Plan6Participant,
  type Plan6Reward,
  type Plan6Submission,
  type Plan6ValuePoolManifest,
} from "@frontier/api";
import { Redis } from "@upstash/redis";
import { keccak256, stringToHex, type Hex } from "viem";

const prefix = "frontier:plan6";
const key = (...parts: string[]) => [prefix, ...parts].join(":");
const userHash = (userId: string) => keccak256(stringToHex(`privy-user:${userId}`));

class RedisPlan6CompetitionStore implements Plan6CompetitionStore {
  readonly durability = "durable-redis" as const;

  constructor(private readonly redis: Redis) {}

  async participantForUser(userId: string) {
    const id = await this.redis.get<string>(key("user", userHash(userId), "participant"));
    return id ? this.participant(id) : null;
  }

  async participant(id: string) {
    return (await this.redis.get<Plan6Participant>(key("participant", id))) ?? null;
  }

  async join(identity: Plan5Identity) {
    const existing = await this.participantForUser(identity.userId);
    if (existing) return existing;
    const record = createPlan6Participant(identity);
    const transaction = this.redis.multi();
    transaction.set(key("participant", record.participantId), record);
    transaction.set(key("user", record.userIdHash, "participant"), record.participantId);
    transaction.sadd(key("participants"), record.participantId);
    await transaction.exec();
    return record;
  }

  async submissionsForParticipant(participantId: string) {
    const ids = await this.redis.smembers<string[]>(
      key("participant", participantId, "submissions"),
    );
    const records = await Promise.all(
      ids.map((id) => this.redis.get<Plan6Submission>(key("submission", id))),
    );
    return records
      .filter((record): record is Plan6Submission => record !== null)
      .sort((left, right) => left.revision - right.revision);
  }

  async submissionsForChallenge() {
    const ids = await this.redis.smembers<string[]>(key("submissions"));
    const records = await Promise.all(
      ids.map((id) => this.redis.get<Plan6Submission>(key("submission", id))),
    );
    return records
      .filter((record): record is Plan6Submission => record !== null)
      .sort((left, right) => left.submittedAt.localeCompare(right.submittedAt));
  }

  async addSubmission(input: Omit<Plan6Submission, "submissionId" | "revision" | "submittedAt">) {
    const participant = await this.participant(input.participantId);
    if (!participant) throw new Error("Join this challenge before submitting");
    const revision = await this.redis.incr(key("participant", input.participantId, "revision"));
    if (revision > 20) {
      await this.redis.decr(key("participant", input.participantId, "revision"));
      throw new Error("Submission revision limit reached");
    }
    const submissionId = keccak256(
      stringToHex(`${input.participantId}:${revision}:${input.sourceHash}:${input.inputHash}`),
    );
    const record = {
      ...input,
      revision,
      submissionId,
      submittedAt: new Date().toISOString(),
    } satisfies Plan6Submission;
    const transaction = this.redis.multi();
    transaction.set(key("submission", submissionId), record);
    transaction.sadd(key("participant", input.participantId, "submissions"), submissionId);
    transaction.sadd(key("submissions"), submissionId);
    await transaction.exec();
    return record;
  }

  async submissionForIdempotency(participantId: string, idempotencyKey: string) {
    const submissionId = await this.redis.get<string>(
      key("participant", participantId, "idempotency", idempotencyKey),
    );
    return submissionId
      ? ((await this.redis.get<Plan6Submission>(key("submission", submissionId))) ?? null)
      : null;
  }

  async saveSubmissionIdempotency(
    participantId: string,
    idempotencyKey: string,
    submissionId: string,
  ) {
    await this.redis.set(
      key("participant", participantId, "idempotency", idempotencyKey),
      submissionId,
      { ex: 86_400 },
    );
  }

  async finalEntry(participantId: string) {
    return (
      (await this.redis.get<Plan6FinalEntry>(key("participant", participantId, "final"))) ?? null
    );
  }

  async selectFinal(participantId: string, submissionId: string) {
    const submission = await this.redis.get<Plan6Submission>(key("submission", submissionId));
    if (!submission || submission.participantId !== participantId)
      throw new Error("Submission does not belong to this participant");
    const entry = {
      participantId: participantId as Hex,
      challengeId: plan6ChallengeId,
      submissionId: submissionId as Hex,
      selectedAt: new Date().toISOString(),
    } satisfies Plan6FinalEntry;
    await this.redis.set(key("participant", participantId, "final"), entry);
    return entry;
  }

  async reward(participantId: string) {
    return (await this.redis.get<Plan6Reward>(key("participant", participantId, "reward"))) ?? null;
  }

  async saveReward(reward: Plan6Reward) {
    await this.redis.set(key("participant", reward.participantId, "reward"), reward);
  }

  async valuePools() {
    const ids = await this.redis.smembers<string[]>(key("value-pools"));
    const records = await Promise.all(
      ids.map((id) => this.redis.get<Plan6ValuePoolManifest>(key("value-pool", id))),
    );
    return records
      .filter((record): record is Plan6ValuePoolManifest => record !== null)
      .sort((left, right) => left.poolId.localeCompare(right.poolId));
  }

  async valuePoolForFunder(funderId: string) {
    const poolId = await this.redis.get<string>(key("value-funder", funderId));
    return poolId
      ? ((await this.redis.get<Plan6ValuePoolManifest>(key("value-pool", poolId))) ?? null)
      : null;
  }

  async saveValuePool(pool: Plan6ValuePoolManifest) {
    if (!pool.funderId) throw new Error("Community Value Pool requires a funder");
    const transaction = this.redis.multi();
    transaction.set(key("value-pool", pool.poolId), pool);
    transaction.set(key("value-funder", pool.funderId), pool.poolId);
    transaction.sadd(key("value-pools"), pool.poolId);
    await transaction.exec();
  }
}

function redisFromEnvironment() {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

export function createPlan6Store(): Plan6CompetitionStore {
  const redis = redisFromEnvironment();
  return redis ? new RedisPlan6CompetitionStore(redis) : new MemoryPlan6CompetitionStore();
}
