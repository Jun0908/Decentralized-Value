import { describe, expect, it, vi } from "vitest";
import { keccak256, stringToHex } from "viem";
import {
  createEvaluationResultV2,
  evaluationRequestV2Schema,
  evaluationResultV2Schema,
  executionEvidenceV1Schema,
  hashEvaluationRequestV2,
  hashExecutionEvidenceV1,
  verifyEvaluationResultV2,
  verifyExecutionEvidenceV1,
  type EvaluationRequestV2,
  type EvaluationResultInputV2,
  type ExecutionEvidenceV1,
} from "./evaluation-envelope";

const h = (byte: string) => `0x${byte.repeat(64)}` as const;
const request: EvaluationRequestV2 = {
  schemaVersion: "evaluation-request-v2",
  arenaId: "rescue-room",
  jobId: "job-1",
  roundHash: null,
  artifactHash: h("1"),
  artifactUri: null,
  evaluator: { id: "rescue-doctrine", version: "v0", codeHash: h("2") },
  contextHash: h("3"),
  metrics: [
    {
      key: "loss",
      name: "User loss",
      direction: "MINIMIZE",
      unit: "USD",
      lowerBound: 0,
      upperBound: 100,
    },
    {
      key: "served",
      name: "Served demand",
      direction: "MAXIMIZE",
      unit: "USD",
      lowerBound: 0,
      upperBound: 100,
    },
  ],
  aggregationVersion: "sum-v1",
  snapshotHash: null,
  requiredCapability: "rescue-doctrine-v0",
  executionMode: "local",
};
const input: EvaluationResultInputV2 = {
  correctness: true,
  failures: [],
  outcomes: { loss: 10, served: 50 },
  episodes: [
    { episodeId: "episode-b", resultHash: h("4") },
    { episodeId: "episode-a", resultHash: h("5") },
  ],
};
function execution(): ExecutionEvidenceV1 {
  return {
    schemaVersion: "execution-evidence-v1",
    requestHash: hashEvaluationRequestV2(request),
    resultHash: createEvaluationResultV2(request, input).resultHash,
    jobId: request.jobId,
    executionMode: "local",
    recordedAt: "2026-09-11T00:00:00Z",
    executionId: null,
    workflowId: null,
    reportHash: null,
    transactionHash: null,
    verificationStatus: "unverified",
  };
}

