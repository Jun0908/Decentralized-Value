import { expect, it } from "vitest";
import ens from "../../Docs/deployments/ensv2-rescue-demo.json";
import cre from "../../Docs/deployments/chainlink-cre-private-pack.json";
import bazantic from "../../Docs/deployments/bazantic-rescue-agent-demo.json";
import { replayRescueSecretPack } from "./rescue-secret-pack";
import { verifyRescueDoctrinePracticeIntegrity, compareRuns } from "../../packages/sdk/src/index";
import { cliRunSchema } from "../../packages/shared/src/index";
import {
  evaluateRescueDoctrinePracticeEpisode,
  normalizeRescueDoctrine,
} from "../../packages/rescue-room/src/index";

it("replays the explicitly revealed CRE pack offline and preserves simulation boundaries", () => {
  const replay = replayRescueSecretPack(JSON.stringify(cre.receipt), cre.revealedPack, {
    codeHash: cre.evaluatorBundleHash as `0x${string}`,
  });
  expect(replay).toEqual(cre.replay);
  expect(cre.liveTeeAttestationVerified).toBe(false);
  expect(cre.onchainCommitment).toBe(false);
  expect(cre.rewardEligible).toBe(false);
  const modified = { ...cre.receipt, evaluationCommitment: `0x${"0".repeat(64)}` };
  expect(() =>
    replayRescueSecretPack(JSON.stringify(modified), cre.revealedPack, {
      codeHash: cre.evaluatorBundleHash as `0x${string}`,
    }),
  ).toThrow();
});

it("independently verifies both Bazantic runs and retains the observed tie", () => {
  for (const proof of bazantic.proofs) {
    const request = proof.request as Parameters<
      typeof verifyRescueDoctrinePracticeIntegrity
    >[0]["request"];
    expect(verifyRescueDoctrinePracticeIntegrity({ request, run: proof.run })).toEqual(
      proof.integrity,
    );
    const local = evaluateRescueDoctrinePracticeEpisode(
      normalizeRescueDoctrine(request.artifact),
      request.episodeId,
    );
    expect(local.evaluationHash).toBe(proof.run.resultHash);
  }
  expect(
    compareRuns(
      cliRunSchema.parse(bazantic.proofs[0]!.run),
      cliRunSchema.parse(bazantic.proofs[1]!.run),
    ),
  ).toEqual(bazantic.comparison);
  expect(bazantic.comparison.relation).toBe("equal");
  expect(bazantic.hostedRecipeExecuted).toBe(false);
  expect(bazantic.gatewayPaymentAttempted).toBe(false);
});

it("keeps seven distinct ENS transaction references and labels the rejection as eth_call", () => {
  expect(new Set(ens.transactions.map((tx) => tx.hash)).size).toBe(7);
  expect(ens.finalDelegatePermission).toBe("revoked");
  expect(ens.rejectionMethod).toBe("eth_call");
  expect(ens.independentThirdPartyProvider).toBe(false);
});
