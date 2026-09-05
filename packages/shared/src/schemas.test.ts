import { describe, expect, it } from "vitest";
import {
  benchmarkRecordSchema,
  computeOutcomeResultHash,
  hashOutcomeAttestation,
  outcomeAttestationSchema,
  stringifyProtocolJson,
} from "./schemas";

const base = {
  challengeId: `0x${"11".repeat(32)}`,
  artifactId: `0x${"22".repeat(32)}`,
  artifactHash: `0x${"33".repeat(32)}`,
  contextHash: `0x${"44".repeat(32)}`,
  constraintResultHash: `0x${"55".repeat(32)}`,
  constraintSpecHash: `0x${"66".repeat(32)}`,
  gasPerOrder: 48_321n,
  parallelThroughput: 400n,
  runnerEnsName: "runner.frontier.eth",
  runnerAddress: "0x000000000000000000000000000000000000aaaa",
  issuedAt: 1_800_000_000n,
} as const;

describe("protocol schemas and canonical encoding", () => {
  it("has a stable result hash and EIP-712 digest test vector", () => {
    const resultHash = computeOutcomeResultHash(base);
    const attestation = outcomeAttestationSchema.parse({ ...base, resultHash });
    const digest = hashOutcomeAttestation(attestation, {
      chainId: 11_155_111,
      verifyingContract: "0x0000000000000000000000000000000000001234",
    });

    expect(resultHash).toBe("0x6f957da2559b9e72d99bf5b83b91822fe4a87b40c3c857ad3cf3e7a1d8e50677");
    expect(digest).toBe("0x68f8a123a46beacf10a3e88092166d4c15fe76c64616f2c284abc7742e925f1b");
  });

  it("serializes bigint as unsigned decimal strings at JSON boundaries", () => {
    expect(stringifyProtocolJson({ gasPerOrder: 7n })).toBe('{"gasPerOrder":"7"}');
    expect(() => benchmarkRecordSchema.parse({})).toThrow();
  });

  it("rejects malformed bytes32 and addresses", () => {
    expect(() =>
      outcomeAttestationSchema.parse({ ...base, artifactHash: "0x01", resultHash: "0x02" }),
    ).toThrow();
  });
});
