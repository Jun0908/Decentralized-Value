import { describe, expect, it } from "vitest";

import { defaultOceanEntry } from "./entry";
import { evaluateOceanEntry, oceanSubmissionSeeds } from "./submission";

describe("submitted entries", () => {
  it("scores an entry over the published seeds, and repeats exactly", async () => {
    const first = await evaluateOceanEntry(defaultOceanEntry);
    const second = await evaluateOceanEntry(defaultOceanEntry);

    expect(first.correctness).toBe(true);
    expect(first.perSeason).toHaveLength(oceanSubmissionSeeds.length);
    expect(first.resultHash).toMatch(/^0x[0-9a-f]{64}$/);
    // Same entry, same seeds, same hash: whatever separates two submissions is
    // the entry, never the run.
    expect(second.resultHash).toBe(first.resultHash);
  });

  it("lets the wallet policy change the result, not only the sailing dials", async () => {
    const open = await evaluateOceanEntry(defaultOceanEntry);
    const closed = await evaluateOceanEntry({
      ...defaultOceanEntry,
      wallet: { ...defaultOceanEntry.wallet, allowedPurposes: [] },
    });

    // A seat forbidden every contract kind cannot buy restraint at all, so the
    // cooperation axis has to move. If it did not, the wallet would be theatre.
    expect(closed.correctness).toBe(true);
    expect(closed.cooperation).not.toBeCloseTo(open.cooperation, 6);
    expect(closed.resultHash).not.toBe(open.resultHash);
  });

  it("reports every broken bound at once instead of throwing on the first", async () => {
    const broken = await evaluateOceanEntry({
      name: "",
      mission: "",
      wallet: { startingBudget: -1, maxPaymentPerTransaction: 10_000, allowedPurposes: "all" },
      sailing: { effortFraction: 4, reserve: "sometimes", contracts: "lavish" },
    });

    expect(broken.correctness).toBe(false);
    expect(broken.constraintFailures.length).toBeGreaterThan(4);
    expect(broken.perSeason).toHaveLength(0);
    // A rejected entry still hashes, so a submitter has something to quote back.
    expect(broken.resultHash).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
