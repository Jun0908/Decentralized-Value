import { keccak256, stringToHex, type Hex } from "viem";
import { z } from "zod";
import { outcomeMetricSchema } from "./multiobjective";
import { bytes32Schema } from "./schemas";

/** New envelopes do not change the legacy attestation or arena hash formats. */
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/);
const executionModeSchema = z.enum(["local", "runner", "cre-simulation", "cre-confidential"]);
const evaluatorSchema = z
  .object({ id: identifier, version: identifier, codeHash: bytes32Schema })
  .strict();
const metricSchema = outcomeMetricSchema.safeExtend({ key: identifier }).strict();
const metricsSchema = z
  .array(metricSchema)
  .min(1)
  .max(6)
  .superRefine((metrics, ctx) => {
    if (new Set(metrics.map(({ key }) => key)).size !== metrics.length) {
      ctx.addIssue({ code: "custom", message: "Duplicate metric key" });
    }
  });

/** Deterministic evaluation identity, including the particular artifact.
 * Comparison groups omit artifactHash but must share the committed context. */
const bindingSchema = z
  .object({
    arenaId: identifier,
    roundHash: bytes32Schema.nullable(),
    artifactHash: bytes32Schema,
    evaluator: evaluatorSchema,
    contextHash: bytes32Schema,
    metrics: metricsSchema,
    aggregationVersion: identifier,
    snapshotHash: bytes32Schema.nullable(),
    requiredCapability: identifier,
  })
  .strict();

/* Reject JavaScript-only values before Zod can strip/coerce them or canonical JSON
 * can collapse NaN, sparse arrays, Date, getters, symbols, or undefined. The
 * public wire boundary accepts plain JSON data only; it never executes getters. */
function assertJson(value: unknown, ancestors = new Set<object>(), depth = 0): void {
  if (depth > 64) throw new Error("Evaluation envelope exceeds JSON depth limit");
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (typeof value !== "object" || value === null)
    throw new Error("Expected finite plain JSON data");
  if (ancestors.has(value)) throw new Error("Cyclic JSON data is not supported");
  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (!array && prototype !== Object.prototype && prototype !== null) {
    throw new Error("Expected a plain JSON object");
  }
  ancestors.add(value);
  const keys = Reflect.ownKeys(value);
  if (array && keys.length !== value.length + 1) throw new Error("Expected a dense JSON array");
  for (const key of keys) {
    if (array && key === "length") continue;
    if (typeof key !== "string") throw new Error("Symbol keys are not JSON data");
    if (array && !/^(0|[1-9][0-9]*)$/.test(key)) throw new Error("Unexpected array property");
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!descriptor.enumerable || !("value" in descriptor))
      throw new Error("Expected enumerable JSON data properties");
    assertJson(descriptor.value, ancestors, depth + 1);
  }
  ancestors.delete(value);
}

function jsonGuard(value: unknown, ctx: z.RefinementCtx): unknown {
  try {
    assertJson(value);
  } catch {
    ctx.addIssue({
      code: "custom",
      message: "Expected finite, dense, plain JSON data (maximum depth 64)",
    });
    return z.NEVER;
  }
  return value;
}

const requestObjectSchema = bindingSchema
  .extend({
    schemaVersion: z.literal("evaluation-request-v2"),
    jobId: identifier,
    // A locator is data, not permission to fetch it. Dispatch must apply its own
    // origin/SSRF policy and verify the downloaded artifact's arena-native hash.
    artifactUri: z.string().url().nullable(),
    executionMode: executionModeSchema,
  })
  .strict();

export const evaluationRequestV2Schema = z.preprocess(jsonGuard, requestObjectSchema);
export type EvaluationRequestV2 = z.infer<typeof evaluationRequestV2Schema>;

const episodeSchema = z.object({ episodeId: identifier, resultHash: bytes32Schema }).strict();
const resultInputSchema = z
  .object({
    correctness: z.boolean(),
    failures: z.array(identifier),
    outcomes: z.record(identifier, z.number().finite()),
    episodes: z.array(episodeSchema).min(1),
  })
  .strict();
const resultBodySchema = z
  .object({
    schemaVersion: z.literal("evaluation-result-v2"),
    binding: bindingSchema,
    ...resultInputSchema.shape,
  })
  .strict()
  .superRefine((result, ctx) => {
    if (result.correctness !== (result.failures.length === 0)) {
      ctx.addIssue({
        code: "custom",
        message: "Correctness must agree with hard-constraint failures",
      });
    }
    if (new Set(result.failures).size !== result.failures.length) {
      ctx.addIssue({ code: "custom", message: "Duplicate failure code" });
    }
    const expectedKeys = result.binding.metrics.map(({ key }) => key).sort();
    const actualKeys = Object.keys(result.outcomes).sort();
    if (JSON.stringify(expectedKeys) !== JSON.stringify(actualKeys)) {
      ctx.addIssue({
        code: "custom",
        message: "Outcomes must contain exactly the declared metrics",
      });
    }
    if (
      new Set(result.episodes.map(({ episodeId }) => episodeId)).size !== result.episodes.length
    ) {
      ctx.addIssue({ code: "custom", message: "Duplicate episode ID" });
    }
  });

const resultObjectSchema = resultBodySchema.safeExtend({ resultHash: bytes32Schema }).strict();
export const evaluationResultV2Schema = z.preprocess(jsonGuard, resultObjectSchema);
export type EvaluationResultV2 = z.infer<typeof evaluationResultV2Schema>;
export type EvaluationResultInputV2 = Pick<
  EvaluationResultV2,
  "correctness" | "failures" | "outcomes" | "episodes"
