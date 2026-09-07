import { describe, expect, it } from "vitest";
import { hashChallengeManifest, parseChallengeManifest } from "./manifest";

const hash = `0x${"11".repeat(32)}` as const;
const base = {
  schemaVersion: "2",
  id: "example-v1",
  slug: "example",
  name: "Example",
  lifecycle: "PRACTICE",
  sponsor: { name: "Demo", wallet: null, statement: "A transparent practice sponsor." },
  valueTension: "Cost against resilience",
  artifactType: "example-v1",
  hardConstraints: ["correctness=true"],
  metrics: [
    {
      key: "cost",
      name: "Cost",
      direction: "MINIMIZE",
      unit: "USD",
      lowerBound: 0,
      upperBound: 100,
    },
    {
      key: "quality",
      name: "Quality",
      direction: "MAXIMIZE",
      unit: "points",
      lowerBound: 0,
      upperBound: 100,
    },
  ],
  contexts: [
    {
      id: "public",
      version: "1",
      name: "Public",
      description: "Public fixture",
      datasetHash: hash,
      constraintHash: hash,
      evidenceLevel: 0,
    },
  ],
  activeContextId: "public",
  workload: { publicHash: hash, finalCommitment: null },
  submission: {
    methods: ["INLINE"],
    sourceVisibility: "PUBLIC",
    opensAt: null,
    closesAt: null,
    maxRevisions: 20,
  },
  reviewEndsAt: null,
  reward: { kind: "PREVIEW", poolCredits: 10_000 },
} as const;

describe("ChallengeManifestV2", () => {
  it("hashes canonical content independent of object key order", () => {
    const parsed = parseChallengeManifest(base);
    expect(hashChallengeManifest(parsed)).toMatch(/^0x[0-9a-f]{64}$/);
    expect(hashChallengeManifest(parsed)).toBe(hashChallengeManifest({ ...parsed }));
  });

  it("prevents an unfunded practice configuration from claiming to be open", () => {
    expect(() => parseChallengeManifest({ ...base, lifecycle: "OPEN" })).toThrow(/funded reward/);
  });

  it("requires a declared active context", () => {
    expect(() => parseChallengeManifest({ ...base, activeContextId: "missing" })).toThrow(
      /activeContextId/,
    );
  });
});