describe("versioned evaluation envelopes", () => {
  it("hashes mixed-case metric keys without localeCompare in every V2 binding", () => {
    const mixedRequest = {
      ...request,
      metrics: request.metrics.map((metric, index) => ({
        ...metric,
        key: index === 0 ? "I" : "i",
      })),
    };
    const mixedInput = { ...input, outcomes: { i: 50, I: 10 } };
    const baselineRequestHash = hashEvaluationRequestV2(mixedRequest);
    const baselineResult = createEvaluationResultV2(mixedRequest, mixedInput);
    const { resultHash, ...body } = baselineResult;
    // JSON.stringify's explicit property list is an independent encoding oracle
    // for this complete fixture. Default sort is UTF-16 code-unit order: I < i.
    const propertyOrder = [
      ...new Set([
        "domain",
        "value",
        ...Object.keys(body),
        ...Object.keys(body.binding),
        ...Object.keys(body.binding.evaluator),
        ...Object.keys(body.binding.metrics[0]!),
        "episodeId",
        "resultHash",
        "I",
        "i",
      ]),
    ].sort();
    expect(resultHash).toBe(
      keccak256(
        stringToHex(
          JSON.stringify({ domain: "frontier:evaluation-result:v2", value: body }, propertyOrder),
        ),
      ),
    );
    const evidence = {
      ...execution(),
      requestHash: baselineRequestHash,
      resultHash: baselineResult.resultHash,
    };
    const baselineEvidenceHash = hashExecutionEvidenceV1(evidence);
    const localeCompare = vi.spyOn(String.prototype, "localeCompare").mockImplementation(() => {
      throw new Error("Host locale must not participate in V2 encoding");
    });
    try {
      expect(hashEvaluationRequestV2(mixedRequest)).toBe(baselineRequestHash);
      const result = createEvaluationResultV2(mixedRequest, {
        ...mixedInput,
        outcomes: { I: 10, i: 50 },
      });
      expect(result.resultHash).toBe(baselineResult.resultHash);
      expect(verifyEvaluationResultV2(result, mixedRequest)).toEqual(baselineResult);
      expect(hashExecutionEvidenceV1(evidence)).toBe(baselineEvidenceHash);
      expect(verifyExecutionEvidenceV1(evidence, mixedRequest, result)).toEqual(evidence);
    } finally {
      localeCompare.mockRestore();
    }
  });

  it("keeps independent outcomes and verifies against a trusted request", () => {
    const result = createEvaluationResultV2(request, input);
    expect(verifyEvaluationResultV2(result, request)).toEqual(result);
    expect(result.outcomes).toEqual({ loss: 10, served: 50 });
    expect(result.binding.metrics).toEqual(request.metrics);
    expect(result).not.toHaveProperty("score");
    expect(verifyExecutionEvidenceV1(execution(), request, result)).toEqual(execution());
  });

  it("is independent of JSON key, metric, episode, and failure set ordering", () => {
    const reversedRequest = { ...request, metrics: [...request.metrics].reverse() };
    expect(hashEvaluationRequestV2(reversedRequest)).toBe(hashEvaluationRequestV2(request));
    const failed = { ...input, correctness: false, failures: ["constraint-b", "constraint-a"] };
    const changed = {
      ...failed,
      failures: [...failed.failures].reverse(),
      outcomes: { served: 50, loss: 10 },
      episodes: [...input.episodes].reverse(),
    };
    expect(createEvaluationResultV2(reversedRequest, changed)).toEqual(
      createEvaluationResultV2(request, failed),
    );
    // Verification accepts set order without treating it as a different result.
    const result = createEvaluationResultV2(request, failed);
    expect(
      verifyEvaluationResultV2(
        { ...result, episodes: [...result.episodes].reverse() },
        reversedRequest,
      ),
    ).toEqual(result);
  });

  it("keeps job, locator, clock, transaction, and execution observations outside Result", () => {
    const otherRequest = {
      ...request,
      jobId: "job-2",
      artifactUri: "https://example.test/artifact",
      executionMode: "cre-simulation",
    };
    const result = createEvaluationResultV2(request, input);
    expect(createEvaluationResultV2(otherRequest, input)).toEqual(result);
    expect(hashEvaluationRequestV2(otherRequest)).not.toBe(hashEvaluationRequestV2(request));
    expect(
      hashExecutionEvidenceV1({
        ...execution(),
        recordedAt: "2026-09-12T00:00:00Z",
        transactionHash: h("a"),
      }),
    ).not.toBe(hashExecutionEvidenceV1(execution()));
    expect(() => verifyExecutionEvidenceV1(execution(), otherRequest, result)).toThrow(
      /expected request/,
    );
    expect(result.resultHash).not.toBe(hashEvaluationRequestV2(request));
    expect(result.resultHash).not.toBe(hashExecutionEvidenceV1(execution()));
  });

  it.each([
    { artifactHash: h("a") },
    { contextHash: h("a") },
    { arenaId: "other-arena" },
    { roundHash: h("a") },
    { snapshotHash: h("a") },
    { aggregationVersion: "mean-v1" },
    { requiredCapability: "another-capability" },
    { evaluator: { ...request.evaluator, codeHash: h("a") } },
    { evaluator: { ...request.evaluator, version: "v1" } },
    { metrics: request.metrics.map((metric) => ({ ...metric, direction: "MINIMIZE" })) },
    { metrics: request.metrics.map((metric) => ({ ...metric, unit: "points" })) },
    { metrics: request.metrics.map((metric) => ({ ...metric, upperBound: 200 })) },
  ])("rejects a self-consistent result from a different expected binding: %j", (change) => {
    const unrelated = createEvaluationResultV2({ ...request, ...change }, input);
    expect(unrelated.resultHash).not.toBe(createEvaluationResultV2(request, input).resultHash);
    expect(() => verifyEvaluationResultV2(unrelated, request)).toThrow(/binding/);
  });

  it("rejects changed outcomes, episode evidence, and hashes", () => {
    const result = createEvaluationResultV2(request, input);
    for (const changed of [
      { ...result, outcomes: { loss: 11, served: 50 } },
      { ...result, episodes: [{ episodeId: "episode-a", resultHash: h("a") }] },
      { ...result, resultHash: h("a") },
    ])
      expect(() => verifyEvaluationResultV2(changed, request)).toThrow(/hash mismatch/);
  });

  it.each([
    { correctness: true, failures: ["constraint-a"] },
    { correctness: false, failures: [] },
    { correctness: false, failures: ["constraint-a", "constraint-a"] },
    { outcomes: { loss: 10 } },
    { outcomes: { loss: 10, served: 50, score: 100 } },
    { episodes: [input.episodes[0], input.episodes[0]] },
    { episodes: [] },
  ])("rejects malformed independent outcome/correctness evidence: %j", (change) => {
    expect(() =>
      createEvaluationResultV2(request, { ...input, ...change } as EvaluationResultInputV2),
    ).toThrow();
  });

  it("rejects duplicated, invalid-direction, and invalid-bounds metrics", () => {
    for (const metrics of [
      [request.metrics[0], request.metrics[0]],
      [{ ...request.metrics[0], direction: "WEIGHTED" }],
      [{ ...request.metrics[0], upperBound: 0 }],
    ])
      expect(evaluationRequestV2Schema.safeParse({ ...request, metrics }).success).toBe(false);
  });

  it("retains real failed evaluations but does not fabricate an outcome for transport failure", () => {
    const failed = createEvaluationResultV2(request, {
      ...input,
      correctness: false,
      failures: ["unsafe-resume"],
    });
    expect(verifyEvaluationResultV2(failed, request).correctness).toBe(false);
    expect(() =>
      createEvaluationResultV2(request, { error: "timeout" } as unknown as EvaluationResultInputV2),
    ).toThrow();
  });

  it("rejects arbitrary metadata/private state at all nested boundaries", () => {
    const result = createEvaluationResultV2(request, input);
    for (const value of [
      { ...request, hiddenSeed: "secret" },
      { ...request, evaluator: { ...request.evaluator, credential: "secret" } },
      { ...request, metrics: request.metrics.map((metric) => ({ ...metric, weight: 1 })) },
    ])
      expect(evaluationRequestV2Schema.safeParse(value).success).toBe(false);
    for (const value of [
      { ...result, issuedAt: "2026-09-11" },
      { ...result, binding: { ...result.binding, jobId: "job-1" } },
      { ...result, episodes: [{ ...input.episodes[0], hiddenState: {} }] },
    ])
      expect(evaluationResultV2Schema.safeParse(value).success).toBe(false);
    expect(() =>
      createEvaluationResultV2(request, {
        ...input,
        binding: result.binding,
      } as unknown as EvaluationResultInputV2),
    ).toThrow();
  });

  it("rejects JavaScript-only JSON values without evaluating accessors", () => {
    const sparse = new Array(2);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    let getterCalled = false;
    const accessor = Object.defineProperty({}, "secret", {
      enumerable: true,
      get() {
        getterCalled = true;
        return 1;
      },
    });
    const symbol = { [Symbol("private")]: 1 };
    const nonEnumerable = Object.defineProperty({}, "secret", { value: 1 });
    for (const value of [
      NaN,
      Infinity,
      -Infinity,
      undefined,
      1n,
      () => 1,
      new Date(),
      new Map(),
      sparse,
      cyclic,
      accessor,
      symbol,
      nonEnumerable,
    ]) {
      expect(evaluationRequestV2Schema.safeParse({ ...request, unknown: value }).success).toBe(
        false,
      );
      expect(() =>
        createEvaluationResultV2(request, {
          ...input,
          outcomes: { loss: value, served: 50 },
        } as unknown as EvaluationResultInputV2),
      ).toThrow();
    }
    expect(getterCalled).toBe(false);
  });

  it("does not treat claimed signature/TEE/chain/payment evidence as verification", () => {
    const evidence = {
      ...execution(),
      executionMode: "cre-confidential",
      workflowId: "workflow-1",
      reportHash: h("a"),
      transactionHash: h("b"),
    };
    expect(executionEvidenceV1Schema.parse(evidence).verificationStatus).toBe("unverified");
    for (const change of [
      { verificationStatus: "tee-verified" },
      { paid: true },
      { commitmentStatus: "committed" },
      { signature: "0xab" },
    ]) {
      expect(executionEvidenceV1Schema.safeParse({ ...evidence, ...change }).success).toBe(false);
    }
    const result = createEvaluationResultV2(request, input);
    for (const change of [
      { jobId: "job-2" },
      { requestHash: h("a") },
      { resultHash: h("b") },
      { executionMode: "runner" },
    ]) {
      expect(() =>
        verifyExecutionEvidenceV1({ ...execution(), ...change }, request, result),
      ).toThrow(/expected request/);
    }
  });

  it("rejects unknown schema versions", () => {
    expect(
      evaluationRequestV2Schema.safeParse({ ...request, schemaVersion: "evaluation-request-v3" })
        .success,
    ).toBe(false);
    expect(
      evaluationResultV2Schema.safeParse({
        ...createEvaluationResultV2(request, input),
        schemaVersion: "evaluation-result-v3",
      }).success,
    ).toBe(false);
  });
});
