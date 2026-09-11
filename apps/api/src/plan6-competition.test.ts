import { createHash } from "node:crypto";
import {
  compareDisasterResponseEvaluations,
  defaultDisasterResponseStrategy,
  evaluateDisasterResponseStrategy,
} from "@frontier/disaster-response";
import { canonicalProtocolJson } from "@frontier/shared";
import { keccak256, stringToHex } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MemoryPlan6CompetitionStore,
  Plan6StoreError,
  createPlan6StarterKitZip,
  disasterResponseInputHash,
  plan6SubmissionSchema,
  preparePlan6Submission,
} from "./plan6-competition";

const wallet = "0x1111111111111111111111111111111111111111" as const;
const raw = plan6SubmissionSchema.parse({
  strategy: defaultDisasterResponseStrategy,
  sourceMethod: "JSON",
});
const digest = keccak256(stringToHex(canonicalProtocolJson(raw)));

async function fixture() {
  const store = new MemoryPlan6CompetitionStore();
  const participant = await store.join({ userId: "alice", wallet });
  return { store, participant, input: preparePlan6Submission(participant, structuredClone(raw)) };
}

afterEach(() => vi.useRealTimers());

describe("atomic Disaster Response submission storage", () => {
  it("commits one revision for parallel retries, even with the same expected revision", async () => {
    const { store, input } = await fixture();
    const results = await Promise.all(
      Array.from({ length: 40 }, () => store.commitSubmission(input, "operation", digest, 0)),
    );
    expect(results.filter(({ status }) => status === "saved")).toHaveLength(1);
    expect(new Set(results.map(({ submission }) => submission.submissionId)).size).toBe(1);
    expect(await store.submissionsForParticipant(input.participantId)).toHaveLength(1);
    expect(await store.submissionsForChallenge()).toHaveLength(1);
    expect(await store.lookupSubmissionIdempotency(input.participantId, "operation")).toEqual({
      bodyDigest: digest,
      submission: results[0]!.submission,
    });
  });

  it("binds the body before the revision check and rejects competing bodies", async () => {
    const { store, input } = await fixture();
    const outcomes = await Promise.allSettled([
      store.commitSubmission(input, "operation", digest, 0),
      store.commitSubmission(input, "operation", "different-body", 0),
    ]);
    expect(outcomes[0].status).toBe("fulfilled");
    expect(outcomes[1]).toMatchObject({
      status: "rejected",
      reason: { status: 409, code: "IDEMPOTENCY_CONFLICT" },
    });
    expect(await store.submissionsForChallenge()).toHaveLength(1);
  });

  it("caps parallel distinct operations at 20 without consuming revisions on rejection", async () => {
    const { store, input } = await fixture();
    const results = await Promise.allSettled(
      Array.from({ length: 50 }, (_, i) => store.commitSubmission(input, `operation-${i}`, digest)),
    );
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(20);
    for (const result of results.filter(({ status }) => status === "rejected")) {
      expect(result).toMatchObject({ reason: { status: 409, code: "REVISION_LIMIT" } });
    }
    const submissions = await store.submissionsForParticipant(input.participantId);
    expect(submissions.map(({ revision }) => revision)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
    expect(new Set(submissions.map(({ submissionId }) => submissionId)).size).toBe(20);
    expect(await store.submissionsForChallenge()).toHaveLength(20);
    await expect(store.commitSubmission(input, "operation-0", digest, 0)).resolves.toMatchObject({
      status: "existing",
      submission: { revision: 1 },
    });
    expect(await store.lookupSubmissionIdempotency(input.participantId, "operation-49")).toBeNull();
  });

  it("rejects stale preparation without writes and accepts a diff rebuilt against the winner", async () => {
    const { store, participant, input } = await fixture();
    const first = await store.commitSubmission(input, "first", digest, 0);
    const changedRaw = { ...raw, strategy: { ...raw.strategy, reserveKits: 100 } };
    const stale = preparePlan6Submission(participant, changedRaw);
    await expect(store.commitSubmission(stale, "second", "second-body", 0)).rejects.toMatchObject({
      status: 409,
      code: "REVISION_CONFLICT",
    });
    expect(await store.lookupSubmissionIdempotency(input.participantId, "second")).toBeNull();
    const prepared = preparePlan6Submission(participant, changedRaw, first.submission.evaluation);
    const second = await store.commitSubmission(prepared, "second", "second-body", 1);
    expect(second.submission.revision).toBe(2);
    expect(second.submission.evaluation).toEqual(
      compareDisasterResponseEvaluations(
        evaluateDisasterResponseStrategy(changedRaw.strategy),
        first.submission.evaluation,
      ),
    );
    expect(second.submission.evaluation.resultHash).toBe(stale.evaluation.resultHash);
    expect(second.submission.submissionId).toBe(
      keccak256(
        stringToHex(`${input.participantId}:2:${prepared.sourceHash}:${prepared.inputHash}`),
      ),
    );
  });

  it("recovers a lost response after 24 hours and preserves the saved evaluation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const { store, input } = await fixture();
    const saved = await store.commitSubmission(input, "operation", digest, 0);
    vi.setSystemTime(new Date("2026-01-04T00:00:00Z"));
    const retry = await store.commitSubmission(
      { ...input, evaluation: { ...input.evaluation, contextHash: `0x${"ab".repeat(32)}` } },
      "operation",
      digest,
      0,
    );
    expect(retry).toEqual({ status: "existing", submission: saved.submission });
    expect(await store.submissionsForChallenge()).toHaveLength(1);
  });

  it("isolates keys and final selection by participant", async () => {
    const { store, input } = await fixture();
    const bob = await store.join({ userId: "bob", wallet });
    const aliceSaved = await store.commitSubmission(input, "same-key", digest);
    const bobSaved = await store.commitSubmission(
      preparePlan6Submission(bob, raw),
      "same-key",
      digest,
    );
    expect(aliceSaved.submission.submissionId).not.toBe(bobSaved.submission.submissionId);
    expect(await store.submissionsForParticipant(bob.participantId)).toEqual([bobSaved.submission]);
    await expect(
      store.selectFinal(bob.participantId, aliceSaved.submission.submissionId),
    ).rejects.toMatchObject({ status: 404, code: "SUBMISSION_NOT_FOUND" });
    expect(await store.finalEntry(bob.participantId)).toBeNull();
    await expect(
      store.selectFinal(bob.participantId, bobSaved.submission.submissionId),
    ).resolves.toMatchObject({ submissionId: bobSaved.submission.submissionId });
    await expect(
      store.commitSubmission({ ...input, participantId: `0x${"00".repeat(32)}` }, "new", digest),
    ).rejects.toBeInstanceOf(Plan6StoreError);
  });

  it("keeps compatibility bindings immutable and checks legacy payload hashes", async () => {
    const { store, input } = await fixture();
    const first = await store.addSubmission(input);
    await store.saveSubmissionIdempotency(input.participantId, "legacy", first.submissionId);
    const second = await store.addSubmission(input);
    await expect(
      store.saveSubmissionIdempotency(input.participantId, "legacy", second.submissionId),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    await expect(store.commitSubmission(input, "legacy", digest, 0)).resolves.toMatchObject({
      status: "existing",
      submission: first,
    });
    await expect(
      store.commitSubmission({ ...input, sourceHash: `0x${"ff".repeat(32)}` }, "legacy", digest),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    expect(await store.submissionForIdempotency(input.participantId, "legacy")).toEqual(first);
  });

  it("does not let caller mutations rewrite committed evidence", async () => {
    const { store, input } = await fixture();
    const saved = await store.commitSubmission(input, "operation", digest);
    saved.submission.artifact.strategy.name = "mutated result";
    input.artifact.strategy.name = "mutated input";
    const lookup = await store.lookupSubmissionIdempotency(input.participantId, "operation");
    expect(lookup?.submission.artifact.strategy.name).not.toContain("mutated");
    lookup!.submission.artifact.strategy.name = "mutated lookup";
    expect(
      (await store.submissionsForParticipant(input.participantId))[0]!.artifact.strategy.name,
    ).not.toContain("mutated");
  });
});

describe("Disaster Response reproducible artifacts", () => {
  it("shares the original wrapped strategy hash without changing the result hash", async () => {
    const { input } = await fixture();
    expect(input.inputHash).toBe(disasterResponseInputHash(raw.strategy));
    expect(input.inputHash).toBe(
      keccak256(stringToHex(canonicalProtocolJson({ strategy: raw.strategy }))),
    );
    expect(input.evaluation.resultHash).toBe(
      evaluateDisasterResponseStrategy(raw.strategy).resultHash,
    );
  });

  it("emits identical starter ZIP bytes and SHA-256 across download times", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const first = createPlan6StarterKitZip();
    vi.setSystemTime(new Date("2027-09-11T12:34:56Z"));
    const second = createPlan6StarterKitZip();
    expect(Buffer.compare(first, second)).toBe(0);
    expect(createHash("sha256").update(first).digest("hex")).toBe(
      createHash("sha256").update(second).digest("hex"),
    );
  });
});
