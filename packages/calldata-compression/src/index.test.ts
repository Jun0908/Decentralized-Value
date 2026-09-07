import { describe, expect, it } from "vitest";
import {
  calldataCompressionContextHash,
  evaluateCalldataCodec,
  measureCalldataGas,
  measureCodecPoints,
} from "./index";

describe("calldata compression evaluator", () => {
  it("applies EIP-2028 byte pricing exactly", () => {
    expect(measureCalldataGas("0x00010200")).toEqual({
      encodedBytes: 4,
      zeroBytes: 2,
      nonZeroBytes: 2,
      calldataGas: 40,
    });
  });

  it("executes every decoder in a Cancun EVM and reproduces the reference digest", async () => {
    for (const codecId of ["abi", "packed", "dictionary"] as const) {
      const result = await evaluateCalldataCodec(codecId);
      expect(result.correctness).toBe(true);
      expect(result.malformedInputRejected).toBe(true);
      expect(result.batchEvidence).toHaveLength(3);
      expect(result.batchEvidence.every((batch) => batch.correctness)).toBe(true);
      expect(result.decodeExecutionGas).toBeGreaterThan(0);
    }
  }, 30_000);

  it("produces stable measurements and hashes", async () => {
    const first = await evaluateCalldataCodec("dictionary");
    const second = await evaluateCalldataCodec("dictionary");
    expect(second).toEqual(first);
    expect(first.contextHash).toBe(calldataCompressionContextHash);
    expect(first.resultHash).toMatch(/^0x[0-9a-f]{64}$/);
  }, 30_000);

  it("keeps at least two independently useful frontier points", async () => {
    const points = await measureCodecPoints();
    const results = await Promise.all(points.map((point) => evaluateCalldataCodec(point.id)));
    expect(results.filter((result) => result.pareto.frontier).length).toBeGreaterThanOrEqual(2);
  }, 30_000);
});
