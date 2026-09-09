import {
  benchmarkStrategies,
  defaultDisasterResponseStrategy,
  disasterSuppliers,
  evaluateDisasterResponseStrategy,
} from "@frontier/disaster-response";
import { describe, expect, it } from "vitest";
import {
  describeStrategyChanges,
  metricOrigins,
  nextTradeoffMoves,
  worstScenarioReasons,
} from "./disaster-response-insights";

const supplierNames = Object.fromEntries(disasterSuppliers.map(({ id, name }) => [id, name]));

describe("Disaster Response explanations", () => {
  it("explains every strategy lever that changed", () => {
    const next = benchmarkStrategies[0]!.strategy;
    const changes = describeStrategyChanges(defaultDisasterResponseStrategy, next, supplierNames);

    expect(changes.map(({ key }) => key)).toEqual([
      "emergency-budget",
      "reserve-kits",
      "region-policy",
      "primary-order",
      "recovery-order",
    ]);
    expect(changes[0]!.effect).toMatch(/initial buying/);
  });

  it("ties each headline metric to the scenario that produced it", () => {
    const evaluation = evaluateDisasterResponseStrategy(defaultDisasterResponseStrategy);
    const origins = metricOrigins(evaluation);

    expect(origins).toHaveLength(3);
    expect(origins.find(({ key }) => key === "cost")?.value).toBe(evaluation.totalProcurementCost);
    expect(origins.find(({ key }) => key === "delivery")?.value).toBe(
      evaluation.worstCaseDeliveredKits,
    );
    expect(origins.find(({ key }) => key === "fairness")?.value).toBe(
      evaluation.regionalFairnessPpm,
    );
  });

  it("derives scenario causes and suggestions from measured evidence", () => {
    const evaluation = evaluateDisasterResponseStrategy(defaultDisasterResponseStrategy);
    const explanation = worstScenarioReasons(evaluation);

    expect(explanation.reasons).toHaveLength(3);
    expect(explanation.reasons.join(" ")).toMatch(/520 kits were lost/);
    expect(nextTradeoffMoves(evaluation).length).toBeGreaterThan(0);
  });
});
