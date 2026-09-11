import { z } from "zod";

const hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const object = z.record(z.string(), z.unknown());
const storage = z.enum(["durable-redis", "ephemeral-memory"]);

// Validate the fields the SDK interprets, retaining all additional server evidence.
export const disasterEvaluationSchema = z
  .object({
    contextHash: hash,
    manifestHash: hash,
    resultHash: hash,
    dataVersion: z.string(),
    evaluatorVersion: z.string(),
    correctness: z.boolean(),
    totalProcurementCost: z.number().finite(),
    worstCaseDeliveredKits: z.number().finite(),
    regionalFairnessPpm: z.number().finite(),
    strategy: object,
  })
  .passthrough();

export const disasterPracticeSchema = disasterEvaluationSchema.extend({
  state: z.literal("measured"),
  inputHash: hash,
});

export const rescuePracticeSchema = z
  .object({
    state: z.literal("simulated"),
    strategyState: z.literal("deterministic-rules"),
    paymentState: z.literal("game-credits"),
    contextHash: hash,
    doctrineContextHash: hash,
    manifestHash: hash,
    doctrineHash: hash,
    evaluationHash: hash,
    interpreterVersion: z.string(),
    doctrine: object,
    episode: z.object({ id: z.string() }).passthrough(),
    outcome: z
      .object({
        correctness: z.boolean(),
        resultHash: hash,
        userLossUsd: z.number().finite(),
        servedProtocolDemandPpm: z.number().finite(),
        netResponseSpendCredits: z.number().finite(),
      })
      .passthrough(),
    rewardEligibility: z.object({ eligible: z.literal(false), reason: z.string() }).passthrough(),
  })
  .passthrough();

export const participantSchema = z
  .object({
    participantId: hash,
    challengeId: z.string(),
    wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    userIdHash: hash,
    displayName: z.string(),
    joinedAt: z.string(),
  })
  .passthrough();
export const finalEntrySchema = z
  .object({
    participantId: hash,
    challengeId: z.string(),
    submissionId: hash,
    selectedAt: z.string(),
  })
  .passthrough();
export const submissionSchema = z
  .object({
    submissionId: hash,
    participantId: hash,
    challengeId: z.string(),
    revision: z.number().int().positive(),
    sourceMethod: z.enum(["VISUAL", "JSON", "UPLOAD", "AGENT_API"]),
    sourceHash: hash,
    inputHash: hash,
    artifact: z.object({ strategy: object }).passthrough(),
    evaluation: disasterEvaluationSchema,
    repositoryUrl: z.string().nullable(),
    sourceCommit: z.string().nullable(),
    agentEvidence: z
      .object({ name: z.string(), version: z.string(), objective: z.string() })
      .nullable(),
    submittedAt: z.string(),
  })
  .passthrough();

export const joinResponseSchema = z
  .object({ storage, participant: participantSchema })
  .passthrough();
export const submissionsResponseSchema = z
  .object({
    participant: participantSchema.nullable(),
    submissions: z.array(submissionSchema),
    finalEntry: finalEntrySchema.nullable(),
  })
  .passthrough();
export const createSubmissionResponseSchema = z
  .object({ storage, submission: submissionSchema })
  .passthrough();
export const selectEntryResponseSchema = z
  .object({ storage, finalEntry: finalEntrySchema })
  .passthrough();

export type DisasterResponsePractice = z.infer<typeof disasterPracticeSchema>;
export type RescueRoomPractice = z.infer<typeof rescuePracticeSchema>;
export type Participant = z.infer<typeof participantSchema>;
export type Submission = z.infer<typeof submissionSchema>;
export type FinalEntry = z.infer<typeof finalEntrySchema>;
export type JoinResponse = z.infer<typeof joinResponseSchema>;
export type SubmissionsResponse = z.infer<typeof submissionsResponseSchema>;
export type CreateSubmissionResponse = z.infer<typeof createSubmissionResponseSchema>;
export type SelectEntryResponse = z.infer<typeof selectEntryResponseSchema>;
