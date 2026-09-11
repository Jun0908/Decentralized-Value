import {
  defaultDisasterResponseStrategy,
  evaluateDisasterResponseStrategy,
} from "@frontier/disaster-response";
import { describe, expect, it } from "vitest";
import { metricOrigins } from "./disaster-response-insights";
import { resolveSavedSubmission, savedSubmissionAccess, type Submission } from "./saved-submission";

const submissionId = `0x${"12".repeat(32)}`;
const otherId = `0x${"34".repeat(32)}`;
const selectedAt = "2026-09-11T03:00:00.000Z";

function fixture() {
  const strategy = structuredClone(defaultDisasterResponseStrategy);
  const submission: Submission = {
    submissionId,
    participantId: "owner",
    revision: 1,
    sourceMethod: "JSON",
    inputHash: `0x${"56".repeat(32)}`,
    sourceHash: `0x${"78".repeat(32)}`,
    artifact: { strategy },
    evaluation: evaluateDisasterResponseStrategy(strategy),
    submittedAt: "2026-09-11T02:00:00.000Z",
    agentEvidence: null,
  };
  return {
    participant: { participantId: "owner", displayName: "Fixture participant" },
    submissions: [submission],
    finalEntry: null as { submissionId: string; selectedAt: string } | null,
  };
}

