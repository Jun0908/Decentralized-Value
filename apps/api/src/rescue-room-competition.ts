import { publicRescueRoomScenario, rescueCommanderStarterPlaybook } from "@frontier/rescue-room";
import { strToU8, zipSync } from "fflate";

export function createRescueRoomStarterKitZip(): Uint8Array {
  const scenario = publicRescueRoomScenario();
  const readme = `# Rescue Room Controlled Practice Starter

This kit contains the public Practice alerts, curated Service Agent catalog, fixed Commander runtime contract, and a valid starter Playbook.

The AI runtime is fixed by the Arena. Participants edit only the Playbook. The model receives public state, never the hidden incident seed or true state. Outcomes are recomputed from recorded Actions; model prose, token usage, and attempt count are excluded from reward metrics.

Run one local Practice Episode:

\`\`\`bash
curl -X POST http://localhost:3000/v1/rescue-room/commander-evaluations \\
  -H "content-type: application/json" \\
  --data-binary @request.example.json
\`\`\`

This is Controlled Practice. Hidden Final, participant uniqueness, onchain service payments, and reward settlement are not implemented.
`;
  const requestExample = {
    episodeId: scenario.episodes[0]!.id,
    playbook: rescueCommanderStarterPlaybook,
  };
  const files = {
    "rescue-room-starter/challenge-manifest.json": strToU8(
      JSON.stringify(scenario.manifest, null, 2),
    ),
    "rescue-room-starter/public-practice-alerts.json": strToU8(
      JSON.stringify(scenario.episodes, null, 2),
    ),
    "rescue-room-starter/service-agents.json": strToU8(JSON.stringify(scenario.services, null, 2)),
    "rescue-room-starter/playbook.schema.json": strToU8(
      JSON.stringify(scenario.commanderRuntime.playbookSchema, null, 2),
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
          commanderContextHash: scenario.commanderRuntime.contextHash,
          manifestHash: scenario.manifestHash,
          runtime: scenario.commanderRuntime,
          axes: scenario.axes,
          hardConstraints: scenario.manifest.hardConstraints,
          evaluationEndpoint: "/v1/rescue-room/commander-evaluations",
          replayBasis: "recorded-actions",
          rewardBasis: "outcome-vector-only",
          status: "CONTROLLED_PRACTICE_NOT_REWARD_ELIGIBLE",
        },
        null,
        2,
      ),
    ),
    "rescue-room-starter/request.example.json": strToU8(JSON.stringify(requestExample, null, 2)),
    "rescue-room-starter/README.md": strToU8(readme),
  };
  return zipSync(files, { level: 6 });
}
