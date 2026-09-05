import { describe, expect, it } from "vitest";
import {
  computeParetoFrontier,
  dominates,
  updateParetoFrontier,
  type FrontierPoint,
} from "./pareto";

const id = (byte: string) => `0x${byte.repeat(64)}` as const;
const point = (
  artifactId: `0x${string}`,
  gasPerOrder: bigint,
  parallelThroughput: bigint,
  correctness = true,
): FrontierPoint => ({ artifactId, gasPerOrder, parallelThroughput, correctness });

describe("Pareto frontier", () => {
  it("requires one strict improvement and treats exact ties as non-dominating", () => {
    const left = point(id("1"), 100n, 10n);
    const tie = point(id("2"), 100n, 10n);
    expect(dominates(left, tie)).toBe(false);
    expect(computeParetoFrontier([left, tie])).toHaveLength(2);
  });

  it("adds a candidate and removes every point it dominates", () => {
    const lowGas = point(id("1"), 80n, 2n);
    const highThroughput = point(id("2"), 120n, 8n);
    const candidate = point(id("3"), 100n, 9n);
    const update = updateParetoFrontier([lowGas, highThroughput], candidate);
    expect(update.added).toBe(true);
    expect(update.removed.map((item) => item.artifactId)).toEqual([highThroughput.artifactId]);
    expect(update.frontier).toHaveLength(2);
  });

  it("excludes incorrect and dominated outcomes and rejects duplicate artifacts", () => {
    const best = point(id("1"), 1n, 10n);
    const dominated = point(id("2"), 2n, 9n);
    const incorrect = point(id("3"), 0n, 99n, false);
    expect(computeParetoFrontier([best, dominated, incorrect])).toEqual([best]);
    expect(() => updateParetoFrontier([best], best)).toThrow(/Duplicate/);
  });

  it("handles zero-valued metric boundaries without arithmetic", () => {
    const zero = point(id("1"), 0n, 0n);
    const throughput = point(id("2"), 1n, 1n);
    expect(computeParetoFrontier([zero, throughput])).toHaveLength(2);
  });
});
