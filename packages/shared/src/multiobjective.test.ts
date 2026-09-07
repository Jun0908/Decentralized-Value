import { describe, expect, it } from "vitest";
import {
  computeContributionEvidence,
  computeHypervolume2d,
  computeHypervolume,
  computeOutcomeFrontier,
  dominatesOutcome,
  normalizeOutcomeValue,
  type OutcomeMetric,
  type OutcomePoint,
} from "./multiobjective";

const metrics = [
  {
    key: "cost",
    name: "Cost",
    direction: "MINIMIZE",
    unit: "USD",
    lowerBound: 0,
    upperBound: 100,
  },
  {
    key: "resilience",
    name: "Resilience",
    direction: "MAXIMIZE",
    unit: "kits",
    lowerBound: 0,
    upperBound: 100,
  },
] as const satisfies readonly OutcomeMetric[];

const point = (id: string, cost: number, resilience: number): OutcomePoint => ({
  id,
  name: id,
  correctness: true,
  baseline: true,
  values: { cost, resilience },
});

describe("multi-objective evaluation", () => {
  it("normalizes both metric directions against fixed bounds", () => {
    expect(normalizeOutcomeValue(25, metrics[0])).toBe(750_000);
    expect(normalizeOutcomeValue(25, metrics[1])).toBe(250_000);
    expect(normalizeOutcomeValue(-10, metrics[1])).toBe(0);
    expect(normalizeOutcomeValue(120, metrics[1])).toBe(1_000_000);
  });

  it("keeps tradeoffs and rejects dominated or invalid points", () => {
    const a = point("a", 20, 60);
    const b = point("b", 40, 90);
    const c = point("c", 50, 50);
    const invalid = { ...point("invalid", 1, 100), correctness: false };
    expect(dominatesOutcome(a, c, metrics)).toBe(true);
    expect(computeOutcomeFrontier([c, invalid, b, a], metrics).map(({ id }) => id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("computes a hand-checkable 2D hypervolume", () => {
    // normalized rectangles: (0.8, 0.6) and (0.6, 0.9)
    // union = 0.8*0.6 + 0.6*0.9 - 0.6*0.6 = 0.66
    expect(computeHypervolume2d([point("a", 20, 60), point("b", 40, 90)], metrics)).toBe(660_000);
  });

  it("computes n-dimensional hypervolume without changing Pareto semantics", () => {
    const threeMetrics = [
      ...metrics,
      {
        key: "carbon",
        name: "Carbon",
        direction: "MINIMIZE",
        unit: "kg",
        lowerBound: 0,
        upperBound: 100,
      },
    ] as const satisfies readonly OutcomeMetric[];
    const candidate: OutcomePoint = {
      id: "3d",
      name: "3D",
      correctness: true,
      baseline: false,
      values: { cost: 50, resilience: 50, carbon: 50 },
    };
    expect(computeHypervolume([candidate], threeMetrics)).toBe(125_000);
  });

  it("is input-order independent and gives no contribution to dominated points", () => {
    const baseline = [point("a", 20, 60), point("b", 40, 90)];
    const candidate = { ...point("candidate", 10, 80), baseline: false };
    expect(computeContributionEvidence(baseline, candidate, metrics)).toEqual(
      computeContributionEvidence([...baseline].reverse(), candidate, metrics),
    );
    expect(
      computeContributionEvidence(baseline, { ...point("bad", 80, 10), baseline: false }, metrics)
        .frontierExpansionPpm,
    ).toBe(0);
  });
});
