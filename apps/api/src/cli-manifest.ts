import { createHash } from "node:crypto";
import { publicDisasterResponseScenario } from "@frontier/disaster-response";
import { publicRescueRoomScenario, rescueRoomMetrics } from "@frontier/rescue-room";
import { canonicalProtocolJson, cliArenaManifestSchema, type CliArenaId } from "@frontier/shared";
import { keccak256, stringToHex } from "viem";
import { createPlan6StarterKitZip } from "./plan6-competition";
import { createRescueRoomStarterKitZip } from "./rescue-room-competition";

export type CliManifestOptions = {
  storage: "durable-redis" | "ephemeral-memory" | "unconfigured";
  authenticationAvailable: boolean;
  production?: boolean;
};

export function cliArenaManifest(id: CliArenaId, options: CliManifestOptions) {
  const disaster = id === "disaster-response";
  const available =
    disaster &&
    options.authenticationAvailable &&
    options.storage !== "unconfigured" &&
    (!options.production || options.storage === "durable-redis");
  const unavailableReason = !disaster
    ? "Doctrine supports Controlled Practice only"
    : !options.authenticationAvailable
      ? "CLI authentication is not configured"
      : "Durable competition storage is not configured";
  const submission = {
    supported: disaster,
    available,
    reason: available ? null : unavailableReason,
    authentication: "cli-session" as const,
  };
  const scenario = publicDisasterResponseScenario();
  const rescue = publicRescueRoomScenario();
  const schema = disaster ? scenario.strategySchema : rescue.doctrineRuntime.doctrineSchema;
  const zip = disaster ? createPlan6StarterKitZip() : createRescueRoomStarterKitZip();
  return cliArenaManifestSchema.parse({
    schemaVersion: "1",
    id,
    challengeId: disaster ? scenario.challengeId : rescue.arenaId,
    name: disaster ? scenario.name : rescue.name,
    webPath: disaster ? "/arenas/emergency-supply" : "/arenas/rescue-room",
    context: {
      contextHash: disaster ? scenario.contextHash : rescue.contextHash,
      runtimeContextHash: disaster ? null : rescue.doctrineRuntime.contextHash,
      manifestHash: disaster ? scenario.manifestHash : rescue.manifestHash,
      evaluatorVersion: disaster
        ? scenario.evaluatorVersion
        : rescue.doctrineRuntime.interpreterVersion,
      dataVersion: disaster ? scenario.dataVersion : rescue.dataVersion,
      metrics: disaster ? scenario.metrics : rescueRoomMetrics(1),
      evidenceState: disaster ? "measured" : "simulated",
    },
    artifact: {
      kind: disaster ? "strategy" : "doctrine",
      filename: disaster ? "strategy.json" : "doctrine.json",
      schema,
      schemaHash: keccak256(stringToHex(canonicalProtocolJson(schema))),
      sample: disaster ? scenario.defaultStrategy : rescue.doctrineRuntime.presets[0]!.doctrine,
    },
    starter: {
      path: disaster
        ? "/v1/challenges/disaster-response/starter-kit"
        : "/v1/rescue-room/starter-kit",
      sha256: createHash("sha256").update(zip).digest("hex"),
    },
    episodes: disaster
      ? []
      : rescue.episodes.map(({ id: episodeId, headline }) => ({ id: episodeId, headline })),
    constraints: disaster ? scenario.constraints : rescue.manifest.hardConstraints,
    limits: {
      practiceRunsPerMinute: 30,
      maxRevisions: disaster ? scenario.limits.maxRevisions : 0,
    },
    capabilities: {
      practice: { supported: true, available: true, reason: null, authentication: "none" },
      submit: submission,
      finalEntry: submission,
      contextPrecondition: true,
    },
    storage: disaster ? options.storage : "unconfigured",
    paymentState: disaster ? "not-requested" : "game-credits",
    rewardEligible: false,
  });
}

export function contextPrecondition(request: Request, id: CliArenaId): string | null {
  const expected = request.headers.get("x-frontier-context-hash");
  const runtime = request.headers.get("x-frontier-runtime-context-hash");
  const scenario =
    id === "disaster-response" ? publicDisasterResponseScenario() : publicRescueRoomScenario();
  if (expected && expected.toLowerCase() !== scenario.contextHash.toLowerCase())
    return "The locked evaluation context is no longer available";
  if (id === "rescue-room") {
    const currentRuntime = publicRescueRoomScenario().doctrineRuntime.contextHash;
    if (expected && !runtime) return "A Doctrine runtime context is required";
    if (runtime && runtime.toLowerCase() !== currentRuntime.toLowerCase())
      return "The locked Doctrine runtime has changed";
  } else if (runtime) return "Disaster Response does not accept a Doctrine runtime context";
  return null;
}
