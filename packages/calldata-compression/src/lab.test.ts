import { beforeAll, describe, expect, it } from "vitest";
import {
  calldataCompressionContextHash,
  calldataCompressionScenario,
  evaluateCalldataCodec,
  executeCalldataDecoder,
  measureCalldataGas,
} from "./index";
import {
  calldataLabContext,
  compareCalldataLabPoints,
  evaluateCalldataRules,
  hashCalldataRuleArtifact,
  parseCalldataLabRequest,
  type CalldataLabEvaluation,
} from "./lab";
import { calldataRulePresets, parseCalldataRuleArtifact, selectCalldataRule } from "./rules";

describe("bounded Calldata rule practice", () => {
  let adaptive: CalldataLabEvaluation;
  beforeAll(async () => {
    adaptive = await evaluateCalldataRules(calldataRulePresets.adaptive);
  }, 30_000);

  it("changes the selected codec and real EVM aggregate for each batch characteristic", () => {
    expect(adaptive.batchEvidence.map(({ codecId }) => codecId)).toEqual([
      "dictionary",
      "packed",
      "dictionary",
    ]);
    expect(adaptive.point).toMatchObject({
      correctness: true,
      calldataGas: 5172,
      decodeExecutionGas: 17185,
    });
    expect(adaptive.encodedBytes).toBe(459);
    expect(adaptive.pareto.frontier).toBe(true);
    expect(adaptive.pareto.improvesOver.map(({ id }) => id)).toEqual([
      "reference-abi",
      "reference-dictionary",
    ]);
    expect(
      adaptive.batchEvidence.every(({ digest, referenceDigest }) => digest === referenceDigest),
    ).toBe(true);
    for (const batch of adaptive.batchEvidence) {
      expect(batch).toMatchObject(measureCalldataGas(batch.encoded));
      expect(batch.encodedBytes).toBe((batch.encoded.length - 2) / 2);
    }
  });

  it("measures fixed-codec baselines in precisely the rule context", () => {
    expect(
      adaptive.baselines.map(({ point }) => [point.calldataGas, point.decodeExecutionGas]),
    ).toEqual([
      [14112, 19590],
      [8200, 13061],
      [5272, 20123],
    ]);
    expect(
      adaptive.baselines.every(
        ({ point }) => point.contextHash === adaptive.contextHash && point.correctness,
      ),
    ).toBe(true);
    expect(adaptive.contextHash).not.toBe(calldataCompressionContextHash);
    expect(adaptive.context.runtimeHashes).toHaveProperty("DictionaryDecoder");
  });

  it("uses a first-match ordered rule and exact inclusive thresholds", () => {
    const batch = calldataCompressionScenario.batches[0];
    const rules = parseCalldataRuleArtifact({
      ...calldataRulePresets.adaptive,
      rules: [
        { minActions: 10, maxActions: 10, minReusePercent: 80, codecId: "dictionary" },
        { minActions: 1, maxActions: 255, minReusePercent: 0, codecId: "abi" },
      ],
    });
    expect(selectCalldataRule(rules, batch)).toMatchObject({
      codecId: "dictionary",
      ruleIndex: 0,
      reusePercent: 80,
    });
    const reversed = { ...rules, rules: [...rules.rules].reverse() };
    expect(selectCalldataRule(reversed, batch).codecId).toBe("abi");
    expect(hashCalldataRuleArtifact(reversed)).not.toBe(hashCalldataRuleArtifact(rules));
    rules.rules[0]!.minReusePercent = 81;
    expect(selectCalldataRule(rules, batch).codecId).toBe("abi");
  });

  it("changing the threshold changes artifact identity and measures the packed fallback", async () => {
    const artifact = parseCalldataRuleArtifact(calldataRulePresets.adaptive);
    artifact.rules[0]!.minReusePercent = 100;
    const changed = await evaluateCalldataRules(artifact);
    expect(changed.artifactHash).not.toBe(adaptive.artifactHash);
    expect(changed.contextHash).toBe(adaptive.contextHash);
    expect(changed.point).toMatchObject({ calldataGas: 8200, decodeExecutionGas: 13061 });
    expect(changed.batchEvidence.every(({ selection }) => selection.ruleIndex === null)).toBe(true);
    expect(changed.resultHash).not.toBe(adaptive.resultHash);
  }, 30_000);

  it("repeats the exact result and is independent of JSON property order", async () => {
    const reordered = {
      fallbackCodec: "packed",
      rules: [{ codecId: "dictionary", minReusePercent: 50, maxActions: 255, minActions: 4 }],
      schemaVersion: "1",
      kind: "calldata-rules-v1",
    };
    expect(hashCalldataRuleArtifact(reordered)).toBe(adaptive.artifactHash);
    expect(await evaluateCalldataRules(reordered)).toEqual(adaptive);
  }, 30_000);

  it("keeps low-reuse results separate and refuses cross-context comparison", async () => {
    const low = await evaluateCalldataRules(calldataRulePresets.adaptive, "public-low-reuse");
    expect(low.batchEvidence).toHaveLength(2);
    expect(low.contextHash).not.toBe(adaptive.contextHash);
    expect(low.artifactHash).toBe(adaptive.artifactHash);
    expect(() => compareCalldataLabPoints(adaptive.point, [low.point])).toThrow();
    expect(() => calldataLabContext("unknown" as never)).toThrow();
  }, 30_000);

  it("rejects every published empty, short, truncated, and invalid-index payload in the EVM", async () => {
    for (const corpus of adaptive.context.malformedCorpus) {
      for (const test of corpus.cases) {
        const execution = await executeCalldataDecoder(corpus.codecId, test.encoded);
        expect(execution.exceptionError, corpus.codecId + "/" + test.id).toBeDefined();
      }
    }
    expect(adaptive.malformedInputRejected).toBe(true);
  }, 30_000);

  it("does not put a failed correctness point on the frontier even with zero gas", () => {
    const failed = { ...adaptive.point, correctness: false, calldataGas: 0, decodeExecutionGas: 0 };
    expect(
      compareCalldataLabPoints(
        failed,
        adaptive.baselines.map(({ point }) => point),
      ),
    ).toEqual({ frontier: false, dominatedBy: [], improvesOver: [] });
  });

  it("preserves Pareto evidence under comparison submission permutations", () => {
    const points = adaptive.baselines.map(({ point }) => point);
    expect(compareCalldataLabPoints(adaptive.point, [...points].reverse())).toEqual(
      adaptive.pareto,
    );
    expect(compareCalldataLabPoints(adaptive.point, [points[2]!, points[0]!, points[1]!])).toEqual(
      adaptive.pareto,
    );
    expect(() => compareCalldataLabPoints(adaptive.point, [...points, points[0]!])).toThrow(
      "unique",
    );
    expect(() => compareCalldataLabPoints({ ...adaptive.point, calldataGas: NaN }, points)).toThrow(
      "integers",
    );
    expect(() =>
      compareCalldataLabPoints({ ...adaptive.point, decodeExecutionGas: -1 }, points),
    ).toThrow("integers");
  });

  it("returned evidence is an isolated snapshot that cannot alter future runs", async () => {
    const snapshot = await evaluateCalldataRules(calldataRulePresets.adaptive);
    snapshot.artifact.rules[0]!.minReusePercent = 0;
    snapshot.baselines[0]!.artifact.fallbackCodec = "dictionary";
    (snapshot.context.compiler as { optimizerRuns: number }).optimizerRuns = 1;
    (snapshot.context.axes[0] as { upperBound: number }).upperBound = 1;
    snapshot.context.batches[0]!.actions[0]!.amount = "0";
    snapshot.context.malformedCorpus[0]!.cases[0]!.encoded = "0x01";
    snapshot.batchEvidence[0]!.actions[0]!.amount = "0";
    expect(await evaluateCalldataRules(calldataRulePresets.adaptive)).toEqual(adaptive);
  }, 30_000);

  it.each([
    null,
    { ...calldataRulePresets.adaptive, source: "untrusted source" },
    { ...calldataRulePresets.adaptive, fallbackCodec: "custom" },
    { ...calldataRulePresets.adaptive, schemaVersion: "2" },
    {
      ...calldataRulePresets.adaptive,
      rules: Array(5).fill(calldataRulePresets.adaptive.rules[0]),
    },
    {
      ...calldataRulePresets.adaptive,
      rules: [{ ...calldataRulePresets.adaptive.rules[0], minReusePercent: 101 }],
    },
    {
      ...calldataRulePresets.adaptive,
      rules: [{ ...calldataRulePresets.adaptive.rules[0], minReusePercent: 0.5 }],
    },
    {
      ...calldataRulePresets.adaptive,
      rules: [{ ...calldataRulePresets.adaptive.rules[0], minActions: 0 }],
    },
    {
      ...calldataRulePresets.adaptive,
      rules: [{ ...calldataRulePresets.adaptive.rules[0], maxActions: 3 }],
    },
    {
      ...calldataRulePresets.adaptive,
      rules: [{ ...calldataRulePresets.adaptive.rules[0], codecId: "custom" }],
    },
  ])("strictly rejects invalid artifacts %#", (artifact) => {
    expect(() => parseCalldataRuleArtifact(artifact)).toThrow();
  });

  it("requires the bounded request shape and an explicit known context", () => {
    expect(
      parseCalldataLabRequest({
        artifact: calldataRulePresets.adaptive,
        contextId: "public-transfer-mix",
      }).contextId,
    ).toBe("public-transfer-mix");
    expect(() => parseCalldataLabRequest({ artifact: calldataRulePresets.adaptive })).toThrow();
    expect(() =>
      parseCalldataLabRequest({ artifact: calldataRulePresets.adaptive, contextId: "unknown" }),
    ).toThrow();
    expect(() =>
      parseCalldataLabRequest({
        artifact: calldataRulePresets.adaptive,
        contextId: "public-transfer-mix",
        source: "x",
      }),
    ).toThrow();
  });

  it("preserves the preexisting reference evaluator context and all three result hashes", async () => {
    const expectedHashes = {
      abi: "0x46381d1db2ebeea6f4c6b929e9f6a92ad2a447f152fc78b81faa38f12dfe30b9",
      packed: "0xc9e5259b96c9a2db3361fd4538864c4189b0e0f8f0ae290e94948ff907899786",
      dictionary: "0x4d0120296cdc43702cfbb634494a5884162b7f072486b3ec3c61e36efccadb20",
    };
    for (const codecId of ["abi", "packed", "dictionary"] as const) {
      const result = await evaluateCalldataCodec(codecId);
      expect(result.contextHash).toBe(
        "0xd034e950a85565b20c2f1c6c74c90e92a5da9969606d0426329401884b11ceb3",
      );
      expect(result.resultHash).toBe(expectedHashes[codecId]);
    }
  }, 30_000);
});
