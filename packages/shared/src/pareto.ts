import { z } from "zod";
import { bytes32Schema, unsignedBigIntSchema } from "./schemas";

export const frontierPointSchema = z.object({
  artifactId: bytes32Schema,
  correctness: z.boolean(),
  gasPerOrder: unsignedBigIntSchema,
  parallelThroughput: unsignedBigIntSchema,
});

export type FrontierPoint = z.infer<typeof frontierPointSchema>;

export function dominates(left: FrontierPoint, right: FrontierPoint): boolean {
  if (!left.correctness) return false;
  if (!right.correctness) return true;

  const noWorse =
    left.gasPerOrder <= right.gasPerOrder && left.parallelThroughput >= right.parallelThroughput;
  const strictlyBetter =
    left.gasPerOrder < right.gasPerOrder || left.parallelThroughput > right.parallelThroughput;
  return noWorse && strictlyBetter;
}

export function computeParetoFrontier(points: readonly FrontierPoint[]): FrontierPoint[] {
  const seen = new Set<string>();
  for (const point of points) {
    frontierPointSchema.parse(point);
    if (seen.has(point.artifactId)) {
      throw new Error(`Duplicate artifactId: ${point.artifactId}`);
    }
    seen.add(point.artifactId);
  }

  return points
    .filter(
      (candidate) =>
        candidate.correctness &&
        !points.some((other) => other !== candidate && dominates(other, candidate)),
    )
    .sort((left, right) => {
      if (left.gasPerOrder !== right.gasPerOrder) {
        return left.gasPerOrder < right.gasPerOrder ? -1 : 1;
      }
      if (left.parallelThroughput !== right.parallelThroughput) {
        return left.parallelThroughput > right.parallelThroughput ? -1 : 1;
      }
      return left.artifactId.localeCompare(right.artifactId);
    });
}

export function updateParetoFrontier(
  current: readonly FrontierPoint[],
  candidate: FrontierPoint,
): { frontier: FrontierPoint[]; added: boolean; removed: FrontierPoint[] } {
  if (current.some((point) => point.artifactId === candidate.artifactId)) {
    throw new Error(`Duplicate artifactId: ${candidate.artifactId}`);
  }
  if (!candidate.correctness || current.some((point) => dominates(point, candidate))) {
    return { frontier: [...current], added: false, removed: [] };
  }
  const removed = current.filter((point) => dominates(candidate, point));
  return {
    frontier: computeParetoFrontier([
      ...current.filter((point) => !removed.includes(point)),
      candidate,
    ]),
    added: true,
    removed,
  };
}
