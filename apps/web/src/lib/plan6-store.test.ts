import { defaultDisasterResponseStrategy } from "@frontier/disaster-response";
import type { Redis } from "@upstash/redis";
import { describe, expect, it, vi } from "vitest";
import {
  createPlan6Participant,
  createPlan6SubmissionRecord,
  plan6SubmissionSchema,
  preparePlan6Submission,
} from "../../../api/src/plan6-competition";
import { RedisPlan6CompetitionStore } from "./plan6-store";

vi.mock("server-only", () => ({}));
vi.mock("@frontier/api", () => import("../../../api/src/plan6-competition"));

function fixture() {
  const participant = createPlan6Participant({
    userId: "alice",
    wallet: "0x1111111111111111111111111111111111111111",
  });
  const input = preparePlan6Submission(
    participant,
    plan6SubmissionSchema.parse({
      strategy: defaultDisasterResponseStrategy,
      sourceMethod: "JSON",
    }),
  );
  // This fake captures the EVAL contract; it deliberately does not simulate Lua execution.
  const redis = {
    get: vi.fn<(key: string) => Promise<unknown>>().mockResolvedValue(null),
    scard: vi.fn(async () => 0),
    eval: vi.fn(async (_script: string, _keys: string[], args: unknown[]): Promise<unknown> => [
      "saved",
      args[0],
    ]),
    set: vi.fn(),
  };
  return { input, redis, store: new RedisPlan6CompetitionStore(redis as unknown as Redis) };
}

