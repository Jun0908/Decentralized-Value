import { createHash } from "node:crypto";
import { cliArenaManifestSchema } from "../../packages/shared/src/cli";
import {
  evaluateRescueDoctrinePracticeEpisode,
  rescueRoomMetrics,
} from "../../packages/rescue-room/src/index";

export const practiceTools = [
  { name: "get_manifest", method: "GET", path: "/v1/cli/arenas/rescue-room" },
  { name: "get_starter", method: "GET", path: "/v1/rescue-room/starter-kit" },
  { name: "evaluate_doctrine", method: "POST", path: "/v1/rescue-room/doctrine-evaluations" },
] as const;

export type ExperimentConfig = {
  task: string;
  prompt: string;
  model: string;
  settings: Record<string, unknown>;
  apiIdentity: string;
  apiSnapshotHash: string;
  manifest: ReturnType<typeof cliArenaManifestSchema.parse>;
  episodeIds: string[];
  seeds: number[];
  maxToolCalls: number;
};
export type ToolRequest = {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
};
export type PracticePort = (request: ToolRequest) => Promise<{ status: number; body: unknown }>;
export type AgentRequest = {
  controls: ExperimentConfig;
  episodeId: string;
  seed: number;
  tools: typeof practiceTools;
  recipe: string | null;
};
export type AgentTools = {
  getManifest(): Promise<unknown>;
  getStarter(): Promise<Uint8Array>;
  evaluateDoctrine(doctrine: Record<string, unknown>): Promise<unknown>;
};
export type InjectedRunner = (
  request: AgentRequest,
  tools: AgentTools,
) => Promise<{ answer: string; doctrine: Record<string, unknown> }>;
export type ToolTrace = {
  request: ToolRequest;
  requestHash: string;
  status: number | null;
  responseHash: string | null;
  // Failed HTTP bodies/error messages are deliberately not copied into evidence.
  response?: unknown;
};

export function experimentHash(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}
function canonicalJson(value: unknown): string {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  )
    return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  }
  throw new ExperimentFailure("NON_JSON_EVIDENCE");
}
export function recipeHash(recipe: string): string {
  return createHash("sha256").update(recipe, "utf8").digest("hex");
}

