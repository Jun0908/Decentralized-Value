import { cliContextSchema, cliRunSchema, type CliContext } from "@frontier/shared/cli";
import { canonicalProtocolJson } from "@frontier/shared/manifest";
import { keccak256, stringToHex } from "viem";
import { z } from "zod";
import { FrontierError } from "./errors.js";

const hashSchema = z.string().regex(/^0x[0-9a-f]{64}$/);
const integer = z.number().int().nonnegative();
const jsonRecord = z.record(z.string(), z.json());
const evaluatorVersion = "rescue-room-evaluator-v2";
const interpreterVersion = "rescue-doctrine-interpreter-v0";
const dataVersion = "rescue-practice-pack-2026-09-v0";

// This is the v0 hash-normalization shape, not a second Doctrine interpreter.
// Business authorization and correctness still belong to the canonical evaluator.
const doctrineShape = z
  .object({
    schemaVersion: z.literal("rescue-doctrine-v0"),
    name: z.string().min(3).max(80),
    constraints: z
      .object({
        investigationBudgetCredits: integer.max(100),
        maxServicePriceCredits: integer.max(100),
        allowedServiceIds: z.array(z.string()).min(1).max(6),
        allowedProtocolActions: z.array(z.string()).min(1).max(7),
      })
      .strict(),
    rules: z
      .object({
        minimumEvidenceCount: integer.min(1).max(3),
        minimumConfidencePpm: integer.min(500_000).max(950_000),
        disagreementAction: z.enum(["second-opinion", "wait", "contain"]),
        containmentScope: z.enum(["none", "module", "protocol"]),
        servicePriority: z.array(z.string()).min(1).max(4),
        requirePatchVerification: z.boolean(),
        budgetExhaustedAction: z.enum(["wait", "close", "contain"]),
      })
      .strict(),
  })
  .strict();

const decisionSchema = z
  .object({
    action: jsonRecord,
    reasonCode: z.string(),
    confidencePpm: integer.max(1_000_000),
    decision: integer.positive(),
    gameMinute: integer,
    publicViewHash: hashSchema,
    accepted: z.boolean(),
    invalidReason: z.string().nullable(),
  })
  .strict();
const transcriptSchema = z
  .object({
    sequence: integer,
    gameMinute: integer,
    type: z.enum([
      "OBSERVATION",
      "ACTION",
      "PAYMENT_RESERVED",
      "PAYMENT_RELEASED",
      "PAYMENT_REFUNDED",
      "SERVICE_RECEIPT",
      "STATE_TRANSITION",
      "EPISODE_END",
      "INVALID_ACTION",
    ]),
    data: jsonRecord,
  })
  .strict();
const outcomeSchema = z
  .object({
    episodeId: z.string(),
    episodeHash: hashSchema,
    correctness: z.boolean(),
    invalidReason: z.string().nullable(),
    userLossUsd: integer,
    servedProtocolDemandPpm: integer.max(1_000_000),
    netResponseSpendCredits: integer,
    incidentResolved: z.boolean(),
    finalMinute: integer,
    actionCount: integer,
    servicePurchaseCount: integer,
    transcript: z.array(transcriptSchema).max(10_000),
    transcriptHash: hashSchema,
    resultHash: hashSchema,
  })
  .strict();
const orderSchema = z
  .object({
    orderId: hashSchema,
    episodeContextHash: hashSchema,
    episodeHash: hashSchema,
    commanderActionHash: hashSchema,
    serviceManifestHash: hashSchema,
    serviceId: z.string(),
    amountCredits: integer,
    orderedAtMinute: integer,
    dueAtMinute: integer,
    resolvedAtMinute: integer.nullable(),
    gamePaymentState: z.enum(["reserved", "released", "refunded"]),
    deliverableHash: hashSchema.nullable(),
    receiptHash: hashSchema.nullable(),
    acceptanceHash: hashSchema.nullable(),
  })
  .strict();
