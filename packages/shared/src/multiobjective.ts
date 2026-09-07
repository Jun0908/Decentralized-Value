import { z } from "zod";

export const NORMALIZED_SCALE = 1_000_000;

export const outcomeMetricSchema = z
  .object({
    key: z.string().min(1),
    name: z.string().min(1),
    direction: z.enum(["MINIMIZE", "MAXIMIZE"]),
    unit: z.string().min(1),
    lowerBound: z.number().finite(),
    upperBound: z.number().finite(),
  })
  .refine((metric) => metric.upperBound > metric.lowerBound, {
    message: "upperBound must be greater than lowerBound",
    path: ["upperBound"],
  });

export const outcomePointSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  correctness: z.boolean(),
  baseline: z.boolean().default(false),
  values: z.record(z.string(), z.number().finite()),
});

export type OutcomeMetric = z.infer<typeof outcomeMetricSchema>;
export type OutcomePoint = z.infer<typeof outcomePointSchema>;

export type ContributionEvidence = {
  hypervolumeBeforePpm: number;
  hypervolumeAfterPpm: number;
  frontierExpansionPpm: number;
  exclusiveContributionPpm: number;
  contributionSharePpm: number;
};

function assertMetrics(metrics: readonly OutcomeMetric[]): void {
  if (metrics.length === 0) throw new Error("At least one metric is required");
  const keys = new Set<string>();
  for (const metric of metrics) {
    outcomeMetricSchema.parse(metric);
    if (keys.has(metric.key)) throw new Error(`Duplicate metric key: ${metric.key}`);
    keys.add(metric.key);
  }
}

function assertPoints(points: readonly OutcomePoint[], metrics: readonly OutcomeMetric[]): void {
  const ids = new Set<string>();
  for (const point of points) {
    outcomePointSchema.parse(point);
    if (ids.has(point.id)) throw new Error(`Duplicate outcome point: ${point.id}`);
    ids.add(point.id);
    for (const metric of metrics) {
      if (point.values[metric.key] === undefined) {
        throw new Error(`Point ${point.id} is missing metric ${metric.key}`);
      }
    }
  }
}

export function normalizeOutcomeValue(value: number, metric: OutcomeMetric): number {
  outcomeMetricSchema.parse(metric);
  const clamped = Math.min(metric.upperBound, Math.max(metric.lowerBound, value));
  const ratio =
    metric.direction === "MAXIMIZE"
      ? (clamped - metric.lowerBound) / (metric.upperBound - metric.lowerBound)
      : (metric.upperBound - clamped) / (metric.upperBound - metric.lowerBound);
  return Math.round(ratio * NORMALIZED_SCALE);
}

export function dominatesOutcome(
  left: OutcomePoint,
  right: OutcomePoint,
  metrics: readonly OutcomeMetric[],
): boolean {
  if (!left.correctness) return false;
  if (!right.correctness) return true;
  let strictlyBetter = false;
  for (const metric of metrics) {
    const leftValue = left.values[metric.key]!;
    const rightValue = right.values[metric.key]!;
    const noWorse =
      metric.direction === "MINIMIZE" ? leftValue <= rightValue : leftValue >= rightValue;
    if (!noWorse) return false;
    if (leftValue !== rightValue) strictlyBetter = true;
  }
  return strictlyBetter;
}

export function computeOutcomeFrontier(
  points: readonly OutcomePoint[],
  metrics: readonly OutcomeMetric[],
): OutcomePoint[] {
  assertMetrics(metrics);
  assertPoints(points, metrics);
  return [...points]
    .filter(
      (candidate) =>
        candidate.correctness &&
        !points.some(
          (other) => other.id !== candidate.id && dominatesOutcome(other, candidate, metrics),
        ),
    )
    .sort((left, right) => left.id.localeCompare(right.id));
}

/**
 * Exact two-dimensional union of the rectangles between a fixed worst-case
 * reference point (0, 0) and every normalized frontier point. The result is
 * parts-per-million of the complete normalized outcome square.
 */
export function computeHypervolume2d(
  points: readonly OutcomePoint[],
  metrics: readonly OutcomeMetric[],
): number {
  if (metrics.length !== 2) throw new Error("2D hypervolume requires exactly two metrics");
  const frontier = computeOutcomeFrontier(points, metrics);
  const normalized = frontier
    .map((point) => ({
      x: normalizeOutcomeValue(point.values[metrics[0]!.key]!, metrics[0]!),
      y: normalizeOutcomeValue(point.values[metrics[1]!.key]!, metrics[1]!),
    }))
    .filter((point) => point.x > 0 && point.y > 0)
    .sort((left, right) => left.x - right.x || right.y - left.y);

  let previousX = 0;
  let area = 0n;
  for (const point of normalized) {
    if (point.x <= previousX) continue;
    let bestY = 0;
    for (const candidate of normalized) {
      if (candidate.x >= point.x && candidate.y > bestY) bestY = candidate.y;
    }
    area += BigInt(point.x - previousX) * BigInt(bestY);
    previousX = point.x;
  }
  return Number(area / BigInt(NORMALIZED_SCALE));
}

export function computeContributionEvidence(
  baselinePoints: readonly OutcomePoint[],
  candidate: OutcomePoint,
  metrics: readonly OutcomeMetric[],
): ContributionEvidence {
  const before = computeHypervolume2d(baselinePoints, metrics);
  const complete = [...baselinePoints, candidate];
  const after = computeHypervolume2d(complete, metrics);
  const withoutCandidate = computeHypervolume2d(
    complete.filter((point) => point.id !== candidate.id),
    metrics,
  );
  const expansion = Math.max(0, after - before);
  const exclusive = candidate.correctness ? Math.max(0, after - withoutCandidate) : 0;
  return {
    hypervolumeBeforePpm: before,
    hypervolumeAfterPpm: after,
    frontierExpansionPpm: expansion,
    exclusiveContributionPpm: exclusive,
    contributionSharePpm: after === 0 ? 0 : Math.floor((exclusive * NORMALIZED_SCALE) / after),
  };
}
