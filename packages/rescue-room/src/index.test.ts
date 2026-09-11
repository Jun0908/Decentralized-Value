import { describe, expect, it } from "vitest";
import {
  buildRescueRunPaymentEvidence,
  createRescueBaselinePolicy,
  createRescuePracticeSession,
  evaluateRescueDoctrinePracticeEpisode,
  evaluateRescuePolicy,
  generateRescueEpisode,
  getInitialRescuePublicView,
  evaluateRescuePracticeEpisode,
  publicRescueRoomScenario,
  reconcileRescueSepoliaPaymentEvidence,
  replayRescuePracticeCommander,
  replayRescueEpisode,
  rescueDoctrineHash,
  rescueDoctrinePresets,
  rescueEpisodeHash,
  rescueCommanderPlaybookHash,
  rescueCommanderStarterPlaybook,
  rescuePublicViewHash,
  rescuePaymentEpisodeContextHash,
  rescueSepoliaPaymentEvidenceSchema,
  rescueServiceManifestHash,
  rescueUsdDemoToken,
  runRescuePolicy,
  type IncidentFamily,
} from "./index";

function findSeed(family: IncidentFamily): string {
  for (let index = 0; index < 1_000; index += 1) {
    const seed = `test-${family}-${index}`;
    if (generateRescueEpisode(seed).incidentFamily === family) return seed;
  }
  throw new Error(`Could not find ${family}`);
}

