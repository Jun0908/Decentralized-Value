/** Explicit local operator demo, NOT a public paid API or hosted Bazantic Recipe. */
import { Agent, OpenAIProvider, Runner, tool } from "@openai/agents";
import { z } from "zod";
import {
  FrontierClient,
  verifyRescueDoctrinePracticeIntegrity,
  compareRuns,
} from "../../../packages/sdk/src/index";
import {
  evaluateRescueDoctrinePracticeEpisode,
  normalizeRescueDoctrine,
  rescueDoctrineSchema,
} from "@frontier/rescue-room";
import {
  createBazanticPracticeTransport,
  bazanticRescueOrigin,
} from "../../../scripts/lib/bazantic-practice-mcp";

export async function runBazanticRescueAgent(input: {
  apiKey: string;
  recipe: string;
  objective: string;
}) {
  if (input.recipe.length > 12000 || input.objective.length > 600)
    throw new Error("BAZANTIC_AGENT_INPUT_LIMIT");
  const transport = await createBazanticPracticeTransport();
  const client = new FrontierClient({
    baseUrl: bazanticRescueOrigin,
    fetch: transport.fetch,
    timeoutMs: 30_000,
  });
  let manifest: Awaited<ReturnType<typeof client.arenas.get>> | undefined;
  const runs: Awaited<ReturnType<typeof client.evaluations.practice>>[] = [];
  const proofs: unknown[] = [];
  const tools = [
    tool({
      name: "getCliArena",
      description: "Read Rescue's public manifest, sample Doctrine and schema once.",
      parameters: z.object({ id: z.literal("rescue-room") }),
      execute: async () => {
        // Re-reading is idempotent within this run: return the locked snapshot,
        // never silently fetch a new context or spend another gateway request.
        manifest ??= await client.arenas.get("rescue-room");
        if (
          manifest.paymentState !== "game-credits" ||
          manifest.rewardEligible !== false ||
          manifest.context.evidenceState !== "simulated"
        )
          throw new Error("UNSUPPORTED_PRACTICE");
        const view = { ...manifest, episodes: manifest.episodes.slice(0, 1) };
        if (JSON.stringify(view).length > 25000) throw new Error("MANIFEST_TOO_LARGE");
        return JSON.stringify(view);
      },
      errorFunction: null,
    }),
    tool({
      name: "evaluateRescueRoomDoctrine",
      description:
        "Evaluate a Doctrine on the locked first public Episode. Host supplies the locked context headers. Call baseline first, candidate second.",
      parameters: z.object({
        variant: z.enum(["baseline", "candidate"]),
        doctrine: rescueDoctrineSchema.nullable(),
      }),
      execute: async ({ variant, doctrine: proposedDoctrine }) => {
        if (!manifest || runs.length >= 2) throw new Error("EVALUATION_NOT_ALLOWED");
        if (variant !== (runs.length === 0 ? "baseline" : "candidate"))
          throw new Error("EVALUATION_ORDER_INVALID");
        if (variant === "baseline" && proposedDoctrine !== null)
          throw new Error("BASELINE_USES_LOCKED_SAMPLE");
        const doctrine = normalizeRescueDoctrine(
          variant === "baseline" ? manifest.artifact.sample : proposedDoctrine,
        );
        const request = {
          arenaId: "rescue-room" as const,
          context: manifest.context,
          episodeId: manifest.episodes[0]!.id,
          artifact: doctrine,
        };
        const run = await client.evaluations.practice(request);
        const integrity = verifyRescueDoctrinePracticeIntegrity({ request, run });
        const local = evaluateRescueDoctrinePracticeEpisode(doctrine, request.episodeId);
        if (local.evaluationHash !== run.resultHash) throw new Error("LOCAL_REPLAY_MISMATCH");
        runs.push(run);
        proofs.push({ request, run, integrity, localEvaluationHash: local.evaluationHash });
        return JSON.stringify({
          correctness: run.correctness,
          values: run.values,
          resultHash: run.resultHash,
          artifactHash: run.artifactHash,
          interpretation: "Independent outcomes, game credits only",
        });
      },
      errorFunction: null,
    }),
  ];
  const model = "gpt-5-nano";
  const agent = new Agent({
    name: "Rescue Strategy Author via Bazantic MCP",
    model,
    instructions: `${input.recipe}\n\nLocal execution adapter: use getCliArena(id=rescue-room), then evaluateRescueRoomDoctrine({variant: "baseline", doctrine: null}) to evaluate the exact stored sample. Then call evaluateRescueRoomDoctrine({variant: "candidate", doctrine: fullChangedDoctrineObject}). Use the schema's structured object, not a string. The host supplies headers and the Episode from the locked manifest. Make exactly these three tool calls: manifest, baseline, candidate. Then give a short English comparison. Do not request other tools or retries. This uses OpenAI as the external author, not Bazantic-hosted inference.`,
    tools,
    modelSettings: {
      reasoning: { effort: "minimal" },
      parallelToolCalls: false,
      store: false,
      maxTokens: 3000,
      timeoutMs: 45_000,
      retry: { maxRetries: 0 },
    },
  });
  const runner = new Runner({
    modelProvider: new OpenAIProvider({
      apiKey: input.apiKey,
      baseURL: "https://api.openai.com/v1",
      useResponses: true,
      useResponsesWebSocket: false,
    }),
    tracingDisabled: true,
    traceIncludeSensitiveData: false,
  });
  const result = await runner.run(agent, input.objective, {
    maxTurns: 6,
    signal: AbortSignal.timeout(150_000),
  });
  if (runs.length !== 2 || transport.events.length !== 3)
    throw new Error("INCOMPLETE_AGENT_COMPARISON");
  return {
    schemaVersion: "frontier-bazantic-external-agent-v1",
    checkedAt: new Date().toISOString(),
    model,
    agentsSdkVersion: "0.17.2",
    execution: "external-openai-agent-via-bazantic-mcp",
    hostedRecipeExecuted: false,
    gateway: bazanticRescueOrigin,
    objective: input.objective,
    events: transport.events,
    proofs,
    comparison: compareRuns(runs[0]!, runs[1]!),
    finalOutput: result.finalOutput,
    usage: {
      requests: result.runContext.usage.requests,
      inputTokens: result.runContext.usage.inputTokens,
      outputTokens: result.runContext.usage.outputTokens,
    },
    responseIds: result.rawResponses.flatMap((r) => (r.responseId ? [r.responseId] : [])),
    automaticRetries: 0,
    gatewayPaymentAttempted: false,
    finalTournamentComplete: false,
  };
}
