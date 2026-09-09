import { canonicalProtocolJson } from "@frontier/shared";
import { keccak256, stringToHex } from "viem";
import { z } from "zod";

export const secretGateFeasibilityTrialSchema = z
  .object({
    strategyId: z.string().min(1),
    maxParallelProofs: z.number().int().min(1).max(4),
    workerLifecycle: z.enum(["reuse", "per-request"]),
    artifactLoad: z.enum(["eager", "on-demand"]),
    p95LatencyMs: z.number().positive(),
    baselineRssBytes: z.number().int().positive(),
    peakRssBytes: z.number().int().positive(),
    peakIncrementalMemoryMb: z.number().nonnegative(),
    proofCount: z.literal(4),
    allProofsVerified: z.literal(true),
  })
  .strict();

export type SecretGateFeasibilityTrial = z.infer<typeof secretGateFeasibilityTrialSchema>;

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

function coefficientOfVariation(values: number[]) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

export function assessSecretGateFeasibility(input: unknown) {
  const trials = z.array(secretGateFeasibilityTrialSchema).min(2).parse(input);
  const grouped = new Map<string, SecretGateFeasibilityTrial[]>();
  for (const trial of trials) {
    const strategyTrials = grouped.get(trial.strategyId) ?? [];
    strategyTrials.push(trial);
    grouped.set(trial.strategyId, strategyTrials);
  }
  const summaries = [...grouped.entries()]
    .map(([strategyId, strategyTrials]) => ({
      strategyId,
      trialCount: strategyTrials.length,
      maxParallelProofs: strategyTrials[0]!.maxParallelProofs,
      workerLifecycle: strategyTrials[0]!.workerLifecycle,
      artifactLoad: strategyTrials[0]!.artifactLoad,
      medianP95LatencyMs: Math.round(
        median(strategyTrials.map(({ p95LatencyMs }) => p95LatencyMs)),
      ),
      medianPeakIncrementalMemoryMb:
        Math.round(
          median(strategyTrials.map(({ peakIncrementalMemoryMb }) => peakIncrementalMemoryMb)) * 10,
        ) / 10,
      latencyCv:
        Math.round(
          coefficientOfVariation(strategyTrials.map(({ p95LatencyMs }) => p95LatencyMs)) * 1_000,
        ) / 1_000,
      memoryCv:
        Math.round(
          coefficientOfVariation(
            strategyTrials.map(({ peakIncrementalMemoryMb }) => peakIncrementalMemoryMb),
          ) * 1_000,
        ) / 1_000,
    }))
    .sort((left, right) => left.strategyId.localeCompare(right.strategyId));

  const dominates = (left: (typeof summaries)[number], right: (typeof summaries)[number]) => {
    const latencyTolerance = Math.max(25, right.medianP95LatencyMs * 0.05);
    const memoryTolerance = Math.max(5, right.medianPeakIncrementalMemoryMb * 0.05);
    const noWorseLatency = left.medianP95LatencyMs <= right.medianP95LatencyMs + latencyTolerance;
    const noWorseMemory =
      left.medianPeakIncrementalMemoryMb <= right.medianPeakIncrementalMemoryMb + memoryTolerance;
    const meaningfullyBetter =
      left.medianP95LatencyMs < right.medianP95LatencyMs - latencyTolerance ||
      left.medianPeakIncrementalMemoryMb < right.medianPeakIncrementalMemoryMb - memoryTolerance;
    return noWorseLatency && noWorseMemory && meaningfullyBetter;
  };

  const frontier = summaries.filter(
    (candidate) => !summaries.some((other) => other !== candidate && dominates(other, candidate)),
  );
  const stable = summaries.every(
    ({ latencyCv, memoryCv }) => latencyCv <= 0.15 && memoryCv <= 0.15,
  );
  const decision = stable && frontier.length >= 2 ? "GO" : "PIVOT";
  const resultWithoutHash = {
    schemaVersion: "1",
    measurementClass: "controlled-chromium-feasibility",
    decision,
    rationale:
      decision === "GO"
        ? "At least two epsilon-nondominated strategies remained within the variance gate."
        : "The initial trials did not establish a stable multi-point latency-memory frontier.",
    thresholds: {
      latencyTolerance: "max(25 ms, 5%)",
      memoryTolerance: "max(5 MiB, 5%)",
      maximumCoefficientOfVariation: 0.15,
      minimumFrontierPoints: 2,
    },
    summaries,
    frontierStrategyIds: frontier.map(({ strategyId }) => strategyId),
    trials,
  };
  return {
    ...resultWithoutHash,
    evidenceHash: keccak256(stringToHex(canonicalProtocolJson(resultWithoutHash))),
  };
}
