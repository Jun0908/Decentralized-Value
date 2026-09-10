import { describe, expect, it } from "vitest";
import {
  createRescueBaselinePolicy,
  createRescuePracticeSession,
  evaluateRescuePolicy,
  generateRescueEpisode,
  getInitialRescuePublicView,
  evaluateRescuePracticeEpisode,
  publicRescueRoomScenario,
  replayRescuePracticeCommander,
  replayRescueEpisode,
  rescueEpisodeHash,
  rescueCommanderPlaybookHash,
  rescueCommanderStarterPlaybook,
  rescuePublicViewHash,
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
