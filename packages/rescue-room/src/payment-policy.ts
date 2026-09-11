import { canonicalProtocolJson } from "@frontier/shared";
import { keccak256, stringToHex, type Hex } from "viem";
import { z } from "zod";
import {
  rescueActionSchema,
  rescueCommanderPaymentActionHash,
  rescuePaymentEpisodeContextHash,
  rescueRoomHorizonMinutes,
  rescueRoomMaximumDecisions,
  rescueServiceManifestHash,
  rescueServiceOrderId,
  rescueServices,
  rescueUsdDemoToken,
  serviceIdSchema,
  type RescueGamePaymentOrderEvidence,
} from "./index";

const hashSchema = z
  .string()
  .regex(/^0x[0-9a-f]{64}$/)
  .refine((s) => !/^0x0+$/.test(s))
  .transform((s) => s as Hex);
const addressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/)
  .refine((s) => !/^0x0+$/.test(s))
  .transform((s) => s.toLowerCase());
const uint256Schema = z
  .string()
  .max(78)
  .regex(/^(0|[1-9][0-9]*)$/)
  .refine((s) => /^[0-9]{1,78}$/.test(s) && BigInt(s) < 2n ** 256n);
const amountSchema = uint256Schema.refine((s) => /^[1-9][0-9]{0,77}$/.test(s));
const unixSecondsSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

/**
 * Operator-owned configuration, never model output. No deployment is implied by an address.
 * Lazy schemas allow the package entry point to re-export this adapter without evaluating
 * the existing simulator's catalog before its module initialization has completed.
 */
export const rescuePaymentPolicySchema = z.lazy(() =>
  z
    .object({
      schemaVersion: z.literal("rescue-payment-policy-v0"),
      chainId: z.literal(11_155_111),
      tokenAddress: addressSchema,
      escrowAddress: addressSchema,
      commanderWallet: addressSchema,
      evaluationContextHash: hashSchema,
      episodeHash: hashSchema,
      maximumOrderAmount: amountSchema,
      maximumEpisodeAmount: amountSchema,
      validFromUnixSeconds: unixSecondsSchema,
      validUntilUnixSeconds: unixSecondsSchema,
      maximumOrderLifetimeSeconds: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      services: z
        .array(
          z
            .object({
              serviceId: serviceIdSchema,
              providerAddress: addressSchema,
              serviceManifestHash: hashSchema,
            })
            .strict(),
        )
        .min(1)
        .max(rescueServices.length),
    })
    .strict()
    .superRefine((policy, context) => {
      const fail = (message: string) => context.addIssue({ code: "custom", message });
      if (
        /^[0-9]{1,78}$/.test(policy.maximumOrderAmount) &&
        /^[0-9]{1,78}$/.test(policy.maximumEpisodeAmount) &&
        BigInt(policy.maximumOrderAmount) > BigInt(policy.maximumEpisodeAmount)
      ) {
        fail("Order limit exceeds Episode limit");
      }
      if (policy.validUntilUnixSeconds <= policy.validFromUnixSeconds)
        fail("Invalid policy window");
      const addresses = [
        policy.commanderWallet,
        policy.escrowAddress,
        policy.tokenAddress,
        ...policy.services.map((s) => s.providerAddress),
      ];
      if (new Set(addresses).size !== addresses.length)
        fail("Payment roles must use distinct addresses");
      if (new Set(policy.services.map((s) => s.serviceId)).size !== policy.services.length) {
        fail("Duplicate Service authorization");
      }
      for (const service of policy.services) {
        if (service.serviceManifestHash !== rescueServiceManifestHash(service.serviceId)) {
          fail("Service Manifest does not match the curated catalog");
        }
      }
    }),
);
export type RescuePaymentPolicy = z.infer<typeof rescuePaymentPolicySchema>;