describe("Redis Disaster Response submission adapter (fake Redis, no Lua execution)", () => {
  it("passes the prepared CAS record and every write key to one EVAL", async () => {
    const { store, redis, input } = fixture();
    const saved = await store.commitSubmission(input, "operation", "body-digest", 3);
    expect(saved.status).toBe("saved");
    expect(saved.submission).toMatchObject({
      ...input,
      revision: 4,
      submissionId: createPlan6SubmissionRecord(input, 4).submissionId,
    });
    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.scard).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
    expect(redis.eval).toHaveBeenCalledTimes(1);
    const [script, keys, args] = redis.eval.mock.calls[0]!;
    expect(keys).toEqual([
      `frontier:plan6:participant:${input.participantId}`,
      `frontier:plan6:participant:${input.participantId}:revision`,
      `frontier:plan6:participant:${input.participantId}:submissions`,
      "frontier:plan6:submissions",
      `frontier:plan6:submission:${saved.submission.submissionId}`,
      `frontier:plan6:participant:${input.participantId}:idempotency:operation`,
    ]);
    expect(args.slice(1)).toEqual(["body-digest", 3, "1", "frontier:plan6:submission:"]);
    expect(JSON.parse(args[0] as string)).toEqual(saved.submission);
    expect(script).not.toMatch(/\b(EXPIRE|PEXPIRE|SETNX|INCR|DECR)\b/);
    expect(script).toContain("digest ~= ARGV[2]");
    expect(script).toContain("submission.inputHash ~= candidate.inputHash");
    expect(script).toContain("submission.sourceHash ~= candidate.sourceHash");
    expect(script).toContain("current >= 20");
    expect(script).toContain("current ~= tonumber(ARGV[3])");
    expect(script).toContain("redis.call('TYPE', k)");
    expect(script).toContain("local id, digest = decodeSubmissionBinding(binding)");
    expect(script.indexOf("if isSubmissionId(raw) then return raw, nil end")).toBeLessThan(
      script.indexOf("pcall(cjson.decode, raw)"),
    );
    expect(script).toContain("#value == 66 and string.match(value, '^0x%x+$') ~= nil");
    expect(script).toContain(
      "type(decoded) ~= 'table' or not isSubmissionId(decoded.submissionId)",
    );
    expect(script).toContain(
      "decoded.bodyDigest ~= cjson.null and type(decoded.bodyDigest) ~= 'string'",
    );
    expect(script).toContain("redis.call('PERSIST', KEYS[6])");
    const firstWrite = script.indexOf("redis.call('SET', KEYS[5]");
    for (const guard of [
      "IDEMPOTENCY_CONFLICT",
      "PARTICIPANT_REQUIRED",
      "REVISION_LIMIT",
      "REVISION_CONFLICT",
    ]) {
      expect(script.indexOf(guard)).toBeLessThan(firstWrite);
    }
    expect(script.indexOf("return {'existing', stored}")).toBeLessThan(
      script.indexOf("current >= 20"),
    );
    expect(script).toContain("redis.call('SET', KEYS[5], ARGV[1])");
    expect(script).toContain("redis.call('SADD', KEYS[3], candidate.submissionId)");
    expect(script).toContain("redis.call('SADD', KEYS[4], candidate.submissionId)");
    expect(script).toContain("redis.call('SET', KEYS[2], candidate.revision)");
    expect(script).toContain(
      "redis.call('SET', KEYS[6], cjson.encode({submissionId = candidate.submissionId, bodyDigest = ARGV[2]}))",
    );
  });

  it.each([
    ["IDEMPOTENCY_CONFLICT", 409],
    ["REVISION_CONFLICT", 409],
    ["REVISION_LIMIT", 409],
    ["PARTICIPANT_REQUIRED", 403],
    ["STORE_INCONSISTENT", 500],
  ])("maps %s into an API-independent store error", async (code, status) => {
    const { store, redis, input } = fixture();
    redis.eval.mockResolvedValueOnce([code]);
    await expect(store.commitSubmission(input, "operation", "digest", 0)).rejects.toMatchObject({
      name: "Plan6StoreError",
      status,
      code,
    });
    expect(redis.eval).toHaveBeenCalledTimes(1);
    expect(redis.set).not.toHaveBeenCalled();
  });

  it("returns the saved response unchanged after a lost response", async () => {
    const { store, redis, input } = fixture();
    const saved = createPlan6SubmissionRecord(input, 1);
    redis.eval.mockResolvedValueOnce(["existing", JSON.stringify(saved)]);
    await expect(store.commitSubmission(input, "operation", "digest", 19)).resolves.toEqual({
      status: "existing",
      submission: saved,
    });
    redis.eval.mockResolvedValueOnce(["existing", saved]);
    await expect(store.commitSubmission(input, "operation", "digest", 19)).resolves.toEqual({
      status: "existing",
      submission: saved,
    });
  });

  it("retries CAS for callers without an expected revision and uses the shared ID helper", async () => {
    const { store, redis, input } = fixture();
    redis.get.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    redis.eval.mockResolvedValueOnce(["REVISION_CONFLICT"]);
    const result = await store.commitSubmission(input, "operation", "digest");
    expect(result.submission.revision).toBe(2);
    expect(result.submission.submissionId).toBe(createPlan6SubmissionRecord(input, 2).submissionId);
    expect(redis.eval).toHaveBeenCalledTimes(2);
  });

  it("reads digest bindings and legacy submission IDs without creating a revision", async () => {
    const { store, redis, input } = fixture();
    const submission = createPlan6SubmissionRecord(input, 1);
    redis.eval.mockResolvedValueOnce(["found", "digest", JSON.stringify(submission)]);
    await expect(
      store.lookupSubmissionIdempotency(input.participantId, "operation"),
    ).resolves.toEqual({ bodyDigest: "digest", submission });
    redis.eval.mockResolvedValueOnce(["found", null, submission]);
    await expect(store.lookupSubmissionIdempotency(input.participantId, "legacy")).resolves.toEqual(
      { bodyDigest: null, submission },
    );
    const [script, keys, args] = redis.eval.mock.calls[0]!;
    expect(keys).toEqual([
      `frontier:plan6:participant:${input.participantId}:idempotency:operation`,
    ]);
    expect(args).toEqual([input.participantId, "frontier:plan6:submission:"]);
    expect(script).toContain("local id, digest = decodeSubmissionBinding(binding)");
    expect(script).toContain("redis.call('PERSIST', KEYS[1])");
    expect(script.indexOf("submission.participantId ~= ARGV[1]")).toBeLessThan(
      script.indexOf("redis.call('PERSIST'"),
    );
    expect(script.indexOf("submission.submissionId ~= id")).toBeLessThan(
      script.indexOf("redis.call('PERSIST'"),
    );
    expect(script).not.toContain("redis.call('SET'");
    expect(redis.get).not.toHaveBeenCalled();
    redis.eval.mockResolvedValueOnce(["missing"]);
    await expect(
      store.lookupSubmissionIdempotency(input.participantId, "expired"),
    ).resolves.toBeNull();
  });

  it("fails visibly for dangling or cross-participant bindings", async () => {
    const { store, redis, input } = fixture();
    redis.eval.mockResolvedValueOnce(["STORE_INCONSISTENT"]);
    await expect(
      store.lookupSubmissionIdempotency(input.participantId, "dangling"),
    ).rejects.toMatchObject({ code: "STORE_INCONSISTENT" });
    redis.eval.mockResolvedValueOnce(["STORE_INCONSISTENT"]);
    await expect(
      store.lookupSubmissionIdempotency(input.participantId, "foreign"),
    ).rejects.toMatchObject({ code: "STORE_INCONSISTENT" });
  });

  it("checks ownership before selecting a final entry", async () => {
    const { store, redis, input } = fixture();
    const submission = createPlan6SubmissionRecord(input, 1);
    redis.get.mockResolvedValueOnce({ ...submission, participantId: "other" });
    await expect(
      store.selectFinal(input.participantId, submission.submissionId),
    ).rejects.toMatchObject({ status: 404, code: "SUBMISSION_NOT_FOUND" });
    expect(redis.set).not.toHaveBeenCalled();
    redis.get.mockResolvedValueOnce(submission);
    await expect(
      store.selectFinal(input.participantId, submission.submissionId),
    ).resolves.toMatchObject({
      participantId: input.participantId,
      submissionId: submission.submissionId,
    });
    expect(redis.set).toHaveBeenCalledTimes(1);
  });

  it("preserves compatibility bindings through guarded Lua without a TTL", async () => {
    const { store, redis, input } = fixture();
    redis.eval.mockResolvedValueOnce("saved");
    await store.saveSubmissionIdempotency(input.participantId, "legacy", "submission");
    const [script, keys, args] = redis.eval.mock.calls[0]!;
    expect(keys).toHaveLength(2);
    expect(args).toEqual([input.participantId, "submission"]);
    expect(script).toContain("participantId ~= ARGV[1]");
    expect(script).toContain("local id = decodeSubmissionBinding(existing)");
    expect(script.indexOf("if isSubmissionId(raw) then return raw, nil end")).toBeLessThan(
      script.indexOf("pcall(cjson.decode, raw)"),
    );
    expect(script).toContain("if id ~= ARGV[2] then return 'IDEMPOTENCY_CONFLICT' end");
    expect(script).toContain("redis.call('PERSIST', KEYS[2])");
    expect(script).not.toMatch(/\b(EXPIRE|PEXPIRE)\b|86_400/);
    redis.eval.mockResolvedValueOnce("IDEMPOTENCY_CONFLICT");
    await expect(
      store.saveSubmissionIdempotency(input.participantId, "legacy", "other"),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });
});
