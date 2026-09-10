import { Agent, Runner, type ModelResponse } from "@openai/agents";
import {
  createRescuePracticeSession,
  finalizeRescueCommanderPracticeEvaluation,
  normalizeRescueCommanderPlaybook,
  rescueCommanderDecisionSchema,
  rescuePublicViewHash,
  rescueRoomCommanderEpisodeTimeoutMs,
  rescueRoomCommanderMaximumModelTurns,
  rescueRoomCommanderMaximumOutputTokens,
  rescueRoomCommanderModel,
  rescueRoomCommanderModelSettings,
  rescueRoomCommanderModelTimeoutMs,
  rescueRoomCommanderPromptVersion,
  rescueRoomCommanderRuntimeVersion,
  rescueServices,
  type RescueCommanderDecisionEvidence,
  type RescueCommanderRuntimeEvidence,
} from "@frontier/rescue-room";

const agentsSdkVersion = "0.17.2";

export type RescueRoomCommanderInput = {
  episodeId: string;
  playbook: unknown;
};

export type RescueRoomCommanderEvaluation = Awaited<
  ReturnType<typeof runOpenAiRescueRoomCommander>
>;

export type RescueRoomCommanderExecutor = (
  input: RescueRoomCommanderInput,
) => Promise<ReturnType<typeof finalizeRescueCommanderPracticeEvaluation>>;

export class RescueCommanderConfigurationError extends Error {}

function assertOfficialOpenAiEndpoint(): void {
  const baseUrl = process.env.OPENAI_BASE_URL?.trim();
  if (!baseUrl) return;
  let origin: string;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    throw new RescueCommanderConfigurationError("OPENAI_BASE_URL is not a valid URL");
  }
  if (origin !== "https://api.openai.com") {
    throw new RescueCommanderConfigurationError(
      "Rescue Room Controlled Practice requires the official OpenAI API endpoint",
    );
  }
}

function resolvedModel(response: ModelResponse): string | null {
  const direct = response.providerData?.model;
  if (typeof direct === "string") return direct;
  const nested = response.providerData?.response;
  if (nested && typeof nested === "object" && "model" in nested) {
    const model = (nested as { model?: unknown }).model;
    if (typeof model === "string") return model;
  }
  return null;
}

export async function runOpenAiRescueRoomCommander(
  input: RescueRoomCommanderInput,
): Promise<ReturnType<typeof finalizeRescueCommanderPracticeEvaluation>> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new RescueCommanderConfigurationError("OPENAI_API_KEY is not configured");
  }
  assertOfficialOpenAiEndpoint();

  const playbook = normalizeRescueCommanderPlaybook(input.playbook);
  const session = createRescuePracticeSession(input.episodeId, playbook);
  const decisions: RescueCommanderDecisionEvidence[] = [];
  const responseIds: string[] = [];
  const requestIds: string[] = [];
  const resolvedModels = new Set<string>();
  const usage = { requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  const startedAt = new Date().toISOString();

  const agent = new Agent({
    name: "Rescue Room Incident Commander",
    model: rescueRoomCommanderModel,
    modelSettings: {
      reasoning: { effort: rescueRoomCommanderModelSettings.reasoningEffort },
      text: { verbosity: rescueRoomCommanderModelSettings.textVerbosity },
      parallelToolCalls: rescueRoomCommanderModelSettings.parallelToolCalls,
      store: rescueRoomCommanderModelSettings.store,
      maxTokens: rescueRoomCommanderMaximumOutputTokens,
      timeoutMs: rescueRoomCommanderModelTimeoutMs,
    },
    instructions: `You are the Incident Commander in Frontier Protocol Rescue Room.

Follow the participant Playbook below as your policy. Choose exactly one Action for the current public state. You never receive the hidden incident family, severity, valid patch, seed, environment variables, or chain-of-thought. BUY_SERVICE purchases a simulated Service Agent; its Evidence appears only in a later public state. Use CLOSE_INCIDENT when the Playbook intends to stop or do nothing. Return only the structured decision with one schema-valid Action, a short kebab-case reasonCode, and confidencePpm. Do not produce narrative reasoning.

Participant Playbook:
${playbook.instructions}

Authorized Service Agents: ${playbook.allowedServiceIds.join(", ") || "none"}
Maximum price per Service Agent: ${playbook.maxServicePriceCredits} Rescue Credits
Total investigation budget: ${playbook.investigationBudgetCredits} Rescue Credits
Authorized protocol actions: ${playbook.allowedProtocolActions.join(", ")}`,
    outputType: rescueCommanderDecisionSchema,
  });
  const runner = new Runner({
    tracingDisabled: true,
    traceIncludeSensitiveData: false,
    workflowName: "Rescue Room Controlled Practice",
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), rescueRoomCommanderEpisodeTimeoutMs);

  try {
    while (!session.isComplete() && decisions.length < rescueRoomCommanderMaximumModelTurns) {
      const view = session.getPublicView();
      const result = await runner.run(
        agent,
        `Prompt version: ${rescueRoomCommanderPromptVersion}\nDecision: ${decisions.length + 1} of ${rescueRoomCommanderMaximumModelTurns}\nCurrent public state:\n${JSON.stringify(
          view,
        )}\nService catalog:\n${JSON.stringify(rescueServices)}`,
        { maxTurns: 1, signal: controller.signal },
      );
      if (!result.finalOutput) throw new Error("Commander did not produce a structured Action");
      const decision = rescueCommanderDecisionSchema.parse(result.finalOutput);
      const step = session.takeAction(decision.action);
      decisions.push({
        ...decision,
        decision: decisions.length + 1,
        gameMinute: view.gameMinute,
        publicViewHash: rescuePublicViewHash(view),
        accepted: step.accepted,
        invalidReason: step.invalidReason,
      });
      for (const response of result.rawResponses) {
        if (response.responseId) responseIds.push(response.responseId);
        if (response.requestId) requestIds.push(response.requestId);
        const model = resolvedModel(response);
        if (model) resolvedModels.add(model);
      }
      usage.requests += result.runContext.usage.requests;
      usage.inputTokens += result.runContext.usage.inputTokens;
      usage.outputTokens += result.runContext.usage.outputTokens;
      usage.totalTokens += result.runContext.usage.totalTokens;
    }
  } finally {
    clearTimeout(timeout);
  }

  const outcome = session.finish();
  const completedAt = new Date().toISOString();
  const runtime: RescueCommanderRuntimeEvidence = {
    runtimeVersion: rescueRoomCommanderRuntimeVersion,
    promptVersion: rescueRoomCommanderPromptVersion,
    sdk: { name: "@openai/agents", version: agentsSdkVersion },
    configuredModel: rescueRoomCommanderModel,
    modelSettings: rescueRoomCommanderModelSettings,
    maximumModelTurns: rescueRoomCommanderMaximumModelTurns,
    episodeTimeoutMs: rescueRoomCommanderEpisodeTimeoutMs,
    startedAt,
    completedAt,
    responseIds,
    requestIds,
    resolvedModels: [...resolvedModels],
    usage,
  };

  return finalizeRescueCommanderPracticeEvaluation({
    playbook,
    episodeId: input.episodeId,
    outcome,
    decisions,
    runtime,
  });
}
