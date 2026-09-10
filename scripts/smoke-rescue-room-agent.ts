import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { runOpenAiRescueRoomCommander } from "../apps/api/src/rescue-room-agent";
import {
  publicRescueRoomScenario,
  rescueCommanderStarterPlaybook,
} from "../packages/rescue-room/src/index";
import { config } from "dotenv";

const root = resolve(import.meta.dirname, "..");
const envPath = existsSync(resolve(root, ".env.local"))
  ? resolve(root, ".env.local")
  : resolve(root, ".env");
config({ path: envPath, quiet: true });

if (!process.env.OPENAI_API_KEY?.trim()) {
  throw new Error("OPENAI_API_KEY is required for the Rescue Room AI smoke run");
}

const scenario = publicRescueRoomScenario();
const episode = scenario.episodes[0]!;
const evaluation = await runOpenAiRescueRoomCommander({
  episodeId: episode.id,
  playbook: rescueCommanderStarterPlaybook,
});
const outputPath = resolve(root, "benchmarks/rescue-room/results/ai-smoke-latest.json");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(evaluation, null, 2)}\n`, "utf8");

process.stdout.write(
  `${JSON.stringify(
    {
      status: "ok",
      model: evaluation.runtime.configuredModel,
      episodeId: evaluation.episode.id,
      decisionCount: evaluation.decisions.length,
      correctness: evaluation.outcome.correctness,
      outcome: {
        userLossUsd: evaluation.outcome.userLossUsd,
        servedProtocolDemandPpm: evaluation.outcome.servedProtocolDemandPpm,
        netResponseSpendCredits: evaluation.outcome.netResponseSpendCredits,
      },
      usage: evaluation.runtime.usage,
      replayMatches: evaluation.replay.matchesRecordedOutcome,
      resultHash: evaluation.outcome.resultHash,
      evaluationHash: evaluation.evaluationHash,
      evidencePath: outputPath,
    },
    null,
    2,
  )}\n`,
);