const orderSchema = z.lazy(() =>
  z
    .object({
      orderId: hashSchema,
      episodeContextHash: hashSchema,
      episodeHash: hashSchema,
      commanderActionHash: hashSchema,
      serviceManifestHash: hashSchema,
      serviceId: serviceIdSchema,
      amountCredits: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      orderedAtMinute: z.number().int().nonnegative().max(rescueRoomHorizonMinutes),
      dueAtMinute: z.number().int().nonnegative(),
      resolvedAtMinute: z.number().int().nonnegative().nullable(),
      gamePaymentState: z.enum(["reserved", "released", "refunded"]),
      deliverableHash: hashSchema.nullable(),
      receiptHash: hashSchema.nullable(),
      acceptanceHash: hashSchema.nullable(),
    })
    .strict(),
) satisfies z.ZodType<RescueGamePaymentOrderEvidence>;

const purchaseSchema = z.lazy(() =>
  z
    .object({
      accepted: z.literal(true),
      action: rescueActionSchema,
      decision: z.number().int().min(1).max(rescueRoomMaximumDecisions),
      publicViewHash: hashSchema,
      order: orderSchema,
      policyNonce: uint256Schema,
      deadlineUnixSeconds: unixSecondsSchema,
    })
    .strict(),
);

export type RescuePaymentPurchase = z.infer<typeof purchaseSchema>;

/** An unsigned reservation, NOT a transaction, approval, payment receipt or account nonce. */
export type RescuePaymentIntent = Readonly<{
  schemaVersion: "rescue-payment-intent-v0";
  status: "reserved-intent";
  paymentState: "not-requested";
  policyHash: Hex;
  intentHash: Hex;
  policyNonce: string;
  chainId: 11155111;
  tokenAddress: string;
  commanderWallet: string;
  escrowAddress: string;
  functionName: "fundOrder";
  args: Readonly<{
    orderId: Hex;
    provider: string;
    amount: string;
    deadline: number;
    episodeContextHash: Hex;
    commanderActionHash: Hex;
    serviceManifestHash: Hex;
  }>;
}>;

export type RescuePaymentPolicyState = Readonly<{
  policyHash: Hex;
  reservations: readonly RescuePaymentIntent[];
}>;

// Runtime provenance only, not durable authentication or a concurrency lock.
const issuedStates = new WeakSet<RescuePaymentPolicyState>();

function hash(value: unknown): Hex {
  return keccak256(stringToHex(canonicalProtocolJson(value)));
}

/**
 * Pure local state only. Keep this and the policy behind the trusted runner boundary.
 * Deserialized state is intentionally unsupported. Restarting or forking a snapshot
 * bypasses aggregate accounting: a future executor MUST
 * persist a compare-and-swap reservation before signing, scoped by wallet + Episode context.
 * No RPC, signer, token approval, refund reclamation or receipt verification is performed.
 */
export function createRescuePaymentPolicyState(policyInput: unknown): RescuePaymentPolicyState {
  const policy = rescuePaymentPolicySchema.parse(policyInput);
  const state = Object.freeze({ policyHash: hash(policy), reservations: Object.freeze([]) });
  issuedStates.add(state);
  return state;
}

/**
 * purchaseInput must come from the trusted evaluator's accepted BUY_SERVICE and its
 * pre-action view hash, not an HTTP/model assertion of `accepted: true`. Hash binding
 * detects substitution; it does not authenticate who evaluated the action.
 * nowUnixSeconds is explicit wall-clock time, never an Episode's game minute.
 */
