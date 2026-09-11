import { publicRescueRoomScenario, rescueCommanderStarterPlaybook } from "@frontier/rescue-room";
import { strToU8, zipSync } from "fflate";

export function createRescueRoomStarterKitZip(): Uint8Array {
  const scenario = publicRescueRoomScenario();
  const readme = `# Rescue Room Controlled Practice Starter

This kit contains the public Practice alerts, curated Service Agent catalog, deterministic Doctrine contract, fixed AI Commander runtime contract, and valid starter Artifacts.

Participants can edit a deterministic Doctrine or an AI Playbook. Both use the same Service, protocol-action, single-price, and total-investigation-budget gate. The Commander receives public state, never the hidden incident seed or true state. Outcomes are recomputed from recorded Actions; model prose, token usage, and attempt count are excluded from reward metrics.

Run one deterministic Doctrine Practice Episode:

\`\`\`bash
curl -X POST http://localhost:3000/v1/rescue-room/doctrine-evaluations \\
  -H "content-type: application/json" \\
  --data-binary @doctrine-request.example.json
\`\`\`

Run one AI Commander Practice Episode:

\`\`\`bash
curl -X POST http://localhost:3000/v1/rescue-room/commander-evaluations \\
  -H "content-type: application/json" \\
  --data-binary @request.example.json
\`\`\`

This is Controlled Practice. The rUSD-DEMO and RescueServiceEscrow contracts are implemented but not deployed or connected here. Hidden Final, participant uniqueness, live onchain service payments, and reward settlement are not implemented.
`;
  const requestExample = {
    episodeId: scenario.episodes[0]!.id,
    playbook: rescueCommanderStarterPlaybook,
  };
  const doctrineRequestExample = {
    episodeId: scenario.episodes[0]!.id,
    doctrine: scenario.doctrineRuntime.presets[0]!.doctrine,
  };
  const files = {
    "rescue-room-starter/challenge-manifest.json": strToU8(
      JSON.stringify(scenario.manifest, null, 2),
    ),
    "rescue-room-starter/public-practice-alerts.json": strToU8(
      JSON.stringify(scenario.episodes, null, 2),
    ),
    "rescue-room-starter/service-agents.json": strToU8(JSON.stringify(scenario.services, null, 2)),
    "rescue-room-starter/payment-contract.json": strToU8(
      JSON.stringify(scenario.paymentRuntime, null, 2),
    ),
    "rescue-room-starter/playbook.schema.json": strToU8(
      JSON.stringify(scenario.commanderRuntime.playbookSchema, null, 2),
    ),
    "rescue-room-starter/doctrine.schema.json": strToU8(
      JSON.stringify(scenario.doctrineRuntime.doctrineSchema, null, 2),
    ),
    "rescue-room-starter/doctrine-presets.json": strToU8(
      JSON.stringify(scenario.doctrineRuntime.presets, null, 2),
    ),
    "rescue-room-starter/starter-playbook.json": strToU8(
      JSON.stringify(rescueCommanderStarterPlaybook, null, 2),
    ),
    "rescue-room-starter/runtime-contract.json": strToU8(
      JSON.stringify(
        {
          arenaId: scenario.arenaId,
          contextId: scenario.contextId,
          contextHash: scenario.contextHash,
          doctrineContextHash: scenario.doctrineRuntime.contextHash,
          commanderContextHash: scenario.commanderRuntime.contextHash,
          manifestHash: scenario.manifestHash,
          doctrineRuntime: scenario.doctrineRuntime,
          runtime: scenario.commanderRuntime,
          paymentRuntime: scenario.paymentRuntime,
          axes: scenario.axes,
          hardConstraints: scenario.manifest.hardConstraints,
          doctrineEvaluationEndpoint: "/v1/rescue-room/doctrine-evaluations",
          commanderEvaluationEndpoint: "/v1/rescue-room/commander-evaluations",
          replayBasis: "recorded-actions",
          rewardBasis: "outcome-vector-only",
          status: "CONTROLLED_PRACTICE_NOT_REWARD_ELIGIBLE",
        },
        null,
        2,
      ),
    ),
    "rescue-room-starter/request.example.json": strToU8(JSON.stringify(requestExample, null, 2)),
    "rescue-room-starter/doctrine-request.example.json": strToU8(
      JSON.stringify(doctrineRequestExample, null, 2),
    ),
    "rescue-room-starter/README.md": strToU8(readme),
  };
  return zipSync(files, { level: 6, mtime: new Date(2026, 0, 1) });
}
