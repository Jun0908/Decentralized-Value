import "server-only";

import {
  MemoryPlan6CompetitionStore,
  createPlan6Participant,
  createPlan6SubmissionRecord,
  Plan6StoreError,
  plan6ChallengeId,
  type Plan5Identity,
  type Plan6CompetitionStore,
  type Plan6FinalEntry,
  type Plan6Participant,
  type Plan6Reward,
  type Plan6Submission,
  type Plan6SubmissionCommit,
  type Plan6SubmissionInput,
  type Plan6ValuePoolManifest,
} from "@frontier/api";
import { Redis } from "@upstash/redis";
import { keccak256, stringToHex, type Hex } from "viem";

const prefix = "frontier:plan6";
const key = (...parts: string[]) => [prefix, ...parts].join(":");
const userHash = (userId: string) => keccak256(stringToHex(`privy-user:${userId}`));

// Redis cjson accepts bare hexadecimal numbers, so recognize legacy IDs before decoding JSON.
const submissionBindingLua = `
local function isSubmissionId(value)
  return type(value) == 'string' and #value == 66 and string.match(value, '^0x%x+$') ~= nil
end
local function decodeSubmissionBinding(raw)
  if isSubmissionId(raw) then return raw, nil end
  local ok, decoded = pcall(cjson.decode, raw)
  if not ok then return nil end
  if isSubmissionId(decoded) then return decoded, nil end
  if type(decoded) ~= 'table' or not isSubmissionId(decoded.submissionId) then return nil end
  if decoded.bodyDigest ~= cjson.null and type(decoded.bodyDigest) ~= 'string' then return nil end
  return decoded.submissionId, decoded.bodyDigest
end
`;

// Return stored JSON unchanged: Lua's cjson would turn empty arrays into objects.
const commitSubmissionScript = `
${submissionBindingLua}
local function checkType(k, expected)
  local actual = redis.call('TYPE', k).ok
  return actual == 'none' or actual == expected
end
for i, expected in ipairs({'string', 'string', 'set', 'set', 'string', 'string'}) do
  if not checkType(KEYS[i], expected) then return {'STORE_INCONSISTENT'} end
end
local candidate = cjson.decode(ARGV[1])
local keyed = ARGV[4] == '1'
if keyed then
  local binding = redis.call('GET', KEYS[6])
  if binding then
    local id, digest = decodeSubmissionBinding(binding)
    if not id then return {'STORE_INCONSISTENT'} end
    local stored = redis.call('GET', ARGV[5] .. id)
    if not stored then return {'STORE_INCONSISTENT'} end
    local submission = cjson.decode(stored)
    if submission.participantId ~= candidate.participantId then return {'STORE_INCONSISTENT'} end
    if (digest and digest ~= cjson.null and digest ~= ARGV[2]) or
       submission.inputHash ~= candidate.inputHash or submission.sourceHash ~= candidate.sourceHash then
      return {'IDEMPOTENCY_CONFLICT'}
    end
    redis.call('PERSIST', KEYS[6])
    return {'existing', stored}
  end
end
if redis.call('EXISTS', KEYS[1]) == 0 then return {'PARTICIPANT_REQUIRED'} end
local current = tonumber(redis.call('GET', KEYS[2]) or '0')
if not current or current < 0 or current % 1 ~= 0 then return {'STORE_INCONSISTENT'} end
current = math.max(current, redis.call('SCARD', KEYS[3]))
if current >= 20 then return {'REVISION_LIMIT'} end
if current ~= tonumber(ARGV[3]) then return {'REVISION_CONFLICT'} end
if candidate.revision ~= current + 1 or redis.call('EXISTS', KEYS[5]) == 1 then
  return {'STORE_INCONSISTENT'}
end
redis.call('SET', KEYS[5], ARGV[1])
redis.call('SADD', KEYS[3], candidate.submissionId)
redis.call('SADD', KEYS[4], candidate.submissionId)
redis.call('SET', KEYS[2], candidate.revision)
if keyed then
  redis.call('SET', KEYS[6], cjson.encode({submissionId = candidate.submissionId, bodyDigest = ARGV[2]}))
end
return {'saved', ARGV[1]}
`;

const saveSubmissionIdempotencyScript = `
${submissionBindingLua}
local stored = redis.call('GET', KEYS[1])
if not stored or cjson.decode(stored).participantId ~= ARGV[1] then return 'SUBMISSION_NOT_FOUND' end
local existing = redis.call('GET', KEYS[2])
if existing then
  local id = decodeSubmissionBinding(existing)
  if not id then return 'STORE_INCONSISTENT' end
  if id ~= ARGV[2] then return 'IDEMPOTENCY_CONFLICT' end
  redis.call('PERSIST', KEYS[2])
else
  redis.call('SET', KEYS[2], cjson.encode({submissionId = ARGV[2], bodyDigest = cjson.null}))
end
return 'saved'
`;