describe("saved submission resolution", () => {
  it("returns the requested owner revision and original saved artifact and evaluation", () => {
    const payload = fixture();
    const submission = payload.submissions[0]!;
    payload.submissions.unshift({ ...submission, submissionId: otherId, revision: 2 });
    const result = resolveSavedSubmission(payload, submissionId);
    expect(result.kind).toBe("loaded");
    if (result.kind !== "loaded") throw new Error("Expected saved owner revision");
    expect(result.submission).toBe(submission);
    expect(result.submission.artifact).toBe(submission.artifact);
    expect(result.submission.evaluation).toBe(submission.evaluation);
  });

  it("does not select an unselected revision merely by resolving it", () => {
    const payload = fixture();
    expect(resolveSavedSubmission(payload, submissionId)).toMatchObject({
      kind: "loaded",
      selectedAt: null,
    });
    expect(payload.finalEntry).toBeNull();
  });

  it("does not expose an unknown ID", () => {
    expect(resolveSavedSubmission(fixture(), otherId)).toEqual({ kind: "missing" });
  });

  it("does not expose a matching ID owned by another participant", () => {
    const payload = fixture();
    payload.submissions[0]!.participantId = "another-owner";
    expect(resolveSavedSubmission(payload, submissionId)).toEqual({ kind: "missing" });
  });

  it("distinguishes an account that has not joined, even if rows were returned", () => {
    expect(resolveSavedSubmission({ ...fixture(), participant: null }, submissionId)).toEqual({
      kind: "not-joined",
    });
  });

  it.each([undefined, {}, { participantId: null }, { participantId: 12 }])(
    "rejects malformed participant identity %j",
    (participant) => {
      expect(resolveSavedSubmission({ ...fixture(), participant }, submissionId)).toEqual({
        kind: "error",
      });
    },
  );

  it("reports the server's selection timestamp for this revision", () => {
    const payload = fixture();
    payload.finalEntry = { submissionId, selectedAt };
    expect(resolveSavedSubmission(payload, submissionId)).toMatchObject({
      kind: "loaded",
      selectedAt,
    });
  });

  it("does not label this revision selected when the server selected another ID", () => {
    const payload = fixture();
    payload.finalEntry = { submissionId: otherId, selectedAt };
    expect(resolveSavedSubmission(payload, submissionId)).toMatchObject({
      kind: "loaded",
      selectedAt: null,
    });
  });

  it.each([null, undefined, false, 12, "invalid", []].map((payload) => ({ payload })))(
    "rejects non-response payload %j",
    ({ payload }) => {
      expect(resolveSavedSubmission(payload, submissionId)).toEqual({ kind: "error" });
    },
  );

  it.each([
    {},
    { participant: null, finalEntry: null },
    { participant: null, submissions: {} },
    { participant: null, submissions: [] },
  ])("rejects missing or malformed envelope fields %j", (payload) => {
    expect(resolveSavedSubmission(payload, submissionId)).toEqual({ kind: "error" });
  });

  it.each([
    { evaluation: null },
    { evaluation: {} },
    { artifact: null },
    { artifact: { strategy: { name: 12 } } },
  ])("rejects incomplete saved content %j", (patch) => {
    const payload = fixture();
    expect(
      resolveSavedSubmission(
        { ...payload, submissions: [{ ...payload.submissions[0], ...patch }] },
        submissionId,
      ),
    ).toEqual({ kind: "error" });
  });

  it("preserves failed correctness as saved evidence without marking it passed", () => {
    const payload = fixture();
    payload.submissions[0]!.evaluation.correctness = false;
    payload.submissions[0]!.evaluation.constraintFailures = ["Fixture correctness failure"];
    const result = resolveSavedSubmission(payload, submissionId);
    expect(result).toMatchObject({
      kind: "loaded",
      submission: {
        evaluation: { correctness: false, constraintFailures: ["Fixture correctness failure"] },
      },
    });
  });

  it.each([
    { correctness: "true" },
    { strategy: { name: null } },
    { constraintFailures: [12] },
    { constraintFailures: null },
    { scenarioOutcomes: null },
    { scenarioOutcomes: [null] },
    { scenarioOutcomes: [{ scenarioId: "incomplete" }] },
  ])("rejects malformed evaluation fields %j", (patch) => {
    const payload = fixture();
    const submission = payload.submissions[0]!;
    expect(
      resolveSavedSubmission(
        {
          ...payload,
          submissions: [{ ...submission, evaluation: { ...submission.evaluation, ...patch } }],
        },
        submissionId,
      ),
    ).toEqual({ kind: "error" });
  });

  it("leaves the entire response unchanged on repeated reads", () => {
    const payload = fixture();
    payload.finalEntry = { submissionId: otherId, selectedAt };
    const before = structuredClone(payload);
    resolveSavedSubmission(payload, submissionId);
    resolveSavedSubmission(payload, submissionId);
    expect(payload).toEqual(before);
  });

  it("rejects non-finite scenario metrics", () => {
    const payload = fixture();
    payload.submissions[0]!.evaluation.scenarioOutcomes[0]!.totalCostUsd = Number.NaN;
    expect(resolveSavedSubmission(payload, submissionId)).toEqual({ kind: "error" });
  });

  it("does not infer selection from a malformed timestamp", () => {
    expect(
      resolveSavedSubmission(
        { ...fixture(), finalEntry: { submissionId, selectedAt: null } },
        submissionId,
      ),
    ).toMatchObject({ kind: "loaded", selectedAt: null });
  });

  it("preserves every deterministic scenario's replay and produces the existing metric summaries", () => {
    const payload = fixture();
    const result = resolveSavedSubmission(payload, submissionId);
    if (result.kind !== "loaded") throw new Error("Expected a playable saved evaluation");
    const evaluation = result.submission.evaluation;
    expect(evaluation.scenarioOutcomes).toHaveLength(7);
    expect(
      evaluation.scenarioOutcomes.some((outcome) => outcome.replayTrace.disruptions.length > 0),
    ).toBe(true);
    for (const outcome of evaluation.scenarioOutcomes) {
      expect(outcome.replayTrace.shipments.length).toBeGreaterThan(0);
      expect(outcome.regionOutcomes.length).toBeGreaterThan(0);
    }
    expect(metricOrigins(evaluation).map(({ value }) => value)).toEqual([
      evaluation.totalProcurementCost,
      evaluation.worstCaseDeliveredKits,
      evaluation.regionalFairnessPpm,
    ]);
  });

  it.each([
    { totalProcurementCost: undefined },
    { worstCaseDeliveredKits: "800" },
    { regionalFairnessPpm: Number.POSITIVE_INFINITY },
    { worstScenarioId: {} },
    { evaluatorVersion: {} },
    { dataVersion: [] },
    { contextHash: {} },
    { manifestHash: {} },
    { resultHash: {} },
    { finalScenarioCommitment: {} },
  ])("rejects malformed evaluation values rendered outside scenario summaries %j", (patch) => {
    const payload = fixture();
    const submission = payload.submissions[0]!;
    expect(
      resolveSavedSubmission(
        {
          ...payload,
          submissions: [{ ...submission, evaluation: { ...submission.evaluation, ...patch } }],
        },
        submissionId,
      ),
    ).toEqual({ kind: "error" });
  });

  it.each([
    { revision: {} },
    { submittedAt: {} },
    { sourceMethod: {} },
    { inputHash: {} },
    { sourceHash: {} },
    { agentEvidence: { name: {}, version: "1", objective: "fixture" } },
  ])("rejects non-renderable revision metadata %j", (patch) => {
    const payload = fixture();
    expect(
      resolveSavedSubmission(
        { ...payload, submissions: [{ ...payload.submissions[0], ...patch }] },
        submissionId,
      ),
    ).toEqual({ kind: "error" });
  });

  it.each([
    { shipments: null },
    { shipments: [null] },
    { shipments: [{}] },
    { disruptions: null },
    { disruptions: [null] },
    { disruptions: [{ label: {}, disabledRouteIds: [] }] },
    { disruptions: [{ label: "Fixture event", disabledRouteIds: [12] }] },
    { disruptions: [{ label: "Fixture event", disabledRouteIds: null }] },
    { emergencyBudgetUsd: "100" },
    { recoverySpentUsd: Number.NaN },
  ])("rejects malformed replay traces %j", (patch) => {
    const payload = fixture();
    const outcome = payload.submissions[0]!.evaluation.scenarioOutcomes[0]!;
    Object.assign(outcome.replayTrace, patch);
    expect(resolveSavedSubmission(payload, submissionId)).toEqual({ kind: "error" });
  });

  it.each([
    { routeId: 12 },
    { routeName: {} },
    { supplierName: {} },
    { phase: null },
    { status: {} },
    { kits: "100" },
    { costUsd: Number.POSITIVE_INFINITY },
  ])("rejects shipment fields used by replay markers and arithmetic %j", (patch) => {
    const payload = fixture();
    Object.assign(
      payload.submissions[0]!.evaluation.scenarioOutcomes[0]!.replayTrace.shipments[0]!,
      patch,
    );
    expect(resolveSavedSubmission(payload, submissionId)).toEqual({ kind: "error" });
  });

  it.each([
    { regionOutcomes: null },
    { regionOutcomes: [] },
    { regionOutcomes: [null] },
    {
      regionOutcomes: [
        { regionId: "region", regionName: {}, demand: 100, delivered: 50, coveragePpm: 500_000 },
      ],
    },
    {
      regionOutcomes: [
        {
          regionId: "region",
          regionName: "Region",
          demand: "100",
          delivered: 50,
          coveragePpm: 500_000,
        },
      ],
    },
    {
      regionOutcomes: [
        {
          regionId: "region",
          regionName: "Region",
          demand: 100,
          delivered: 50,
          coveragePpm: Number.NaN,
        },
      ],
    },
    { replayTrace: {} },
  ])("rejects malformed scenario replay evidence %j", (patch) => {
    const payload = fixture();
    Object.assign(payload.submissions[0]!.evaluation.scenarioOutcomes[0]!, patch);
    expect(resolveSavedSubmission(payload, submissionId)).toEqual({ kind: "error" });
  });

  it("validates all replay scenarios, not just the initially selected worst case", () => {
    const payload = fixture();
    const evaluation = payload.submissions[0]!.evaluation;
    const other = evaluation.scenarioOutcomes.find(
      (outcome) => outcome.scenarioId !== evaluation.worstScenarioId,
    )!;
    Object.assign(other.replayTrace, { shipments: null });
    expect(resolveSavedSubmission(payload, submissionId)).toEqual({ kind: "error" });
  });

  it.each([null, undefined])(
    "preserves absent legacy replay evidence %j for the unavailable state",
    (replayTrace) => {
      const payload = fixture();
      Object.assign(payload.submissions[0]!.evaluation.scenarioOutcomes[0]!, { replayTrace });
      expect(resolveSavedSubmission(payload, submissionId).kind).toBe("loaded");
    },
  );
});

