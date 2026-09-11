import { canonicalProtocolJson } from "@frontier/shared";
import { keccak256, stringToHex, type Hex } from "viem";
import { z } from "zod";
import {
  incidentFamilySchema,
  normalizeRescueCommanderPlaybook,
  patchIdSchema,
  rescueActionSchema,
  rescueCommanderDecisionSchema,
  rescueCommanderPaymentActionHash,
  rescueModuleSchema,
  rescuePaymentEpisodeContextHash,
  rescuePublicViewHash,
  rescueServiceDeliverableHash,
  rescueServiceManifestHash,
  rescueServiceOrderId,
  rescueServices,
  serviceIdSchema,
  type RescuePaymentPurchase,
} from "./index";

/** Sidecar analysis, not a replacement for the deterministic simulator/evaluator. */
export const rescueServiceExecutionVersion = "rescue-service-execution-v0" as const;
export const rescueLiveSpecialistIds = [
  "pulse-monitor",
  "trace-audit",
  "accounting-audit",
  "second-opinion",
] as const;
// A type assertion, not a Zod transform: output schemas must remain JSON-Schema representable.
const hashSchema = z.string().regex(/^0x[0-9a-f]{64}$/) as z.ZodType<Hex>;
const minute = z.number().int().min(0).max(60);
const credits = z.number().int().min(0).max(100);
const text = z.string().min(1).max(1_000);
const task = z.enum([
  "SCAN_ACTIVITY",
  "TRACE_EXECUTION",
  "CHECK_ACCOUNTING",
  "SECOND_OPINION",
  "BUILD_PATCH",
  "VERIFY_PATCH",
]);
const receiptSchema = z
  .object({
    receiptId: text,
    orderId: hashSchema,
    serviceId: serviceIdSchema,
    task,
    deliveredAtMinute: minute,
    classification: z.union([incidentFamilySchema, z.literal("inconclusive")]),
    likelyAffectedModule: rescueModuleSchema.nullable(),
    severity: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
    confidencePpm: z.number().int().min(0).max(1_000_000),
    patchId: patchIdSchema.nullable(),
    patchValid: z.boolean().nullable(),
    summary: text,
    deliverableHash: hashSchema,
    receiptHash: hashSchema,
  })
  .strict();

/** Strict JSON boundary: never pass a hidden Episode definition through to an agent. */
export const rescueServicePublicViewSchema = z
  .object({
    episodeId: text,
    gameMinute: minute,
    horizonMinutes: z.literal(60),
    availableBudgetCredits: credits,
    reservedBudgetCredits: credits,
    netResponseSpendCredits: credits,
    pausedModules: z.array(rescueModuleSchema).max(6),
    incidentResolved: z.boolean(),
    observations: z
      .array(
        z
          .object({
            id: text,
            gameMinute: minute,
            source: z.enum(["PROTOCOL", "SERVICE"]),
            headline: text,
            facts: z.array(text).max(12),
          })
          .strict(),
      )
      .max(64),
    serviceOrders: z
      .array(
        z
          .object({
            orderId: hashSchema,
            episodeHash: hashSchema,
            commanderActionHash: hashSchema,
            serviceManifestHash: hashSchema,
            serviceId: serviceIdSchema,
            task,
            orderedAtMinute: minute,
            dueAtMinute: z.number().int().min(0).max(68),
            priceCredits: credits,
            targetModule: rescueModuleSchema.nullable(),
            targetReceiptId: text.nullable(),
            status: z.enum(["RESERVED", "DELIVERED", "REFUNDED"]),
          })
          .strict(),
      )
      .max(12),
    serviceReceipts: z.array(receiptSchema).max(12),
    actions: z.array(rescueActionSchema).max(12),
  })
  .strict();

export function rescueServiceExecutionHash(value: unknown): Hex {
  return keccak256(stringToHex(canonicalProtocolJson(value)));
}