describe("Rescue Room Phase 0", () => {
  it("generates the same committed Episode from the same seed", () => {
    const first = generateRescueEpisode("repeatable-seed");
    const second = generateRescueEpisode("repeatable-seed");
    expect(second).toEqual(first);
    expect(rescueEpisodeHash(second)).toBe(rescueEpisodeHash(first));
  });

  it("does not expose the seed or true incident in the initial Commander view", () => {
    const episode = generateRescueEpisode("hidden-world");
    const serialized = JSON.stringify(getInitialRescuePublicView(episode));
    expect(serialized).not.toContain(episode.seed);
    expect(serialized).not.toContain(episode.incidentFamily);
    expect(serialized).not.toContain("lossRateUsdPerMinute");
  });

  it("does not reveal that a false-positive Episode is already safe", () => {
    const episode = generateRescueEpisode(findSeed("false-positive"));
    const initialView = getInitialRescuePublicView(episode);
    expect(initialView.incidentResolved).toBe(false);

    const outcome = replayRescueEpisode(episode, [{ type: "CLOSE_INCIDENT" }]);
    const transition = outcome.transcript.find(({ type }) => type === "STATE_TRANSITION");
    expect(transition?.data.incidentResolved).toBe(true);
    expect(outcome.incidentResolved).toBe(true);
  });

  it("replays an ordered Action Transcript exactly", () => {
    const episode = generateRescueEpisode("replay-seed");
    const actions = [
      { type: "BUY_SERVICE" as const, serviceId: "pulse-monitor" as const, targetModule: null },
      { type: "WAIT" as const, minutes: 2 },
      { type: "PAUSE_MODULE" as const, module: "withdrawals" as const },
      { type: "CLOSE_INCIDENT" as const },
    ];
    const first = replayRescueEpisode(episode, actions);
    const second = replayRescueEpisode(episode, actions);
    expect(second.resultHash).toBe(first.resultHash);
    expect(second.transcriptHash).toBe(first.transcriptHash);
    expect(second.transcript).toEqual(first.transcript);
  });

  it("keeps Service evidence quality independent of purchase order", () => {
    const episode = generateRescueEpisode("service-realization-order");
    const first = replayRescueEpisode(episode, [
      { type: "BUY_SERVICE", serviceId: "pulse-monitor" },
      { type: "WAIT", minutes: 1 },
    ]);
    const second = replayRescueEpisode(episode, [
      { type: "BUY_SERVICE", serviceId: "second-opinion" },
      { type: "BUY_SERVICE", serviceId: "pulse-monitor" },
      { type: "WAIT", minutes: 2 },
    ]);
    const findPulse = (outcome: typeof first) => {
      const event = outcome.transcript.find(
        ({ type, data }) =>
          type === "SERVICE_RECEIPT" &&
          (data.receipt as { serviceId?: string } | undefined)?.serviceId === "pulse-monitor",
      );
      const receipt = event?.data.receipt as
        | {
            classification: string;
            likelyAffectedModule: string | null;
            severity: number | null;
            confidencePpm: number;
            summary: string;
          }
        | undefined;
      if (!receipt) throw new Error("Pulse Monitor receipt missing");
      return receipt;
    };
    const firstPulse = findPulse(first);
    const secondPulse = findPulse(second);
    expect({
      classification: secondPulse.classification,
      likelyAffectedModule: secondPulse.likelyAffectedModule,
      severity: secondPulse.severity,
      confidencePpm: secondPulse.confidencePpm,
      summary: secondPulse.summary,
    }).toEqual({
      classification: firstPulse.classification,
      likelyAffectedModule: firstPulse.likelyAffectedModule,
      severity: firstPulse.severity,
      confidencePpm: firstPulse.confidencePpm,
      summary: firstPulse.summary,
    });
  });

  it("binds each simulated Service payment to deterministic Order and deliverable hashes", () => {
    const episode = generateRescueEpisode("service-realization-order");
    const outcome = replayRescueEpisode(episode, [
      { type: "BUY_SERVICE", serviceId: "pulse-monitor" },
      { type: "WAIT", minutes: 1 },
    ]);
    const evaluationContextHash = rescueEpisodeHash(episode);
    const contextHash = rescuePaymentEpisodeContextHash(evaluationContextHash, outcome.episodeHash);
    const first = buildRescueRunPaymentEvidence(outcome, evaluationContextHash);
    const second = buildRescueRunPaymentEvidence(outcome, evaluationContextHash);

    expect(second).toEqual(first);
    expect(first.evidenceHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(first.evidenceState).toBe("simulated");
    expect(first.onchainMirror.paymentState).toBe("not-requested");
    expect(first.orders).toHaveLength(1);
    expect(first.orders[0]).toMatchObject({
      episodeContextHash: contextHash,
      serviceId: "pulse-monitor",
      amountCredits: 5,
      gamePaymentState: "released",
      serviceManifestHash: rescueServiceManifestHash("pulse-monitor"),
    });
    expect(first.orders[0]!.orderId).toMatch(/^0x[0-9a-f]{64}$/);
    expect(first.orders[0]!.commanderActionHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(first.orders[0]!.deliverableHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(first.orders[0]!.receiptHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(first.orders[0]!.acceptanceHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(first.gameLedger).toEqual({
      unit: "Rescue Credits",
      initialBalance: 100,
      availableBalance: 95,
      reservedBalance: 0,
      spentBalance: 5,
    });
  });

  it("requires confirmed release and provider balance evidence before a payment is paid", () => {
    const episode = generateRescueEpisode("service-realization-order");
    const outcome = replayRescueEpisode(episode, [
      { type: "BUY_SERVICE", serviceId: "pulse-monitor" },
      { type: "WAIT", minutes: 1 },
    ]);
    const game = buildRescueRunPaymentEvidence(outcome, rescueEpisodeHash(episode));
    const order = game.orders[0]!;
    const tokenAddress = `0x${"2".repeat(40)}`;
    const commanderWallet = `0x${"3".repeat(40)}`;
    const serviceAgentWallet = `0x${"4".repeat(40)}`;
    const escrowAddress = `0x${"5".repeat(40)}`;
    const transactionHash = `0x${"6".repeat(64)}`;
    const released = {
      schemaVersion: "rescue-sepolia-payment-evidence-v0",
      network: "sepolia",
      chainId: rescueUsdDemoToken.chainId,
      paymentState: "released",
      token: {
        symbol: rescueUsdDemoToken.symbol,
        address: tokenAddress,
        decimals: rescueUsdDemoToken.decimals,
        monetaryValueClaim: false,
      },
      orderId: order.orderId,
      episodeContextHash: order.episodeContextHash,
      commanderActionHash: order.commanderActionHash,
      serviceManifestHash: order.serviceManifestHash,
      commanderWallet,
      serviceAgentWallet,
      escrowAddress,
      amount: "5000000",
      deliverableHash: order.deliverableHash,
      receiptHash: order.receiptHash,
      acceptanceHash: order.acceptanceHash,
      depositTransactionHash: transactionHash,
      releaseTransactionHash: transactionHash,
      refundTransactionHash: null,
      blockNumber: 1,
      eventLogIndex: 0,
      providerBalanceBefore: "0",
      providerBalanceAfter: "5000000",
      failureReason: null,
    };

    expect(rescueSepoliaPaymentEvidenceSchema.safeParse(released).success).toBe(true);
    expect(reconcileRescueSepoliaPaymentEvidence(game, released)).toEqual(released);
    expect(
      rescueSepoliaPaymentEvidenceSchema.safeParse({
        ...released,
        releaseTransactionHash: null,
        providerBalanceAfter: null,
      }).success,
    ).toBe(false);
    expect(() =>
      reconcileRescueSepoliaPaymentEvidence(game, {
        ...released,
        episodeContextHash: `0x${"7".repeat(64)}`,
      }),
    ).toThrow("Episode context");
    expect(() =>
      reconcileRescueSepoliaPaymentEvidence(game, {
        ...released,
        providerBalanceAfter: "5000001",
      }),
    ).toThrow("balance increase");
  });

  it("makes full Pause costly during a benign event", () => {
    const episode = generateRescueEpisode(findSeed("false-positive"));
    const paused = runRescuePolicy(episode, createRescueBaselinePolicy("always-pause", episode));
    const active = runRescuePolicy(episode, createRescueBaselinePolicy("never-pause", episode));
    expect(paused.userLossUsd).toBe(0);
    expect(active.userLossUsd).toBe(0);
    expect(paused.servedProtocolDemandPpm).toBeLessThan(active.servedProtocolDemandPpm);
  });

  it("makes inaction costly during a contract exploit", () => {
    const episode = generateRescueEpisode(findSeed("contract-exploit"));
    const paused = runRescuePolicy(episode, createRescueBaselinePolicy("always-pause", episode));
    const active = runRescuePolicy(episode, createRescueBaselinePolicy("never-pause", episode));
    expect(paused.userLossUsd).toBeLessThan(active.userLossUsd);
    expect(paused.servedProtocolDemandPpm).toBeLessThan(active.servedProtocolDemandPpm);
  });

  it("binds multi-Episode evaluation to its Context and results", () => {
    const seeds = Array.from({ length: 16 }, (_, index) => `evaluation-${index}`);
    const first = evaluateRescuePolicy("simple-adaptive", seeds);
    const second = evaluateRescuePolicy("simple-adaptive", seeds);
    expect(first.correctness).toBe(true);
    expect(first.episodeCount).toBe(16);
    expect(second.contextHash).toBe(first.contextHash);
    expect(second.resultHash).toBe(first.resultHash);
  });

  it("publishes a hidden-state-safe Practice context with independent Value Pools", () => {
    const scenario = publicRescueRoomScenario();
    const serialized = JSON.stringify(scenario);
    expect(scenario.episodes).toHaveLength(35);
    expect(scenario.policies).toHaveLength(8);
    expect(scenario.valuePools).toHaveLength(4);
    expect(scenario.axes.map(({ key }) => key)).toEqual([
      "totalUserLossUsd",
      "servedProtocolDemandPpm",
      "netResponseSpendCredits",
    ]);
    expect(serialized).not.toContain("incidentFamily");
    expect(serialized).not.toContain("validPatchId");
    expect(serialized).not.toContain('"seed"');
    expect(
      scenario.valuePools.every(
        ({ allocations, budgetCredits }) =>
          allocations.reduce((sum, { credits }) => sum + credits, 0) === budgetCredits,
      ),
    ).toBe(true);
  });

  it("returns the same simulated Practice replay and reveals truth only after the run", () => {
    const scenario = publicRescueRoomScenario();
    const episodeId = scenario.episodes[0]!.id;
    const first = evaluateRescuePracticeEpisode("simple-adaptive", episodeId);
    const second = evaluateRescuePracticeEpisode("simple-adaptive", episodeId);
    expect(first.evaluationHash).toBe(second.evaluationHash);
    expect(first.outcome.transcript).toEqual(second.outcome.transcript);
    expect(first.episode.revealedAfterRun.incidentFamily).toBeTruthy();
    expect(first.aggregate.episodeCount).toBe(35);
  });

  it("normalizes Commander Playbooks as deterministic artifacts", () => {
    const reversed = {
      ...rescueCommanderStarterPlaybook,
      allowedServiceIds: [...rescueCommanderStarterPlaybook.allowedServiceIds].reverse(),
      allowedProtocolActions: [...rescueCommanderStarterPlaybook.allowedProtocolActions].reverse(),
    };
    expect(rescueCommanderPlaybookHash(reversed)).toBe(
      rescueCommanderPlaybookHash(rescueCommanderStarterPlaybook),
    );
  });

  it("normalizes Doctrine permissions while preserving strategic Service priority", () => {
    const doctrine = rescueDoctrinePresets[0]!.doctrine;
    const reorderedPermissions = {
      ...doctrine,
      constraints: {
        ...doctrine.constraints,
        allowedServiceIds: [...doctrine.constraints.allowedServiceIds].reverse(),
        allowedProtocolActions: [...doctrine.constraints.allowedProtocolActions].reverse(),
      },
    };
    const reorderedPriority = {
      ...doctrine,
      rules: {
        ...doctrine.rules,
        servicePriority: [...doctrine.rules.servicePriority].reverse(),
      },
    };

    expect(rescueDoctrineHash(reorderedPermissions)).toBe(rescueDoctrineHash(doctrine));
    expect(rescueDoctrineHash(reorderedPriority)).not.toBe(rescueDoctrineHash(doctrine));
  });

  it("runs and replays an editable deterministic Doctrine artifact", () => {
    const episodeId = publicRescueRoomScenario().episodes[0]!.id;
    const doctrine = rescueDoctrinePresets[1]!.doctrine;
    const first = evaluateRescueDoctrinePracticeEpisode(doctrine, episodeId);
    const second = evaluateRescueDoctrinePracticeEpisode(doctrine, episodeId);

    expect(first.doctrineHash).toBe(rescueDoctrineHash(doctrine));
    expect(first.evaluationHash).toBe(second.evaluationHash);
    expect(first.decisions.length).toBeGreaterThan(0);
    expect(first.decisions.every(({ accepted }) => accepted)).toBe(true);
    expect(first.replay.matchesRecordedOutcome).toBe(true);
  });

  it("keeps every published Doctrine preset valid across the public Practice pack", () => {
    const scenario = publicRescueRoomScenario();
    for (const preset of rescueDoctrinePresets) {
      for (const episode of scenario.episodes) {
        const evaluation = evaluateRescueDoctrinePracticeEpisode(preset.doctrine, episode.id);
        expect(evaluation.outcome.correctness).toBe(true);
        expect(evaluation.decisions.every(({ accepted }) => accepted)).toBe(true);
      }
    }
  });

  it("enforces the Playbook investigation budget as a common execution gate", () => {
    const episodeId = publicRescueRoomScenario().episodes[0]!.id;
    const playbook = {
      ...rescueCommanderStarterPlaybook,
      investigationBudgetCredits: 4,
    };
    const session = createRescuePracticeSession(episodeId, playbook);
    const step = session.takeAction({ type: "BUY_SERVICE", serviceId: "pulse-monitor" });

    expect(step.accepted).toBe(false);
    expect(step.invalidReason).toContain("investigation budget");
  });

  it("replays AI decision evidence and enforces Playbook authorization", () => {
    const episodeId = publicRescueRoomScenario().episodes[0]!.id;
    const playbook = {
      ...rescueCommanderStarterPlaybook,
      allowedServiceIds: [],
      maxServicePriceCredits: 0,
    };
    const session = createRescuePracticeSession(episodeId, playbook);
    const view = session.getPublicView();
    const decision = {
      decision: 1,
      gameMinute: view.gameMinute,
      publicViewHash: rescuePublicViewHash(view),
      action: { type: "BUY_SERVICE" as const, serviceId: "pulse-monitor" as const },
      reasonCode: "probe-alert",
      confidencePpm: 500_000,
      accepted: false,
      invalidReason: "Playbook does not authorize Service Agent pulse-monitor",
    };
    const step = session.takeAction(decision.action);
    const outcome = session.finish();
    const replay = replayRescuePracticeCommander(episodeId, playbook, [decision]);

    expect(step.accepted).toBe(false);
    expect(outcome.correctness).toBe(false);
    expect(replay.resultHash).toBe(outcome.resultHash);
  });
});
