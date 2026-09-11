import { describe, expect, it } from "vitest";
import {
  createRescuePracticeSession,
  publicRescueRoomScenario,
  rescueCommanderStarterPlaybook,
  rescuePublicViewHash,
  type RescueAction,
} from "./index";
import {
  assertRescueSubmissionReplayComparison,
  replayRescueSubmissionActions,
} from "./submission-replay";

function fixture(
  actions: RescueAction[] = [
    { type: "WAIT", minutes: 1 },
    { type: "WAIT", minutes: 1 },
    { type: "PAUSE_MODULE", module: "withdrawals" },
  ],
) {
  const episodeId = publicRescueRoomScenario().episodes[0]!.id;
  const playbook = structuredClone(rescueCommanderStarterPlaybook);
  const purchaseAction = { type: "BUY_SERVICE", serviceId: "pulse-monitor" } as const;
  const session = createRescuePracticeSession(episodeId, playbook);
  expect(session.takeAction(purchaseAction).accepted).toBe(true);
  const decisions = actions.map((action) => {
    const view = session.getPublicView();
    expect(session.takeAction(action).accepted).toBe(true);
    return {
      action,
      reasonCode: "public-replay-fixture",
      confidencePpm: 300000,
      gameMinute: view.gameMinute,
      publicViewHash: rescuePublicViewHash(view),
    };
  });
  return {
    schemaVersion: "rescue-submission-replay-v1",
    episodeId,
    playbook,
    purchaseAction,
    decisions,
    expectedOutcome: session.finish(),
    expectedComparison: { preview: true },
  };
}

describe("public Rescue submission action replay", () => {
  it("reproduces full outcome and transcript from public fixture without operator state", () => {
    const input = fixture();
    const result = replayRescueSubmissionActions(input);
    expect(result.outcome).toEqual(input.expectedOutcome);
    expect(result.decisionCount).toBe(3);
    expect(result.outcome.finalMinute).toBe(60);
  });

  it("accepts an earlier authorized terminal decision", () => {
    const input = fixture([{ type: "CLOSE_INCIDENT" }]);
    expect(replayRescueSubmissionActions(input).decisionCount).toBe(1);
  });

  it("rejects changed actions even when result and transcript hashes are untouched", () => {
    const input = fixture();
    input.decisions[2]!.action = { type: "PAUSE_PROTOCOL" };
    expect(() => replayRescueSubmissionActions(input)).toThrow("OUTCOME_MISMATCH");
  });

  it.each(["minute", "viewHash", "episode"])("rejects changed %s context", (field) => {
    const input = fixture();
    if (field === "minute") input.decisions[0]!.gameMinute += 1;
    if (field === "viewHash") input.decisions[0]!.publicViewHash = `0x${"0".repeat(64)}`;
    if (field === "episode") input.episodeId = publicRescueRoomScenario().episodes[1]!.id;
    expect(() => replayRescueSubmissionActions(input)).toThrow("VIEW_CONTEXT_MISMATCH");
  });

  it("rejects disallowed playbook actions and purchase prefixes", () => {
    const input = fixture();
    input.playbook.allowedProtocolActions = input.playbook.allowedProtocolActions.filter(
      (a) => a !== "PAUSE_MODULE",
    );
    // The playbook is intentionally not part of publicView; the session still enforces it.
    expect(() => replayRescueSubmissionActions(input)).toThrow("DECISION_REJECTED");
    const noBudget = fixture();
    noBudget.playbook.investigationBudgetCredits = 0;
    expect(() => replayRescueSubmissionActions(noBudget)).toThrow("PURCHASE_REJECTED");
  });

  it("does not trust recorded metric values just because the embedded resultHash matches", () => {
    const input = fixture();
    input.expectedOutcome = {
      ...input.expectedOutcome,
      userLossUsd: input.expectedOutcome.userLossUsd + 1,
    };
    expect(() => replayRescueSubmissionActions(input)).toThrow("OUTCOME_MISMATCH");
  });

  it("rejects transcript edits and a changed transcriptHash", () => {
    const input = fixture();
    input.expectedOutcome = { ...input.expectedOutcome, transcript: [] };
    expect(() => replayRescueSubmissionActions(input)).toThrow("OUTCOME_MISMATCH");
    const other = fixture();
    other.expectedOutcome = { ...other.expectedOutcome, transcriptHash: `0x${"0".repeat(64)}` };
    expect(() => replayRescueSubmissionActions(other)).toThrow("OUTCOME_MISMATCH");
  });

  it("rejects omitted nonterminal turns instead of silently finishing an incomplete recording", () => {
    const input = fixture();
    input.decisions.pop();
    expect(() => replayRescueSubmissionActions(input)).toThrow("INCOMPLETE_RECORDED_TURNS");
  });

  it("rejects extra turns and actions after closing", () => {
    const input = fixture();
    input.decisions.push(input.decisions[2]!);
    expect(() => replayRescueSubmissionActions(input)).toThrow();
    const closed = fixture([{ type: "CLOSE_INCIDENT" }]);
    closed.decisions.push(closed.decisions[0]!);
    expect(() => replayRescueSubmissionActions(closed)).toThrow("ACTION_AFTER_TERMINAL");
  });

  it("forbids a second purchase and patches in this limited continuation", () => {
    const input = fixture();
    input.decisions[0]!.action = { type: "BUY_SERVICE", serviceId: "pulse-monitor" };
    expect(() => replayRescueSubmissionActions(input)).toThrow(
      "ADDITIONAL_PURCHASE_OR_PATCH_FORBIDDEN",
    );
    const patch = fixture();
    patch.decisions[0]!.action = { type: "APPLY_PATCH", receiptId: "simulated-receipt" };
    expect(() => replayRescueSubmissionActions(patch)).toThrow(
      "ADDITIONAL_PURCHASE_OR_PATCH_FORBIDDEN",
    );
  });

  it("checks the complete recomputed comparison including allocations", () => {
    const expected = {
      frontier: ["never-pause"],
      pools: [{ key: "loss", allocations: [{ id: "never-pause", credits: 100 }] }],
    };
    expect(assertRescueSubmissionReplayComparison(expected, structuredClone(expected))).toMatch(
      /^0x[0-9a-f]{64}$/,
    );
    expect(() =>
      assertRescueSubmissionReplayComparison(expected, { ...expected, frontier: [] }),
    ).toThrow("COMPARISON_MISMATCH");
    expect(() =>
      assertRescueSubmissionReplayComparison(expected, { ...expected, pools: [] }),
    ).toThrow("COMPARISON_MISMATCH");
  });
});
