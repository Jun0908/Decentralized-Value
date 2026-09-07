import { describe, expect, it } from "vitest";
import { evaluateMicrogridDispatch, microgridManifest, microgridMetrics } from "./index";

describe("microgrid dispatch adapter", () => {
  it("measures all three axes with a deterministic hash", () => {
    const input = { solar: 25, wind: 25, grid: 25, battery: 25 };
    const first = evaluateMicrogridDispatch(input);
    expect(first).toEqual(evaluateMicrogridDispatch({ ...input }));
    expect(first.correctness).toBe(true);
    expect(first.worstCaseEnergy).toBe(75);
    expect(first.resultHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(microgridManifest.metrics).toHaveLength(3);
    expect(microgridMetrics).toHaveLength(3);
  });

  it("rejects capacity violations before frontier comparison", () => {
    const result = evaluateMicrogridDispatch({ solar: 100, wind: 0, grid: 0, battery: 0 });
    expect(result.correctness).toBe(false);
    expect(result.pareto.frontier).toBe(false);
    expect(result.contribution.frontierExpansionPpm).toBe(0);
  });
});
