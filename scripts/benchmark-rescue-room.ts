import { mkdir, writeFile } from "node:fs/promises";
import { computeOutcomeFrontier } from "../packages/shared/src/index";
import {
  assessRescueRoomFeasibility,
  createRescueBaselinePolicy,
  evaluateRescuePolicy,
  generateRescueEpisode,
  replayRescueEpisode,
  rescueBaselinePolicyIds,
  rescueEvaluationPoint,
  rescueRoomMetrics,
  runRescuePolicy,
  type RescueBaselinePolicyId,
  type RescuePublicView,
} from "../packages/rescue-room/src/index";

const episodeCount = Number(process.env.RESCUE_ROOM_EPISODES ?? 2_000);
if (!Number.isInteger(episodeCount) || episodeCount < 100) {
  throw new Error("RESCUE_ROOM_EPISODES must be an integer of at least 100");
}
const startedAt = performance.now();

const seeds = Array.from({ length: episodeCount }, (_, index) => `phase0-v0-${index}`);
const evaluationPolicyIds: readonly RescueBaselinePolicyId[] = rescueBaselinePolicyIds;
const evaluations = evaluationPolicyIds.map((policyId) => evaluateRescuePolicy(policyId, seeds));

const replayEpisode = generateRescueEpisode("phase0-replay-check");
const replayRun = runRescuePolicy(
  replayEpisode,
  createRescueBaselinePolicy("simple-adaptive", replayEpisode),
);
const replayed = replayRescueEpisode(
  replayEpisode,
  replayRun.transcript
    .filter(({ type }) => type === "ACTION")
    .map(({ data }) => data.action)
    .filter((action): action is Parameters<typeof replayRescueEpisode>[1][number] =>
      Boolean(action),
    ),
);

let serviceHelpfulEpisodeCount = 0;
let serviceWastefulEpisodeCount = 0;
const oracleFirstActions = new Set<string>();
const families = new Set<string>();
for (const seed of seeds) {
  const episode = generateRescueEpisode(seed);
  families.add(episode.incidentFamily);
  const noService = runRescuePolicy(episode, createRescueBaselinePolicy("never-pause", episode));
  const monitor = runRescuePolicy(episode, createRescueBaselinePolicy("monitor-first", episode));
  if (monitor.userLossUsd < noService.userLossUsd) serviceHelpfulEpisodeCount += 1;
  if (
    monitor.netResponseSpendCredits > noService.netResponseSpendCredits &&
    monitor.userLossUsd >= noService.userLossUsd &&
    monitor.servedProtocolDemandPpm <= noService.servedProtocolDemandPpm
  ) {
    serviceWastefulEpisodeCount += 1;
  }
  const oracle = createRescueBaselinePolicy("oracle", episode);
  oracleFirstActions.add(
    oracle.decide({
      ...getPublicStart(episode),
    }).type,
  );
}

const packSize = Math.floor(episodeCount / 5);
const packFrontierSets = Array.from({ length: 5 }, (_, packIndex) => {
  const packSeeds = seeds.slice(packIndex * packSize, (packIndex + 1) * packSize);
  const packEvaluations = evaluationPolicyIds.map((policyId) =>
    evaluateRescuePolicy(policyId, packSeeds),
  );
  return computeOutcomeFrontier(
    packEvaluations.map(rescueEvaluationPoint),
    rescueRoomMetrics(packSeeds.length),
  ).map(({ id }) => id);
});

const assessment = assessRescueRoomFeasibility(evaluations, {
  replayDeterministic:
    replayRun.userLossUsd === replayed.userLossUsd &&
    replayRun.servedProtocolDemandPpm === replayed.servedProtocolDemandPpm &&
    replayRun.netResponseSpendCredits === replayed.netResponseSpendCredits &&
    replayRun.transcriptHash === replayed.transcriptHash,
  serviceHelpfulEpisodeCount,
  serviceWastefulEpisodeCount,
  distinctOracleFirstActions: oracleFirstActions.size,
  familyCoverage: families.size,
  packFrontierSets,
});
const runtimeMilliseconds = Math.round(performance.now() - startedAt);

const output = {
  generatedAt: new Date().toISOString(),
  status: "phase-0-feasibility; not a public Arena or settlement result",
  simulationSeedPattern: "phase0-v0-{0..1999}",
  baselinePolicyCount: evaluationPolicyIds.length,
  runtimeMilliseconds,
  runtimeWithinOperationalBudget: runtimeMilliseconds <= 120_000,
  ...assessment,
};

await mkdir("benchmarks/rescue-room/results", { recursive: true });
await writeFile(
  "benchmarks/rescue-room/results/latest.json",
  `${JSON.stringify(output, null, 2)}\n`,
  "utf8",
);
process.stdout.write(
  `${JSON.stringify(
    {
      decision: output.decision,
      rationale: output.rationale,
      episodeCount: output.episodeCount,
      baselinePolicyCount: output.baselinePolicyCount,
      runtimeMilliseconds: output.runtimeMilliseconds,
      runtimeWithinOperationalBudget: output.runtimeWithinOperationalBudget,
      criteria: output.criteria,
      diagnostics: output.diagnostics,
      frontierPolicyIds: output.frontierPolicyIds,
      evaluations: output.evaluations.map(
        ({
          policyId,
          totalUserLossUsd,
          worstEpisodeUserLossUsd,
          servedProtocolDemandPpm,
          netResponseSpendCredits,
          resolvedEpisodeCount,
          servicePurchaseCount,
        }) => ({
          policyId,
          totalUserLossUsd,
          worstEpisodeUserLossUsd,
          servedProtocolDemandPpm,
          netResponseSpendCredits,
          resolvedEpisodeCount,
          servicePurchaseCount,
        }),
      ),
      evidenceHash: output.evidenceHash,
    },
    null,
    2,
  )}\n`,
);

function getPublicStart(episode: ReturnType<typeof generateRescueEpisode>) {
  let captured: RescuePublicView | null = null;
  runRescuePolicy(episode, {
    id: "capture-start",
    name: "Capture Start",
    decide(view) {
      captured = view;
      return { type: "CLOSE_INCIDENT" };
    },
  });
  if (!captured) throw new Error("Could not capture the initial public view");
  return captured;
}
