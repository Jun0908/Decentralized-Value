import {
  buildRescueRunPaymentEvidence,
  createRescuePracticeSession,
  normalizeRescueCommanderPlaybook,
  rescuePublicViewHash,
  rescueRoomCommanderContextHash,
  type RescuePaymentPurchase,
} from "@frontier/rescue-room";
import type { Hex } from "viem";
import {
  createRescueCommanderHireRequest,
  createRescueServiceExecutionRequest,
  replayRescueServiceAnalysis,
  rescueServiceExecutionHash,
  type RescueCommanderHireRequest,
} from "../../../packages/rescue-room/src/service-execution";
import type { executeRescueCommanderHire, executeRescueServiceAgent } from "./rescue-service-agent";
import type { RescueJobJson } from "./rescue-jobs";

export const rescueServiceWorkflowContext = {
  schemaVersion: "rescue-service-workflow-v0",
  baseCommanderContextHash: rescueRoomCommanderContextHash,
  scope: "single-hire-public-evidence-analysis-sidecar",
  serviceAcceptance: "schema-and-source-references-only",
  changesDeterministicEvaluation: false,
  rewardEligible: false,
} as const;
export const rescueServiceWorkflowContextHash = rescueServiceExecutionHash(
  rescueServiceWorkflowContext,
);

export type RescueWorkflowReceipt = {
  transactionHash: Hex;
  blockNumber: string;
  state: "confirmed";
  verifiedEvent: true;
  recipientBalanceAfter: string | null;
};
export type RescueWorkflowPayments = {
  mode: "sepolia" | "isolated-local-test";
  reserve(purchase: RescuePaymentPurchase): Promise<{ key: Hex; providerAddress: string }>;
  fund(key: Hex): Promise<RescueWorkflowReceipt>;
  deliverAndRelease(
    key: Hex,
    evidence: { deliverableHash: Hex; receiptHash: Hex; acceptanceHash: Hex },
  ): Promise<{ delivery: RescueWorkflowReceipt; release: RescueWorkflowReceipt }>;
};
export type RescueServiceWorkflowOptions = {
  episodeId: string;
  playbook: unknown;
  deadlineUnixSeconds: number;
  commander(request: RescueCommanderHireRequest): ReturnType<typeof executeRescueCommanderHire>;
  specialist(
    request: ReturnType<typeof createRescueServiceExecutionRequest>,
  ): ReturnType<typeof executeRescueServiceAgent>;
  payments: RescueWorkflowPayments;
  recordEvent(event: { type: string; data?: RescueJobJson }): Promise<void>;
};

function requireReceipt(receipt: RescueWorkflowReceipt) {
  if (
    receipt.state !== "confirmed" ||
    receipt.verifiedEvent !== true ||
    !/^0x[0-9a-f]{64}$/.test(receipt.transactionHash) ||
    !/^[0-9]+$/.test(receipt.blockNumber)
  )
    throw new Error("UNCONFIRMED_WORKFLOW_PAYMENT");
}

/** One real hiring decision, one interpretation service, no hidden truth or arbitrary tools.
 * Caller persists jobs and model/payment reservations. Unknown failures must not auto-retry.
 */
