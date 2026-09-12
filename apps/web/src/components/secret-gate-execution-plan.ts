import { proofExecutionStrategySchema, type ProofExecutionStrategy } from "@frontier/secret-gate";

/** Structural allocation only. No predicted duration, memory, score or cryptographic shortcut. */
export function describeSecretGateExecution(input: ProofExecutionStrategy) {
  const strategy = proofExecutionStrategySchema.parse(input);
  return {
    proofCount: 4,
    concurrentSlots: strategy.maxParallelProofs,
    workerCreations: strategy.workerLifecycle === "reuse" ? strategy.maxParallelProofs : 4,
    initialProofs: Array.from({ length: strategy.maxParallelProofs }, (_, i) => i + 1),
    queuedProofs: Array.from(
      { length: 4 - strategy.maxParallelProofs },
      (_, i) => i + 1 + strategy.maxParallelProofs,
    ),
    artifactExplanation:
      strategy.artifactLoad === "eager"
        ? "Fetch both proof files before dispatch. This preparation is included in the batch timer; browser caching may help or may not."
        : "Let the proof engine request its files when needed. First use can include loading time; this does not clear the browser cache.",
    workerExplanation:
      strategy.workerLifecycle === "reuse"
        ? "Keep one Worker per slot for this batch, then terminate it. Reuse can avoid setup work but keeps each Worker alive longer."
        : "Create and terminate a Worker for every proof. This releases the Worker after use but repeats setup work.",
  };
}

export function secretGateNearestRankP95(values: number[]) {
  if (!values.length || values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("Expected nonnegative finite completion observations");
  }
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1]!;
}
