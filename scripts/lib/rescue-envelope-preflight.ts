import {
  canonicalProtocolJson,
  createEvaluationResultV2,
  evaluationRequestV2Schema,
  hashEvaluationRequestV2,
  verifyEvaluationResultV2,
  type EvaluationRequestV2,
} from "../../packages/shared/src/index";
import {
  evaluateRescueDoctrinePracticeEpisode,
  normalizeRescueDoctrine,
  rescuePublicPracticeEpisodeIds,
  rescueDoctrineContextHash,
  rescueDoctrineHash,
  rescueDoctrineInterpreterVersion,
  rescuePracticeContextHash,
  rescueRoomEvaluatorVersion,
  rescueRoomManifestHash,
  rescueRoomMetrics,
} from "../../packages/rescue-room/src/index";
import { keccak256, stringToHex, type Hex } from "viem";

export type RescueEnvelopeArtifact = { doctrine: unknown; episodeId: string };

/** Local public-Practice adapter, not a Final or externally callable runner.
 * The host supplies the hash of the actual bundle it executes; a request may
 * not choose a different evaluator. This does not authenticate that host. */
export function createRescueEnvelopeRequest(
  artifact: RescueEnvelopeArtifact,
  runtime: { jobId: string; codeHash: Hex },
): EvaluationRequestV2 {
  const episodeId = artifact.episodeId;
  const doctrine = normalizeRescueDoctrine(artifact.doctrine);
  if (!rescuePublicPracticeEpisodeIds().includes(episodeId)) {
    throw new Error("Only published Rescue Practice episodes are supported");
  }
  const contextHash = keccak256(
    stringToHex(
      canonicalProtocolJson({
        domain: "frontier:rescue-envelope-preflight-context:v1",
        practiceContextHash: rescuePracticeContextHash,
        doctrineContextHash: rescueDoctrineContextHash,
        manifestHash: rescueRoomManifestHash,
        episodeId,
        aggregationVersion: "rescue-single-episode-v1",
      }),
    ),
  );
  return evaluationRequestV2Schema.parse({
    schemaVersion: "evaluation-request-v2",
    arenaId: "rescue-room",
    jobId: runtime.jobId,
    roundHash: null,
    artifactHash: rescueDoctrineHash(doctrine),
    artifactUri: null,
    evaluator: {
      id: "rescue-room-doctrine",
      version: `${rescueRoomEvaluatorVersion}/${rescueDoctrineInterpreterVersion}`,
      codeHash: runtime.codeHash,
    },
    contextHash,
    metrics: rescueRoomMetrics(1),
    aggregationVersion: "rescue-single-episode-v1",
    snapshotHash: null,
    requiredCapability: "rescue-doctrine-public-practice",
    executionMode: "local",
  });
}

/** Evaluate only after every requested binding matches this local runtime and
 * the supplied artifact. The legacy evaluator's hashes remain untouched. */
export function runRescueEnvelopePreflight(
  requestValue: unknown,
  artifact: RescueEnvelopeArtifact,
  runtime: { codeHash: Hex },
) {
  const request = evaluationRequestV2Schema.parse(requestValue);
  // Normalize once: never validate one caller-owned object and then reread it
  // for execution (e.g. a getter returning a different Doctrine on each read).
  const snapshot = {
    episodeId: artifact.episodeId,
    doctrine: normalizeRescueDoctrine(artifact.doctrine),
  };
  const expected = createRescueEnvelopeRequest(snapshot, {
    jobId: request.jobId,
    codeHash: runtime.codeHash,
  });
  if (hashEvaluationRequestV2(request) !== hashEvaluationRequestV2(expected)) {
    throw new Error("Request does not match the local Rescue Practice runtime and artifact");
  }
  const evaluation = evaluateRescueDoctrinePracticeEpisode(snapshot.doctrine, snapshot.episodeId);
  if (evaluation.doctrineHash !== request.artifactHash) {
    throw new Error("Evaluated Doctrine does not match the requested Artifact hash");
  }
  const result = createEvaluationResultV2(request, {
    correctness: evaluation.outcome.correctness,
    failures: evaluation.outcome.correctness ? [] : ["RESCUE_HARD_CONSTRAINT_FAILED"],
    outcomes: {
      totalUserLossUsd: evaluation.outcome.userLossUsd,
      servedProtocolDemandPpm: evaluation.outcome.servedProtocolDemandPpm,
      netResponseSpendCredits: evaluation.outcome.netResponseSpendCredits,
    },
    episodes: [{ episodeId: snapshot.episodeId, resultHash: evaluation.outcome.resultHash }],
  });
  return {
    request,
    result: verifyEvaluationResultV2(result, request),
    legacy: {
      evaluationHash: evaluation.evaluationHash,
      episodeResultHash: evaluation.outcome.resultHash,
      transcriptHash: evaluation.outcome.transcriptHash,
    },
    replay: evaluation.replay,
    boundary: {
      evaluationState: "simulated" as const,
      executionMode: "local" as const,
      verification: "local-replay" as const,
      paymentState: "game-credits" as const,
      rewardEligible: false as const,
      creVerified: false as const,
    },
  };
}