export function reserveRescuePaymentIntent(
  policyInput: unknown,
  state: RescuePaymentPolicyState,
  purchaseInput: unknown,
  nowUnixSeconds: number,
): { state: RescuePaymentPolicyState; intent: RescuePaymentIntent; reused: boolean } {
  const policy = rescuePaymentPolicySchema.parse(policyInput);
  const policyHash = hash(policy);
  if (!issuedStates.has(state)) throw new Error("Unrecognized local Payment reservation state");
  if (state.policyHash !== policyHash)
    throw new Error("Payment policy changed; reservation state mismatch");
  const now = unixSecondsSchema.parse(nowUnixSeconds);
  const purchase = purchaseSchema.parse(purchaseInput);
  const { order, action } = purchase;
  if (now < policy.validFromUnixSeconds || now >= policy.validUntilUnixSeconds) {
    throw new Error("Payment policy is not currently valid");
  }
  if (
    purchase.deadlineUnixSeconds <= now ||
    purchase.deadlineUnixSeconds > policy.validUntilUnixSeconds ||
    purchase.deadlineUnixSeconds - now > policy.maximumOrderLifetimeSeconds
  ) {
    throw new Error("Payment deadline is outside the allowed wall-clock window");
  }
  if (action.type !== "BUY_SERVICE" || action.serviceId !== order.serviceId) {
    throw new Error("Only a matching accepted BUY_SERVICE can reserve a payment");
  }
  if (order.gamePaymentState === "refunded") throw new Error("Cannot mirror a refunded Game Order");
  if (
    order.episodeHash !== policy.episodeHash ||
    order.episodeContextHash !==
      rescuePaymentEpisodeContextHash(
        policy.evaluationContextHash as Hex,
        policy.episodeHash as Hex,
      )
  ) {
    throw new Error("Payment Episode context mismatch");
  }
  const authorization = policy.services.find((s) => s.serviceId === order.serviceId);
  if (!authorization) throw new Error("Service is not authorized by the payment policy");
  if (order.serviceManifestHash !== authorization.serviceManifestHash) {
    throw new Error("Payment Service Manifest mismatch");
  }
  const service = rescueServices.find((s) => s.id === order.serviceId)!;
  if (
    order.amountCredits !== service.priceCredits ||
    order.dueAtMinute !== order.orderedAtMinute + service.deliveryMinutes
  ) {
    throw new Error("Game Order price or delivery time mismatch");
  }
  const actionHash = rescueCommanderPaymentActionHash({
    episodeHash: order.episodeHash,
    decision: purchase.decision,
    gameMinute: order.orderedAtMinute,
    publicViewHash: purchase.publicViewHash as Hex,
    action,
  });
  if (order.commanderActionHash !== actionHash) throw new Error("Commander Action hash mismatch");
  if (
    order.orderId !==
    rescueServiceOrderId({
      episodeHash: order.episodeHash,
      commanderActionHash: actionHash,
      serviceManifestHash: order.serviceManifestHash,
    })
  ) {
    throw new Error("Payment Order ID mismatch");
  }
  const amount = BigInt(order.amountCredits) * 10n ** BigInt(rescueUsdDemoToken.decimals);
  if (amount > BigInt(policy.maximumOrderAmount)) throw new Error("Payment Order limit exceeded");
  const intentBody = {
    schemaVersion: "rescue-payment-intent-v0" as const,
    status: "reserved-intent" as const,
    paymentState: "not-requested" as const,
    policyHash,
    policyNonce: purchase.policyNonce,
    chainId: policy.chainId,
    tokenAddress: policy.tokenAddress,
    commanderWallet: policy.commanderWallet,
    escrowAddress: policy.escrowAddress,
    functionName: "fundOrder" as const,
    args: Object.freeze({
      orderId: order.orderId,
      provider: authorization.providerAddress,
      amount: amount.toString(),
      deadline: purchase.deadlineUnixSeconds,
      episodeContextHash: order.episodeContextHash,
      commanderActionHash: actionHash,
      serviceManifestHash: order.serviceManifestHash,
    }),
  };
  const intent = Object.freeze({ ...intentBody, intentHash: hash(intentBody) });
  const previous = state.reservations.find((r) => r.args.orderId === order.orderId);
  if (previous) {
    if (previous.intentHash !== intent.intentHash)
      throw new Error("Conflicting Payment Order retry");
    return { state, intent: previous, reused: true };
  }
  if (BigInt(purchase.policyNonce) !== BigInt(state.reservations.length)) {
    throw new Error("Payment policy nonce mismatch");
  }
  const reserved = state.reservations.reduce((sum, r) => sum + BigInt(r.args.amount), 0n);
  if (reserved + amount > BigInt(policy.maximumEpisodeAmount)) {
    throw new Error("Payment Episode limit exceeded");
  }
  const nextState = Object.freeze({
    policyHash,
    reservations: Object.freeze([...state.reservations, intent]),
  });
  issuedStates.add(nextState);
  return { state: nextState, intent, reused: false };
}
