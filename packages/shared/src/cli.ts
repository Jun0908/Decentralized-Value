import { z } from "zod";
import { outcomeMetricSchema } from "./multiobjective";
import { bytes32Schema } from "./schemas";

export const cliArenaIdSchema = z.enum(["disaster-response", "rescue-room"]);
export const cliContextSchema = z
  .object({
    contextHash: bytes32Schema,
    runtimeContextHash: bytes32Schema.nullable(),
    manifestHash: bytes32Schema,
    evaluatorVersion: z.string().min(1),
    dataVersion: z.string().min(1),
    metrics: z.array(outcomeMetricSchema).min(1),
    evidenceState: z.enum(["measured", "simulated"]),
  })
  .strict();

export const cliCapabilitySchema = z
  .object({
    supported: z.boolean(),
    available: z.boolean(),
    reason: z.string().nullable(),
    authentication: z.enum(["none", "cli-session"]),
  })
  .strict();

export const cliArenaManifestSchema = z
  .object({
    schemaVersion: z.literal("1"),
    id: cliArenaIdSchema,
    challengeId: z.string().min(1),
    name: z.string().min(1),
    webPath: z.string().startsWith("/"),
    context: cliContextSchema,
    artifact: z
      .object({
        kind: z.enum(["strategy", "doctrine"]),
        filename: z.enum(["strategy.json", "doctrine.json"]),
        schema: z.record(z.string(), z.unknown()),
        schemaHash: bytes32Schema,
        sample: z.record(z.string(), z.unknown()),
      })
      .strict(),
    starter: z
      .object({ path: z.string().startsWith("/"), sha256: z.string().regex(/^[a-f0-9]{64}$/) })
      .strict(),
    episodes: z.array(z.object({ id: z.string(), headline: z.string() }).strict()),
    constraints: z.array(z.string()),
    limits: z
      .object({
        practiceRunsPerMinute: z.number().int().positive(),
        maxRevisions: z.number().int().nonnegative(),
      })
      .strict(),
    capabilities: z
      .object({
        practice: cliCapabilitySchema,
        submit: cliCapabilitySchema,
        finalEntry: cliCapabilitySchema,
        contextPrecondition: z.literal(true),
      })
      .strict(),
    storage: z.enum(["durable-redis", "ephemeral-memory", "unconfigured"]),
    paymentState: z.enum(["not-requested", "game-credits"]),
    rewardEligible: z.literal(false),
  })
  .strict();

export const cliProvenanceSchema = z
  .object({
    kind: z.enum(["human", "agent"]),
    name: z.string().min(1).max(80).optional(),
    version: z.string().min(1).max(40).optional(),
    objective: z.string().min(3).max(240).optional(),
    repositoryUrl: z.string().url().startsWith("https://github.com/").optional(),
    sourceCommit: z
      .string()
      .regex(/^[0-9a-f]{40}$/)
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.kind === "agent" && (!value.name || !value.version || !value.objective)) {
      ctx.addIssue({ code: "custom", message: "Agent name, version and objective are required" });
    }
    if (Boolean(value.repositoryUrl) !== Boolean(value.sourceCommit)) {
      ctx.addIssue({
        code: "custom",
        message: "Repository URL and commit must be supplied together",
      });
    }
  });

export const cliProjectSchema = z
  .object({
    schemaVersion: z.literal("1"),
    arenaId: cliArenaIdSchema,
    baseUrl: z.string().url(),
    artifact: z.enum(["strategy.json", "doctrine.json"]),
    provenance: cliProvenanceSchema,
  })
  .strict();

export const cliLockSchema = z
  .object({
    schemaVersion: z.literal("1"),
    arenaId: cliArenaIdSchema,
    baseUrl: z.string().url(),
    context: cliContextSchema,
    schemaHash: bytes32Schema,
    starterSha256: z.string().regex(/^[a-f0-9]{64}$/),
    episodeId: z.string().nullable(),
  })
  .strict();

export const cliRunSchema = z
  .object({
    schemaVersion: z.literal("1"),
    runId: z.string().regex(/^run_[a-f0-9-]{36}$/),
    arenaId: cliArenaIdSchema,
    baseUrl: z.string().url(),
    createdAt: z.string().datetime(),
    context: cliContextSchema,
    episodeId: z.string().nullable(),
    artifact: z.record(z.string(), z.unknown()),
    artifactHash: bytes32Schema,
    resultHash: bytes32Schema,
    correctness: z.boolean(),
    values: z.record(z.string(), z.number().finite()),
    raw: z.record(z.string(), z.unknown()),
  })
  .strict();

export type CliArenaId = z.infer<typeof cliArenaIdSchema>;
export type CliContext = z.infer<typeof cliContextSchema>;
export type CliArenaManifest = z.infer<typeof cliArenaManifestSchema>;
export type CliProject = z.infer<typeof cliProjectSchema>;
export type CliLock = z.infer<typeof cliLockSchema>;
export type CliProvenance = z.infer<typeof cliProvenanceSchema>;
export type CliRun = z.infer<typeof cliRunSchema>;
