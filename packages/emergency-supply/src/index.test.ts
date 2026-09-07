import { describe, expect, it } from "vitest";
import {
  emergencySupplyBaselinePoints,
  emergencySupplyContextHash,
  emergencySupplyScenario,
  evaluateSupplyAllocation,
} from "./index";

describe("Emergency Supply Allocation evaluator", () => {
  it("measures every single failure and exposes the shared-route risk", () => {
    const cheapest = emergencySupplyScenario.strategies[0]!;
    const result = evaluateSupplyAllocation(cheapest.allocation);

    expect(result.correctness).toBe(true);
    expect(result.totalProcurementCost).toBe(38_500);
    expect(result.worstCaseDeliveredKits).toBe(0);
    expect(result.failureOutcomes).toHaveLength(9);
    expect(
      result.failureOutcomes.find((outcome) => outcome.scenarioId === "route-seaport-east"),
    ).toMatchObject({ deliveredKits: 0, lostKits: 1_000 });
  });

  it("keeps cost and resilience tradeoffs on the baseline frontier", () => {
    expect(emergencySupplyBaselinePoints).toEqual([
      expect.objectContaining({ totalProcurementCost: 38_500, worstCaseDeliveredKits: 0 }),
      expect.objectContaining({ totalProcurementCost: 48_500, worstCaseDeliveredKits: 500 }),
      expect.objectContaining({ totalProcurementCost: 57_500, worstCaseDeliveredKits: 750 }),
    ]);
  });

  it("fails allocations that do not meet the shared constraints", () => {
    const result = evaluateSupplyAllocation({
      "harbor-aid": 900,
      northstar: 0,
      "inland-works": 0,
      "local-grid": 0,
      airbridge: 0,
    });

    expect(result.correctness).toBe(false);
    expect(result.pareto.frontier).toBe(false);
    expect(result.constraintFailures).toEqual(
      expect.arrayContaining([
        expect.stringContaining("capacity"),
        expect.stringContaining("exactly 1000"),
      ]),
    );
  });

  it("returns the same hashes for the same input and data version", () => {
    const allocation = emergencySupplyScenario.strategies[1]!.allocation;
    const first = evaluateSupplyAllocation(allocation);
    const second = evaluateSupplyAllocation({ ...allocation });

    expect(first.contextHash).toBe(emergencySupplyContextHash);
    expect(first.resultHash).toBe(second.resultHash);
    expect(first.failureOutcomes).toEqual(second.failureOutcomes);
  });
});
