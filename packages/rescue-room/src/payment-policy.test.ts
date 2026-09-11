import { describe, expect, it } from "vitest";
import {
  buildRescueRunPaymentEvidence,
  createRescueEpisodeSession,
  createRescuePaymentPolicyState,
  generateRescueEpisode,
  reserveRescuePaymentIntent,
  rescueEpisodeHash,
  rescuePaymentPolicySchema,
  rescuePublicViewHash,
  rescueServiceManifestHash,
  type RescueAction,
  type RescuePaymentPolicy,
  type RescuePaymentPurchase,
} from "./index";

const hash = `0x${"1".repeat(64)}` as const;
const address = (n: number) => `0x${String(n).repeat(40)}`;
const now = 1_800_000_000;

function fixture() {
  const episode = generateRescueEpisode("payment-policy-local-only");
  const session = createRescueEpisodeSession(episode);
  const actions: RescueAction[] = [
    { type: "BUY_SERVICE", serviceId: "pulse-monitor" },
    { type: "BUY_SERVICE", serviceId: "pulse-monitor" },
    { type: "BUY_SERVICE", serviceId: "trace-audit", targetModule: "withdrawals" },
  ];
  const captures = actions.map((action) => {
    const view = session.getPublicView();
    const step = session.takeAction(action);
    return {
      accepted: step.accepted as true,
      publicViewHash: rescuePublicViewHash(view),
      decision: view.actions.length + 1,
      action,
    };
  });
  const outcome = session.finish();
  const evidence = buildRescueRunPaymentEvidence(outcome, hash);
  const purchases: RescuePaymentPurchase[] = captures.map((capture, index) => ({
    ...capture,
    order: evidence.orders[index]!,
    policyNonce: String(index),
    deadlineUnixSeconds: now + 120,
  }));
  const policy: RescuePaymentPolicy = {
    schemaVersion: "rescue-payment-policy-v0",
    chainId: 11155111,
    tokenAddress: address(2),
    escrowAddress: address(3),
    commanderWallet: address(4),
    evaluationContextHash: hash,
    episodeHash: rescueEpisodeHash(episode),
    maximumOrderAmount: "30000000",
    maximumEpisodeAmount: "100000000",
    validFromUnixSeconds: now - 60,
    validUntilUnixSeconds: now + 600,
    maximumOrderLifetimeSeconds: 180,
    services: [
      {
        serviceId: "pulse-monitor",
        providerAddress: address(5),
        serviceManifestHash: rescueServiceManifestHash("pulse-monitor"),
      },
      {
        serviceId: "trace-audit",
        providerAddress: address(6),
        serviceManifestHash: rescueServiceManifestHash("trace-audit"),
      },
    ],
  };
  return { policy, purchases, purchase: purchases[0]!, outcome, evidence };
}