// JSON snapshots avoid getters/toJSON/prototype surprises before Zod reads values.
function snapshot(value: unknown): unknown {
  let nodes = 0;
  const visit = (item: unknown, depth: number): unknown => {
    if (++nodes > 20_000 || depth > 32) throw new Error("Service input exceeds structural limit");
    if (item === null || typeof item === "boolean" || typeof item === "string") return item;
    if (typeof item === "number" && Number.isFinite(item)) return item;
    if (!item || typeof item !== "object") throw new Error("Service input must be plain JSON");
    if (
      !Array.isArray(item) &&
      Object.getPrototypeOf(item) !== Object.prototype &&
      Object.getPrototypeOf(item) !== null
    ) {
      throw new Error("Service input must be plain JSON");
    }
    const result: Record<string, unknown> | unknown[] = Array.isArray(item) ? [] : {};
    for (const key of Reflect.ownKeys(item)) {
      if (Array.isArray(item) && key === "length") continue;
      const property = Object.getOwnPropertyDescriptor(item, key)!;
      if (
        typeof key !== "string" ||
        !property.enumerable ||
        !("value" in property) ||
        key === "__proto__"
      ) {
        throw new Error("Service input must contain data properties only");
      }
      if (Array.isArray(item) && !/^(0|[1-9][0-9]*)$/.test(key))
        throw new Error("Invalid JSON array");
      Object.defineProperty(result, key, {
        value: visit(property.value, depth + 1),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    if (Array.isArray(item) && Object.keys(item).length !== item.length)
      throw new Error("Invalid JSON array");
    return result;
  };
  const parsed = visit(value, 0);
  if (JSON.stringify(parsed).length > 48_000) throw new Error("Service input exceeds size limit");
  return parsed;
}

export function parseRescueServicePublicView(input: unknown) {
  const view = rescueServicePublicViewSchema.parse(snapshot(input));
  const ids = [
    ...view.observations.map((item) => `observation:${item.id}`),
    ...view.serviceReceipts.map((item) => `receipt:${item.receiptId}`),
  ];
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate public evidence ID");
  for (const observation of view.observations) {
    if (observation.gameMinute > view.gameMinute)
      throw new Error("Future observation is not authorized");
    if (
      observation.source === "SERVICE" &&
      !view.serviceReceipts.some((receipt) => observation.id === `observation-${receipt.receiptId}`)
    ) {
      throw new Error("Unpurchased service observation is not authorized");
    }
  }
  for (const receipt of view.serviceReceipts) {
    const order = view.serviceOrders.find((entry) => entry.orderId === receipt.orderId);
    const { receiptHash, deliverableHash, ...body } = receipt;
    if (
      !order ||
      order.status !== "DELIVERED" ||
      order.serviceId !== receipt.serviceId ||
      receipt.deliveredAtMinute > view.gameMinute ||
      receipt.task !== order.task ||
      receipt.deliveredAtMinute < order.dueAtMinute
    ) {
      throw new Error("Unpurchased or undelivered receipt is not authorized");
    }
    if (
      receiptHash !== rescueServiceExecutionHash(body) ||
      deliverableHash !== rescueServiceDeliverableHash({ orderId: order.orderId, receiptHash })
    ) {
      throw new Error("Purchased receipt hash mismatch");
    }
  }
  return view;
}

const purchaseSchema = z
  .object({
    accepted: z.literal(true),
    action: rescueActionSchema,
    decision: z.number().int().min(1).max(12),
    publicViewHash: hashSchema,
    policyNonce: z
      .string()
      .regex(/^(0|[1-9][0-9]*)$/)
      .max(78),
    deadlineUnixSeconds: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    order: z
      .object({
        orderId: hashSchema,
        episodeContextHash: hashSchema,
        episodeHash: hashSchema,
        commanderActionHash: hashSchema,
        serviceManifestHash: hashSchema,
        serviceId: serviceIdSchema,
        amountCredits: credits,
        orderedAtMinute: minute,
        dueAtMinute: z.number().int().min(0).max(68),
        resolvedAtMinute: minute.nullable(),
        gamePaymentState: z.enum(["reserved", "released", "refunded"]),
        deliverableHash: hashSchema.nullable(),
        receiptHash: hashSchema.nullable(),
        acceptanceHash: hashSchema.nullable(),
      })
      .strict(),
  })
  .strict();

/** Caller must supply an evaluator-owned accepted purchase; hashes do not authenticate callers. */
export function createRescueServiceExecutionRequest(input: {
  evaluationContextHash: Hex;
  purchase: RescuePaymentPurchase;
  publicView: unknown;
}) {
  const safe = z
    .object({
      evaluationContextHash: hashSchema,
      purchase: purchaseSchema,
      publicView: z.unknown(),
    })
    .strict()
    .parse(snapshot(input));
  const view = parseRescueServicePublicView(safe.publicView);
  const { purchase } = safe;
  const { order, action } = purchase;
  const serviceId = z.enum(rescueLiveSpecialistIds).parse(order.serviceId);
  const service = rescueServices.find((item) => item.id === serviceId)!;
  if (
    action.type !== "BUY_SERVICE" ||
    action.serviceId !== serviceId ||
    order.gamePaymentState === "refunded"
  )
    throw new Error("A matching accepted service purchase is required");
  if (
    view.incidentResolved ||
    purchase.decision !== view.actions.length + 1 ||
    view.gameMinute !== order.orderedAtMinute ||
    purchase.publicViewHash !== rescuePublicViewHash(view)
  )
    throw new Error("Pre-action public view mismatch");
  if (
    view.availableBudgetCredits < order.amountCredits ||
    order.amountCredits !== service.priceCredits ||
    order.dueAtMinute !== order.orderedAtMinute + service.deliveryMinutes
  )
    throw new Error("Service price or delivery mismatch");
  if (
    order.episodeContextHash !==
    rescuePaymentEpisodeContextHash(safe.evaluationContextHash, order.episodeHash)
  )
    throw new Error("Service episode context mismatch");
  if (order.serviceManifestHash !== rescueServiceManifestHash(serviceId))
    throw new Error("Service manifest mismatch");
  const actionHash = rescueCommanderPaymentActionHash({
    episodeHash: order.episodeHash,
    decision: purchase.decision,
    gameMinute: view.gameMinute,
    publicViewHash: purchase.publicViewHash,
    action,
  });
  if (
    actionHash !== order.commanderActionHash ||
    order.orderId !==
      rescueServiceOrderId({
        episodeHash: order.episodeHash,
        commanderActionHash: actionHash,
        serviceManifestHash: order.serviceManifestHash,
      })
  )
    throw new Error("Service order or action hash mismatch");
  if (
    action.targetReceiptId &&
    !view.serviceReceipts.some((receipt) => receipt.receiptId === action.targetReceiptId)
  )
    throw new Error("Target receipt is not authorized");
  const body = {
    schemaVersion: rescueServiceExecutionVersion,
    executionKind: "recorded-ai-specialist-analysis" as const,
    evaluationContextHash: safe.evaluationContextHash,
    purchase,
    publicView: view,
  };
  return { ...body, requestHash: rescueServiceExecutionHash(body) };
}
export type RescueServiceExecutionRequest = ReturnType<typeof createRescueServiceExecutionRequest>;

export function validateRescueServiceExecutionRequest(
  input: unknown,
): RescueServiceExecutionRequest {
  const parsed = z
    .object({
      schemaVersion: z.literal(rescueServiceExecutionVersion),
      executionKind: z.literal("recorded-ai-specialist-analysis"),
      evaluationContextHash: hashSchema,
      purchase: purchaseSchema,
      publicView: z.unknown(),
      requestHash: hashSchema,
    })
    .strict()
    .parse(snapshot(input));
  const rebuilt = createRescueServiceExecutionRequest({
    evaluationContextHash: parsed.evaluationContextHash,
    purchase: parsed.purchase,
    publicView: parsed.publicView,
  });
  if (rebuilt.requestHash !== parsed.requestHash) throw new Error("Service request hash mismatch");
  return rebuilt;
}

export const rescueServiceAnalysisSchema = z
  .object({
    requestHash: hashSchema,
    assessment: z.enum([
      "inconclusive",
      "anomaly-observed",
      "likely-benign",
      "requires-investigation",
    ]),
    likelyAffectedModule: rescueModuleSchema.nullable(),
    confidencePpm: z.number().int().min(0).max(1_000_000),
    evidenceRefs: z.array(z.string().min(1).max(1_100)).min(1).max(8),
    recommendation: z.enum([
      "continue-monitoring",
      "seek-second-opinion",
      "consider-targeted-pause",
      "escalate-to-commander",
    ]),
    summary: z.string().min(1).max(600),
  })
  .strict();
export type RescueServiceAnalysis = z.infer<typeof rescueServiceAnalysisSchema>;

export function acceptRescueServiceAnalysis(requestInput: unknown, rawOutput: string) {
  const request = validateRescueServiceExecutionRequest(requestInput);
  if (typeof rawOutput !== "string" || rawOutput.length > 8_000)
    throw new Error("Service output exceeds size limit");
  const analysis = rescueServiceAnalysisSchema.parse(JSON.parse(rawOutput));
  if (analysis.requestHash !== request.requestHash)
    throw new Error("Service response request mismatch");
  const refs = new Set([
    ...request.publicView.observations.map((item) => `observation:${item.id}`),
    ...request.publicView.serviceReceipts.map((item) => `receipt:${item.receiptId}`),
  ]);
  if (
    new Set(analysis.evidenceRefs).size !== analysis.evidenceRefs.length ||
    analysis.evidenceRefs.some((ref) => !refs.has(ref))
  )
    throw new Error("Service response cites unauthorized evidence");
  const body = {
    schemaVersion: "rescue-service-analysis-delivery-v0" as const,
    requestHash: request.requestHash,
    orderId: request.purchase.order.orderId,
    episodeContextHash: request.purchase.order.episodeContextHash,
    commanderActionHash: request.purchase.order.commanderActionHash,
    serviceManifestHash: request.purchase.order.serviceManifestHash,
    rawOutput,
    rawOutputHash: rescueServiceExecutionHash({ rawOutput }),
    analysis,
    acceptance: "schema-and-source-references-validated" as const,
    correctness: "not-evaluated" as const,
    paymentState: "not-requested" as const,
    changesDeterministicEvaluation: false as const,
  };
  return { ...body, deliveryHash: rescueServiceExecutionHash(body) };
}
export type RescueServiceAnalysisDelivery = ReturnType<typeof acceptRescueServiceAnalysis>;

/** Replay checks recorded output, not fresh inference or the truth of the prose. */
export function replayRescueServiceAnalysis(
  request: unknown,
  delivery: RescueServiceAnalysisDelivery,
) {
  const rebuilt = acceptRescueServiceAnalysis(request, delivery.rawOutput);
  if (rescueServiceExecutionHash(rebuilt) !== rescueServiceExecutionHash(delivery))
    throw new Error("Recorded service delivery mismatch");
  return rebuilt;
}

export function createRescueCommanderHireRequest(input: {
  publicView: unknown;
  playbook: unknown;
}) {
  const safe = z
    .object({ publicView: z.unknown(), playbook: z.unknown() })
    .strict()
    .parse(snapshot(input));
  const view = parseRescueServicePublicView(safe.publicView);
  const playbook = normalizeRescueCommanderPlaybook(safe.playbook);
  const services = rescueServices.filter(
    (service) =>
      rescueLiveSpecialistIds.includes(service.id as (typeof rescueLiveSpecialistIds)[number]) &&
      playbook.allowedServiceIds.includes(service.id) &&
      service.priceCredits <= playbook.maxServicePriceCredits &&
      service.priceCredits <= view.availableBudgetCredits &&
      view.netResponseSpendCredits + view.reservedBudgetCredits + service.priceCredits <=
        playbook.investigationBudgetCredits,
  );
  const body = {
    schemaVersion: "rescue-commander-hire-v0" as const,
    publicView: view,
    publicViewHash: rescuePublicViewHash(view),
    playbook,
    services,
  };
  return { ...body, requestHash: rescueServiceExecutionHash(body) };
}
export type RescueCommanderHireRequest = ReturnType<typeof createRescueCommanderHireRequest>;

export function acceptRescueCommanderHireDecision(
  request: RescueCommanderHireRequest,
  rawOutput: string,
) {
  const rebuilt = createRescueCommanderHireRequest({
    publicView: request.publicView,
    playbook: request.playbook,
  });
  if (rescueServiceExecutionHash(rebuilt) !== rescueServiceExecutionHash(request))
    throw new Error("Commander request mismatch");
  if (rawOutput.length > 8_000) throw new Error("Commander output exceeds size limit");
  const decision = rescueCommanderDecisionSchema.parse(JSON.parse(rawOutput));
  const action = decision.action;
  if (action.type === "BUY_SERVICE") {
    if (
      request.publicView.incidentResolved ||
      !request.services.some((service) => service.id === action.serviceId)
    )
      throw new Error("Commander hire exceeds authorized service or budget");
    if (
      action.targetReceiptId &&
      !request.publicView.serviceReceipts.some(
        (receipt) => receipt.receiptId === action.targetReceiptId,
      )
    )
      throw new Error("Commander target receipt is unauthorized");
  } else if (
    action.type !== "CLOSE_INCIDENT" ||
    !request.playbook.allowedProtocolActions.includes("CLOSE_INCIDENT")
  ) {
    throw new Error("Only an authorized hire or close decision is supported");
  }
  const body = {
    schemaVersion: "rescue-commander-hire-decision-v0" as const,
    requestHash: request.requestHash,
    publicViewHash: request.publicViewHash,
    rawOutput,
    decision,
    actionAcceptance: "requires-evaluator" as const,
    paymentState: "not-requested" as const,
  };
  return { ...body, decisionHash: rescueServiceExecutionHash(body) };
}
