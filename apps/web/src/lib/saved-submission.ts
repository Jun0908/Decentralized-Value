import type {
  DisasterResponseEvaluation,
  DisasterResponseStrategy,
} from "@frontier/disaster-response";
import { z } from "zod";

export type Submission = {
  submissionId: string;
  participantId: string;
  revision: number;
  sourceMethod: string;
  inputHash: string;
  sourceHash: string;
  artifact: { strategy: DisasterResponseStrategy };
  evaluation: DisasterResponseEvaluation;
  submittedAt: string;
  agentEvidence: { name: string; version: string; objective: string } | null;
};

type MineResponse = {
  participant: { participantId: string; displayName: string } | null;
  submissions: Submission[];
  finalEntry: { submissionId: string; selectedAt: string } | null;
};

export type ResultState =
  | { kind: "loaded"; submission: Submission; selectedAt: string | null }
  | { kind: "missing" | "not-joined" | "unauthorized" | "unavailable" | "error" };

export function savedSubmissionAccess(
  arena: string | string[],
  account: { configured: boolean; ready: boolean; authenticated: boolean },
) {
  if (arena !== "disaster-response") return "unsupported-arena";
  if (!account.configured) return "unconfigured";
  if (!account.ready) return "restoring";
  if (!account.authenticated) return "sign-in";
  return "allowed";
}

// Validate only fields rendered by SubmissionResult, metricOrigins, and DisasterReplayStage.
// Keep the original payload below so validation cannot strip saved Strategy or evidence fields.
const namedStrategySchema = z.object({ name: z.string() });
const replaySchema = z.object({
  emergencyBudgetUsd: z.number().finite(),
  recoverySpentUsd: z.number().finite(),
  shipments: z.array(
    z.object({
      supplierId: z.string(),
      supplierName: z.string(),
      routeId: z.string(),
      routeName: z.string(),
      phase: z.enum(["PRIMARY", "RESERVE", "RECOVERY"]),
      status: z.enum(["SURVIVED", "LOST"]),
      kits: z.number().finite(),
      costUsd: z.number().finite(),
    }),
  ),
  disruptions: z.array(z.object({ label: z.string(), disabledRouteIds: z.array(z.string()) })),
});
const scenarioSchema = z
  .object({
    scenarioId: z.string(),
    scenarioName: z.string(),
    totalCostUsd: z.number().finite(),
    deliveredKits: z.number().finite(),
    fairnessPpm: z.number().finite(),
    regionOutcomes: z.array(
      z.object({
        regionId: z.string(),
        regionName: z.string(),
        delivered: z.number().finite(),
        demand: z.number().finite(),
        coveragePpm: z.number().finite(),
      }),
    ),
    replayTrace: replaySchema.nullish(),
  })
  .refine(({ replayTrace, regionOutcomes }) => !replayTrace || regionOutcomes.length > 0);
const displayedSubmissionSchema = z.object({
  submissionId: z.string(),
  participantId: z.string(),
  revision: z.number().int(),
  sourceMethod: z.string(),
  inputHash: z.string(),
  sourceHash: z.string(),
  submittedAt: z.string(),
  artifact: z.object({ strategy: namedStrategySchema }),
  agentEvidence: z
    .object({ name: z.string(), version: z.string(), objective: z.string() })
    .nullish(),
  evaluation: z.object({
    strategy: namedStrategySchema,
    correctness: z.boolean(),
    constraintFailures: z.array(z.string()),
    totalProcurementCost: z.number().finite(),
    worstCaseDeliveredKits: z.number().finite(),
    regionalFairnessPpm: z.number().finite(),
    worstScenarioId: z.string(),
    evaluatorVersion: z.string(),
    dataVersion: z.string(),
    contextHash: z.string(),
    manifestHash: z.string(),
    resultHash: z.string(),
    finalScenarioCommitment: z.string(),
    scenarioOutcomes: z.array(scenarioSchema),
  }),
});

export function resolveSavedSubmission(value: unknown, id: string): ResultState {
  const payload = value as MineResponse | null;
  if (
    !payload ||
    typeof payload !== "object" ||
    !Array.isArray(payload.submissions) ||
    !("participant" in payload) ||
    !("finalEntry" in payload)
  )
    return { kind: "error" };
  if (payload.participant === null) return { kind: "not-joined" };
  if (typeof payload.participant?.participantId !== "string") return { kind: "error" };
  // Resolve exclusively within the API's owner-scoped list, with an additional owner check.
  const submission = payload.submissions.find(
    (item) =>
      item?.submissionId === id && item.participantId === payload.participant?.participantId,
  );
  if (!submission) return { kind: "missing" };
  if (!displayedSubmissionSchema.safeParse(submission).success) return { kind: "error" };
  return {
    kind: "loaded",
    submission,
    selectedAt:
      payload.finalEntry?.submissionId === id && typeof payload.finalEntry.selectedAt === "string"
        ? payload.finalEntry.selectedAt
        : null,
  };
}
