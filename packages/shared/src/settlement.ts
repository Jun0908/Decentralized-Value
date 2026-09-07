import { NORMALIZED_SCALE } from "./multiobjective";

export type RewardCandidate = {
  participantId: string;
  wallet: string;
  correctness: boolean;
  baseline: boolean;
  exclusiveContributionPpm: number;
  reproducibilityFactorPpm: number;
  evidenceFactorPpm: number;
};

export type ComputedReward = RewardCandidate & {
  eligibleWeight: bigint;
  amount: bigint;
};

export function allocateContributionRewards(
  pool: bigint,
  candidates: readonly RewardCandidate[],
): ComputedReward[] {
  if (pool < 0n) throw new Error("Reward pool cannot be negative");
  const scale = BigInt(NORMALIZED_SCALE);
  const weighted = candidates.map((candidate) => {
    for (const value of [
      candidate.exclusiveContributionPpm,
      candidate.reproducibilityFactorPpm,
      candidate.evidenceFactorPpm,
    ]) {
      if (!Number.isInteger(value) || value < 0 || value > NORMALIZED_SCALE) {
        throw new Error("Reward factors must be integer parts per million");
      }
    }
    const eligibleWeight =
      !candidate.correctness || candidate.baseline
        ? 0n
        : (BigInt(candidate.exclusiveContributionPpm) *
            BigInt(candidate.reproducibilityFactorPpm) *
            BigInt(candidate.evidenceFactorPpm)) /
          (scale * scale);
    return { ...candidate, eligibleWeight, amount: 0n };
  });
  const totalWeight = weighted.reduce((sum, candidate) => sum + candidate.eligibleWeight, 0n);
  if (totalWeight === 0n) return weighted;
  for (const candidate of weighted) {
    candidate.amount = (pool * candidate.eligibleWeight) / totalWeight;
  }
  let remainder = pool - weighted.reduce((sum, candidate) => sum + candidate.amount, 0n);
  const priority = [...weighted]
    .filter(({ eligibleWeight }) => eligibleWeight > 0n)
    .sort((left, right) =>
      left.eligibleWeight === right.eligibleWeight
        ? left.participantId.localeCompare(right.participantId)
        : left.eligibleWeight > right.eligibleWeight
          ? -1
          : 1,
    );
  for (let index = 0; remainder > 0n; index += 1) {
    priority[index % priority.length]!.amount += 1n;
    remainder -= 1n;
  }
  return weighted;
}