class ExperimentFailure extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
function requireMatch(a: unknown, b: unknown, code = "CONTEXT_MISMATCH") {
  if (experimentHash(a) !== experimentHash(b)) throw new ExperimentFailure(code);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype
  );
}
function parseConfig(input: ExperimentConfig): ExperimentConfig {
  if (
    !isRecord(input) ||
    [input.task, input.prompt, input.model, input.apiIdentity].some(
      (value) => typeof value !== "string" || !value.trim(),
    ) ||
    !isRecord(input.settings) ||
    !/^[a-f0-9]{64}$/.test(input.apiSnapshotHash) ||
    !Array.isArray(input.episodeIds) ||
    !input.episodeIds.length ||
    input.episodeIds.some((id) => typeof id !== "string" || !id) ||
    !Array.isArray(input.seeds) ||
    !input.seeds.length ||
    input.seeds.some((seed) => !Number.isSafeInteger(seed) || seed < 0) ||
    !Number.isSafeInteger(input.maxToolCalls) ||
    input.maxToolCalls < 3 ||
    input.maxToolCalls > 30
  ) {
    throw new ExperimentFailure("INVALID_CONTROLS");
  }
  requireMatch(
    Object.keys(input).sort(),
    [
      "task",
      "prompt",
      "model",
      "settings",
      "apiIdentity",
      "apiSnapshotHash",
      "manifest",
      "episodeIds",
      "seeds",
      "maxToolCalls",
    ].sort(),
    "INVALID_CONTROLS",
  );
  return { ...input, manifest: cliArenaManifestSchema.parse(input.manifest) };
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

type ValidEvaluation = ReturnType<typeof evaluateRescueDoctrinePracticeEpisode> & {
  state: "simulated";
  strategyState: "deterministic-rules";
  paymentState: "game-credits";
};
export function practiceResponse(doctrine: unknown, episodeId: string): ValidEvaluation {
  return {
    ...evaluateRescueDoctrinePracticeEpisode(doctrine, episodeId),
    state: "simulated",
    strategyState: "deterministic-rules",
    paymentState: "game-credits",
  };
}

async function runArm(
  config: ExperimentConfig,
  episodeId: string,
  seed: number,
  recipe: string | null,
  makeRunner: () => InjectedRunner,
  port: PracticePort,
) {
  const request = freeze(
    structuredClone({ controls: config, episodeId, seed, tools: practiceTools, recipe }),
  );
  const traces: ToolTrace[] = [];
  let halted: ExperimentFailure | null = null;
  let active = true;
  let pendingCalls = 0;
  const performCall = async (input: ToolRequest): Promise<unknown> => {
    if (!active) throw new ExperimentFailure("RUN_CLOSED");
    if (halted) throw halted;
    if (traces.length >= config.maxToolCalls) {
      halted = new ExperimentFailure("TOOL_LIMIT");
      throw halted;
    }
    const snapshot = structuredClone(input);
    const trace: ToolTrace = {
      request: snapshot,
      requestHash: experimentHash(snapshot),
      status: null,
      responseHash: null,
    };
    traces.push(trace);
    pendingCalls += 1;
    try {
      const response = await port(structuredClone(snapshot));
      // A runner can return without awaiting its calls. Late results never mutate evidence.
      if (!active) throw new ExperimentFailure("RUN_CLOSED");
      const status = response?.status;
      if (!Number.isInteger(status) || status < 100 || status > 599) {
        throw new ExperimentFailure("INVALID_HTTP_STATUS");
      }
      trace.status = status;
      if (status !== 200) {
        throw new ExperimentFailure(
          [401, 402, 403].includes(status) ? `BLOCKED_HTTP_${status}` : "HTTP_FAILURE",
        );
      }
      if (snapshot.path === practiceTools[1].path) {
        if (!(response.body instanceof Uint8Array)) throw new ExperimentFailure("INVALID_STARTER");
        const bytes = new Uint8Array(response.body);
        trace.responseHash = createHash("sha256").update(bytes).digest("hex");
        if (trace.responseHash !== config.manifest.starter.sha256)
          throw new ExperimentFailure("STARTER_HASH_MISMATCH");
        trace.response = { sha256: trace.responseHash, byteLength: bytes.byteLength };
        return bytes;
      }
      trace.responseHash = experimentHash(response.body);
      if (snapshot.path === practiceTools[0].path) {
        requireMatch(response.body, config.manifest);
      } else {
        const doctrine = (snapshot.body as { doctrine: Record<string, unknown> }).doctrine;
        const expected = practiceResponse(doctrine, episodeId);
        if (
          expected.contextHash !== config.manifest.context.contextHash ||
          expected.doctrineContextHash !== config.manifest.context.runtimeContextHash ||
          expected.manifestHash !== config.manifest.context.manifestHash ||
          expected.interpreterVersion !== config.manifest.context.evaluatorVersion
        ) {
          throw new ExperimentFailure("CONTEXT_MISMATCH");
        }
        // Verify the complete response against the public deterministic evaluator, not model claims.
        requireMatch(response.body, expected, "EVALUATION_REPLAY_MISMATCH");
      }
      trace.response = structuredClone(response.body);
      return structuredClone(response.body);
    } catch (error) {
      if (!active) throw new ExperimentFailure("RUN_CLOSED");
      halted = error instanceof ExperimentFailure ? error : new ExperimentFailure("TOOL_FAILURE");
      throw halted;
    } finally {
      pendingCalls -= 1;
    }
  };
  const call = (input: ToolRequest): Promise<unknown> => {
    const promise = performCall(input);
    // Handle abandoned rejections internally while preserving rejection for awaited callers.
    void promise.catch(() => {});
    return promise;
  };
  const tools: AgentTools = {
    getManifest: () => call(practiceTools[0]),
    getStarter: () => call(practiceTools[1]) as Promise<Uint8Array>,
    evaluateDoctrine: (doctrine) =>
      call({
        method: "POST",
        path: practiceTools[2].path,
        headers: {
          "X-Frontier-Context-Hash": config.manifest.context.contextHash,
          "X-Frontier-Runtime-Context-Hash": config.manifest.context.runtimeContextHash!,
        },
        body: { doctrine: structuredClone(doctrine), episodeId },
      }),
  };
  const base = {
    request,
    requestHash: experimentHash(request),
    recipeHash: recipe === null ? null : recipeHash(recipe),
    traces,
  };
  let response: unknown = null;
  let responseHash: string | null = null;
  try {
    // Preflight is identical on A and B and cannot be skipped by a runner.
    await tools.getManifest();
    await tools.getStarter();
    const raw = structuredClone(await makeRunner()(request, tools));
    if (pendingCalls !== 0) throw new ExperimentFailure("INCOMPLETE_TOOL_CALLS");
    responseHash = experimentHash(raw);
    response = raw;
    if (halted) throw halted;
    if (
      !isRecord(response) ||
      typeof response.answer !== "string" ||
      !isRecord(response.doctrine) ||
      Object.keys(response).sort().join(",") !== "answer,doctrine"
    )
      throw new ExperimentFailure("INVALID_RUNNER_RESPONSE");
    const evaluated = (await tools.evaluateDoctrine(response.doctrine)) as ValidEvaluation;
    if (pendingCalls !== 0) throw new ExperimentFailure("INCOMPLETE_TOOL_CALLS");
    return freeze(
      structuredClone({
        ...base,
        status: "completed" as const,
        failureCode: null,
        response,
        responseHash,
        evaluation: evaluated,
      }),
    );
  } catch (error) {
    return freeze(
      structuredClone({
        ...base,
        status: "failed" as const,
        failureCode: error instanceof ExperimentFailure ? error.code : "RUNNER_FAILURE",
        response,
        responseHash,
        evaluation: null,
      }),
    );
  } finally {
    active = false;
  }
}

function compare(
  a: Awaited<ReturnType<typeof runArm>>,
  b: Awaited<ReturnType<typeof runArm>>,
  config: ExperimentConfig,
) {
  if (!a.evaluation || !b.evaluation) return { relation: "not-comparable" as const, metrics: [] };
  const values = (e: ValidEvaluation) => ({
    totalUserLossUsd: e.outcome.userLossUsd,
    servedProtocolDemandPpm: e.outcome.servedProtocolDemandPpm,
    netResponseSpendCredits: e.outcome.netResponseSpendCredits,
  });
  const av = values(a.evaluation),
    bv = values(b.evaluation);
  const metrics = config.manifest.context.metrics.map((metric) => {
    const key = metric.key as keyof typeof av;
    return { ...metric, a: av[key], b: bv[key], delta: bv[key] - av[key] };
  });
  if (!a.evaluation.outcome.correctness || !b.evaluation.outcome.correctness) {
    return { relation: "ineligible" as const, metrics };
  }
  const aBetter = metrics.some((m) => (m.direction === "MINIMIZE" ? m.a < m.b : m.a > m.b));
  const bBetter = metrics.some((m) => (m.direction === "MINIMIZE" ? m.b < m.a : m.b > m.a));
  return {
    relation:
      aBetter && bBetter ? "tradeoff" : aBetter ? "a-dominates" : bBetter ? "b-dominates" : "equal",
    metrics,
  };
}

/** Trusted injected runner/port only; this is not a process/network sandbox. No built-in external transport. */
export async function runRecipeExperiment(
  input: ExperimentConfig,
  recipe: string,
  dependencies: { makeRunner: () => InjectedRunner; port: PracticePort },
) {
  const config = freeze(structuredClone(parseConfig(input)));
  experimentHash(config); // Reject non-JSON controls before any injected work.
  if (!recipe.trim()) throw new ExperimentFailure("EMPTY_RECIPE");
  const { manifest } = config;
  if (
    manifest.id !== "rescue-room" ||
    manifest.artifact.kind !== "doctrine" ||
    manifest.context.evidenceState !== "simulated" ||
    manifest.paymentState !== "game-credits" ||
    !manifest.context.runtimeContextHash ||
    !manifest.capabilities.practice.available ||
    manifest.capabilities.practice.authentication !== "none" ||
    manifest.starter.path !== practiceTools[1].path
  )
    throw new ExperimentFailure("UNSUPPORTED_MANIFEST");
  requireMatch(config.apiSnapshotHash, experimentHash(manifest), "SNAPSHOT_MISMATCH");
  const metricKeys = manifest.context.metrics.map((m) => m.key).sort();
  requireMatch(
    metricKeys,
    ["netResponseSpendCredits", "servedProtocolDemandPpm", "totalUserLossUsd"],
    "METRIC_MISMATCH",
  );
  const canonicalMetrics = rescueRoomMetrics(1);
  requireMatch(manifest.context.metrics, canonicalMetrics, "METRIC_MISMATCH");
  if (
    new Set(config.episodeIds).size !== config.episodeIds.length ||
    new Set(config.seeds).size !== config.seeds.length ||
    config.episodeIds.some((id) => !manifest.episodes.some((episode) => episode.id === id))
  )
    throw new ExperimentFailure("INVALID_CASES");
  const pairs = [];
  // All declared Episodes/seeds are retained; no retries, best-of-N selection or early success exit.
  for (const episodeId of config.episodeIds)
    for (const seed of config.seeds) {
      const a = await runArm(
        config,
        episodeId,
        seed,
        null,
        dependencies.makeRunner,
        dependencies.port,
      );
      const b = await runArm(
        config,
        episodeId,
        seed,
        recipe,
        dependencies.makeRunner,
        dependencies.port,
      );
      pairs.push({ episodeId, seed, a, b, comparison: compare(a, b, config) });
    }
  const report = {
    schemaVersion: "bazantic-rescue-local-ab-v1",
    evidenceClass: "injected-runner-local-readiness",
    liveGatewayVerified: false,
    realModelExecutionVerified: false,
    paymentRequested: false,
    controls: config,
    controlsHash: experimentHash(config),
    recipeHash: recipeHash(recipe),
    pairs,
  } as const;
  return freeze(structuredClone({ ...report, reportHash: experimentHash(report) }));
}