const paymentSchema = z
  .object({
    schemaVersion: z.literal("rescue-run-payment-evidence-v0"),
    evidenceState: z.literal("simulated"),
    gameLedger: z
      .object({
        unit: z.literal("Rescue Credits"),
        initialBalance: z.literal(100),
        availableBalance: integer,
        reservedBalance: integer,
        spentBalance: integer,
      })
      .strict(),
    orders: z.array(orderSchema).max(12),
    onchainMirror: z
      .object({
        network: z.literal("sepolia"),
        chainId: z.literal(11_155_111),
        paymentState: z.literal("not-requested"),
        token: z
          .object({
            name: z.literal("RescueUSD Demo"),
            symbol: z.literal("rUSD-DEMO"),
            decimals: z.literal(6),
            network: z.literal("sepolia"),
            chainId: z.literal(11_155_111),
            monetaryValueClaim: z.literal(false),
            address: z.null(),
          })
          .strict(),
        escrowAddress: z.null(),
        reason: z.literal("Sepolia payment mirror is not deployed for Controlled Practice."),
      })
      .strict(),
    evidenceHash: hashSchema,
  })
  .strict();
const rawSchema = z
  .object({
    state: z.literal("simulated"),
    strategyState: z.literal("deterministic-rules"),
    paymentState: z.literal("game-credits"),
    schemaVersion: z.literal("rescue-doctrine-practice-evaluation-v0"),
    arenaId: z.literal("rescue-room-v0"),
    contextId: z.literal("public-practice-pack-v0"),
    contextHash: hashSchema,
    doctrineContextHash: hashSchema,
    manifestHash: hashSchema,
    doctrine: doctrineShape,
    doctrineHash: hashSchema,
    interpreterVersion: z.literal(interpreterVersion),
    decisions: z.array(decisionSchema).max(12),
    episode: z
      .object({ id: z.string(), initialHeadline: z.string(), revealedAfterRun: jsonRecord })
      .strict(),
    paymentEvidence: paymentSchema,
    outcome: outcomeSchema,
    replay: z
      .object({
        deterministic: z.literal(true),
        actionCount: integer,
        resultHash: hashSchema,
        matchesRecordedOutcome: z.literal(true),
      })
      .strict(),
    rewardEligibility: z.object({ eligible: z.literal(false), reason: z.string() }).strict(),
    evaluationHash: hashSchema,
  })
  .strict();

type Layer =
  | "input"
  | "version"
  | "artifact"
  | "context"
  | "episode"
  | "evaluation"
  | "outcome"
  | "transcript"
  | "payment"
  | "order"
  | "receipt"
  | "projection";
function fail(layer: Layer): never {
  throw new FrontierError(
    layer === "version" ? "RESCUE_INTEGRITY_UNSUPPORTED_VERSION" : "RESCUE_INTEGRITY_MISMATCH",
    "Rescue Practice integrity verification failed.",
    { details: { layer } },
  );
}
function check(condition: unknown, layer: Layer): asserts condition {
  if (!condition) fail(layer);
}
function equal(a: unknown, b: unknown, layer: Layer): void {
  check(canonicalProtocolJson(a) === canonicalProtocolJson(b), layer);
}
function hash(value: unknown) {
  return keccak256(stringToHex(canonicalProtocolJson(value)));
}

/** Copy only finite plain JSON; never execute getters, toJSON, or hidden fields. */
function snapshot(value: unknown): unknown {
  let nodes = 0;
  let characters = 0;
  const active = new Set<object>();
  const copy = (item: unknown, depth: number): unknown => {
    if (++nodes > 100_000 || depth > 48) fail("input");
    if (item === null || typeof item === "boolean") return item;
    if (typeof item === "string") {
      characters += item.length;
      if (characters > 8_388_608) fail("input");
      return item;
    }
    if (typeof item === "number") {
      check(Number.isFinite(item), "input");
      return item;
    }
    check(typeof item === "object" && item !== null, "input");
    check(!active.has(item) && Object.getOwnPropertySymbols(item).length === 0, "input");
    active.add(item);
    const descriptors = Object.getOwnPropertyDescriptors(item);
    let result: unknown;
    if (Array.isArray(item)) {
      check(
        Object.getPrototypeOf(item) === Array.prototype &&
          Object.keys(descriptors).length === item.length + 1,
        "input",
      );
      result = Array.from({ length: item.length }, (_, index) => {
        const descriptor = descriptors[String(index)];
        check(descriptor && descriptor.enumerable && "value" in descriptor, "input");
        return copy(descriptor.value, depth + 1);
      });
    } else {
      const prototype: unknown = Object.getPrototypeOf(item);
      check(prototype === null || prototype === Object.prototype, "input");
      const object: Record<string, unknown> = Object.create(null);
      for (const [key, descriptor] of Object.entries(descriptors)) {
        characters += key.length;
        check(descriptor.enumerable && "value" in descriptor, "input");
        object[key] = copy(descriptor.value, depth + 1);
      }
      result = object;
    }
    active.delete(item);
    return result;
  };
  return copy(value, 0);
}

