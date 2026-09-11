import { describe, expect, it } from "vitest";
import { rescueCommanderStarterPlaybook } from "./index";
import { serviceExecutionFixture } from "./service-execution.test-fixture";
import {
  acceptRescueCommanderHireDecision,
  acceptRescueServiceAnalysis,
  createRescueCommanderHireRequest,
  createRescueServiceExecutionRequest,
  parseRescueServicePublicView,
  replayRescueServiceAnalysis,
  rescueServiceExecutionHash,
  validateRescueServiceExecutionRequest,
} from "./service-execution";

describe("recorded Rescue specialist analysis boundary", () => {
  it("binds accepted order, action, manifest, context and public state without leaking truth", () => {
    const { request, episode } = serviceExecutionFixture();
    expect(validateRescueServiceExecutionRequest(JSON.parse(JSON.stringify(request)))).toEqual(
      request,
    );
    expect(request.purchase.order.serviceId).toBe("trace-audit");
    const encoded = JSON.stringify(request);
    for (const key of ["seed", "incidentFamily", "validPatchId", "lossRateUsdPerMinute"])
      expect(request.publicView).not.toHaveProperty(key);
    expect(encoded).not.toContain(episode.seed);
  });

  it("replays exact recorded model text without reevaluating inference or changing legacy outcomes", () => {
    const { request, analysis, outcome, payments } = serviceExecutionFixture();
    const before = JSON.stringify({ request, outcome, payments });
    const raw = JSON.stringify(analysis, null, 2);
    const delivery = acceptRescueServiceAnalysis(request, raw);
    expect(delivery.rawOutput).toBe(raw);
    expect(delivery.correctness).toBe("not-evaluated");
    expect(delivery.acceptance).toBe("schema-and-source-references-validated");
    expect(delivery.paymentState).toBe("not-requested");
    expect(delivery.changesDeterministicEvaluation).toBe(false);
    expect(replayRescueServiceAnalysis(request, delivery)).toEqual(delivery);
    expect(JSON.stringify({ request, outcome, payments })).toBe(before);
    expect(() =>
      replayRescueServiceAnalysis(request, { ...delivery, paymentState: "paid" } as never),
    ).toThrow();
    expect(() =>
      replayRescueServiceAnalysis(request, {
        ...delivery,
        analysis: { ...analysis, summary: "modified" },
      }),
    ).toThrow();
  });

  it("allows already delivered purchased evidence, retaining its simulated provenance", () => {
    const { request, analysis } = serviceExecutionFixture(true);
    expect(request.publicView.serviceReceipts).toHaveLength(1);
    expect(
      acceptRescueServiceAnalysis(
        request,
        JSON.stringify({
          ...analysis,
          evidenceRefs: [`receipt:${request.publicView.serviceReceipts[0]!.receiptId}`],
        }),
      ).analysis.evidenceRefs[0],
    ).toMatch(/^receipt:/);
  });

  it.each([
    [
      "action",
      (input: ReturnType<typeof serviceExecutionFixture>["input"]) => {
        input.purchase.action = { type: "BUY_SERVICE", serviceId: "pulse-monitor" };
      },
    ],
    [
      "order",
      (input: ReturnType<typeof serviceExecutionFixture>["input"]) => {
        input.purchase.order.orderId = `0x${"2".repeat(64)}`;
      },
    ],
    [
      "manifest",
      (input: ReturnType<typeof serviceExecutionFixture>["input"]) => {
        input.purchase.order.serviceManifestHash = `0x${"2".repeat(64)}`;
      },
    ],
    [
      "context",
      (input: ReturnType<typeof serviceExecutionFixture>["input"]) => {
        input.purchase.order.episodeContextHash = `0x${"2".repeat(64)}`;
      },
    ],
    [
      "view",
      (input: ReturnType<typeof serviceExecutionFixture>["input"]) => {
        input.publicView.availableBudgetCredits--;
      },
    ],
    [
      "price",
      (input: ReturnType<typeof serviceExecutionFixture>["input"]) => {
        input.purchase.order.amountCredits++;
      },
    ],
    [
      "refund",
      (input: ReturnType<typeof serviceExecutionFixture>["input"]) => {
        input.purchase.order.gamePaymentState = "refunded";
      },
    ],
    [
      "rejected",
      (input: ReturnType<typeof serviceExecutionFixture>["input"]) => {
        input.purchase.accepted = false as never;
      },
    ],
  ])("rejects %s substitution", (_name, mutate) => {
    const { input } = serviceExecutionFixture();
    mutate(input);
    expect(() => createRescueServiceExecutionRequest(input)).toThrow();
  });

  it("rejects hidden fields, accessor reads, non-JSON input and oversized public data", () => {
    const { input } = serviceExecutionFixture();
    expect(() =>
      createRescueServiceExecutionRequest({
        ...input,
        publicView: { ...input.publicView, seed: "secret" },
      }),
    ).toThrow();
    let called = false;
    const hostile = {
      ...input.publicView,
      get seed() {
        called = true;
        return "secret";
      },
    };
    expect(() => parseRescueServicePublicView(hostile)).toThrow();
    expect(called).toBe(false);
    expect(() => parseRescueServicePublicView(new Date())).toThrow();
    expect(() =>
      parseRescueServicePublicView({ ...input.publicView, episodeId: "x".repeat(50_000) }),
    ).toThrow();
  });

  it("rejects unpurchased, future and corrupted evidence", () => {
    const { input } = serviceExecutionFixture(true);
    expect(() => parseRescueServicePublicView({ ...input.publicView, serviceOrders: [] })).toThrow(
      "Unpurchased",
    );
    expect(() =>
      parseRescueServicePublicView({ ...input.publicView, serviceReceipts: [] }),
    ).toThrow("Unpurchased");
    expect(() => parseRescueServicePublicView({ ...input.publicView, gameMinute: 0 })).toThrow();
    const view = structuredClone(input.publicView);
    view.serviceReceipts = view.serviceReceipts.map((receipt) => ({
      ...receipt,
      summary: "malicious replacement",
    }));
    expect(() => parseRescueServicePublicView(view)).toThrow("hash mismatch");
  });

  it.each([
    { requestHash: `0x${"2".repeat(64)}` },
    { evidenceRefs: ["receipt:unpaid-secret"] },
    { evidenceRefs: [] },
    { confidencePpm: 1_000_001 },
    { summary: "x".repeat(601) },
    { paymentState: "paid" },
    { chainOfThought: "hidden reasoning" },
    { assessment: "verified-exploit" },
  ])("rejects invalid/unauthorized model output %j", (change) => {
    const { request, analysis } = serviceExecutionFixture();
    expect(() =>
      acceptRescueServiceAnalysis(request, JSON.stringify({ ...analysis, ...change })),
    ).toThrow();
  });

  it("checks full replay envelope, not only raw text", () => {
    const { request, analysis } = serviceExecutionFixture();
    const delivery = acceptRescueServiceAnalysis(request, JSON.stringify(analysis));
    expect(() =>
      replayRescueServiceAnalysis(request, {
        ...delivery,
        deliveryHash: rescueServiceExecutionHash("forged"),
      }),
    ).toThrow();
    expect(() =>
      validateRescueServiceExecutionRequest({
        ...request,
        requestHash: rescueServiceExecutionHash("forged"),
      }),
    ).toThrow();
  });
});

describe("bounded Commander hiring", () => {
  it("offers only affordable authorized specialists and leaves action acceptance to evaluator", () => {
    const { input } = serviceExecutionFixture();
    const request = createRescueCommanderHireRequest({
      publicView: input.publicView,
      playbook: {
        ...rescueCommanderStarterPlaybook,
        allowedServiceIds: ["pulse-monitor"],
        maxServicePriceCredits: 5,
      },
    });
    expect(request.services.map((service) => service.id)).toEqual(["pulse-monitor"]);
    const raw = JSON.stringify({
      action: { type: "BUY_SERVICE", serviceId: "pulse-monitor" },
      reasonCode: "check-signal",
      confidencePpm: 500_000,
    });
    expect(acceptRescueCommanderHireDecision(request, raw).actionAcceptance).toBe(
      "requires-evaluator",
    );
    expect(() =>
      acceptRescueCommanderHireDecision(request, raw.replace("pulse-monitor", "trace-audit")),
    ).toThrow();
    expect(() =>
      acceptRescueCommanderHireDecision(
        request,
        JSON.stringify({
          action: { type: "PAUSE_PROTOCOL" },
          reasonCode: "pause",
          confidencePpm: 500_000,
        }),
      ),
    ).toThrow();
  });
});
