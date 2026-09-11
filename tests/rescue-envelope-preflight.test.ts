import { describe, expect, it } from "vitest";
import {
  createRescuePaymentPolicyState,
  evaluateRescueDoctrinePracticeEpisode,
  publicRescueRoomScenario,
  reserveRescuePaymentIntent,
  rescueCommanderPaymentActionHash,
  rescueDoctrinePresets,
} from "../packages/rescue-room/src/index";
import { hashEvaluationRequestV2 } from "../packages/shared/src/index";
import {
  createRescueEnvelopeRequest,
  runRescueEnvelopePreflight,
} from "../scripts/lib/rescue-envelope-preflight";

const codeHash = `0x${"ab".repeat(32)}` as const; // Unit-test runtime identity, not deployed code.
const runtime = { jobId: "local-test-1", codeHash };
const artifact = {
  episodeId: publicRescueRoomScenario().episodes[0]!.id,
  doctrine: rescueDoctrinePresets[1]!.doctrine,
};

describe("Rescue public-Practice to Evaluation V2 integration", () => {
  it("preserves real evaluator results, all three metrics and replay without claiming CRE/payment", () => {
    const request = createRescueEnvelopeRequest(artifact, runtime);
    const wrapped = runRescueEnvelopePreflight(request, artifact, runtime);
    const legacy = evaluateRescueDoctrinePracticeEpisode(artifact.doctrine, artifact.episodeId);
    expect(wrapped.legacy.evaluationHash).toBe(legacy.evaluationHash);
    expect(wrapped.result.episodes[0]!.resultHash).toBe(legacy.outcome.resultHash);
    expect(wrapped.result.outcomes).toEqual({
      totalUserLossUsd: legacy.outcome.userLossUsd,
      servedProtocolDemandPpm: legacy.outcome.servedProtocolDemandPpm,
      netResponseSpendCredits: legacy.outcome.netResponseSpendCredits,
    });
    expect(wrapped.replay.matchesRecordedOutcome).toBe(true);
    expect(wrapped.boundary).toEqual({
      evaluationState: "simulated",
      executionMode: "local",
      verification: "local-replay",
      paymentState: "game-credits",
      rewardEligible: false,
      creVerified: false,
    });
  });

  it("repeats the same result independently of local Job identity", () => {
    const firstRequest = createRescueEnvelopeRequest(artifact, runtime);
    const secondRequest = createRescueEnvelopeRequest(artifact, {
      ...runtime,
      jobId: "local-test-2",
    });
    expect(hashEvaluationRequestV2(firstRequest)).not.toBe(hashEvaluationRequestV2(secondRequest));
    expect(runRescueEnvelopePreflight(firstRequest, artifact, runtime).result.resultHash).toBe(
      runRescueEnvelopePreflight(secondRequest, artifact, runtime).result.resultHash,
    );
  });

  it("rejects substituted Doctrine, episode, code, Context, metrics and execution mode", () => {
    const request = createRescueEnvelopeRequest(artifact, runtime);
    expect(() =>
      runRescueEnvelopePreflight(
        request,
        { ...artifact, doctrine: rescueDoctrinePresets[0]!.doctrine },
        runtime,
      ),
    ).toThrow(/does not match/);
    expect(() =>
      runRescueEnvelopePreflight(
        request,
        { ...artifact, episodeId: publicRescueRoomScenario().episodes[1]!.id },
        runtime,
      ),
    ).toThrow(/does not match/);
    for (const modified of [
      { ...request, evaluator: { ...request.evaluator, codeHash: `0x${"cd".repeat(32)}` } },
      { ...request, contextHash: `0x${"cd".repeat(32)}` },
      { ...request, metrics: request.metrics.map((m) => ({ ...m, direction: "MAXIMIZE" })) },
      { ...request, executionMode: "cre-confidential" },
      { ...request, snapshotHash: `0x${"cd".repeat(32)}` },
      { ...request, roundHash: `0x${"cd".repeat(32)}` },
      { ...request, artifactUri: "https://example.com/different-artifact.json" },
    ]) {
      expect(() => runRescueEnvelopePreflight(modified, artifact, runtime)).toThrow(
        /does not match/,
      );
    }
  });

  it("does not expose arbitrary or Hidden Final episodes through the Practice adapter", () => {
    expect(() =>
      createRescueEnvelopeRequest({ ...artifact, episodeId: "hidden-final" }, runtime),
    ).toThrow(/published/);
  });

  it("evaluates the same normalized snapshot it validated instead of rereading caller getters", () => {
    const request = createRescueEnvelopeRequest(artifact, runtime);
    let reads = 0;
    const mutableInput = {
      episodeId: artifact.episodeId,
      get doctrine() {
        reads += 1;
        return reads === 1 ? artifact.doctrine : rescueDoctrinePresets[0]!.doctrine;
      },
    };
    const wrapped = runRescueEnvelopePreflight(request, mutableInput, runtime);
    expect(reads).toBe(1);
    expect(wrapped.legacy.evaluationHash).toBe(
      evaluateRescueDoctrinePracticeEpisode(artifact.doctrine, artifact.episodeId).evaluationHash,
    );
    expect(wrapped.result.binding.artifactHash).toBe(request.artifactHash);
  });

  it("prepares a real Doctrine Service purchase without changing the evaluation or claiming payment", () => {
    const request = createRescueEnvelopeRequest(artifact, runtime);
    const before = runRescueEnvelopePreflight(request, artifact, runtime);
    const evaluation = evaluateRescueDoctrinePracticeEpisode(artifact.doctrine, artifact.episodeId);
    const order = evaluation.paymentEvidence.orders[0]!;
    expect(order).toBeDefined();
    const decision = evaluation.decisions.find(
      (item) =>
        item.accepted &&
        rescueCommanderPaymentActionHash({
          episodeHash: order.episodeHash,
          decision: item.decision,
          gameMinute: item.gameMinute,
          publicViewHash: item.publicViewHash,
          action: item.action,
        }) === order.commanderActionHash,
    )!;
    expect(decision).toBeDefined();
    const now = 1_800_000_000;
    const policy = {
      schemaVersion: "rescue-payment-policy-v0",
      chainId: 11155111,
      tokenAddress: `0x${"2".repeat(40)}`,
      escrowAddress: `0x${"3".repeat(40)}`,
      commanderWallet: `0x${"4".repeat(40)}`,
      evaluationContextHash: evaluation.contextHash,
      episodeHash: order.episodeHash,
      maximumOrderAmount: "100000000",
      maximumEpisodeAmount: "100000000",
      validFromUnixSeconds: now - 60,
      validUntilUnixSeconds: now + 600,
      maximumOrderLifetimeSeconds: 180,
      services: [
        {
          serviceId: order.serviceId,
          providerAddress: `0x${"5".repeat(40)}`,
          serviceManifestHash: order.serviceManifestHash,
        },
      ],
    };
    const prepared = reserveRescuePaymentIntent(
      policy,
      createRescuePaymentPolicyState(policy),
      {
        accepted: decision.accepted,
        action: decision.action,
        decision: decision.decision,
        publicViewHash: decision.publicViewHash,
        order,
        policyNonce: "0",
        deadlineUnixSeconds: now + 120,
      },
      now,
    );
    expect(prepared.intent.args.orderId).toBe(order.orderId);
    expect(prepared.intent.paymentState).toBe("not-requested");
    expect(runRescueEnvelopePreflight(request, artifact, runtime)).toEqual(before);
  });
});