function normalizedDoctrine(value: unknown) {
  const object = jsonRecord.parse(value);
  const parsed = doctrineShape.parse({
    ...object,
    name: typeof object.name === "string" ? object.name.trim() : object.name,
  });
  const lexical = (values: string[]) => [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  check(
    new Set(parsed.constraints.allowedServiceIds).size ===
      parsed.constraints.allowedServiceIds.length,
    "artifact",
  );
  check(
    new Set(parsed.constraints.allowedProtocolActions).size ===
      parsed.constraints.allowedProtocolActions.length,
    "artifact",
  );
  return {
    ...parsed,
    constraints: {
      ...parsed.constraints,
      allowedServiceIds: lexical(parsed.constraints.allowedServiceIds),
      allowedProtocolActions: lexical(parsed.constraints.allowedProtocolActions),
    },
  };
}

export type RescueDoctrineIntegrityRequest = {
  artifact: Record<string, unknown>;
  episodeId: string;
  context: CliContext;
};

export type RescueDoctrineIntegrityReport = {
  schemaVersion: "rescue-doctrine-integrity-v0";
  verification: "hash-consistency";
  integrityVerified: true;
  evaluatorReplay: false;
  correctnessVerified: false;
  signatureVerified: false;
  paymentVerified: false;
  commitmentPreimagesVerified: false;
  episodeId: string;
  hashes: {
    artifact: string;
    evaluation: string;
    outcome: string;
    transcript: string;
    paymentEvidence: string;
  };
  checkedOrders: number;
  checkedReceipts: number;
};

/** Pure, opt-in legacy Rescue Doctrine verification. No evaluator, AI, RPC or network.
 * The caller must supply an independently retained request/context, not copy them
 * from the response. Hash consistency does NOT authenticate a self-consistently
 * forged bundle or establish evaluator correctness, real payment or hidden state.
 */
export function verifyRescueDoctrinePracticeIntegrity(input: {
  request: RescueDoctrineIntegrityRequest;
  run: unknown;
}): RescueDoctrineIntegrityReport {
  try {
    const copied = snapshot(input) as { request: RescueDoctrineIntegrityRequest; run: unknown };
    const request = copied.request;
    const run = cliRunSchema.parse(copied.run);
    check(request && request.artifact && request.context, "input");
    const expected = cliContextSchema.parse(request.context);
    const candidate = run.raw;
    check(
      candidate.schemaVersion === "rescue-doctrine-practice-evaluation-v0" &&
        candidate.interpreterVersion === interpreterVersion &&
        candidate.paymentEvidence &&
        typeof candidate.paymentEvidence === "object" &&
        "schemaVersion" in candidate.paymentEvidence &&
        candidate.paymentEvidence.schemaVersion === "rescue-run-payment-evidence-v0" &&
        request.artifact.schemaVersion === "rescue-doctrine-v0" &&
        expected.evaluatorVersion === interpreterVersion &&
        expected.dataVersion === dataVersion,
      "version",
    );
    const raw = rawSchema.parse(candidate);
    const doctrine = normalizedDoctrine(request.artifact);
    equal(raw.doctrine, doctrine, "artifact");
    equal(normalizedDoctrine(run.artifact), doctrine, "artifact");
    const artifactHash = hash(doctrine);
    check(raw.doctrineHash === artifactHash && run.artifactHash === artifactHash, "artifact");
    equal(run.context, expected, "context");
    check(
      expected.evidenceState === "simulated" &&
        expected.runtimeContextHash !== null &&
        raw.contextHash === expected.contextHash &&
        raw.doctrineContextHash === expected.runtimeContextHash &&
        raw.manifestHash === expected.manifestHash,
      "context",
    );
    equal(
      expected.metrics.map(({ key, direction, unit, lowerBound, upperBound }) => ({
        key,
        direction,
        unit,
        lowerBound,
        upperBound,
      })),
      [
        {
          key: "totalUserLossUsd",
          direction: "MINIMIZE",
          unit: "USD",
          lowerBound: 0,
          upperBound: 250_000,
        },
        {
          key: "servedProtocolDemandPpm",
          direction: "MAXIMIZE",
          unit: "ppm",
          lowerBound: 0,
          upperBound: 1_000_000,
        },
        {
          key: "netResponseSpendCredits",
          direction: "MINIMIZE",
          unit: "Rescue Credits",
          lowerBound: 0,
          upperBound: 100,
        },
      ],
      "context",
    );
    check(
      run.arenaId === "rescue-room" &&
        run.episodeId === request.episodeId &&
        raw.episode.id === request.episodeId &&
        raw.outcome.episodeId === request.episodeId,
      "episode",
    );

    const { state, strategyState, paymentState, evaluationHash, ...evaluation } = raw;
    void state;
    void strategyState;
    void paymentState;
    check(hash(evaluation) === evaluationHash && run.resultHash === evaluationHash, "evaluation");
    const { resultHash, ...outcome } = raw.outcome;
    check(hash(outcome) === resultHash && raw.replay.resultHash === resultHash, "outcome");
    check(hash(outcome.transcript) === outcome.transcriptHash, "transcript");
    check(raw.replay.actionCount === raw.decisions.length, "projection");
    equal(
      run.values,
      {
        totalUserLossUsd: outcome.userLossUsd,
        servedProtocolDemandPpm: outcome.servedProtocolDemandPpm,
        netResponseSpendCredits: outcome.netResponseSpendCredits,
      },
      "projection",
    );
    check(run.correctness === outcome.correctness, "projection");
    const { evidenceHash, ...payment } = raw.paymentEvidence;
    check(hash(payment) === evidenceHash, "payment");

    const actionEvents = outcome.transcript.filter((event) => event.type === "ACTION");
    check(actionEvents.length === outcome.actionCount, "transcript");
    const acceptedDecisions = raw.decisions.filter((decision) => decision.accepted);
    // Valid v0 Doctrine runs bind every recorded decision to an Action event.
    // Invalid runs can have a refused action and are integrity-checked, not re-evaluated.
    if (outcome.correctness)
      check(
        acceptedDecisions.length === raw.decisions.length &&
          actionEvents.length === raw.decisions.length,
        "transcript",
      );
    for (let index = 0; index < raw.decisions.length; index++)
      check(raw.decisions[index]!.decision === index + 1, "transcript");
    const actionHashes = new Map<string, { serviceId: unknown; minute: number }>();
    for (const decision of raw.decisions) {
      const actionEvent = actionEvents[decision.decision - 1];
      if (actionEvent) {
        equal(actionEvent.data.action, decision.action, "transcript");
        check(actionEvent.gameMinute === decision.gameMinute, "transcript");
      }
      if (decision.action.type === "BUY_SERVICE")
        actionHashes.set(
          hash({
            schemaVersion: "rescue-payment-action-v0",
            evaluatorVersion,
            episodeHash: outcome.episodeHash,
            decision: decision.decision,
            gameMinute: decision.gameMinute,
            publicViewHash: decision.publicViewHash,
            action: decision.action,
          }),
          { serviceId: decision.action.serviceId, minute: decision.gameMinute },
        );
    }
    const episodeContextHash = hash({
      schemaVersion: "rescue-payment-episode-context-v0",
      evaluatorVersion,
      evaluationContextHash: raw.contextHash,
      episodeHash: outcome.episodeHash,
    });
    const orders = new Map(payment.orders.map((order) => [order.orderId, order]));
    check(
      orders.size === payment.orders.length && outcome.servicePurchaseCount === orders.size,
      "order",
    );
    const reserved = new Set<string>();
    const resolved = new Set<string>();
    const receipts = new Set<string>();
    let available = 100,
      held = 0,
      spent = 0;
    for (const order of orders.values()) {
      check(
        order.episodeHash === outcome.episodeHash &&
          order.episodeContextHash === episodeContextHash,
        "order",
      );
      check(
        hash({
          schemaVersion: "rescue-service-order-v0",
          evaluatorVersion,
          episodeHash: order.episodeHash,
          commanderActionHash: order.commanderActionHash,
          serviceManifestHash: order.serviceManifestHash,
        }) === order.orderId,
        "order",
      );
      const action = actionHashes.get(order.commanderActionHash);
      check(
        action && action.serviceId === order.serviceId && action.minute === order.orderedAtMinute,
        "order",
      );
    }
    for (const event of outcome.transcript) {
      if (event.type === "PAYMENT_RESERVED") {
        const order = orders.get(String(event.data.orderId));
        check(order && !reserved.has(order.orderId), "order");
        equal(
          event.data,
          {
            orderId: order.orderId,
            serviceId: order.serviceId,
            credits: order.amountCredits,
            dueAtMinute: order.dueAtMinute,
            episodeHash: order.episodeHash,
            commanderActionHash: order.commanderActionHash,
            serviceManifestHash: order.serviceManifestHash,
          },
          "order",
        );
        check(event.gameMinute === order.orderedAtMinute, "order");
        reserved.add(order.orderId);
        available -= order.amountCredits;
        held += order.amountCredits;
      } else if (event.type === "SERVICE_RECEIPT") {
        const receipt = z
          .object({
            receiptHash: hashSchema,
            deliverableHash: hashSchema,
            orderId: hashSchema,
            serviceId: z.string(),
            deliveredAtMinute: integer,
          })
          .passthrough()
          .parse(event.data.receipt);
        const order = orders.get(receipt.orderId);
        check(order && reserved.has(order.orderId) && !receipts.has(order.orderId), "receipt");
        const { receiptHash, deliverableHash, ...body } = receipt;
        check(
          hash(body) === receiptHash &&
            receiptHash === order.receiptHash &&
            deliverableHash === order.deliverableHash,
          "receipt",
        );
        check(
          hash({
            schemaVersion: "rescue-service-deliverable-v0",
            orderId: order.orderId,
            receiptHash,
          }) === deliverableHash,
          "receipt",
        );
        check(
          hash({
            schemaVersion: "rescue-service-acceptance-v0",
            orderId: order.orderId,
            episodeContextHash,
            deliverableHash,
            receiptHash,
          }) === order.acceptanceHash,
          "receipt",
        );
        check(
          receipt.serviceId === order.serviceId && receipt.deliveredAtMinute === event.gameMinute,
          "receipt",
        );
        receipts.add(order.orderId);
      } else if (event.type === "PAYMENT_RELEASED" || event.type === "PAYMENT_REFUNDED") {
        const order = orders.get(String(event.data.orderId));
        check(order && reserved.has(order.orderId) && !resolved.has(order.orderId), "order");
        check(
          order.gamePaymentState ===
            (event.type === "PAYMENT_RELEASED" ? "released" : "refunded") &&
            order.resolvedAtMinute === event.gameMinute &&
            event.data.credits === order.amountCredits,
          "order",
        );
        check(
          event.data.serviceId === order.serviceId &&
            event.data.episodeHash === order.episodeHash &&
            event.data.commanderActionHash === order.commanderActionHash &&
            event.data.serviceManifestHash === order.serviceManifestHash,
          "order",
        );
        if (event.type === "PAYMENT_RELEASED") {
          check(
            receipts.has(order.orderId) &&
              event.data.receiptHash === order.receiptHash &&
              event.data.deliverableHash === order.deliverableHash,
            "receipt",
          );
          spent += order.amountCredits;
        } else {
          check(!receipts.has(order.orderId), "receipt");
          available += order.amountCredits;
        }
        held -= order.amountCredits;
        resolved.add(order.orderId);
      }
      check(available >= 0 && held >= 0, "payment");
    }
    check(reserved.size === orders.size, "order");
    for (const order of orders.values()) {
      check((order.gamePaymentState !== "reserved") === resolved.has(order.orderId), "order");
      if (!receipts.has(order.orderId))
        check(
          order.receiptHash === null &&
            order.deliverableHash === null &&
            order.acceptanceHash === null,
          "receipt",
        );
    }
    equal(
      payment.gameLedger,
      {
        unit: "Rescue Credits",
        initialBalance: 100,
        availableBalance: available,
        reservedBalance: held,
        spentBalance: spent,
      },
      "payment",
    );
    check(outcome.netResponseSpendCredits === spent, "projection");
    return {
      schemaVersion: "rescue-doctrine-integrity-v0",
      verification: "hash-consistency",
      integrityVerified: true,
      evaluatorReplay: false,
      correctnessVerified: false,
      signatureVerified: false,
      paymentVerified: false,
      commitmentPreimagesVerified: false,
      episodeId: request.episodeId,
      hashes: {
        artifact: artifactHash,
        evaluation: evaluationHash,
        outcome: resultHash,
        transcript: outcome.transcriptHash,
        paymentEvidence: evidenceHash,
      },
      checkedOrders: orders.size,
      checkedReceipts: receipts.size,
    };
  } catch (error) {
    if (error instanceof FrontierError) throw error;
    fail("input");
  }
}
