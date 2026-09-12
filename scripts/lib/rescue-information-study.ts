import {
  publicRescueRoomScenario,
  rescueCommanderStarterPlaybook,
  rescueRoomMetrics,
} from "../../packages/rescue-room/src/index";
import { rescueServiceExecutionHash } from "../../packages/rescue-room/src/service-execution";

/** A design commitment, not an execution/result/evaluator attestation. No inference adapter. */
export function prepareRescueInformationStudy() {
  const scenario = publicRescueRoomScenario();
  const episodeIds = scenario.episodes.map(({ id }) => id);
  const body = {
    schemaVersion: "rescue-information-study-plan-v1",
    status: "design-only-not-executed",
    population: "all-public-practice-episodes-not-hidden-final",
    episodeIds,
    context: {
      practiceContextHash: scenario.contextHash,
      manifestHash: scenario.manifestHash,
      commanderContextHash: scenario.commanderRuntime.contextHash,
      dataVersion: scenario.dataVersion,
      proposedModel: scenario.commanderRuntime.model,
      proposedModelSettings: scenario.commanderRuntime.modelSettings,
      playbook: rescueCommanderStarterPlaybook,
      service: scenario.services.find(({ id }) => id === "pulse-monitor")!,
      metrics: rescueRoomMetrics(1),
    },
    protocol: {
      version: "fixed-monitor-short-continuation-ablation-v1",
      maximumContinuationTurns: 3,
      horizonMinutes: scenario.horizonMinutes,
      replicatesPerEpisode: 1,
      arms: ["analysis-visible", "analysis-withheld", "no-purchase"] as const,
      baselines: ["always-pause", "never-pause"] as const,
      purchase:
        "Fixed pulse-monitor purchase prefix for the first two arms; not a Commander hiring-choice experiment.",
      analysis:
        "One new specialist output per Episode, bound to that Episode's initial public input; identical output retained for the paired arms, never reused across Episodes.",
      commonInput:
        "Fresh stateless Commander per arm/turn. Same prompt/playbook/model controls. No transcript, receipt or output from another arm.",
      masking:
        "Both arms omit simulator ServiceReceipts and SERVICE observations from model input. Only analysis-visible receives the real specialist analysis field. Ledger, timing and actions remain observable. True state, public Episode IDs, hashes and evaluator results never enter model input.",
      control:
        "No-purchase starts at T+0 with full game budget. Visible-versus-withheld isolates analysis content; visible-versus-no-purchase includes purchase cost and opportunity cost, not pure information causality.",
      additionalPurchases: false,
      applyPatch: false,
      deliveryTime:
        "Simulator time from the same declared purchase prefix; real inference latency recorded separately, not charged as game minutes.",
      termination:
        "Close, invalid action, or three decisions; evaluator advances to horizon. Never silently substitute baseline actions for failed models.",
      executionOrder:
        "Rotate the three arm orders by Episode index modulo three; order is scheduling, not a reproducible model seed.",
      modelReplay:
        "Record actual model inputs/outputs and actions. Replay actions only; fresh model output equality is not assumed.",
      failures:
        "Keep every planned slot, including timeout, parse, invalid-action and budget-stop. Pairwise comparison only for complete correct same-Episode pairs; disclose denominators and all missing slots.",
      reporting:
        "Per-Episode independent deltas, dominance/tradeoff/equal counts, correctness and coverage. No weighted score, best-of-N, failed-run exclusion or post-hoc Episode replacement.",
      goBoundary:
        "Local plumbing GO only after masked-input leak tests, identical purchase prefixes and deterministic action replay. AI utility and hidden-Final generalization remain separate empirical questions.",
    },
    cases: episodeIds.map((episodeId, index) => ({
      episodeId,
      replicate: 1,
      armOrder: [
        ["analysis-visible", "analysis-withheld", "no-purchase"],
        ["analysis-withheld", "no-purchase", "analysis-visible"],
        ["no-purchase", "analysis-visible", "analysis-withheld"],
      ][index % 3]!,
    })),
    resourceCeiling: {
      specialistCalls: episodeIds.length,
      commanderCalls: episodeIds.length * 3 * 3,
      totalCalls: episodeIds.length * 10,
      automaticRetries: 0,
      chainTransactions: 0,
      approvedLiveCalls: 0,
      approvedSpendUsd: 0,
    },
    pendingBeforeExecution: [
      "Implement and test the masked model-input projection and paired-arm runner.",
      "Bind final experiment code digest, complete prompt digest, provider/model settings and output limits to a new execution commitment before any calls.",
      "Confirm remaining account budget and reserve a hard cost ceiling; this design grants no inference/payment authority.",
      "Run all local invalid-action, failure-retention, leakage and action-replay fixtures.",
    ],
    boundary: {
      localDesignCommitmentOnly: true,
      publicTimestampProven: false,
      modelExecuted: false,
      aiUtilityProven: false,
      servicePayment: "simulated-game-credits-only",
      rewardEligible: false,
      hiddenFinal: false,
    },
  } as const;
  return { ...structuredClone(body), planHash: rescueServiceExecutionHash(body) };
}
