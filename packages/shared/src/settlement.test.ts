import { describe, expect, it } from "vitest";
import { allocateContributionRewards, type RewardCandidate } from "./settlement";

const candidate = (
  participantId: string,
  contribution: number,
  overrides: Partial<RewardCandidate> = {},
): RewardCandidate => ({
  participantId,
  wallet: "0x1111111111111111111111111111111111111111",
  correctness: true,
  baseline: false,
  exclusiveContributionPpm: contribution,
  reproducibilityFactorPpm: 1_000_000,
  evidenceFactorPpm: 1_000_000,
  ...overrides,
});

describe("contribution reward allocation", () => {
  it("allocates the exact pool independent of input order", () => {
    const inputs = [candidate("a", 250_000), candidate("b", 750_000)];
    const first = allocateContributionRewards(1_000n, inputs);
    const reversed = allocateContributionRewards(1_000n, [...inputs].reverse());
    expect(first.find(({ participantId }) => participantId === "a")?.amount).toBe(250n);
    expect(first.find(({ participantId }) => participantId === "b")?.amount).toBe(750n);
    expect(
      reversed
        .map(({ participantId, amount }) => [participantId, amount])
        .sort(([left], [right]) => String(left).localeCompare(String(right))),
    ).toEqual(
      first
        .map(({ participantId, amount }) => [participantId, amount])
        .sort(([left], [right]) => String(left).localeCompare(String(right))),
    );
  });

  it("excludes invalid and baseline artifacts", () => {
    const rewards = allocateContributionRewards(99n, [
      candidate("invalid", 900_000, { correctness: false }),
      candidate("baseline", 900_000, { baseline: true }),
      candidate("eligible", 100_000),
    ]);
    expect(rewards.find(({ participantId }) => participantId === "eligible")?.amount).toBe(99n);
    expect(rewards.find(({ participantId }) => participantId === "invalid")?.amount).toBe(0n);
  });

  it("does not allocate when nobody has positive contribution", () => {
    expect(allocateContributionRewards(100n, [candidate("a", 0)])[0]?.amount).toBe(0n);
  });
});