// Upgrade surviving bindings on successful lookup, including API retries that skip commit.
// Already-expired legacy bindings cannot be reconstructed from submission records alone.
const lookupSubmissionIdempotencyScript = `
${submissionBindingLua}
local binding = redis.call('GET', KEYS[1])
if not binding then return {'missing'} end
local id, digest = decodeSubmissionBinding(binding)
if not id then return {'STORE_INCONSISTENT'} end
local stored = redis.call('GET', ARGV[2] .. id)
if not stored then return {'STORE_INCONSISTENT'} end
local ok, submission = pcall(cjson.decode, stored)
if not ok or type(submission) ~= 'table' or submission.participantId ~= ARGV[1] or submission.submissionId ~= id then
  return {'STORE_INCONSISTENT'}
end
redis.call('PERSIST', KEYS[1])
if digest == nil or digest == cjson.null then digest = false end
return {'found', digest, stored}
`;

function storeError(code: string): Plan6StoreError {
  switch (code) {
    case "IDEMPOTENCY_CONFLICT":
      return new Plan6StoreError(409, code, "Idempotency key is bound to another body");
    case "REVISION_CONFLICT":
      return new Plan6StoreError(409, code, "Submission revision changed; prepare again");
    case "REVISION_LIMIT":
      return new Plan6StoreError(409, code, "Submission revision limit reached");
    case "PARTICIPANT_REQUIRED":
      return new Plan6StoreError(403, code, "Join this challenge before submitting");
    case "SUBMISSION_NOT_FOUND":
      return new Plan6StoreError(404, code, "Submission does not belong to this participant");
    default:
      return new Plan6StoreError(500, "STORE_INCONSISTENT", "Invalid submission storage state");
  }
}

export class RedisPlan6CompetitionStore implements Plan6CompetitionStore {
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

  async commitSubmission(
    input: Plan6SubmissionInput,
    idempotencyKey: string | null,
    bodyDigest: string,
    expectedPreviousRevision?: number,
  ): Promise<Plan6SubmissionCommit> {
    const revisionKey = key("participant", input.participantId, "revision");
    // Callers supplying an expected revision must rebuild their evaluation diff on conflict.
    for (;;) {
      const previousRevision =
        expectedPreviousRevision ??
        Math.max(
          Number((await this.redis.get<number>(revisionKey)) ?? 0),
          await this.redis.scard(key("participant", input.participantId, "submissions")),
        );
      const record = createPlan6SubmissionRecord(input, previousRevision + 1);
      const result = await this.redis.eval<unknown[], [string, (string | Plan6Submission)?]>(
        commitSubmissionScript,
        [
          key("participant", input.participantId),
          revisionKey,
          key("participant", input.participantId, "submissions"),
          key("submissions"),
          key("submission", record.submissionId),
          key("participant", input.participantId, "idempotency", idempotencyKey ?? ""),
        ],
        [
          JSON.stringify(record),
          bodyDigest,
          previousRevision,
          idempotencyKey === null ? "0" : "1",
          key("submission", ""),
        ],
      );
      if (result[0] === "saved" || result[0] === "existing") {
        // Upstash may deserialize JSON nested in an EVAL array response.
        const submission = typeof result[1] === "string" ? JSON.parse(result[1]) : result[1];
        return { status: result[0], submission: submission as Plan6Submission };
      }
      if (result[0] === "REVISION_CONFLICT" && expectedPreviousRevision === undefined) continue;
      throw storeError(result[0]);
    }
  }

  async addSubmission(input: Plan6SubmissionInput) {
    return (await this.commitSubmission(input, null, "")).submission;
  }

  async lookupSubmissionIdempotency(participantId: string, idempotencyKey: string) {
    const result = await this.redis.eval<
      string[],
      [string, (string | null)?, (string | Plan6Submission)?]
    >(
      lookupSubmissionIdempotencyScript,
      [key("participant", participantId, "idempotency", idempotencyKey)],
      [participantId, key("submission", "")],
    );
    if (result[0] === "missing") return null;
    if (result[0] !== "found") throw storeError(result[0]);
    const submission = typeof result[2] === "string" ? JSON.parse(result[2]) : result[2];
    return { bodyDigest: result[1] ?? null, submission: submission as Plan6Submission };
  }

  async submissionForIdempotency(participantId: string, idempotencyKey: string) {
    return (
      (await this.lookupSubmissionIdempotency(participantId, idempotencyKey))?.submission ?? null
    );
  }

  async saveSubmissionIdempotency(
    participantId: string,
    idempotencyKey: string,
    submissionId: string,
  ) {
    const result = await this.redis.eval<string[], string>(
      saveSubmissionIdempotencyScript,
      [
        key("submission", submissionId),
        key("participant", participantId, "idempotency", idempotencyKey),
      ],
      [participantId, submissionId],
    );
    if (result !== "saved") throw storeError(result);
  }

  async finalEntry(participantId: string) {
    return (
      (await this.redis.get<Plan6FinalEntry>(key("participant", participantId, "final"))) ?? null
    );
  }

  async selectFinal(participantId: string, submissionId: string) {
    const submission = await this.redis.get<Plan6Submission>(key("submission", submissionId));
    if (!submission || submission.participantId !== participantId)
      throw storeError("SUBMISSION_NOT_FOUND");
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
