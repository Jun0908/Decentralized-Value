import { z } from "zod";
import {
  bytes32Schema,
  cliArenaManifestSchema,
  cliContextSchema,
  cliLockSchema,
  cliProjectSchema,
  cliRunSchema,
} from "@frontier/shared";
import { disasterResponseStrategySchema, plan6SubmissionSchema } from "./plan6-competition";
import { rescueDoctrineSchema } from "@frontier/rescue-room";
import { cliAuthScopes } from "./cli-auth";

const hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const object = z.record(z.string(), z.unknown());
const disasterEvaluation = z.looseObject({
  schemaVersion: z.literal("2"),
  arenaId: z.string(),
  dataVersion: z.string(),
  evaluatorVersion: z.string(),
  contextHash: hash,
  manifestHash: hash,
  resultHash: hash,
  finalScenarioCommitment: hash,
  strategy: disasterResponseStrategySchema,
  correctness: z.boolean(),
  constraintFailures: z.array(z.string()),
  totalProcurementCost: z.number().finite(),
  worstCaseDeliveredKits: z.number().finite(),
  regionalFairnessPpm: z.number().finite(),
  scenarioOutcomes: z.array(object),
  pareto: object,
  contribution: object,
});
const rescueOutcome = z.looseObject({
  episodeId: z.string(),
  episodeHash: hash,
  correctness: z.boolean(),
  invalidReason: z.string().nullable(),
  userLossUsd: z.number().finite(),
  servedProtocolDemandPpm: z.number().finite(),
  netResponseSpendCredits: z.number().finite(),
  transcript: z.array(object),
  transcriptHash: hash,
  resultHash: hash,
});
const participant = z.object({
  participantId: hash,
  challengeId: z.string(),
  userIdHash: hash,
  wallet: z.string(),
  displayName: z.string(),
  joinedAt: z.string(),
});
const finalEntry = z.object({
  participantId: hash,
  challengeId: z.string(),
  submissionId: hash,
  selectedAt: z.string(),
});
const submission = z.object({
  submissionId: hash,
  participantId: hash,
  challengeId: z.string(),
  revision: z.number().int(),
  sourceMethod: z.enum(["VISUAL", "JSON", "UPLOAD", "AGENT_API"]),
  sourceHash: hash,
  inputHash: hash,
  repositoryUrl: z.string().nullable(),
  sourceCommit: z.string().nullable(),
  agentEvidence: z
    .object({ name: z.string(), version: z.string(), objective: z.string() })
    .nullable(),
  artifact: z.object({ strategy: disasterResponseStrategySchema }),
  evaluation: disasterEvaluation,
  submittedAt: z.string(),
});

export const cliResponseSchemas = {
  CliAuthDeviceInput: z
    .object({
      scope: z.string().optional(),
      scopes: z.array(z.enum(cliAuthScopes)).min(1).optional(),
    })
    .strict(),
  CliAuthDeviceResult: z.object({
    device_code: z.string(),
    user_code: z.string(),
    verification_uri: z.string().url(),
    expires_in: z.number().int(),
    interval: z.number().int(),
  }),
  CliAuthCodeInput: z.object({ user_code: z.string() }).strict(),
  CliAuthApprovalInput: z
    .object({ user_code: z.string(), decision: z.enum(["approve", "deny"]) })
    .strict(),
  CliAuthInspection: z.object({
    origin: z.string().url(),
    scopes: z.array(z.enum(cliAuthScopes)),
    expiresAt: z.string().datetime(),
    session_expires_in: z.number().int(),
  }),
  CliAuthApprovalResult: z.object({ status: z.enum(["approved", "denied"]) }),
  CliAuthTokenInput: z.object({ device_code: z.string() }).strict(),
  CliAuthTokenResult: z.looseObject({
    access_token: z.string(),
    token_type: z.literal("Bearer"),
    expires_in: z.number().int(),
  }),
  CliAuthSession: z.looseObject({
    userId: z.string(),
    wallet: z.string(),
    scopes: z.array(z.enum(cliAuthScopes)),
    expiresAt: z.string().datetime(),
    revoked: z.literal(false),
  }),
  CliAuthRevoked: z.object({ revoked: z.literal(true) }),
  CliArenaManifest: cliArenaManifestSchema,
  CliArenaList: z.object({
    schemaVersion: z.literal("1"),
    arenas: z.array(cliArenaManifestSchema),
  }),
  CliContext: cliContextSchema,
  CliProject: cliProjectSchema,
  CliLock: cliLockSchema,
  CliRun: cliRunSchema,
  CliApiError: z.object({
    error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
  }),
  DisasterResponseStrategy: disasterResponseStrategySchema,
  Plan6SubmissionInput: plan6SubmissionSchema,
  CliDisasterPracticeResult: disasterEvaluation.extend({
    state: z.literal("measured"),
    inputHash: hash,
  }),
  CliRescuePracticeInput: z
    .object({ episodeId: z.string().min(1), doctrine: rescueDoctrineSchema })
    .strict(),
  CliRescuePracticeResult: z.looseObject({
    schemaVersion: z.literal("rescue-doctrine-practice-evaluation-v0"),
    arenaId: z.string(),
    contextId: z.string(),
    contextHash: hash,
    doctrineContextHash: hash,
    manifestHash: hash,
    doctrine: rescueDoctrineSchema,
    doctrineHash: hash,
    interpreterVersion: z.string(),
    decisions: z.array(object),
    episode: z.object({ id: z.string(), initialHeadline: z.string(), revealedAfterRun: object }),
    outcome: rescueOutcome,
    replay: z.object({
      deterministic: z.literal(true),
      actionCount: z.number(),
      resultHash: hash,
      matchesRecordedOutcome: z.literal(true),
    }),
    evaluationHash: hash,
    state: z.literal("simulated"),
    strategyState: z.literal("deterministic-rules"),
    paymentState: z.literal("game-credits"),
    rewardEligibility: z.object({ eligible: z.literal(false), reason: z.string() }),
  }),
  CliSubmission: submission,
  CliSubmissionResult: z.object({
    storage: z.enum(["ephemeral-memory", "durable-redis"]),
    submission,
  }),
  CliMySubmissions: z.object({
    participant: participant.nullable(),
    submissions: z.array(submission),
    finalEntry: finalEntry.nullable(),
  }),
  CliJoinResult: z.object({ storage: z.enum(["ephemeral-memory", "durable-redis"]), participant }),
  CliFinalEntryInput: z.object({ submissionId: bytes32Schema }).strict(),
  CliFinalEntryResult: z.object({
    storage: z.enum(["ephemeral-memory", "durable-redis"]),
    finalEntry,
  }),
};

export const cliJsonSchemas = Object.fromEntries(
  Object.entries(cliResponseSchemas).map(([name, schema]) => [
    name,
    z.toJSONSchema(schema, { io: "input", target: "draft-2020-12" }),
  ]),
);
