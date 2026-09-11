import {
  artifactSchema,
  benchmarkRecordSchema,
  bytes32Schema,
  cliArenaIdSchema,
  canonicalProtocolJson,
  stringifyProtocolJson,
} from "@frontier/shared";
import {
  evaluateCalldataCodec,
  publicCalldataCompressionScenario,
} from "@frontier/calldata-compression";
import {
  evaluateSupplyAllocation,
  publicEmergencySupplyScenario,
  replayEmergencySupplyAgents,
} from "@frontier/emergency-supply";
import {
  evaluateDisasterResponseStrategy,
  publicDisasterResponseScenario,
} from "@frontier/disaster-response";
import { evaluateMicrogridDispatch, publicMicrogridScenario } from "@frontier/microgrid-dispatch";
import {
  evaluateRescueDoctrinePracticeEpisode,
  evaluateRescuePracticeEpisode,
  publicRescueRoomScenario,
  rescueCommanderPlaybookSchema,
  rescueDoctrineSchema,
  rescuePracticePolicyIds,
} from "@frontier/rescue-room";
import { publicSecretGateScenario } from "@frontier/secret-gate";
import type { EnsRunnerDirectory } from "@frontier/ens-adapter";
import { z } from "zod";
import { keccak256, stringToHex, type Hex } from "viem";
import { FrontierStore, type EvaluationJob } from "./store";
import { CompetitionSandboxStore } from "./competition-store";
import {
  buildPlan5Leaderboard,
  createStarterKitZip,
  plan5ChallengeId,
  plan5SubmissionSchema,
  preparePlan5Submission,
  type Plan5CompetitionStore,
  type Plan5Identity,
  type Plan5Reward,
} from "./plan5-competition";
import {
  buildPlan6Leaderboard,
  createPlan6CommunityValuePool,
  createPlan6StarterKitZip,
  disasterResponseStrategySchema,
  disasterResponseInputHash,
  Plan6StoreError,
  plan6ChallengeId,
  plan6SubmissionSchema,
  plan6ValueFunderId,
  plan6ValuePoolSchema,
  preparePlan6Submission,
  type Plan6CompetitionStore,
  type Plan6Reward,
} from "./plan6-competition";
import {
  RescueCommanderConfigurationError,
  runOpenAiRescueRoomCommander,
  type RescueRoomCommanderExecutor,
} from "./rescue-room-agent";
import { createRescueRoomStarterKitZip } from "./rescue-room-competition";
import { cliArenaManifest, contextPrecondition } from "./cli-manifest";
import { CliAuthError, type CliAuthService, type CliAuthScope } from "./cli-auth";

export * from "./plan5-competition";
export * from "./plan6-competition";
export * from "./rescue-room-agent";
export * from "./rescue-room-competition";
export * from "./cli-auth";

const evaluationSchema = z.object({ artifactId: bytes32Schema });
const supplyEvaluationSchema = z
  .object({
    allocations: z.record(z.string(), z.number().int().nonnegative().max(1_000_000)),
    contextId: z
      .enum(["public-normal-operations", "public-port-constrained"])
      .default("public-normal-operations"),
  })
  .strict();
const calldataEvaluationSchema = z
  .object({
    codecId: z.enum(["abi", "packed", "dictionary"]),
    contextId: z.enum(["public-transfer-mix", "public-low-reuse"]).default("public-transfer-mix"),
  })
  .strict();
const disputeSchema = z.object({
  artifactId: bytes32Schema,
  reason: z.string().min(10).max(2_000),
});
const microgridEvaluationSchema = z
  .object({
    allocations: z.record(z.string(), z.number().int().nonnegative().max(1_000_000)),
  })
  .strict();
import {
  MISSION_MAX_LENGTH,
  oceanPracticeSeeds,
  sailSeasonWithMission,
  type SeasonResult,
} from "@frontier/ocean-commons";

const oceanSeasonSchema = z
  .object({
    /** The owner's standing instruction. Untrusted text on its way to a model. */
    mission: z.string().trim().min(1).max(MISSION_MAX_LENGTH),
    seed: z.string().min(1),
  })
  .strict();
const rescueRoomEvaluationSchema = z
  .object({
    policyId: z.enum(rescuePracticePolicyIds),
    episodeId: z.string().min(1),
  })
  .strict();
const rescueRoomCommanderEvaluationSchema = z
  .object({
    episodeId: z.string().min(1),
    playbook: rescueCommanderPlaybookSchema,
  })
  .strict();
const rescueRoomDoctrineEvaluationSchema = z
  .object({
    episodeId: z.string().min(1),
    doctrine: rescueDoctrineSchema,
  })
  .strict();
const sandboxRegistrationSchema = z
  .object({
    challengeId: z.enum([
      "emergency-supply-v1",
      "calldata-compression-v1",
      "microgrid-dispatch-v1",
    ]),
    wallet: z.string(),
  })
  .strict();
const sandboxSubmissionSchema = z
  .object({
    participantId: bytes32Schema,
    challengeId: z.enum([
      "emergency-supply-v1",
      "calldata-compression-v1",
      "microgrid-dispatch-v1",
    ]),
    source: z.unknown(),
    artifactInput: z.unknown(),
  })
  .strict();
const sandboxFinalEntrySchema = z
  .object({ participantId: bytes32Schema, submissionId: bytes32Schema })
  .strict();
const plan5FinalEntrySchema = z.object({ submissionId: bytes32Schema }).strict();
const plan6FinalEntrySchema = z.object({ submissionId: bytes32Schema }).strict();

export type Plan5IdentityResolver = (request: Request) => Promise<Plan5Identity>;
export type Plan5Settlement = (input: {
  participantId: Hex;
  recipient: `0x${string}`;
  amount: bigint;
  resultHash: Hex;
}) => Promise<Pick<Plan5Reward, "allocationRoot" | "transactionHash" | "blockNumber">>;

export type Plan5Options = {
  store?: Plan5CompetitionStore;
  identity?: Plan5IdentityResolver;
  settlement?: Plan5Settlement;
};

export type Plan6Settlement = (input: {
  participantId: Hex;
  recipient: `0x${string}`;
  amount: bigint;
  resultHash: Hex;
}) => Promise<Pick<Plan6Reward, "allocationRoot" | "transactionHash" | "blockNumber">>;

