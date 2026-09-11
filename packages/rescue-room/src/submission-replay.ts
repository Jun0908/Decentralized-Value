import { z } from "zod";
import {
  createRescuePracticeSession,
  normalizeRescueCommanderPlaybook,
  rescueActionSchema,
  rescueCommanderDecisionSchema,
  rescuePublicViewHash,
  rescueRoomHorizonMinutes,
} from "./index";
import { rescueServiceExecutionHash } from "./service-execution";

const hashSchema = z.string().regex(/^0x[0-9a-f]{64}$/);
export const rescueSubmissionReplayFixtureSchema = z
  .object({
    schemaVersion: z.literal("rescue-submission-replay-v1"),
    episodeId: z.string().min(1).max(200),
    playbook: z.unknown(),
    purchaseAction: rescueActionSchema.refine((action) => action.type === "BUY_SERVICE", {
      message: "Public continuation replay requires one purchase prefix",
    }),
    decisions: z
      .array(
        rescueCommanderDecisionSchema.extend({
          gameMinute: z.number().int().min(0).max(rescueRoomHorizonMinutes),
          publicViewHash: hashSchema,
        }),
      )
      .min(1)
      .max(3),
    // Compare the entire canonical value after replay, rather than trusting selected fields
    // or accepting the recorded resultHash as proof of the recorded numeric outcomes.
    expectedOutcome: z.unknown(),
    expectedComparison: z.unknown(),
  })
  .strict();

/**
 * Pure public-Practice replay. No environment, filesystem, model, keys, RPC or private jobs.
 * This proves recorded Actions reproduce the simulator Outcome, NOT that a model generated
 * the Actions, that an actual specialist was paid, or that its diagnosis was correct.
 * The full original continuation Evidence Hash includes provenance not supplied here.
 */
export function replayRescueSubmissionActions(fixtureInput: unknown) {
  const fixture = rescueSubmissionReplayFixtureSchema.parse(fixtureInput);
  const playbook = normalizeRescueCommanderPlaybook(fixture.playbook);
  const session = createRescuePracticeSession(fixture.episodeId, playbook);
  if (!session.takeAction(fixture.purchaseAction).accepted)
    throw new Error("PUBLIC_REPLAY_PURCHASE_REJECTED");
  for (const decision of fixture.decisions) {
    if (session.isComplete()) throw new Error("PUBLIC_REPLAY_ACTION_AFTER_TERMINAL");
    const view = session.getPublicView();
    if (
      decision.gameMinute !== view.gameMinute ||
      decision.publicViewHash !== rescuePublicViewHash(view)
    )
      throw new Error("PUBLIC_REPLAY_VIEW_CONTEXT_MISMATCH");
    if (decision.action.type === "BUY_SERVICE" || decision.action.type === "APPLY_PATCH")
      throw new Error("PUBLIC_REPLAY_ADDITIONAL_PURCHASE_OR_PATCH_FORBIDDEN");
    if (!session.takeAction(decision.action).accepted)
      throw new Error("PUBLIC_REPLAY_DECISION_REJECTED");
  }
  if (fixture.decisions.length < 3 && !session.isComplete())
    throw new Error("PUBLIC_REPLAY_INCOMPLETE_RECORDED_TURNS");
  const outcome = session.finish();
  const expected = fixture.expectedOutcome as {
    resultHash?: unknown;
    transcriptHash?: unknown;
  } | null;
  if (
    !expected ||
    outcome.resultHash !== expected.resultHash ||
    outcome.transcriptHash !== expected.transcriptHash ||
    rescueServiceExecutionHash(outcome) !== rescueServiceExecutionHash(expected)
  )
    throw new Error("PUBLIC_REPLAY_OUTCOME_MISMATCH");
  return {
    request: { episodeId: fixture.episodeId, playbook },
    outcome,
    outcomeCanonicalHash: rescueServiceExecutionHash(outcome),
    expectedComparison: fixture.expectedComparison,
    decisionCount: fixture.decisions.length,
  };
}

/** The caller recomputes pools with the same versioned comparison implementation. */
export function assertRescueSubmissionReplayComparison(expected: unknown, recomputed: unknown) {
  const hash = rescueServiceExecutionHash(recomputed);
  if (rescueServiceExecutionHash(expected) !== hash)
    throw new Error("PUBLIC_REPLAY_COMPARISON_MISMATCH");
  return hash;
}
