import { describe, expect, it } from "vitest";
import { baselineProofExecutionStrategy } from "@frontier/secret-gate";
import {
  describeSecretGateExecution,
  secretGateNearestRankP95,
} from "./secret-gate-execution-plan";

describe("Secret Gate structural settings explanation", () => {
  it("accounts for all four proofs in every one of the 16 bounded configurations", () => {
    for (const maxParallelProofs of [1, 2, 3, 4]) {
      for (const workerLifecycle of ["reuse", "per-request"] as const) {
        for (const artifactLoad of ["eager", "on-demand"] as const) {
          const input = {
            ...baselineProofExecutionStrategy,
            maxParallelProofs,
            workerLifecycle,
            artifactLoad,
          };
          const before = structuredClone(input);
          const plan = describeSecretGateExecution(input);
          expect([...plan.initialProofs, ...plan.queuedProofs]).toEqual([1, 2, 3, 4]);
          expect(plan.workerCreations).toBe(workerLifecycle === "reuse" ? maxParallelProofs : 4);
          expect(plan.concurrentSlots).toBe(maxParallelProofs);
          expect(input).toEqual(before);
          expect(plan).not.toHaveProperty("score");
          expect(plan).not.toHaveProperty("predictedLatency");
          expect(plan).not.toHaveProperty("predictedMemory");
        }
      }
    }
  });
  it("does not turn unlimited workers or fake engine threads into working controls", () => {
    expect(() =>
      describeSecretGateExecution({ ...baselineProofExecutionStrategy, maxParallelProofs: 5 }),
    ).toThrow();
    expect(() =>
      describeSecretGateExecution({
        ...baselineProofExecutionStrategy,
        engineThreads: "4" as "sdk-default",
      }),
    ).toThrow();
  });
  it("four-observation p95 is the largest batch completion, without mutating observations", () => {
    const observations = [4300, 1000, 2900, 1700];
    expect(secretGateNearestRankP95(observations)).toBe(4300);
    expect(observations).toEqual([4300, 1000, 2900, 1700]);
    for (const bad of [[], [NaN], [Infinity], [-1]])
      expect(() => secretGateNearestRankP95(bad)).toThrow();
  });
});
