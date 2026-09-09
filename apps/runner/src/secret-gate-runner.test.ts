import { describe, expect, it } from "vitest";
import { assessSecretGateFeasibility, type SecretGateFeasibilityTrial } from "./secret-gate-runner";

function trial(
  strategyId: string,
  p95LatencyMs: number,
  peakIncrementalMemoryMb: number,
): SecretGateFeasibilityTrial {
  return {
    strategyId,
    maxParallelProofs: strategyId === "fast" ? 4 : 1,
    workerLifecycle: "reuse",
    artifactLoad: "on-demand",
    p95LatencyMs,
    baselineRssBytes: 100_000_000,
    peakRssBytes: 100_000_000 + Math.round(peakIncrementalMemoryMb * 1024 * 1024),
    peakIncrementalMemoryMb,
    proofCount: 4,
    allProofsVerified: true,
  };
}

describe("Secret Gate feasibility assessment", () => {
  it("keeps stable independent latency and memory strategies", () => {
    const result = assessSecretGateFeasibility([
      trial("fast", 100, 200),
      trial("lean", 200, 100),
      trial("fast", 102, 198),
      trial("lean", 198, 102),
    ]);
    expect(result.decision).toBe("GO");
    expect(result.frontierStrategyIds).toEqual(["fast", "lean"]);
    expect(result.evidenceHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("pivots when repeated measurements are too noisy", () => {
    const result = assessSecretGateFeasibility([
      trial("fast", 100, 200),
      trial("lean", 200, 100),
      trial("fast", 250, 80),
      trial("lean", 80, 250),
    ]);
    expect(result.decision).toBe("PIVOT");
  });
});
