import "server-only";

import {
  MemoryPlan5CompetitionStore,
  createPlan5Participant,
  plan5ChallengeId,
  type Plan5CompetitionStore,
  type Plan5FinalEntry,
  type Plan5Identity,
  type Plan5Participant,
  type Plan5Reward,
  type Plan5Submission,
} from "@frontier/api";
import { Redis } from "@upstash/redis";
import { keccak256, stringToHex, type Hex } from "viem";

const prefix = "frontier:plan5";
const key = (...parts: string[]) => [prefix, ...parts].join(":");
const userHash = (userId: string) => keccak256(stringToHex(`privy-user:${userId}`));

class RedisPlan5CompetitionStore implements Plan5CompetitionStore {
  readonly durability = "durable-redis" as const;

  constructor(private readonly redis: Redis) {}

  async participantForUser(userId: string) {
    const id = await this.redis.get<string>(key("user", userHash(userId), "participant"));
    return id ? this.participant(id) : null;
  }

  async participant(id: string) {
    return (await this.redis.get<Plan5Participant>(key("participant", id))) ?? null;
  }

  async join(identity: Plan5Identity) {
    const existing = await this.participantForUser(identity.userId);
    if (existing) return existing;
    const record = createPlan5Participant(identity);
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
      ids.map((id) => this.redis.get<Plan5Submission>(key("submission", id))),
    );
    return records
      .filter((record): record is Plan5Submission => record !== null)
      .sort((left, right) => left.revision - right.revision);
  }

  async submissionsForChallenge() {
    const ids = await this.redis.smembers<string[]>(key("submissions"));
    const records = await Promise.all(
      ids.map((id) => this.redis.get<Plan5Submission>(key("submission", id))),
    );
    return records
      .filter((record): record is Plan5Submission => record !== null)
      .sort((left, right) => left.submittedAt.localeCompare(right.submittedAt));
  }

  async addSubmission(input: Omit<Plan5Submission, "submissionId" | "revision" | "submittedAt">) {
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
    } satisfies Plan5Submission;
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
      ? ((await this.redis.get<Plan5Submission>(key("submission", submissionId))) ?? null)
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
      (await this.redis.get<Plan5FinalEntry>(key("participant", participantId, "final"))) ?? null
    );
  }

  async selectFinal(participantId: string, submissionId: string) {
    const submission = await this.redis.get<Plan5Submission>(key("submission", submissionId));
    if (!submission || submission.participantId !== participantId) {
      throw new Error("Submission does not belong to this participant");
    }
    const entry = {
      participantId: participantId as Hex,
      challengeId: plan5ChallengeId,
      submissionId: submissionId as Hex,
      selectedAt: new Date().toISOString(),
    } satisfies Plan5FinalEntry;
    await this.redis.set(key("participant", participantId, "final"), entry);
    return entry;
  }

  async reward(participantId: string) {
    return (await this.redis.get<Plan5Reward>(key("participant", participantId, "reward"))) ?? null;
  }

  async saveReward(reward: Plan5Reward) {
    await this.redis.set(key("participant", reward.participantId, "reward"), reward);
  }
}

function redisFromEnvironment() {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

export function createPlan5Store(): Plan5CompetitionStore {
  const redis = redisFromEnvironment();
  return redis ? new RedisPlan5CompetitionStore(redis) : new MemoryPlan5CompetitionStore();
}
