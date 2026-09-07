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
  return computeHypervolume(points, metrics);
}

/**
 * Deterministic exact hypervolume for small n-dimensional frontiers. It walks
 * the coordinate cells induced by frontier points, so it is intended for
 * settlement-sized frontiers rather than unbounded analytics datasets.
 */
export function computeHypervolume(
  points: readonly OutcomePoint[],
  metrics: readonly OutcomeMetric[],
): number {
  if (metrics.length > 6) throw new Error("Hypervolume supports at most six metrics");
  const frontier = computeOutcomeFrontier(points, metrics);
  const normalized = frontier.map((point) =>
    metrics.map((metric) => normalizeOutcomeValue(point.values[metric.key]!, metric)),
  );
  const coordinates = metrics.map((_, axis) =>
    [...new Set([0, ...normalized.map((point) => point[axis]!)])].sort(
      (left, right) => left - right,
    ),
  );
  let volume = 0n;

  function visit(axis: number, upper: number[], cellVolume: bigint) {
    if (axis === metrics.length) {
      const covered = normalized.some((point) =>
        point.every((coordinate, index) => coordinate >= upper[index]!),
      );
      if (covered) volume += cellVolume;
      return;
    }
    const values = coordinates[axis]!;
    for (let index = 1; index < values.length; index += 1) {
      const lower = values[index - 1]!;
      const nextUpper = values[index]!;
      visit(axis + 1, [...upper, nextUpper], cellVolume * BigInt(nextUpper - lower));
    }
  }

  visit(0, [], 1n);
  return Number(volume / BigInt(NORMALIZED_SCALE) ** BigInt(metrics.length - 1));
}

export function computeContributionEvidence(
  baselinePoints: readonly OutcomePoint[],
  candidate: OutcomePoint,
  metrics: readonly OutcomeMetric[],
): ContributionEvidence {
  const before = computeHypervolume(baselinePoints, metrics);
  const complete = [...baselinePoints, candidate];
  const after = computeHypervolume(complete, metrics);
  const withoutCandidate = computeHypervolume(
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
