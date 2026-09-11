import { describe, expect, it } from "vitest";
import { evaluateRescuePolicy } from "../../packages/rescue-room/src/index";
import {
  commitRescueSecretPack,
  evaluateRescueSecretPack,
  replayRescueSecretPack,
  RescueSecretPackError,
  revealRescueSecretPack,
  verifyRescueSecretPack,
  type SecretPackRuntime,
} from "./rescue-secret-pack";

// Test salt is intentionally deterministic, never an operational secret.
const salt = `0x${"ab".repeat(32)}`;
const seeds = ["PRIVATE_PACK_ALPHA", "PRIVATE_PACK_BETA", "PRIVATE_PACK_GAMMA"];
const runtime: SecretPackRuntime = { codeHash: `0x${"12".repeat(32)}` };
const input = { salt, seeds, policyId: "simple-adaptive" };
const committed = () => commitRescueSecretPack(JSON.stringify(input), runtime);
const code = "RESCUE_SECRET_PACK_VERIFICATION_FAILED";

describe("nonproduction local Rescue secret pack", () => {
  it("commits, verifies, evaluates, explicitly reveals and replays existing evaluator output", () => {
    const { commitment, privatePackJson } = committed();
    expect(verifyRescueSecretPack(commitment, privatePackJson, runtime)).toBe(true);
    const receipt = evaluateRescueSecretPack(commitment, privatePackJson, runtime);
    const receiptJson = JSON.stringify(receipt);
    const revealJson = revealRescueSecretPack(receiptJson, privatePackJson, runtime);
    const replay = replayRescueSecretPack(receiptJson, revealJson, runtime);
    expect(replay.evaluation).toEqual(evaluateRescuePolicy("simple-adaptive", seeds));
    expect(replay.verified).toBe(true);
    expect(replay.boundary).toMatchObject({
      creVerified: false,
      teeVerified: false,
      finalComplete: false,
      rewardEligible: false,
    });
    expect(JSON.parse(revealJson).pack.salt).toBe(salt);
  });

  it("reproduces commitments/results, regardless of JSON object key order", () => {
    const first = committed();
    const second = commitRescueSecretPack(
      JSON.stringify({ policyId: input.policyId, seeds, salt }),
      runtime,
    );
    expect(first).toEqual(second);
    expect(evaluateRescueSecretPack(first.commitment, first.privatePackJson, runtime)).toEqual(
      evaluateRescueSecretPack(second.commitment, second.privatePackJson, runtime),
    );
  });

  it.each([
    "pack",
    "order",
    "salt",
    "context",
    "artifact",
    "generator",
    "metric",
    "catalog",
    "extra",
  ])("rejects %s tampering against retained commitment", (kind) => {
    const { commitment, privatePackJson } = committed();
    const changed = JSON.parse(privatePackJson);
    if (kind === "pack") changed.episodes[0].severity = 99;
    if (kind === "order") {
      changed.generator.orderedSeeds.reverse();
      changed.episodes.reverse();
    }
    if (kind === "salt") changed.salt = `0x${"cd".repeat(32)}`;
    if (kind === "context") changed.context.initialBudgetCredits += 1;
    if (kind === "artifact") changed.artifact.policyId = "never-pause";
    if (kind === "generator") changed.generator.version = "other-generator";
    if (kind === "metric") changed.context.metrics[0].direction = "MAXIMIZE";
    if (kind === "catalog") changed.context.serviceCatalog[0].priceCredits += 1;
    if (kind === "extra") changed.ignoredSecret = "PRIVATE_CREDENTIAL";
    expect(() => evaluateRescueSecretPack(commitment, JSON.stringify(changed), runtime)).toThrow(
      code,
    );
  });

  it("binds the host evaluator code hash", () => {
    const pack = committed();
    expect(() =>
      verifyRescueSecretPack(pack.commitment, pack.privatePackJson, {
        codeHash: `0x${"34".repeat(32)}`,
      }),
    ).toThrow(code);
  });

  it("keeps scenario details and unsalted result/context hashes out of public receipts", () => {
    const { commitment, privatePackJson } = committed();
    const receipt = evaluateRescueSecretPack(commitment, privatePackJson, runtime);
    const output = JSON.stringify(receipt);
    const legacy = evaluateRescuePolicy("simple-adaptive", seeds);
    for (const secret of [
      salt,
      ...seeds,
      legacy.contextHash,
      legacy.resultHash,
      ...legacy.episodeResultHashes,
    ])
      expect(output).not.toContain(secret);
    expect(Object.keys(receipt).sort()).toEqual([
      "boundary",
      "commitment",
      "evaluationCommitment",
      "schemaVersion",
    ]);
    expect(output).not.toMatch(
      /severity|validPatchId|incidentFamily|userLoss|orderedSeeds|transcript/,
    );
  });

  it("changes both commitments when only salt changes; outcomes stay identical", () => {
    const first = committed();
    const second = commitRescueSecretPack(
      JSON.stringify({ ...input, salt: `0x${"cd".repeat(32)}` }),
      runtime,
    );
    expect(first.commitment).not.toBe(second.commitment);
    const receipts = [first, second].map(({ commitment, privatePackJson }) =>
      evaluateRescueSecretPack(commitment, privatePackJson, runtime),
    );
    expect(receipts[0]!.evaluationCommitment).not.toBe(receipts[1]!.evaluationCommitment);
    const evaluations = [first, second].map(
      (pack, i) =>
        JSON.parse(
          revealRescueSecretPack(JSON.stringify(receipts[i]), pack.privatePackJson, runtime),
        ).evaluation,
    );
    expect(evaluations[0]).toEqual(evaluations[1]);
  });

  it.each(["result", "receipt", "boundary", "reveal-extra"])(
    "rejects altered %s during reveal/replay",
    (kind) => {
      const pack = committed();
      const receipt = evaluateRescueSecretPack(pack.commitment, pack.privatePackJson, runtime);
      const reveal = JSON.parse(
        revealRescueSecretPack(JSON.stringify(receipt), pack.privatePackJson, runtime),
      );
      if (kind === "result") reveal.evaluation.totalUserLossUsd += 1;
      if (kind === "receipt") receipt.evaluationCommitment = `0x${"99".repeat(32)}`;
      if (kind === "boundary")
        Object.assign(receipt, { boundary: { ...receipt.boundary, creVerified: true } });
      if (kind === "reveal-extra") reveal.extra = "SECRET_EXTRA";
      expect(() =>
        replayRescueSecretPack(JSON.stringify(receipt), JSON.stringify(reveal), runtime),
      ).toThrow(code);
    },
  );

  it("rejects a different valid pack's reveal against the original receipt", () => {
    const first = committed();
    const second = commitRescueSecretPack(
      JSON.stringify({ ...input, seeds: [...seeds].reverse() }),
      runtime,
    );
    const receipt1 = evaluateRescueSecretPack(first.commitment, first.privatePackJson, runtime);
    const receipt2 = evaluateRescueSecretPack(second.commitment, second.privatePackJson, runtime);
    const reveal2 = revealRescueSecretPack(
      JSON.stringify(receipt2),
      second.privatePackJson,
      runtime,
    );
    expect(() => replayRescueSecretPack(JSON.stringify(receipt1), reveal2, runtime)).toThrow(code);
  });

  it.each([
    { ...input, salt: "PRIVATE_INVALID_SALT" },
    { ...input, salt: `0x${"0".repeat(64)}` },
    { ...input, seeds: [] },
    { ...input, seeds: [seeds[0], seeds[0]] },
    { ...input, seeds: Array.from({ length: 9 }, (_, i) => `seed_${i}`) },
    { ...input, policyId: "oracle" },
    { ...input, policyId: "seeded-random" },
    { ...input, extra: "PRIVATE_KEY" },
  ])("rejects invalid bounded input without private values in errors", (invalid) => {
    expect(() => commitRescueSecretPack(JSON.stringify(invalid), runtime)).toThrow(
      new RescueSecretPackError(),
    );
  });

  it.each([
    "{PRIVATE_MALFORMED_JSON",
    "x".repeat(100_001),
    "null",
    '{"__proto__":{"secret":"PRIVATE"}}',
  ])("redacts malformed input", (json) => {
    expect(() => commitRescueSecretPack(json, runtime)).toThrow(new RescueSecretPackError());
  });
});