export type Plan6Options = {
  store?: Plan6CompetitionStore;
  identity?: Plan5IdentityResolver;
  settlement?: Plan6Settlement;
  cliAuth?: CliAuthService;
};

export type RescueRoomOptions = {
  commander?: RescueRoomCommanderExecutor;
};

export type OceanCommonsOptions = {
  /** Sails one season. Injected in tests so no run reaches a model. */
  season?: (input: { mission: string; seed: string }) => Promise<SeasonResult>;
};

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface EvaluationDispatcher {
  dispatch(job: EvaluationJob): Promise<void>;
}

class SlidingWindowLimiter {
  private readonly requests = new Map<string, number[]>();
  constructor(
    private readonly limit = 30,
    private readonly windowMs = 60_000,
  ) {}
  accept(key: string, now = Date.now()): boolean {
    const recent = (this.requests.get(key) ?? []).filter(
      (timestamp) => now - timestamp < this.windowMs,
    );
    if (recent.length >= this.limit) return false;
    recent.push(now);
    this.requests.set(key, recent);
    return true;
  }
}

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(stringifyProtocolJson(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

function error(status: number, code: string, message: string, details?: unknown): Response {
  return json({ error: { code, message, details: details ?? null } }, status);
}

async function body(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new Error("Request body must be valid JSON");
  }
}

export class FrontierApi {
  private readonly limiter = new SlidingWindowLimiter();
  private readonly rescueCommanderLimiter = new SlidingWindowLimiter(3, 10 * 60_000);
  // A season costs a model call per boat-turn, so this is a spending limit
  // before it is a traffic one.
  // A match is three seasons and each is a separate request, so the old limit of
  // three let a visitor sail exactly one match and then wait ten minutes. Six
  // allows two matches, which is still a firm ceiling on what a client can spend.
  private readonly oceanSeasonLimiter = new SlidingWindowLimiter(6, 10 * 60_000);
  readonly competition = new CompetitionSandboxStore();
  constructor(
    readonly store: FrontierStore,
    private readonly dispatcher?: EvaluationDispatcher,
    private readonly runnerDirectory?: EnsRunnerDirectory,
    private readonly plan5: Plan5Options = {},
    private readonly plan6: Plan6Options = {},
    private readonly rescueRoom: RescueRoomOptions = {},
    private readonly oceanCommons: OceanCommonsOptions = {},
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "") || "/";
    if (path.startsWith("/v1/cli/auth/")) {
      if (!this.plan6.cliAuth)
        return error(503, "CLI_AUTH_UNCONFIGURED", "CLI authentication is not configured");
      return (
        (await this.plan6.cliAuth.handle(request)) ?? error(404, "NOT_FOUND", "Route not found")
      );
    }
    const client = request.headers.get("x-forwarded-for") ?? "local";
    if (!this.limiter.accept(client)) return error(429, "RATE_LIMITED", "Too many requests");

    try {
      if (request.method === "GET") return await this.get(path, url, request);
      if (request.method === "POST") return await this.post(path, request);
      if (request.method === "PUT") return await this.put(path, request);
      return error(405, "METHOD_NOT_ALLOWED", "Method not allowed", {
        allowed: ["GET", "POST", "PUT"],
      });
    } catch (cause) {
      if (cause instanceof Plan6StoreError || cause instanceof CliAuthError)
        return error(cause.status, cause.code, cause.message);
      if (cause instanceof ApiError) return error(cause.status, cause.code, cause.message);
      if (cause instanceof z.ZodError)
        return error(400, "VALIDATION_ERROR", "Request validation failed", cause.issues);
      return error(400, "BAD_REQUEST", cause instanceof Error ? cause.message : "Bad request");
    }
  }

  private async get(path: string, url: URL, request: Request): Promise<Response> {
    const { store } = this;
    if (path === "/v1/cli/arenas" || path.startsWith("/v1/cli/arenas/")) {
      const options = {
        storage: this.plan6.store?.durability ?? ("unconfigured" as const),
        authenticationAvailable: this.plan6.cliAuth?.available ?? false,
        production: process.env.NODE_ENV === "production",
      };
      if (path === "/v1/cli/arenas") {
        return json({
          schemaVersion: "1",
          arenas: cliArenaIdSchema.options.map((id) => cliArenaManifest(id, options)),
        });
      }
      const id = cliArenaIdSchema.safeParse(path.slice("/v1/cli/arenas/".length));
      if (!id.success)
        return error(404, "ARENA_NOT_SUPPORTED", "This Arena is not supported by the CLI");
      return json(cliArenaManifest(id.data, options));
    }
    if (path === "/v1/challenges/disaster-response") {
      const leaderboard = this.plan6.store
        ? await buildPlan6Leaderboard(this.plan6.store)
        : { participantCount: 0, submissionCount: 0, valuePools: [] };
      return json({
        challengeId: plan6ChallengeId,
        name: "72-Hour Disaster Response",
        state: "OPEN_DEMO",
        rewardPool: "10,000 FDT demo credits",
        participantCount: leaderboard.participantCount,
        submissionCount: leaderboard.submissionCount,
        valuePools: leaderboard.valuePools,
        maxRevisions: publicDisasterResponseScenario().limits.maxRevisions,
        maxFinalEntries: publicDisasterResponseScenario().limits.maxFinalEntries,
        practiceRunsPerMinute: publicDisasterResponseScenario().limits.practiceRunsPerMinute,
        storage: this.plan6.store?.durability ?? "unconfigured",
        authentication: this.plan6.identity ? "privy-verified" : "unconfigured",
        settlement: this.plan6.settlement ? "sepolia-ready" : "unconfigured",
        scenario: publicDisasterResponseScenario(),
      });
    }
    if (path === "/v1/challenges/disaster-response/starter-kit") {
      const archive = createPlan6StarterKitZip();
      const archiveBody = archive.buffer.slice(
        archive.byteOffset,
        archive.byteOffset + archive.byteLength,
      ) as ArrayBuffer;
      return new Response(archiveBody, {
        headers: {
          "cache-control": "public, max-age=3600",
          "content-disposition": 'attachment; filename="disaster-response-starter.zip"',
          "content-type": "application/zip",
        },
      });
    }
    if (path === "/v1/challenges/disaster-response/leaderboard") {
      return json(await buildPlan6Leaderboard(this.requirePlan6Store()));
    }
    if (path === "/v1/challenges/disaster-response/submissions/mine") {
      const identity = await this.requirePlan6Identity(request);
      const competition = this.requirePlan6Store();
      const participant = await competition.participantForUser(identity.userId);
      if (!participant) return json({ participant: null, submissions: [], finalEntry: null });
      return json({
        participant,
        submissions: await competition.submissionsForParticipant(participant.participantId),
        finalEntry: await competition.finalEntry(participant.participantId),
      });
    }
    if (path === "/v1/challenges/disaster-response/reward/mine") {
      const identity = await this.requirePlan6Identity(request);
      const competition = this.requirePlan6Store();
      const participant = await competition.participantForUser(identity.userId);
      return json({
        reward: participant ? await competition.reward(participant.participantId) : null,
      });
    }
    if (path === "/v1/challenges/emergency-supply") {
      const leaderboard = this.plan5.store
        ? await buildPlan5Leaderboard(this.plan5.store)
        : { participantCount: 0, submissionCount: 0 };
      return json({
        challengeId: plan5ChallengeId,
        name: "Emergency Supply Allocation",
        state: "OPEN_DEMO",
        rewardPool: "10,000 FDT demo credits",
        participantCount: leaderboard.participantCount,
        submissionCount: leaderboard.submissionCount,
        maxRevisions: 20,
        storage: this.plan5.store?.durability ?? "unconfigured",
        authentication: this.plan5.identity ? "privy-verified" : "unconfigured",
        settlement: this.plan5.settlement ? "sepolia-ready" : "unconfigured",
        scenario: publicEmergencySupplyScenario(),
      });
    }
    if (path === "/v1/challenges/emergency-supply/starter-kit") {
      const archive = createStarterKitZip();
      const body = archive.buffer.slice(
        archive.byteOffset,
        archive.byteOffset + archive.byteLength,
      ) as ArrayBuffer;
      return new Response(body, {
        headers: {
          "cache-control": "public, max-age=3600",
          "content-disposition": 'attachment; filename="emergency-supply-starter.zip"',
          "content-type": "application/zip",
        },
      });
    }
    if (path === "/v1/challenges/emergency-supply/leaderboard") {
      if (!this.plan5.store)
        throw new ApiError(503, "STORAGE_UNCONFIGURED", "Competition storage is not configured");
      return json(await buildPlan5Leaderboard(this.plan5.store));
    }
    if (path === "/v1/me") {
      const identity = await this.requirePlan5Identity(url, request);
      const participant =
        (await this.requirePlan5Store().participantForUser(identity.userId)) ?? null;
      return json({ identity: { userId: identity.userId, wallet: identity.wallet }, participant });
    }
    if (path === "/v1/challenges/emergency-supply/submissions/mine") {
      const identity = await this.requirePlan5Identity(url, request);
      const competition = this.requirePlan5Store();
      const participant = await competition.participantForUser(identity.userId);
      if (!participant) return json({ participant: null, submissions: [], finalEntry: null });
      return json({
        participant,
        submissions: await competition.submissionsForParticipant(participant.participantId),
        finalEntry: await competition.finalEntry(participant.participantId),
      });
    }
    if (path === "/v1/challenges/emergency-supply/reward/mine") {
      const identity = await this.requirePlan5Identity(url, request);
      const competition = this.requirePlan5Store();
      const participant = await competition.participantForUser(identity.userId);
      return json({
        reward: participant ? await competition.reward(participant.participantId) : null,
      });
    }
    if (path === "/v1/health")
      return json({ status: "ok", benchmarkMeasuredAt: store.benchmark.measuredAt });
    if (path === "/v1/arenas")
      return json({
        arenas: [
          publicDisasterResponseScenario(),
          publicEmergencySupplyScenario(),
          await publicCalldataCompressionScenario(),
          publicMicrogridScenario(),
          publicRescueRoomScenario(),
          publicSecretGateScenario(),
          this.challenge(),
        ],
      });
    if (path === "/v1/disaster-response") return json(publicDisasterResponseScenario());
    if (path === "/v1/emergency-supply") {
      const contextId = z
        .enum(["public-normal-operations", "public-port-constrained"])
        .default("public-normal-operations")
        .parse(url.searchParams.get("contextId") ?? undefined);
      return json(publicEmergencySupplyScenario(contextId));
    }
    if (path === "/v1/emergency-supply/replay") return json(replayEmergencySupplyAgents());
    if (path === "/v1/calldata-compression") {
      const contextId = z
        .enum(["public-transfer-mix", "public-low-reuse"])
        .default("public-transfer-mix")
        .parse(url.searchParams.get("contextId") ?? undefined);
      return json(await publicCalldataCompressionScenario(contextId));
    }
    if (path === "/v1/microgrid-dispatch") return json(publicMicrogridScenario());
    if (path === "/v1/rescue-room/starter-kit") {
      const archive = createRescueRoomStarterKitZip();
      const archiveBody = archive.buffer.slice(
        archive.byteOffset,
        archive.byteOffset + archive.byteLength,
      ) as ArrayBuffer;
      return new Response(archiveBody, {
        headers: {
          "cache-control": "public, max-age=3600",
          "content-disposition": 'attachment; filename="rescue-room-starter.zip"',
          "content-type": "application/zip",
        },
      });
    }
    if (path === "/v1/rescue-room") {
      return json({
        ...publicRescueRoomScenario(),
        commanderAvailable: Boolean(
          this.rescueRoom.commander ?? process.env.OPENAI_API_KEY?.trim(),
        ),
      });
    }
    const sandboxSubmissionsMatch = path.match(
      /^\/v2\/sandbox\/participants\/(0x[0-9a-f]{64})\/submissions$/,
    );
    if (sandboxSubmissionsMatch) {
      return json({
        storage: "ephemeral-memory",
        submissions: this.competition.forParticipant(sandboxSubmissionsMatch[1]!),
      });
    }
    if (path === "/v1/challenges" || path === `/v1/challenges/${store.challengeId}`)
      return json(this.challenge());
    if (path === `/v1/arenas/${store.challengeId}`) return json(this.challenge());
    if (
      path === `/v1/challenges/${store.challengeId}/frontier` ||
      path === `/v1/arenas/${store.challengeId}/frontier`
    )
      return json({
        challengeId: store.challengeId,
        artifacts: [...store.artifacts.values()].filter((artifact) => artifact.frontier),
      });
    if (path === `/v1/challenges/${store.challengeId}/artifacts`)
      return json({ artifacts: [...store.artifacts.values()] });
    if (path === `/v1/challenges/${store.challengeId}/attestations`)
      return json({
        attestations: [...store.jobs.values()].filter((job) => job.state === "attested"),
      });
    if (path === "/v1/runners") {
      if (!this.runnerDirectory)
        return json({ runners: [], source: "ens", status: "unconfigured" });
      try {
        return json({
          runners: await this.runnerDirectory.discover("evm-orderbook-v1"),
          source: "ens",
          status: "live",
        });
      } catch (cause) {
        return error(
          503,
          "ENS_UNAVAILABLE",
          cause instanceof Error ? cause.message : "ENS unavailable",
        );
      }
    }
    if (path.startsWith("/v1/runners/")) {
      if (!this.runnerDirectory)
        return error(503, "ENS_UNCONFIGURED", "Live ENS runner discovery is not configured");
      try {
        return json(
          await this.runnerDirectory.resolve(decodeURIComponent(path.slice("/v1/runners/".length))),
        );
      } catch (cause) {
        return error(
          503,
          "ENS_UNAVAILABLE",
          cause instanceof Error ? cause.message : "ENS unavailable",
        );
      }
    }
    if (path.startsWith("/v1/artifacts/")) {
      const artifact = store.artifacts.get(path.slice("/v1/artifacts/".length) as Hex);
      return artifact ? json(artifact) : error(404, "NOT_FOUND", "Artifact not found");
    }
    if (path.startsWith("/v1/evaluations/")) {
      const job = store.jobs.get(path.slice("/v1/evaluations/".length));
      return job ? json(job) : error(404, "NOT_FOUND", "Evaluation not found");
    }
    return error(404, "NOT_FOUND", "Route not found");
  }

  private async post(path: string, request: Request): Promise<Response> {
    const { store } = this;
    if (path === "/v1/challenges/disaster-response/join") {
      const identity = await this.requirePlan6Identity(request);
      const competition = this.requirePlan6Store(true);
      return json(
        { storage: competition.durability, participant: await competition.join(identity) },
        201,
      );
    }
    if (path === "/v1/challenges/disaster-response/value-pools") {
      const identity = await this.requirePlan6Identity(request);
      const competition = this.requirePlan6Store(true);
      const parsed = plan6ValuePoolSchema.parse(await body(request));
      const funderId = plan6ValueFunderId(identity.userId);
      const existing = await competition.valuePoolForFunder(funderId);
      const candidate = createPlan6CommunityValuePool(identity, parsed);
      if (existing) {
        if (existing.manifestHash === candidate.manifestHash) {
          return json({ storage: competition.durability, valuePool: existing });
        }
        throw new ApiError(
          409,
          "VALUE_POOL_EXISTS",
          "This demo account has already published its one community Value Pool",
        );
      }
      await competition.saveValuePool(candidate);
      return json({ storage: competition.durability, valuePool: candidate }, 201);
    }
    if (path === "/v1/challenges/disaster-response/submissions") {
      const identity = await this.requirePlan6Identity(request);
      const competition = this.requirePlan6Store(true);
      const participant = await competition.participantForUser(identity.userId);
      if (!participant)
        throw new ApiError(409, "NOT_JOINED", "Join this challenge before submitting");
      const idempotencyKey = request.headers.get("idempotency-key")?.trim();
      if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
        throw new ApiError(
          400,
          "IDEMPOTENCY_KEY_REQUIRED",
          "A unique Idempotency-Key between 8 and 128 characters is required",
        );
      }
      const parsed = plan6SubmissionSchema.parse(await body(request));
      const digest = keccak256(stringToHex(canonicalProtocolJson(parsed)));
      const existing = await competition.lookupSubmissionIdempotency(
        participant.participantId,
        idempotencyKey,
      );
      if (existing) {
        const sourceHash = keccak256(
          stringToHex(
            canonicalProtocolJson({
              sourceMethod: parsed.sourceMethod,
              repositoryUrl: parsed.repositoryUrl,
              sourceCommit: parsed.sourceCommit,
              agentEvidence: parsed.agentEvidence,
            }),
          ),
        );
        if (
          (existing.bodyDigest !== null && existing.bodyDigest !== digest) ||
          existing.submission.inputHash !== disasterResponseInputHash(parsed.strategy) ||
          existing.submission.sourceHash !== sourceHash
        ) {
          return error(
            409,
            "IDEMPOTENCY_CONFLICT",
            "This operation is bound to another submission body",
          );
        }
        return json({ storage: competition.durability, submission: existing.submission });
      }
      const mismatch = contextPrecondition(request, "disaster-response");
      if (mismatch) return error(409, "CONTEXT_MISMATCH", mismatch);
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const previous = (
          await competition.submissionsForParticipant(participant.participantId)
        ).at(-1);
        const prepared = preparePlan6Submission(participant, parsed, previous?.evaluation ?? null);
        try {
          const result = await competition.commitSubmission(
            prepared,
            idempotencyKey,
            digest,
            previous?.revision ?? 0,
          );
          return json(
            { storage: competition.durability, submission: result.submission },
            result.status === "saved" ? 201 : 200,
          );
        } catch (cause) {
          if (
            !(cause instanceof Plan6StoreError) ||
            cause.code !== "REVISION_CONFLICT" ||
            attempt === 3
          )
            throw cause;
        }
      }
      return error(409, "REVISION_CONFLICT", "Retry this operation with the same idempotency key");
    }
    if (path === "/v1/challenges/disaster-response/demo-settlement") {
      const identity = await this.requirePlan6Identity(request);
      const competition = this.requirePlan6Store(true);
      if (!this.plan6.settlement)
        throw new ApiError(
          503,
          "SETTLEMENT_UNCONFIGURED",
          "Sepolia demo settlement is not configured",
        );
      const participant = await competition.participantForUser(identity.userId);
      if (!participant) throw new ApiError(409, "NOT_JOINED", "Join this challenge first");
      const previous = await competition.reward(participant.participantId);
      if (previous?.status === "PAID") return json({ reward: previous });
      if (previous?.status === "SENDING")
        throw new ApiError(409, "SETTLEMENT_IN_PROGRESS", "Reward settlement is in progress");
      const finalEntry = await competition.finalEntry(participant.participantId);
      if (!finalEntry)
        throw new ApiError(409, "FINAL_ENTRY_REQUIRED", "Choose a Final Entry first");
      const submissions = await competition.submissionsForParticipant(participant.participantId);
      const selected = submissions.find(
        ({ submissionId }) => submissionId === finalEntry.submissionId,
      );
      if (!selected?.evaluation.correctness)
        throw new ApiError(409, "VALID_ENTRY_REQUIRED", "The Final Entry must pass correctness");
      const leaderboard = await buildPlan6Leaderboard(competition);
      const entry = leaderboard.entries.find(({ id }) => id === selected.submissionId);
      const poolAllocations =
        entry?.valueAllocations
          .filter(({ poolStatus }) => poolStatus === "COMMITTED")
          .map(({ poolId, poolName, manifestHash, credits }) => ({
            poolId,
            poolName,
            manifestHash,
            credits,
          })) ?? [];
      const amount = BigInt(entry?.settlementEligibleCredits ?? 0);
      if (amount === 0n)
        throw new ApiError(
          409,
          "NO_VALUE_ALLOCATION",
          "This Final Entry has no committed Value Pool allocation",
        );
      const allocationEvidenceHash = keccak256(
        stringToHex(
          canonicalProtocolJson({
            challengeId: plan6ChallengeId,
            resultHash: selected.evaluation.resultHash,
            poolAllocations,
          }),
        ),
      );
      const now = new Date().toISOString();
      const sending: Plan6Reward = {
        participantId: participant.participantId,
        challengeId: plan6ChallengeId,
        recipient: participant.wallet,
        amount: amount.toString(),
        awardIds: entry?.awardIds ?? [],
        poolAllocations,
        allocationEvidenceHash,
        status: "SENDING",
        allocationRoot: null,
        transactionHash: null,
        blockNumber: null,
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
        error: null,
      };
      await competition.saveReward(sending);
      try {
        const receipt = await this.plan6.settlement({
          participantId: participant.participantId,
          recipient: participant.wallet,
          amount,
          resultHash: allocationEvidenceHash,
        });
        const paid: Plan6Reward = {
          ...sending,
          ...receipt,
          status: "PAID",
          updatedAt: new Date().toISOString(),
        };
        await competition.saveReward(paid);
        return json({ reward: paid }, 201);
      } catch (cause) {
        await competition.saveReward({
          ...sending,
          status: "FAILED",
          updatedAt: new Date().toISOString(),
          error: cause instanceof Error ? cause.message : "Settlement failed",
        });
        throw new ApiError(
          502,
          "SETTLEMENT_FAILED",
          cause instanceof Error ? cause.message : "Settlement failed",
        );
      }
    }
    if (path === "/v1/disaster-response/evaluations") {
      const mismatch = contextPrecondition(request, "disaster-response");
      if (mismatch) return error(409, "CONTEXT_MISMATCH", mismatch);
      const strategy = disasterResponseStrategySchema.parse(await body(request));
      return json({
        state: "measured",
        inputHash: disasterResponseInputHash(strategy),
        ...evaluateDisasterResponseStrategy(strategy),
      });
    }
    if (path === "/v1/challenges/emergency-supply/join") {
      const identity = await this.requirePlan5Identity(undefined, request);
      const competition = this.requirePlan5Store(true);
      const participant = await competition.join(identity);
      return json({ storage: competition.durability, participant }, 201);
    }
    if (path === "/v1/challenges/emergency-supply/submissions") {
      const identity = await this.requirePlan5Identity(undefined, request);
      const competition = this.requirePlan5Store(true);
      const participant = await competition.participantForUser(identity.userId);
      if (!participant)
        throw new ApiError(409, "NOT_JOINED", "Join this challenge before submitting");
      const idempotencyKey = request.headers.get("idempotency-key")?.trim();
      if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
        throw new ApiError(
          400,
          "IDEMPOTENCY_KEY_REQUIRED",
          "A unique Idempotency-Key between 8 and 128 characters is required",
        );
      }
      const existing = await competition.submissionForIdempotency(
        participant.participantId,
        idempotencyKey,
      );
      if (existing) return json({ storage: competition.durability, submission: existing });
      const parsed = plan5SubmissionSchema.parse(await body(request));
      const submission = await competition.addSubmission(
        preparePlan5Submission(participant, parsed),
      );
      await competition.saveSubmissionIdempotency(
        participant.participantId,
        idempotencyKey,
        submission.submissionId,
      );
      return json({ storage: competition.durability, submission }, 201);
    }
    if (path === "/v1/challenges/emergency-supply/demo-settlement") {
      const identity = await this.requirePlan5Identity(undefined, request);
      const competition = this.requirePlan5Store(true);
      if (!this.plan5.settlement) {
        throw new ApiError(
          503,
          "SETTLEMENT_UNCONFIGURED",
          "Sepolia demo settlement is not configured",
        );
      }
      const participant = await competition.participantForUser(identity.userId);
      if (!participant) throw new ApiError(409, "NOT_JOINED", "Join this challenge first");
      const previous = await competition.reward(participant.participantId);
      if (previous?.status === "PAID") return json({ reward: previous });
      if (previous?.status === "SENDING") {
        throw new ApiError(409, "SETTLEMENT_IN_PROGRESS", "Reward settlement is in progress");
      }
      const finalEntry = await competition.finalEntry(participant.participantId);
      if (!finalEntry)
        throw new ApiError(409, "FINAL_ENTRY_REQUIRED", "Choose a Final Entry first");
      const submissions = await competition.submissionsForParticipant(participant.participantId);
      const selected = submissions.find(
        ({ submissionId }) => submissionId === finalEntry.submissionId,
      );
      if (!selected?.evaluation.correctness) {
        throw new ApiError(409, "VALID_ENTRY_REQUIRED", "The Final Entry must pass correctness");
      }
      const leaderboard = await buildPlan5Leaderboard(competition);
      const entry = leaderboard.entries.find(({ id }) => id === selected.submissionId);
      const amount = BigInt(entry?.rewardPreview ?? 0);
      if (amount === 0n) {
        throw new ApiError(
          409,
          "ZERO_CONTRIBUTION",
          "This entry is dominated and has no demo reward",
        );
      }
      const now = new Date().toISOString();
      const sending: Plan5Reward = {
        participantId: participant.participantId,
        challengeId: plan5ChallengeId,
        recipient: participant.wallet,
        amount: amount.toString(),
        status: "SENDING",
        allocationRoot: null,
        transactionHash: null,
        blockNumber: null,
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
        error: null,
      };
      await competition.saveReward(sending);
      try {
        const receipt = await this.plan5.settlement({
          participantId: participant.participantId,
          recipient: participant.wallet,
          amount,
          resultHash: selected.evaluation.resultHash,
        });
        const paid: Plan5Reward = {
          ...sending,
          ...receipt,
          status: "PAID",
          updatedAt: new Date().toISOString(),
        };
        await competition.saveReward(paid);
        return json({ reward: paid }, 201);
      } catch (cause) {
        await competition.saveReward({
          ...sending,
          status: "FAILED",
          updatedAt: new Date().toISOString(),
          error: cause instanceof Error ? cause.message : "Settlement failed",
        });
        throw new ApiError(
          502,
          "SETTLEMENT_FAILED",
          cause instanceof Error ? cause.message : "Settlement failed",
        );
      }
    }
    if (path === "/v1/emergency-supply/evaluations") {
      const parsed = supplyEvaluationSchema.parse(await body(request));
      return json(
        {
          state: "measured",
          ...evaluateSupplyAllocation(parsed.allocations, parsed.contextId),
        },
        200,
      );
    }
    if (path === "/v1/calldata-compression/evaluations") {
      const parsed = calldataEvaluationSchema.parse(await body(request));
      return json(
        {
          state: "measured",
          ...(await evaluateCalldataCodec(parsed.codecId, parsed.contextId)),
        },
        200,
      );
    }
    if (path === "/v1/microgrid-dispatch/evaluations") {
      const parsed = microgridEvaluationSchema.parse(await body(request));
      return json({ state: "measured", ...evaluateMicrogridDispatch(parsed.allocations) }, 200);
    }
    if (path === "/v1/rescue-room/doctrine-evaluations") {
      const mismatch = contextPrecondition(request, "rescue-room");
      if (mismatch) return error(409, "CONTEXT_MISMATCH", mismatch);
      const parsed = rescueRoomDoctrineEvaluationSchema.parse(await body(request));
      const scenario = publicRescueRoomScenario();
      if (!scenario.episodes.some(({ id }) => id === parsed.episodeId)) {
        throw new ApiError(400, "UNKNOWN_PRACTICE_EPISODE", "Unknown Rescue Room practice Episode");
      }
      return json(
        {
          state: "simulated",
          strategyState: "deterministic-rules",
          paymentState: "game-credits",
          ...evaluateRescueDoctrinePracticeEpisode(parsed.doctrine, parsed.episodeId),
        },
        200,
      );
    }
    if (path === "/v1/rescue-room/commander-evaluations") {
      const client = request.headers.get("x-forwarded-for") ?? "local";
      if (!this.rescueCommanderLimiter.accept(client)) {
        throw new ApiError(
          429,
          "COMMANDER_RATE_LIMITED",
          "At most three AI Commander runs are allowed per client every ten minutes",
        );
      }
      const parsed = rescueRoomCommanderEvaluationSchema.parse(await body(request));
      const scenario = publicRescueRoomScenario();
      if (!scenario.episodes.some(({ id }) => id === parsed.episodeId)) {
        throw new ApiError(400, "UNKNOWN_PRACTICE_EPISODE", "Unknown Rescue Room practice Episode");
      }
      const commander = this.rescueRoom.commander ?? runOpenAiRescueRoomCommander;
      try {
        return json(
          {
            state: "simulated",
            inferenceState: "openai-api",
            paymentState: "game-credits",
            ...(await commander(parsed)),
          },
          200,
        );
      } catch (cause) {
        if (cause instanceof RescueCommanderConfigurationError) {
          throw new ApiError(503, "COMMANDER_UNCONFIGURED", cause.message);
        }
        if (cause instanceof Error && cause.name === "AbortError") {
          throw new ApiError(504, "COMMANDER_TIMEOUT", "AI Commander Episode timed out");
        }
        throw new ApiError(502, "COMMANDER_EXECUTION_FAILED", "AI Commander execution failed");
      }
    }
    if (path === "/v1/ocean-commons/seasons") {
      const client = request.headers.get("x-forwarded-for") ?? "local";
      if (!this.oceanSeasonLimiter.accept(client)) {
        throw new ApiError(
          429,
          "SEASON_RATE_LIMITED",
          "At most three model-sailed seasons are allowed per client every ten minutes",
        );
      }
      const parsed = oceanSeasonSchema.parse(await body(request));
      if (!oceanPracticeSeeds.includes(parsed.seed)) {
        throw new ApiError(400, "UNKNOWN_PRACTICE_SEASON", "Unknown Ocean Commons practice season");
      }
      const sail =
        this.oceanCommons.season ??
        (async (input: { mission: string; seed: string }) => {
          // Imported here so the credential check only runs when a season is
          // actually requested, and never at module load.
          const { openaiBackend } = await import("@frontier/ocean-commons");
          return sailSeasonWithMission({ ...input, backend: openaiBackend() });
        });
      try {
        const season = await sail({ mission: parsed.mission, seed: parsed.seed });
        return json(
          {
            state: "simulated",
            inferenceState: "openai-api",
            paymentState: "game-credits",
            ...season,
          },
          200,
        );
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        if (message.includes("OPENAI_API_KEY")) {
          throw new ApiError(503, "SEASON_UNCONFIGURED", message);
        }
        if (cause instanceof Error && cause.name === "AbortError") {
          throw new ApiError(504, "SEASON_TIMEOUT", "The season timed out");
        }
        throw new ApiError(502, "SEASON_EXECUTION_FAILED", "Sailing the season failed");
      }
    }
    if (path === "/v1/rescue-room/evaluations") {
      const parsed = rescueRoomEvaluationSchema.parse(await body(request));
      const scenario = publicRescueRoomScenario();
      if (!scenario.episodes.some(({ id }) => id === parsed.episodeId)) {
        throw new ApiError(400, "UNKNOWN_PRACTICE_EPISODE", "Unknown Rescue Room practice Episode");
      }
      return json(
        {
          state: "simulated",
          paymentState: "game-credits",
          ...evaluateRescuePracticeEpisode(parsed.policyId, parsed.episodeId),
        },
        200,
      );
    }
    if (
      path === "/v2/participants/world-id/context" ||
      path === "/v2/participants/world-id/verify"
    ) {
      return error(
        503,
        "WORLD_ID_UNCONFIGURED",
        "World ID is not configured; the sandbox exposes wallet-only identity without claiming uniqueness",
      );
    }
    if (path === "/v2/sandbox/participants/register") {
      const parsed = sandboxRegistrationSchema.parse(await body(request));
      return json(
        {
          mode: "sandbox",
          uniqueness: "wallet-only-not-personhood",
          storage: "ephemeral-memory",
          participant: this.competition.register(parsed.challengeId, parsed.wallet),
        },
        201,
      );
    }
    if (path === "/v2/sandbox/submissions") {
      const parsed = sandboxSubmissionSchema.parse(await body(request));
      let evaluation: Record<string, unknown> & { resultHash: string; correctness: boolean };
      if (parsed.challengeId === "emergency-supply-v1") {
        const input = supplyEvaluationSchema.parse(parsed.artifactInput);
        evaluation = evaluateSupplyAllocation(input.allocations, input.contextId);
      } else if (parsed.challengeId === "calldata-compression-v1") {
        const input = calldataEvaluationSchema.parse(parsed.artifactInput);
        evaluation = await evaluateCalldataCodec(input.codecId, input.contextId);
      } else {
        const input = microgridEvaluationSchema.parse(parsed.artifactInput);
        evaluation = evaluateMicrogridDispatch(input.allocations);
      }
      return json(
        {
          mode: "sandbox",
          storage: "ephemeral-memory",
          submission: this.competition.addSubmission({ ...parsed, evaluation }),
        },
        201,
      );
    }
    if (path === "/v1/artifacts") {
      const parsed = artifactSchema.parse(await body(request));
      if (parsed.challengeId !== store.challengeId)
        return error(404, "NOT_FOUND", "Challenge not found");
      store.artifacts.set(parsed.artifactId, {
        artifactId: parsed.artifactId,
        artifactHash: parsed.artifactHash,
        challengeId: parsed.challengeId,
        name: parsed.version,
        correctness: false,
        constraintResultHash: `0x${"00".repeat(32)}`,
        gasPerOrder: 0n,
        parallelThroughput: 0n,
        frontier: false,
        sourceCommit: parsed.sourceCommit,
        version: parsed.version,
        author: parsed.author,
      });
      return json(parsed, 201);
    }
    if (path === "/v1/evaluations") {
      const parsed = evaluationSchema.parse(await body(request));
      if (!store.artifacts.has(parsed.artifactId))
        return error(404, "NOT_FOUND", "Artifact not found");
      const idempotencyKey = request.headers.get("idempotency-key") ?? undefined;
      const job = store.createJob(parsed.artifactId, idempotencyKey);
      if (this.dispatcher && job.state === "queued") {
        job.state = "dispatching";
        void this.dispatcher.dispatch(job).catch((cause: unknown) => {
          job.state = "failed";
          job.error = cause instanceof Error ? cause.message : "Runner dispatch failed";
        });
      }
      return json(job, 202, { location: `/v1/evaluations/${job.jobId}` });
    }
    const disputeMatch = path.match(/^\/v1\/challenges\/(0x[0-9a-f]{64})\/disputes$/);
    if (disputeMatch) {
      if (disputeMatch[1] !== store.challengeId)
        return error(404, "NOT_FOUND", "Challenge not found");
      const parsed = disputeSchema.parse(await body(request));
      const dispute = {
        challengeId: store.challengeId,
        ...parsed,
        createdAt: new Date().toISOString(),
      };
      store.disputes.push(dispute);
      return json(dispute, 201);
    }
    return error(404, "NOT_FOUND", "Route not found");
  }

  private async put(path: string, request: Request): Promise<Response> {
    if (path === "/v1/challenges/disaster-response/final-entry") {
      const mismatch = contextPrecondition(request, "disaster-response");
      if (mismatch) return error(409, "CONTEXT_MISMATCH", mismatch);
      const identity = await this.requirePlan6Identity(request);
      const competition = this.requirePlan6Store(true);
      const participant = await competition.participantForUser(identity.userId);
      if (!participant) throw new ApiError(409, "NOT_JOINED", "Join this challenge first");
      const parsed = plan6FinalEntrySchema.parse(await body(request));
      const selected = (
        await competition.submissionsForParticipant(participant.participantId)
      ).find(({ submissionId }) => submissionId === parsed.submissionId);
      if (!selected)
        return error(404, "SUBMISSION_NOT_FOUND", "This submission is not in your history");
      if (selected.evaluation.contextHash !== publicDisasterResponseScenario().contextHash) {
        return error(
          409,
          "CONTEXT_MISMATCH",
          "This saved submission belongs to an older evaluation context",
        );
      }
      const finalEntry = await competition.selectFinal(
        participant.participantId,
        parsed.submissionId,
      );
      return json({ storage: competition.durability, finalEntry });
    }
    if (path === "/v1/challenges/emergency-supply/final-entry") {
      const identity = await this.requirePlan5Identity(undefined, request);
      const competition = this.requirePlan5Store(true);
      const participant = await competition.participantForUser(identity.userId);
      if (!participant) throw new ApiError(409, "NOT_JOINED", "Join this challenge first");
      const parsed = plan5FinalEntrySchema.parse(await body(request));
      const finalEntry = await competition.selectFinal(
        participant.participantId,
        parsed.submissionId,
      );
      return json({ storage: competition.durability, finalEntry });
    }
    if (path === "/v2/sandbox/final-entry") {
      const parsed = sandboxFinalEntrySchema.parse(await body(request));
      return json({
        mode: "sandbox",
        frozen: false,
        finalEntry: this.competition.selectFinal(parsed.participantId, parsed.submissionId),
      });
    }
    return error(404, "NOT_FOUND", "Route not found");
  }

  private requirePlan5Store(forWrite = false) {
    const competition = this.plan5.store;
    if (!competition)
      throw new ApiError(503, "STORAGE_UNCONFIGURED", "Competition storage is not configured");
    if (
      forWrite &&
      competition.durability !== "durable-redis" &&
      process.env.NODE_ENV === "production"
    ) {
      throw new ApiError(
        503,
        "DURABLE_STORAGE_REQUIRED",
        "Durable competition storage is not configured",
      );
    }
    return competition;
  }

  private requirePlan6Store(forWrite = false) {
    const competition = this.plan6.store;
    if (!competition)
      throw new ApiError(
        503,
        "STORAGE_UNCONFIGURED",
        "Disaster Response storage is not configured",
      );
    if (
      forWrite &&
      competition.durability !== "durable-redis" &&
      process.env.NODE_ENV === "production"
    ) {
      throw new ApiError(
        503,
        "DURABLE_STORAGE_REQUIRED",
        "Durable Disaster Response storage is not configured",
      );
    }
    return competition;
  }

  private async requirePlan6Identity(request?: Request) {
    if (request?.headers.get("authorization")?.startsWith("Bearer frontier_cli_")) {
      const scopeByOperation: Record<string, CliAuthScope> = {
        "GET /v1/challenges/disaster-response/submissions/mine": "disaster:read",
        "POST /v1/challenges/disaster-response/join": "disaster:join",
        "POST /v1/challenges/disaster-response/submissions": "disaster:submit",
        "PUT /v1/challenges/disaster-response/final-entry": "disaster:entry",
      };
      const scope =
        scopeByOperation[`${request.method} ${new URL(request.url).pathname.replace(/\/$/, "")}`];
      if (!scope)
        throw new ApiError(
          403,
          "CLI_SCOPE_FORBIDDEN",
          "CLI sessions cannot authorize this operation",
        );
      if (!this.plan6.cliAuth)
        throw new ApiError(503, "CLI_AUTH_UNCONFIGURED", "CLI authentication is not configured");
      return this.plan6.cliAuth.resolve(request, scope);
    }
    if (!this.plan6.identity)
      throw new ApiError(
        503,
        "PRIVY_SERVER_UNCONFIGURED",
        "Privy server verification is not configured",
      );
    if (!request) throw new ApiError(401, "AUTH_REQUIRED", "Authentication is required");
    try {
      return await this.plan6.identity(request);
    } catch (cause) {
      throw new ApiError(
        401,
        "AUTH_INVALID",
        cause instanceof Error ? cause.message : "Authentication failed",
      );
    }
  }

  private async requirePlan5Identity(_url?: URL, request?: Request) {
    if (request?.headers.get("authorization")?.startsWith("Bearer frontier_cli_")) {
      throw new ApiError(
        403,
        "CLI_SCOPE_FORBIDDEN",
        "CLI sessions do not authorize Classic arena operations",
      );
    }
    if (!this.plan5.identity) {
      throw new ApiError(
        503,
        "PRIVY_SERVER_UNCONFIGURED",
        "Privy server verification is not configured",
      );
    }
    if (!request) throw new ApiError(401, "AUTH_REQUIRED", "Authentication is required");
    try {
      return await this.plan5.identity(request);
    } catch (cause) {
      throw new ApiError(
        401,
        "AUTH_INVALID",
        cause instanceof Error ? cause.message : "Authentication failed",
      );
    }
  }

  private challenge() {
    return {
      challengeId: this.store.challengeId,
      name: "EVM Orderbook Frontier",
      artifactType: "evm-orderbook-v1",
      contextHash: this.store.benchmark.contextHash,
      workloadVersion: this.store.benchmark.workloadVersion,
      axes: [
        { key: "gasPerOrder", direction: "MINIMIZE", unit: "gas" },
        { key: "parallelThroughput", direction: "MAXIMIZE", unit: "normalized-ops-per-second" },
      ],
      hardConstraints: ["correctness=true"],
      measuredAt: this.store.benchmark.measuredAt,
    };
  }
}