describe("saved submission access", () => {
  const account = { configured: true, ready: true, authenticated: true };

  it.each(
    [
      "rescue-room",
      "unknown-arena",
      "",
      ["disaster-response"],
      ["disaster-response", "rescue-room"],
    ].map((arena) => ({ arena })),
  )("rejects unsupported or ambiguous arena %j before history can load", ({ arena }) => {
    expect(savedSubmissionAccess(arena, account)).toBe("unsupported-arena");
    expect(
      savedSubmissionAccess(arena, { configured: false, ready: false, authenticated: false }),
    ).toBe("unsupported-arena");
  });

  it("allows history only for a ready authenticated Disaster Response account", () => {
    expect(savedSubmissionAccess("disaster-response", account)).toBe("allowed");
  });

  it("reports missing configuration before attempting session restoration", () => {
    expect(
      savedSubmissionAccess("disaster-response", {
        configured: false,
        ready: false,
        authenticated: false,
      }),
    ).toBe("unconfigured");
  });

  it("waits for restoration even when authentication is already true", () => {
    expect(savedSubmissionAccess("disaster-response", { ...account, ready: false })).toBe(
      "restoring",
    );
  });

  it("requires sign-in when a ready account is unauthenticated", () => {
    expect(savedSubmissionAccess("disaster-response", { ...account, authenticated: false })).toBe(
      "sign-in",
    );
  });
});
