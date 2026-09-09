import { describe, expect, it } from "vitest";
import {
  benchmarkStrategies,
  defaultDisasterResponseStrategy,
  disasterResponseContextHash,
  evaluateDisasterResponseStrategy,
} from "./index";

describe("72-Hour Disaster Response evaluator", () => {
  it("evaluates a valid JSON strategy across training and committed final scenarios", () => {
    const result = evaluateDisasterResponseStrategy(defaultDisasterResponseStrategy);
    expect(result.correctness).toBe(true);
    expect(result.scenarioOutcomes).toHaveLength(7);
    expect(result.worstCaseDeliveredKits).toBeGreaterThan(0);
    expect(result.regionalFairnessPpm).toBeGreaterThanOrEqual(0);
    expect(result.contextHash).toBe(disasterResponseContextHash);
  });

  it("is deterministic for the same strategy", () => {
    const first = evaluateDisasterResponseStrategy(defaultDisasterResponseStrategy);
    const second = evaluateDisasterResponseStrategy(defaultDisasterResponseStrategy);
    expect(second.resultHash).toBe(first.resultHash);
    expect(second.scenarioOutcomes).toEqual(first.scenarioOutcomes);
  });

  it("returns an exact replay trace without changing the committed result hash", () => {
    const result = evaluateDisasterResponseStrategy(defaultDisasterResponseStrategy);
    const portFailure = result.scenarioOutcomes.find(
      ({ scenarioId }) => scenarioId === "training-port",
    )!;
    const initial = portFailure.replayTrace.shipments.filter(({ phase }) => phase !== "RECOVERY");
    const recovery = portFailure.replayTrace.shipments.filter(({ phase }) => phase === "RECOVERY");

    expect(initial.map(({ supplierId, phase, kits }) => ({ supplierId, phase, kits }))).toEqual([
      { supplierId: "harbor-aid", phase: "PRIMARY", kits: 520 },
      { supplierId: "inland-works", phase: "PRIMARY", kits: 260 },
      { supplierId: "airbridge", phase: "RESERVE", kits: 220 },
    ]);
    expect(
      initial
        .filter(({ status }) => status === "LOST")
        .map(({ supplierId, kits }) => ({
          supplierId,
          kits,
        })),
    ).toEqual([{ supplierId: "harbor-aid", kits: 520 }]);
    expect(recovery.map(({ supplierId, kits }) => ({ supplierId, kits }))).toEqual([
      { supplierId: "airbridge", kits: 40 },
      { supplierId: "local-grid", kits: 230 },
    ]);
    expect(portFailure.replayTrace.recoverySpentUsd).toBe(18_000);
    expect(portFailure.replayTrace.deliveries.reduce((sum, { kits }) => sum + kits, 0)).toBe(
      portFailure.deliveredKits,
    );
    expect(result.resultHash).toBe(
      "0xb27f182924df4a304e4d5d25fe1dfa55e9fdfcc2c52c1823811aa141867e71db",
    );
  });

  it("rejects malformed supplier priorities", () => {
    const result = evaluateDisasterResponseStrategy({
      ...defaultDisasterResponseStrategy,
      primarySupplierOrder: ["harbor-aid", "harbor-aid", "inland-works", "local-grid", "airbridge"],
    });
    expect(result.correctness).toBe(false);
    expect(result.constraintFailures.join(" ")).toMatch(/every supplier exactly once/i);
  });

  it("produces distinct outcome tradeoffs for benchmark strategies", () => {
    const outcomes = benchmarkStrategies.map(({ strategy }) =>
      evaluateDisasterResponseStrategy(strategy),
    );
    expect(new Set(outcomes.map(({ resultHash }) => resultHash)).size).toBe(3);
    expect(
      new Set(outcomes.map(({ totalProcurementCost }) => totalProcurementCost)).size,
    ).toBeGreaterThan(1);
  });
});
