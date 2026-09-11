import type { CliArenaManifest, CliArenaId } from "@frontier/shared/cli";
import { zipSync } from "fflate";
export const hash = `0x${"1".repeat(64)}`;
export function makeManifest(id: CliArenaId = "disaster-response"): CliArenaManifest {
  const capability = {
    supported: true,
    available: true,
    authentication: "none" as const,
    reason: null,
  };
  return {
    schemaVersion: "1",
    id,
    challengeId: id,
    name: id,
    webPath: `/arenas/${id}`,
    context: {
      contextHash: hash,
      runtimeContextHash: id === "rescue-room" ? hash : null,
      manifestHash: hash,
      evaluatorVersion: "1",
      dataVersion: "1",
      metrics: [
        {
          key: "value",
          name: "Value",
          direction: "MINIMIZE",
          unit: "USD",
          lowerBound: 0,
          upperBound: 100,
        },
      ],
      evidenceState: id === "rescue-room" ? "simulated" : "measured",
    },
    artifact: {
      kind: id === "rescue-room" ? "doctrine" : "strategy",
      filename: id === "rescue-room" ? "doctrine.json" : "strategy.json",
      schema: {
        type: "object",
        required: ["name"],
        properties: { name: { type: "string" } },
        additionalProperties: false,
      },
      schemaHash: hash,
      sample: { name: "Starter" },
    },
    starter: { path: "/starter", sha256: "0".repeat(64) },
    episodes: id === "rescue-room" ? [{ id: "episode-1", headline: "Public episode" }] : [],
    constraints: ["Evaluator constraint"],
    limits: { practiceRunsPerMinute: 10, maxRevisions: 5 },
    capabilities: {
      practice: capability,
      submit: {
        ...capability,
        supported: id !== "rescue-room",
        authentication: "cli-session",
      },
      finalEntry: {
        ...capability,
        supported: id !== "rescue-room",
        authentication: "cli-session",
      },
      contextPrecondition: true,
    },
    storage: "ephemeral-memory",
    paymentState: id === "rescue-room" ? "game-credits" : "not-requested",
    rewardEligible: false,
  };
}
export function starterZip(manifest: CliArenaManifest, extra: Record<string, Uint8Array> = {}) {
  const json = (value: unknown) => Buffer.from(JSON.stringify(value));
  const names =
    manifest.id === "disaster-response"
      ? {
          "sample_strategy.json": json({ strategy: manifest.artifact.sample }),
          "submission-schema.json": json(manifest.artifact.schema),
          "evaluation-contract.json": json({ contextHash: hash }),
          "network.json": json({}),
          "training-scenarios.json": json([]),
        }
      : {
          "doctrine-request.example.json": json({
            episodeId: "episode-1",
            doctrine: manifest.artifact.sample,
          }),
          "doctrine.schema.json": json(manifest.artifact.schema),
          "runtime-contract.json": json({
            contextHash: hash,
            doctrineContextHash: hash,
          }),
          "public-practice-alerts.json": json([]),
          "service-agents.json": json([]),
          "payment-contract.json": json({
            state: "game-ledger-only",
            token: "rUSD-DEMO",
          }),
        };
  return zipSync(
    {
      ...Object.fromEntries(
        Object.entries(names).map(([name, bytes]) => [`${manifest.id}-starter/${name}`, bytes]),
      ),
      ...extra,
    },
    { mtime: new Date("2020-01-01T00:00:00Z") },
  );
}
