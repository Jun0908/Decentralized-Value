import {
  buildRescueRunPaymentEvidence,
  createRescueEpisodeSession,
  generateRescueEpisode,
  rescuePublicViewHash,
  type RescuePaymentPurchase,
} from "./index";
import { createRescueServiceExecutionRequest } from "./service-execution";

export function serviceExecutionFixture(priorReceipt = false) {
  const episode = generateRescueEpisode("recorded-service-runtime-test");
  const session = createRescueEpisodeSession(episode);
  if (priorReceipt) {
    session.takeAction({ type: "BUY_SERVICE", serviceId: "pulse-monitor" });
    session.takeAction({ type: "WAIT", minutes: 3 });
  }
  const publicView = session.getPublicView();
  const action = { type: "BUY_SERVICE", serviceId: "trace-audit" } as const;
  const step = session.takeAction(action);
  const outcome = session.finish();
  const evaluationContextHash = `0x${"1".repeat(64)}` as const;
  const payments = buildRescueRunPaymentEvidence(outcome, evaluationContextHash);
  const purchase: RescuePaymentPurchase = {
    accepted: step.accepted as true,
    action,
    decision: publicView.actions.length + 1,
    publicViewHash: rescuePublicViewHash(publicView),
    order: payments.orders[priorReceipt ? 1 : 0]!,
    policyNonce: "0",
    deadlineUnixSeconds: 1_800_000_000,
  };
  const input = { evaluationContextHash, purchase, publicView };
  const request = createRescueServiceExecutionRequest(input);
  const analysis = {
    requestHash: request.requestHash,
    assessment: "inconclusive" as const,
    likelyAffectedModule: null,
    confidencePpm: 200_000,
    evidenceRefs: [`observation:${publicView.observations[0]!.id}`],
    recommendation: "seek-second-opinion" as const,
    summary: "Activity is unusual, but the visible evidence does not establish a root cause.",
  };
  return { episode, input, request, analysis, outcome, payments };
}