describe("Rescue payment policy unsigned reservation boundary", () => {
  it("binds a real accepted Game Order to a typed, unpaid Sepolia fundOrder intent", () => {
    const { policy, purchase, outcome, evidence } = fixture();
    const before = JSON.stringify({ outcome, evidence });
    const initial = createRescuePaymentPolicyState(policy);
    const result = reserveRescuePaymentIntent(policy, initial, purchase, now);
    expect(result.reused).toBe(false);
    expect(result.intent).toMatchObject({
      status: "reserved-intent",
      paymentState: "not-requested",
      chainId: 11155111,
      tokenAddress: address(2),
      escrowAddress: address(3),
      commanderWallet: address(4),
      functionName: "fundOrder",
      policyNonce: "0",
      args: {
        orderId: purchase.order.orderId,
        provider: address(5),
        amount: "5000000",
        deadline: now + 120,
        episodeContextHash: purchase.order.episodeContextHash,
      },
    });
    expect(Object.isFrozen(result.state.reservations)).toBe(true);
    expect(Object.isFrozen(result.intent.args)).toBe(true);
    expect(initial.reservations).toHaveLength(0);
    expect(JSON.stringify({ outcome, evidence })).toBe(before);
    expect(JSON.stringify(result)).not.toContain("transactionHash");
    expect(result.intent).not.toHaveProperty("data");
  });

  it("reuses the identical order without consuming another nonce or budget", () => {
    const { policy, purchase, purchases } = fixture();
    const first = reserveRescuePaymentIntent(
      policy,
      createRescuePaymentPolicyState(policy),
      purchase,
      now,
    );
    const second = reserveRescuePaymentIntent(policy, first.state, purchases[1], now);
    const retry = reserveRescuePaymentIntent(policy, second.state, purchase, now + 1);
    expect(retry.reused).toBe(true);
    expect(retry.intent).toBe(first.intent);
    expect(retry.state).toBe(second.state);
    expect(retry.state.reservations).toHaveLength(2);
    expect(() =>
      reserveRescuePaymentIntent(
        policy,
        second.state,
        { ...purchase, deadlineUnixSeconds: now + 121 },
        now,
      ),
    ).toThrow("Conflicting");
    expect(() =>
      reserveRescuePaymentIntent(policy, second.state, { ...purchase, policyNonce: "2" }, now),
    ).toThrow("Conflicting");
  });

  it("rejects reused, future and noncanonical policy nonces for a new order", () => {
    const { policy, purchase, purchases } = fixture();
    const first = reserveRescuePaymentIntent(
      policy,
      createRescuePaymentPolicyState(policy),
      purchase,
      now,
    );
    for (const nonce of ["0", "2", "-1", "01", (2n ** 256n).toString()]) {
      expect(() =>
        reserveRescuePaymentIntent(
          policy,
          first.state,
          { ...purchases[1], policyNonce: nonce },
          now,
        ),
      ).toThrow();
    }
  });

  it("enforces the exact order and cumulative Episode ceilings including outstanding intents", () => {
    const { policy, purchase, purchases } = fixture();
    const small = { ...policy, maximumOrderAmount: "4999999" };
    expect(() =>
      reserveRescuePaymentIntent(small, createRescuePaymentPolicyState(small), purchase, now),
    ).toThrow("Order limit");
    const capped = { ...policy, maximumOrderAmount: "5000000", maximumEpisodeAmount: "5000000" };
    const first = reserveRescuePaymentIntent(
      capped,
      createRescuePaymentPolicyState(capped),
      purchase,
      now,
    );
    expect(() => reserveRescuePaymentIntent(capped, first.state, purchases[1], now)).toThrow(
      "Episode limit",
    );
    expect(first.state.reservations).toHaveLength(1);
    expect(reserveRescuePaymentIntent(capped, first.state, purchase, now).reused).toBe(true);
  });

  it.each([
    "chainId",
    "tokenAddress",
    "escrowAddress",
    "commanderWallet",
    "provider",
    "data",
    "calldata",
    "amount",
  ])("rejects AI-supplied %s rather than incorporating it into a transaction", (field) => {
    const { policy, purchase } = fixture();
    expect(() =>
      reserveRescuePaymentIntent(
        policy,
        createRescuePaymentPolicyState(policy),
        { ...purchase, [field]: "attacker-choice" },
        now,
      ),
    ).toThrow();
    expect(() =>
      reserveRescuePaymentIntent(
        policy,
        createRescuePaymentPolicyState(policy),
        { ...purchase, action: { ...purchase.action, [field]: "attacker-choice" } },
        now,
      ),
    ).toThrow();
  });

  it("rejects non-Sepolia, zero addresses, shared wallets, duplicate services and stale manifests", () => {
    const { policy } = fixture();
    const first = policy.services[0]!;
    for (const input of [
      { ...policy, chainId: 1 },
      { ...policy, tokenAddress: `0x${"0".repeat(40)}` },
      { ...policy, services: [{ ...first, providerAddress: policy.commanderWallet }] },
      { ...policy, services: [first, first] },
      { ...policy, services: [{ ...first, serviceManifestHash: hash }] },
      { ...policy, maximumOrderAmount: "100000001" },
      { ...policy, maximumOrderAmount: "not-an-integer" },
      { ...policy, maximumOrderAmount: "0" },
      { ...policy, maximumEpisodeAmount: (2n ** 256n).toString() },
    ])
      expect(rescuePaymentPolicySchema.safeParse(input).success).toBe(false);
  });

  it("rejects unauthorized services, rejected actions and actions other than BUY_SERVICE", () => {
    const { policy, purchase, purchases } = fixture();
    const restricted = { ...policy, services: [policy.services[0]!] };
    expect(() =>
      reserveRescuePaymentIntent(
        restricted,
        createRescuePaymentPolicyState(restricted),
        purchases[2],
        now,
      ),
    ).toThrow("not authorized");
    for (const input of [
      { ...purchase, accepted: false },
      { ...purchase, action: { type: "PAUSE_PROTOCOL" } },
      { ...purchase, action: { type: "BUY_SERVICE", serviceId: "trace-audit" } },
      { ...purchase, order: { ...purchase.order, gamePaymentState: "refunded" } },
    ]) {
      expect(() =>
        reserveRescuePaymentIntent(policy, createRescuePaymentPolicyState(policy), input, now),
      ).toThrow();
    }
  });

  it.each([
    "episodeHash",
    "episodeContextHash",
    "commanderActionHash",
    "serviceManifestHash",
    "orderId",
  ])("rejects substituted %s", (field) => {
    const { policy, purchase } = fixture();
    expect(() =>
      reserveRescuePaymentIntent(
        policy,
        createRescuePaymentPolicyState(policy),
        { ...purchase, order: { ...purchase.order, [field]: hash } },
        now,
      ),
    ).toThrow();
  });

  it("recomputes action binding, catalog price and Game delivery time", () => {
    const { policy, purchase } = fixture();
    for (const input of [
      { ...purchase, publicViewHash: hash },
      { ...purchase, decision: 2 },
      { ...purchase, action: { ...purchase.action, targetModule: "withdrawals" } },
      { ...purchase, order: { ...purchase.order, amountCredits: 1 } },
      { ...purchase, order: { ...purchase.order, dueAtMinute: 99 } },
      { ...purchase, order: { ...purchase.order, orderedAtMinute: 1, dueAtMinute: 3 } },
    ])
      expect(() =>
        reserveRescuePaymentIntent(policy, createRescuePaymentPolicyState(policy), input, now),
      ).toThrow();
  });

  it("uses explicit wall-clock seconds and refuses expired retries", () => {
    const { policy, purchase } = fixture();
    const state = createRescuePaymentPolicyState(policy);
    for (const deadline of [0, now, now + 181, now + 601, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() =>
        reserveRescuePaymentIntent(
          policy,
          state,
          { ...purchase, deadlineUnixSeconds: deadline },
          now,
        ),
      ).toThrow();
    }
    for (const clock of [0, now - 61, now + 600, NaN, now + 0.1]) {
      expect(() => reserveRescuePaymentIntent(policy, state, purchase, clock)).toThrow();
    }
    const result = reserveRescuePaymentIntent(policy, state, purchase, now);
    expect(() => reserveRescuePaymentIntent(policy, result.state, purchase, now + 120)).toThrow(
      "deadline",
    );
  });

  it("rejects altered policy or forged state and documents that snapshots are not atomic", () => {
    const { policy, purchase } = fixture();
    const state = createRescuePaymentPolicyState(policy);
    expect(() =>
      reserveRescuePaymentIntent({ ...policy, escrowAddress: address(7) }, state, purchase, now),
    ).toThrow("policy changed");
    expect(() => reserveRescuePaymentIntent(policy, { ...state }, purchase, now)).toThrow(
      "Unrecognized",
    );
    // Two callers can still fork a genuine snapshot: a durable CAS layer is REQUIRED before signing.
    const first = reserveRescuePaymentIntent(policy, state, purchase, now);
    const fork = reserveRescuePaymentIntent(policy, state, purchase, now);
    expect(fork.intent).toEqual(first.intent);
    expect(fork.state).not.toBe(first.state);
  });
});
