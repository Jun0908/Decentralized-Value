import { cliArenaManifest } from "../../apps/api/src/cli-manifest";
import { createRescueRoomStarterKitZip } from "../../apps/api/src/rescue-room-competition";
import { publicRescueRoomScenario } from "../../packages/rescue-room/src/index";
import {
  experimentHash,
  practiceResponse,
  practiceTools,
  type ExperimentConfig,
  type InjectedRunner,
  type PracticePort,
} from "./ab-harness";

/** In-process API-shaped fixture: no HTTP, credentials, model or Gateway. */
export function localPracticeFixture() {
  const manifest = cliArenaManifest("rescue-room", {
    storage: "unconfigured",
    authenticationAvailable: false,
  });
  const config: ExperimentConfig = {
    task: "Choose a valid Doctrine and describe all independent Rescue Practice outcomes.",
    prompt:
      "Use the public Rescue Practice tools. Return a Doctrine and an evidence-grounded answer; never claim a weighted winner or payment.",
    model: "deterministic-fixture-not-an-ai-model",
    settings: { temperature: 0, fixtureVersion: "1", conversationReset: "per-arm" },
    apiIdentity: "in-process-rescue-practice-fixture",
    apiSnapshotHash: experimentHash(manifest),
    manifest,
    episodeIds: manifest.episodes.slice(0, 2).map(({ id }) => id),
    seeds: [11, 29],
    maxToolCalls: 8,
  };
  const port: PracticePort = async (request) => {
    if (request.method === "GET" && request.path === practiceTools[0].path)
      return { status: 200, body: structuredClone(manifest) };
    if (request.method === "GET" && request.path === practiceTools[1].path)
      return { status: 200, body: createRescueRoomStarterKitZip() };
    if (request.method === "POST" && request.path === practiceTools[2].path) {
      if (
        request.headers?.["X-Frontier-Context-Hash"] !== manifest.context.contextHash ||
        request.headers?.["X-Frontier-Runtime-Context-Hash"] !== manifest.context.runtimeContextHash
      ) {
        return { status: 409, body: { code: "CONTEXT_MISMATCH" } };
      }
      const body = request.body as { doctrine: Record<string, unknown>; episodeId: string };
      try {
        return { status: 200, body: practiceResponse(body.doctrine, body.episodeId) };
      } catch {
        return { status: 400, body: { code: "INVALID_INPUT" } };
      }
    }
    return { status: 404, body: { code: "NOT_ALLOWED" } };
  };
  const makeRunner = (): InjectedRunner => async (request) => {
    const presets = publicRescueRoomScenario().doctrineRuntime.presets;
    return {
      answer:
        "Deterministic fixture only; preset choice tests the harness, not Recipe effectiveness.",
      doctrine: structuredClone(presets[request.recipe === null ? 0 : 1]!.doctrine),
    };
  };
  return { config, port, makeRunner };
}