export function createApi(
  benchmark: unknown,
  dispatcher?: EvaluationDispatcher,
  runnerDirectory?: EnsRunnerDirectory,
  plan5?: Plan5Options,
  plan6?: Plan6Options,
  rescueRoom?: RescueRoomOptions,
  oceanCommons?: OceanCommonsOptions,
): FrontierApi {
  return new FrontierApi(
    new FrontierStore(benchmarkRecordSchema.parse(benchmark)),
    dispatcher,
    runnerDirectory,
    plan5,
    plan6,
    rescueRoom,
    oceanCommons,
  );
}

/**
 * Creates a zero-configuration API for the public demo. It uses the checked-in
 * benchmark result, marks the terminal state as simulated, and never fabricates
 * a signature or transaction.
 */
export function createDemoApi(
  benchmark: unknown,
  runnerDirectory?: EnsRunnerDirectory,
  plan5?: Plan5Options,
  plan6?: Plan6Options,
  rescueRoom?: RescueRoomOptions,
  oceanCommons?: OceanCommonsOptions,
): FrontierApi {
  const store = new FrontierStore(benchmarkRecordSchema.parse(benchmark));
  const dispatcher: EvaluationDispatcher = {
    async dispatch(job) {
      const artifact = store.artifacts.get(job.artifactId);
      if (!artifact) throw new Error("Artifact not found");

      job.state = "simulated";
      job.resultHash = keccak256(
        stringToHex(`demo:${job.artifactId}:${store.benchmark.contextHash}`),
      );
      job.frontier = artifact.frontier;
    },
  };

  return new FrontierApi(
    store,
    dispatcher,
    runnerDirectory,
    plan5,
    plan6,
    rescueRoom,
    oceanCommons,
  );
}
