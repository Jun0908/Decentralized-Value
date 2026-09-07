import {
  artifactSchema,
  benchmarkRecordSchema,
  bytes32Schema,
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
import { evaluateMicrogridDispatch, publicMicrogridScenario } from "@frontier/microgrid-dispatch";
import type { EnsRunnerDirectory } from "@frontier/ens-adapter";
import { z } from "zod";
import { keccak256, stringToHex, type Hex } from "viem";
import { FrontierStore, type EvaluationJob } from "./store";
import { CompetitionSandboxStore } from "./competition-store";

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
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
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
  readonly competition = new CompetitionSandboxStore();
  constructor(
    readonly store: FrontierStore,
    private readonly dispatcher?: EvaluationDispatcher,
    private readonly runnerDirectory?: EnsRunnerDirectory,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "") || "/";
    const client = request.headers.get("x-forwarded-for") ?? "local";
    if (!this.limiter.accept(client)) return error(429, "RATE_LIMITED", "Too many requests");

    try {
      if (request.method === "GET") return await this.get(path, url);
      if (request.method === "POST") return await this.post(path, request);
      if (request.method === "PUT") return await this.put(path, request);
      return error(405, "METHOD_NOT_ALLOWED", "Method not allowed", {
        allowed: ["GET", "POST", "PUT"],
      });
    } catch (cause) {
      if (cause instanceof z.ZodError)
        return error(400, "VALIDATION_ERROR", "Request validation failed", cause.issues);
      return error(400, "BAD_REQUEST", cause instanceof Error ? cause.message : "Bad request");
    }
  }

  private async get(path: string, url: URL): Promise<Response> {
    const { store } = this;
    if (path === "/v1/health")
      return json({ status: "ok", benchmarkMeasuredAt: store.benchmark.measuredAt });
    if (path === "/v1/arenas")
      return json({
        arenas: [
          publicEmergencySupplyScenario(),
          await publicCalldataCompressionScenario(),
          publicMicrogridScenario(),
          this.challenge(),
        ],
      });
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
): FrontierApi {
  return new FrontierApi(
    new FrontierStore(benchmarkRecordSchema.parse(benchmark)),
    dispatcher,
    runnerDirectory,
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

  return new FrontierApi(store, dispatcher, runnerDirectory);
}