export async function runRescueServiceWorkflow(options: RescueServiceWorkflowOptions) {
  const playbook = normalizeRescueCommanderPlaybook(options.playbook);
  const session = createRescuePracticeSession(options.episodeId, playbook);
  const view = session.getPublicView();
  const hireRequest = createRescueCommanderHireRequest({ publicView: view, playbook });
  await options.recordEvent({
    type: "commander-started",
    data: { publicViewHash: hireRequest.publicViewHash },
  });
  const commander = await options.commander(hireRequest);
  // A trusted model wrapper validates the output; re-bind it before affecting the evaluator.
  const { acceptRescueCommanderHireDecision } =
    await import("../../../packages/rescue-room/src/service-execution");
  const hire = acceptRescueCommanderHireDecision(hireRequest, commander.decision.rawOutput);
  if (rescueServiceExecutionHash(hire) !== rescueServiceExecutionHash(commander.decision))
    throw new Error("COMMANDER_EVIDENCE_MISMATCH");
  const action = hire.decision.action;
  const step = session.takeAction(action);
  if (!step.accepted) throw new Error("COMMANDER_ACTION_REJECTED");
  await options.recordEvent({
    type: "commander-decided",
    data: { action: action.type, reasonCode: hire.decision.reasonCode },
  });
  const outcome = session.finish();
  const common = {
    schemaVersion: "rescue-service-workflow-result-v0",
    context: rescueServiceWorkflowContext,
    contextHash: rescueServiceWorkflowContextHash,
    episodeId: options.episodeId,
    commander,
    publicView: view,
    simulatedOutcome: outcome,
    operatorControlledService: true,
    rewardEligible: false,
    paymentNetwork: options.payments.mode,
  };
  if (action.type === "CLOSE_INCIDENT") {
    await options.recordEvent({ type: "closed-without-hire" });
    return { ...common, status: "closed-without-hire", paymentState: "not-requested" } as const;
  }
  if (action.type !== "BUY_SERVICE") throw new Error("UNSUPPORTED_WORKFLOW_ACTION");
  const gameEvidence = buildRescueRunPaymentEvidence(outcome, rescueServiceWorkflowContextHash);
  const order = gameEvidence.orders[0];
  if (!order || gameEvidence.orders.length !== 1) throw new Error("EXPECTED_SINGLE_ACCEPTED_ORDER");
  const purchase: RescuePaymentPurchase = {
    accepted: true,
    action,
    decision: view.actions.length + 1,
    publicViewHash: rescuePublicViewHash(view),
    order,
    policyNonce: "0",
    deadlineUnixSeconds: options.deadlineUnixSeconds,
  };
  const request = createRescueServiceExecutionRequest({
    evaluationContextHash: rescueServiceWorkflowContextHash,
    purchase,
    publicView: view,
  });
  const reservation = await options.payments.reserve(purchase);
  await options.recordEvent({
    type: "payment-reserved",
    data: {
      orderId: order.orderId,
      serviceId: order.serviceId,
      amountCredits: order.amountCredits,
    },
  });
  const funded = await options.payments.fund(reservation.key);
  requireReceipt(funded);
  await options.recordEvent({
    type: "escrow-funded",
    data: { transactionHash: funded.transactionHash },
  });
  const specialist = await options.specialist(request);
  const delivery = replayRescueServiceAnalysis(request, specialist.delivery);
  const receiptHash = rescueServiceExecutionHash({
    schemaVersion: "rescue-observed-service-receipt-v0",
    requestHash: request.requestHash,
    deliveryHash: delivery.deliveryHash,
    runtime: specialist.runtime,
  });
  const acceptanceHash = rescueServiceExecutionHash({
    schemaVersion: "rescue-analysis-acceptance-v0",
    orderId: order.orderId,
    requestHash: request.requestHash,
    deliveryHash: delivery.deliveryHash,
    receiptHash,
    acceptance: delivery.acceptance,
    correctness: delivery.correctness,
  });
  await options.recordEvent({
    type: "service-delivered",
    data: {
      deliveryHash: delivery.deliveryHash,
      acceptance: delivery.acceptance,
      correctness: delivery.correctness,
    },
  });
  const payment = await options.payments.deliverAndRelease(reservation.key, {
    deliverableHash: delivery.deliveryHash,
    receiptHash,
    acceptanceHash,
  });
  requireReceipt(payment.delivery);
  requireReceipt(payment.release);
  if (payment.release.recipientBalanceAfter === null)
    throw new Error("MISSING_PROVIDER_BALANCE_EVIDENCE");
  await options.recordEvent({
    type: "service-payment-released",
    data: {
      transactionHash: payment.release.transactionHash,
      provider: reservation.providerAddress,
    },
  });
  return {
    ...common,
    status: "service-purchased",
    paymentState: options.payments.mode === "sepolia" ? "paid" : "simulated",
    purchase,
    serviceRequest: request,
    specialist,
    actualServiceReceiptHash: receiptHash,
    actualServiceAcceptanceHash: acceptanceHash,
    providerAddress: reservation.providerAddress,
    payment: { funding: funded, delivery: payment.delivery, release: payment.release },
    replay: {
      recordedServiceOutputMatches: true,
      legacyResultHash: outcome.resultHash,
      freshInferenceDeterministic: false,
      changesDeterministicEvaluation: false,
    },
  } as const;
}

/** Rebuild using recorded outputs only. This never invokes inference or a chain adapter.
 * Chain receipts still require independent RPC verification by the caller.
 */
export async function replayRescueServiceWorkflow(
  request: { episodeId: string; playbook: unknown },
  recorded: Awaited<ReturnType<typeof runRescueServiceWorkflow>>,
) {
  if (recorded.status !== "service-purchased") throw new Error("EXPECTED_RECORDED_PURCHASE");
  const replayed = await runRescueServiceWorkflow({
    ...request,
    deadlineUnixSeconds: recorded.purchase.deadlineUnixSeconds,
    commander: async () => recorded.commander,
    specialist: async () => recorded.specialist,
    payments: {
      mode: recorded.paymentNetwork,
      reserve: async () => ({
        key: recorded.purchase.order.orderId,
        providerAddress: recorded.providerAddress,
      }),
      fund: async () => recorded.payment.funding,
      deliverAndRelease: async () => recorded.payment,
    },
    recordEvent: async () => {},
  });
  if (rescueServiceExecutionHash(replayed) !== rescueServiceExecutionHash(recorded))
    throw new Error("RECORDED_WORKFLOW_MISMATCH");
  return replayed;
}
