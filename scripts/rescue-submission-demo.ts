import { closeSync, existsSync, openSync, readFileSync, renameSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { createLocalRescueJobStore } from "../apps/api/src/rescue-jobs";
import { rescueServiceWorkflowRequestSchema } from "../apps/api/src/rescue-jobs-http";
import {
  continueRescuePurchasedAnalysis,
  executeRescueContinuationDecision,
} from "../apps/api/src/rescue-service-continuation";
import { openAiRescueAgentModel } from "../apps/api/src/rescue-service-agent";
import { rescueServiceExecutionHash } from "../packages/rescue-room/src/service-execution";
import { withRescueModelBudget } from "./lib/rescue-model-budget";
import { persistNewJson } from "./lib/rescue-operator-chain";

const root = resolve(import.meta.dirname, "..");
const directory = resolve(root, ".frontier/rescue-operator");
const lockPath = resolve(directory, "operator.lock");
let lock: number | undefined;
try {
  lock = openSync(lockPath, "wx", 0o600);
  const jobs = await createLocalRescueJobStore({ directory: resolve(directory, "jobs") }).list(
    "local-rescue-operator",
  );
  const job = jobs.find(
    (j) =>
      j.status === "succeeded" &&
      j.result &&
      typeof j.result === "object" &&
      !Array.isArray(j.result) &&
      j.result.status === "service-purchased",
  );
  if (!job) throw new Error("NO_PURCHASE");
  const source = job.result as unknown as Parameters<
    typeof continueRescuePurchasedAnalysis
  >[0]["source"];
  if (source.paymentState !== "paid" || source.specialist.runtime.provider !== "openai")
    throw new Error("REAL_PURCHASE_REQUIRED");
  const request = rescueServiceWorkflowRequestSchema.parse(job.request);
  const savedPath = resolve(directory, "submission-continuation-v2.json");
  const legacyPath = resolve(directory, "submission-continuation-v1.json");
  const rebind = !existsSync(savedPath) && process.argv.includes("--rebind-recorded-context");
  type Run = Awaited<ReturnType<typeof continueRescuePurchasedAnalysis>>;
  const saved: Run | null = existsSync(savedPath)
    ? JSON.parse(readFileSync(savedPath, "utf8"))
    : rebind
      ? JSON.parse(readFileSync(legacyPath, "utf8"))
      : null;
  if (saved) {
    const { evidenceHash, ...body } = saved;
    if (rescueServiceExecutionHash(body) !== evidenceHash)
      throw new Error("SAVED_EVIDENCE_TAMPERED");
  }
  if (!saved && !process.argv.includes("--execute-approved-ai"))
    throw new Error("EXPLICIT_AI_EXECUTION_REQUIRED");
  config({
    path: resolve(root, existsSync(resolve(root, ".env.local")) ? ".env.local" : ".env"),
    quiet: true,
  });
  const run = await continueRescuePurchasedAnalysis({
    source,
    request,
    decide: async (input) => {
      if (saved) {
        const result = saved.turns[input.turn - 1];
        if (!result) throw new Error("RECORDED_TURN_MISSING");
        return result;
      }
      return withRescueModelBudget(
        resolve(directory, "model-budget"),
        `submission-response-v1-${input.turn}`,
        rescueServiceExecutionHash(input),
        () => executeRescueContinuationDecision(input, { model: openAiRescueAgentModel }),
      );
    },
  });
  if (saved && !rebind && run.evidenceHash !== saved.evidenceHash)
    throw new Error("REPLAY_MISMATCH");
  if (!saved || rebind) persistNewJson(savedPath, run);
  const replayFixture = {
    schemaVersion: "rescue-submission-replay-v1",
    episodeId: request.episodeId,
    playbook: request.playbook,
    purchaseAction: source.purchase.action,
    decisions: run.turns.map((t) => ({
      ...t.decision,
      gameMinute: t.input.publicView.gameMinute,
      publicViewHash: t.input.publicViewHash,
    })),
    expectedOutcome: run.outcome,
    expectedComparison: run.comparison,
  };
  const replayOutput = resolve(root, "Docs/deployments/rescue-submission-replay.json");
  const replayTemporary = `${replayOutput}.${randomUUID()}.tmp`;
  persistNewJson(replayTemporary, replayFixture);
  renameSync(replayTemporary, replayOutput);
  const publicEvidence = {
    schemaVersion: "rescue-submission-demo-v1",
    recordedAt: run.turns.at(-1)!.runtime.completedAt,
    contextHash: run.contextHash,
    evidenceHash: run.evidenceHash,
    sourceWorkflowHash: run.sourceWorkflowHash,
    episodeId: run.episodeId,
    paidDeliveryHash: run.paidDeliveryHash,
    releaseTx: source.payment.release.transactionHash,
    specialistSummary: source.specialist.delivery.analysis.summary,
    turns: run.turns.map((t) => ({
      turn: t.turn,
      gameMinute: t.input.publicView.gameMinute,
      action: t.decision.action,
      reasonCode: t.decision.reasonCode,
      inputHash: t.inputHash,
      model: t.runtime.configuredModel,
      provider: t.runtime.provider,
    })),
    outcome: {
      correctness: run.outcome.correctness,
      userLossUsd: run.outcome.userLossUsd,
      servedProtocolDemandPpm: run.outcome.servedProtocolDemandPpm,
      netResponseSpendCredits: run.outcome.netResponseSpendCredits,
      incidentResolved: run.outcome.incidentResolved,
      resultHash: run.outcome.resultHash,
    },
    comparison: run.comparison,
    endedBy: run.endedBy,
    replayVerified: run.replayVerified,
    newChainTransactions: 0,
    protocolExecution: "simulated",
    rewardEligible: false,
    usage: run.turns.reduce(
      (sum, t) => ({
        requests: sum.requests + t.runtime.usage.requests,
        inputTokens: sum.inputTokens + t.runtime.usage.inputTokens,
        outputTokens: sum.outputTokens + t.runtime.usage.outputTokens,
      }),
      { requests: 0, inputTokens: 0, outputTokens: 0 },
    ),
  };
  const output = resolve(root, "Docs/deployments/rescue-submission-demo.json");
  const temporary = `${output}.${randomUUID()}.tmp`;
  persistNewJson(temporary, publicEvidence);
  renameSync(temporary, output);
  console.log(
    JSON.stringify({
      status: "verified",
      replayOnly: saved !== null,
      turns: run.turns.length,
      actions: run.turns.map((t) => t.decision.action.type),
      outcome: publicEvidence.outcome,
      evidenceHash: run.evidenceHash,
      usage: publicEvidence.usage,
      newChainTransactions: 0,
    }),
  );
} catch {
  console.error(
    "Submission continuation stopped. Check private job/budget evidence; never retry uncertain inference with a new label.",
  );
  process.exitCode = 1;
} finally {
  if (lock !== undefined) {
    closeSync(lock);
    unlinkSync(lockPath);
  }
}
