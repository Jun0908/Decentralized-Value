import { z } from "zod";
import { addressSchema, bytes32Schema } from "./schemas";

export const identityPolicySchema = z.enum(["WORLD_ID", "ALLOWLIST", "WALLET_ONLY"]);
export const sourceVisibilitySchema = z.enum(["PUBLIC", "DELAYED_PUBLIC", "PRIVATE"]);
export const sourceMethodSchema = z.enum(["INLINE", "UPLOAD", "GITHUB"]);
export const roundStateSchema = z.enum([
  "OPEN",
  "SUBMISSIONS_CLOSED",
  "FINAL_ENTRIES_FROZEN",
  "EVALUATING",
  "RESULTS_COMMITTED",
  "REVIEW",
  "FINALIZED",
  "DISTRIBUTING",
  "COMPLETE",
]);

export const participantRecordSchema = z.object({
  participantId: bytes32Schema,
  challengeId: z.string().min(1),
  wallet: addressSchema,
  identityPolicy: identityPolicySchema,
  identityReferenceHash: bytes32Schema,
  registeredAt: z.string().datetime(),
});

export const sourceBundleSchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("INLINE"),
    visibility: sourceVisibilitySchema,
    filename: z.string().min(1).max(160),
    content: z.string().max(100_000),
  }),
  z.object({
    method: z.literal("UPLOAD"),
    visibility: sourceVisibilitySchema,
    filename: z.string().min(1).max(160),
    content: z.string().max(100_000),
  }),
  z.object({
    method: z.literal("GITHUB"),
    visibility: sourceVisibilitySchema,
    repositoryUrl: z.string().url().startsWith("https://github.com/"),
    sourceCommit: z.string().regex(/^[0-9a-f]{40}$/),
  }),
]);

export const submissionRevisionSchema = z.object({
  submissionId: bytes32Schema,
  participantId: bytes32Schema,
  challengeId: z.string().min(1),
  revision: z.number().int().positive(),
  sourceMethod: sourceMethodSchema,
  sourceVisibility: sourceVisibilitySchema,
  sourceHash: bytes32Schema,
  inputHash: bytes32Schema,
  evaluationResultHash: bytes32Schema,
  correctness: z.boolean(),
  submittedAt: z.string().datetime(),
});

export const finalEntrySchema = z.object({
  participantId: bytes32Schema,
  challengeId: z.string().min(1),
  submissionId: bytes32Schema,
  selectedAt: z.string().datetime(),
  frozenAt: z.string().datetime().nullable(),
});

export const rewardAllocationSchema = z.object({
  challengeId: z.string().min(1),
  participantId: bytes32Schema,
  wallet: addressSchema,
  amount: z.string().regex(/^(0|[1-9][0-9]*)$/),
  contributionPpm: z.number().int().min(0).max(1_000_000),
  transactionHash: bytes32Schema.nullable(),
});

export type IdentityPolicy = z.infer<typeof identityPolicySchema>;
export type ParticipantRecord = z.infer<typeof participantRecordSchema>;
export type SourceBundle = z.infer<typeof sourceBundleSchema>;
export type SubmissionRevision = z.infer<typeof submissionRevisionSchema>;
export type FinalEntry = z.infer<typeof finalEntrySchema>;
export type RoundState = z.infer<typeof roundStateSchema>;
export type RewardAllocation = z.infer<typeof rewardAllocationSchema>;
