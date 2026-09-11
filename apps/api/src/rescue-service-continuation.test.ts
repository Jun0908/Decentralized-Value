import { describe, expect, it } from "vitest";
import {
  publicRescueRoomScenario,
  rescueCommanderStarterPlaybook,
  type RescueEpisodeOutcome,
} from "@frontier/rescue-room";
import { runRescueServiceWorkflow } from "./rescue-service-workflow";
import {
  executeRescueCommanderHire,
  executeRescueServiceAgent,
  type RescueAgentModel,
} from "./rescue-service-agent";
import {
  allocateRescueDemoPools,
  continueRescuePurchasedAnalysis,
  executeRescueContinuationDecision,
} from "./rescue-service-continuation";

const model: RescueAgentModel = async (request) => {
  const input = JSON.parse(request.input);
  const value =
    request.role === "commander-hire"
      ? {
          action: { type: "BUY_SERVICE", serviceId: "pulse-monitor" },
          reasonCode: "test-hire",
          confidencePpm: 300000,
        }
      : request.role === "commander-response"
        ? {
            action: input.turn === 1 ? { type: "WAIT", minutes: 3 } : { type: "CLOSE_INCIDENT" },
            reasonCode: "inconclusive-monitor",
            confidencePpm: 300000,
          }
        : {
            requestHash: input.requestHash,
            assessment: "inconclusive",
            likelyAffectedModule: null,
            confidencePpm: 300000,
            evidenceRefs: [input.evidenceRefs[0]],
            recommendation: "continue-monitoring",
            summary: "Uncertain source report.",
          };
  return {
    rawOutput: JSON.stringify(value),
    provider: "injected-test-model",
    configuredModel: "test-only",
    responseIds: [],
    usage: { requests: 1, inputTokens: 10, outputTokens: 10, totalTokens: 20 },
  };
};
async function fixture() {
  const request = {
    episodeId: publicRescueRoomScenario().episodes[0]!.id,
    playbook: rescueCommanderStarterPlaybook,
  };
  const hash = `0x${"1".repeat(64)}` as const;
  const receipt = {
    transactionHash: hash,
    blockNumber: "1",
    state: "confirmed" as const,
    verifiedEvent: true as const,
    recipientBalanceAfter: "5000000",
  };
  const source = await runRescueServiceWorkflow({
    ...request,
    deadlineUnixSeconds: 1800000000,
    commander: (r) => executeRescueCommanderHire(r, { model }),
    specialist: (r) => executeRescueServiceAgent(r, { model }),
    payments: {
      mode: "isolated-local-test",
      reserve: async () => ({ key: hash, providerAddress: `0x${"2".repeat(40)}` }),
      fund: async () => receipt,
      deliverAndRelease: async () => ({ delivery: receipt, release: receipt }),
    },
    recordEvent: async () => {},
  });
  if (source.status !== "service-purchased") throw new Error("fixture failed");
  return { source, request };
}
describe("purchased analysis continuation", () => {
  it("feeds paid analysis into subsequent decisions and deterministically replays the final outcome", async () => {
    const f = await fixture();
    const run = await continueRescuePurchasedAnalysis({
      ...f,
      decide: (input) => executeRescueContinuationDecision(input, { model }),
    });
    expect(run.turns).toHaveLength(2);
    expect(run.turns[0]!.input.paidAnalysis.analysis.summary).toBe("Uncertain source report.");
    expect(JSON.stringify(run.turns.map((t) => t.input))).not.toMatch(
      /validPatchId|incidentFamily|hiddenState/,
    );
    // A purchased simulated report may state a severity estimate; that is not the hidden truth.
    expect(run.turns[1]!.input.boundary).toContain("simulated source reports");
    expect(run.replayVerified).toBe(true);
    expect(run.newChainTransactions).toBe(0);
    expect(run.outcome.actionCount).toBe(3);
    const replay = await continueRescuePurchasedAnalysis({
      ...f,
      decide: async (input) => run.turns[input.turn - 1]!,
    });
    expect(replay.evidenceHash).toBe(run.evidenceHash);
    expect(run.comparison.allocationState).toBe("preview-not-paid");
  });
  it("rejects another purchase even if an injected model asks for one", async () => {
    const f = await fixture();
    const buy: RescueAgentModel = async (input) => ({
      ...(await model(input)),
      rawOutput: JSON.stringify({
        action: { type: "BUY_SERVICE", serviceId: "pulse-monitor" },
        reasonCode: "buy-again",
        confidencePpm: 1,
      }),
    });
    await expect(
      continueRescuePurchasedAnalysis({
        ...f,
        decide: (i) => executeRescueContinuationDecision(i, { model: buy }),
      }),
    ).rejects.toThrow("CONTINUATION_ACTION_NOT_AUTHORIZED");
  });
  it("does not let replay callback fields overwrite the reconstructed input", async () => {
    const f = await fixture();
    await expect(
      continueRescuePurchasedAnalysis({
        ...f,
        decide: async (i) => ({
          ...(await executeRescueContinuationDecision(i, { model })),
          input: { altered: true },
          turn: 99,
        }),
      }),
    ).rejects.toThrow("RECORDED_CONTINUATION_INPUT_MISMATCH");
  });
  it("rejects tampered recorded input and source evidence", async () => {
    const f = await fixture();
    await expect(
      continueRescuePurchasedAnalysis({
        ...f,
        decide: async (i) => ({
          ...(await executeRescueContinuationDecision(i, { model })),
          inputHash: `0x${"0".repeat(64)}`,
        }),
      }),
    ).rejects.toThrow("CONTINUATION_DECISION_MISMATCH");
    const source = structuredClone(f.source);
    source.specialist.delivery.analysis.summary = "Invented";
    await expect(
      continueRescuePurchasedAnalysis({
        ...f,
        source,
        decide: (i) => executeRescueContinuationDecision(i, { model }),
      }),
    ).rejects.toThrow();
  });
  it("keeps independent winners, excludes invalid results and is order-independent", async () => {
    const { source } = await fixture();
    const outcome = (
      loss: number,
      availability: number,
      spend: number,
      correctness = true,
    ): RescueEpisodeOutcome => ({
      ...source.simulatedOutcome,
      userLossUsd: loss,
      servedProtocolDemandPpm: availability,
      netResponseSpendCredits: spend,
      correctness,
    });
    const candidates = [
      { id: "protect", name: "Protect", outcome: outcome(0, 100, 80) },
      { id: "available", name: "Available", outcome: outcome(50, 1000000, 10) },
      { id: "cheap", name: "Cheap", outcome: outcome(100, 500000, 0) },
      { id: "invalid", name: "Invalid", outcome: outcome(0, 1000000, 0, false) },
    ];
    const result = allocateRescueDemoPools(candidates);
    expect(result).toEqual(allocateRescueDemoPools([...candidates].reverse()));
    expect(result.pools.map((p) => p.allocations[0]!.id)).toEqual([
      "protect",
      "available",
      "cheap",
    ]);
    expect(result.frontier).not.toContain("invalid");
    expect(
      result.pools.every((p) => p.allocations.reduce((sum, a) => sum + a.credits, 0) === 100),
    ).toBe(true);
  });
});
