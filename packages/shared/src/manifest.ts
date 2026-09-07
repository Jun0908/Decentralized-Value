import { keccak256, stringToHex, type Hex } from "viem";
import { z } from "zod";
import { addressSchema, bytes32Schema } from "./schemas";
import { outcomeMetricSchema } from "./multiobjective";

export const evidenceLevelSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);

export const contextManifestSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  datasetHash: bytes32Schema,
  constraintHash: bytes32Schema,
  evidenceLevel: evidenceLevelSchema,
});

const practiceRewardSchema = z.object({
  kind: z.literal("PREVIEW"),
  poolCredits: z.number().int().nonnegative(),
});

const fundedRewardSchema = z.object({
  kind: z.literal("FUNDED"),
  chainId: z.number().int().positive(),
  tokenAddress: addressSchema,
  poolAddress: addressSchema,
  amount: z.string().regex(/^(0|[1-9][0-9]*)$/),
});

export const challengeManifestV2Schema = z
  .object({
    schemaVersion: z.literal("2"),
    id: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: z.string().min(1),
    lifecycle: z.enum(["PRACTICE", "OPEN", "FINAL_EVALUATION", "SETTLED"]),
    sponsor: z.object({
      name: z.string().min(1),
      wallet: addressSchema.nullable(),
      statement: z.string().min(1),
    }),
    valueTension: z.string().min(1),
    artifactType: z.string().min(1),
    hardConstraints: z.array(z.string().min(1)).min(1),
    metrics: z.array(outcomeMetricSchema).min(2),
    contexts: z.array(contextManifestSchema).min(1),
    activeContextId: z.string().min(1),
    workload: z.object({
      publicHash: bytes32Schema,
      finalCommitment: bytes32Schema.nullable(),
    }),
    submission: z.object({
      methods: z.array(z.enum(["INLINE", "UPLOAD", "GITHUB"])).min(1),
      sourceVisibility: z.enum(["PUBLIC", "DELAYED_PUBLIC", "PRIVATE"]),
      opensAt: z.string().datetime().nullable(),
      closesAt: z.string().datetime().nullable(),
      maxRevisions: z.number().int().positive(),
    }),
    reviewEndsAt: z.string().datetime().nullable(),
    reward: z.discriminatedUnion("kind", [practiceRewardSchema, fundedRewardSchema]),
  })
  .superRefine((manifest, context) => {
    const contextIds = new Set(manifest.contexts.map(({ id }) => id));
    if (!contextIds.has(manifest.activeContextId)) {
      context.addIssue({
        code: "custom",
        message: "activeContextId must reference a declared context",
        path: ["activeContextId"],
      });
    }
    if (manifest.lifecycle !== "PRACTICE" && manifest.reward.kind !== "FUNDED") {
      context.addIssue({
        code: "custom",
        message: "A live challenge must use a funded reward",
        path: ["reward"],
      });
    }
    if (manifest.lifecycle !== "PRACTICE" && manifest.workload.finalCommitment === null) {
      context.addIssue({
        code: "custom",
        message: "A live challenge requires a final workload commitment",
        path: ["workload", "finalCommitment"],
      });
    }
  });

export type EvidenceLevel = z.infer<typeof evidenceLevelSchema>;
export type ContextManifest = z.infer<typeof contextManifestSchema>;
export type ChallengeManifestV2 = z.infer<typeof challengeManifestV2Schema>;

export function canonicalProtocolJson(value: unknown): string {
  if (typeof value === "bigint") return JSON.stringify(value.toString(10));
  if (Array.isArray(value)) return `[${value.map(canonicalProtocolJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalProtocolJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function parseChallengeManifest(value: unknown): ChallengeManifestV2 {
  return challengeManifestV2Schema.parse(value);
}

export function hashChallengeManifest(value: ChallengeManifestV2): Hex {
  return keccak256(stringToHex(canonicalProtocolJson(challengeManifestV2Schema.parse(value))));
}