>;

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function bindingFor(request: EvaluationRequestV2): z.infer<typeof bindingSchema> {
  return {
    arenaId: request.arenaId,
    roundHash: request.roundHash,
    artifactHash: request.artifactHash,
    evaluator: request.evaluator,
    contextHash: request.contextHash,
    metrics: [...request.metrics].sort((a, b) => compareIds(a.key, b.key)),
    aggregationVersion: request.aggregationVersion,
    snapshotHash: request.snapshotHash,
    requiredCapability: request.requiredCapability,
  };
}

/** V2 wire encoding uses UTF-16 code-unit key order, never the host locale.
 * Arrays retain their order; only explicitly set-like schema fields are sorted
 * by their normalizers. Legacy manifest/attestation encoding is unchanged. */
function canonicalEnvelopeJson(value: unknown): string {
  assertJson(value);
  function encode(item: unknown): string {
    if (Array.isArray(item)) return `[${item.map(encode).join(",")}]`;
    if (item !== null && typeof item === "object") {
      return `{${Object.entries(item)
        .sort(([left], [right]) => compareIds(left, right))
        .map(([key, child]) => `${JSON.stringify(key)}:${encode(child)}`)
        .join(",")}}`;
    }
    return JSON.stringify(item);
  }
  return encode(value);
}

function domainHash(domain: string, value: unknown): Hex {
  // Cross-runtime CRE/QuickJS parity remains a separate Phase 0 gate;
  // a local hash is not an execution attestation.
  return keccak256(stringToHex(canonicalEnvelopeJson({ domain, value })));
}

export function hashEvaluationRequestV2(value: unknown): Hex {
  const request = evaluationRequestV2Schema.parse(value);
  return domainHash("frontier:evaluation-request:v2", { ...request, ...bindingFor(request) });
}

function normalizeResultBody(
  value: z.infer<typeof resultBodySchema>,
): z.infer<typeof resultBodySchema> {
  return {
    ...value,
    binding: {
      ...value.binding,
      metrics: [...value.binding.metrics].sort((a, b) => compareIds(a.key, b.key)),
    },
    failures: [...value.failures].sort(compareIds),
    episodes: [...value.episodes].sort((a, b) => compareIds(a.episodeId, b.episodeId)),
  };
}

export function createEvaluationResultV2(
  requestValue: unknown,
  input: EvaluationResultInputV2,
): EvaluationResultV2 {
  const request = evaluationRequestV2Schema.parse(requestValue);
  assertJson(input);
  // Strictly parse input before adding generated fields, so callers cannot
  // override the binding or smuggle execution/private data into the result.
  const data = resultInputSchema.parse(input);
  const body = normalizeResultBody(
    resultBodySchema.parse({
      ...data,
      schemaVersion: "evaluation-result-v2",
      binding: bindingFor(request),
    }),
  );
  return { ...body, resultHash: domainHash("frontier:evaluation-result:v2", body) };
}

/** Checks structural integrity and the caller's trusted request, NOT evaluator
 * correctness, ENS authorization, episode replay, CRE attestation, or payment. */
export function verifyEvaluationResultV2(
  value: unknown,
  expectedRequest: unknown,
): EvaluationResultV2 {
  const request = evaluationRequestV2Schema.parse(expectedRequest);
  const parsed = evaluationResultV2Schema.parse(value);
  const { resultHash, ...rawBody } = parsed;
  const body = normalizeResultBody(rawBody);
  if (canonicalEnvelopeJson(body.binding) !== canonicalEnvelopeJson(bindingFor(request))) {
    throw new Error("Evaluation result does not match expected request binding");
  }
  if (domainHash("frontier:evaluation-result:v2", body) !== resultHash) {
    throw new Error("Evaluation result hash mismatch");
  }
  return { ...body, resultHash };
}

/** Observation envelope only. No supplied signature, workflow ID, or tx hash
 * is upgraded to verified / committed / paid by parsing or hashing it. */
const executionObjectSchema = z
  .object({
    schemaVersion: z.literal("execution-evidence-v1"),
    requestHash: bytes32Schema,
    resultHash: bytes32Schema,
    jobId: identifier,
    executionMode: executionModeSchema,
    recordedAt: z.string().datetime(),
    executionId: identifier.nullable(),
    workflowId: identifier.nullable(),
    reportHash: bytes32Schema.nullable(),
    transactionHash: bytes32Schema.nullable(),
    verificationStatus: z.literal("unverified"),
  })
  .strict();
export const executionEvidenceV1Schema = z.preprocess(jsonGuard, executionObjectSchema);
export type ExecutionEvidenceV1 = z.infer<typeof executionEvidenceV1Schema>;

export function hashExecutionEvidenceV1(value: unknown): Hex {
  return domainHash("frontier:execution-evidence:v1", executionEvidenceV1Schema.parse(value));
}

/** Only validates bindings. Callers must separately authenticate the executor. */
export function verifyExecutionEvidenceV1(
  value: unknown,
  expectedRequest: unknown,
  expectedResult: unknown,
): ExecutionEvidenceV1 {
  const request = evaluationRequestV2Schema.parse(expectedRequest);
  const result = verifyEvaluationResultV2(expectedResult, request);
  const evidence = executionEvidenceV1Schema.parse(value);
  if (
    evidence.requestHash !== hashEvaluationRequestV2(request) ||
    evidence.resultHash !== result.resultHash ||
    evidence.jobId !== request.jobId ||
    evidence.executionMode !== request.executionMode
  ) {
    throw new Error("Execution evidence does not match expected request and result");
  }
  return evidence;
}
