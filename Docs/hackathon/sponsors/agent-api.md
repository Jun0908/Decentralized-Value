# External Agent API: non-billable Rescue Practice

An external agent can submit Doctrine JSON, run deterministic Practice and receive independent outcomes and replay evidence. This evaluates an agent-authored policy; it does not execute arbitrary source. No authentication, OpenAI key, wallet or Sepolia ETH is required; normal API limits apply.

| Operation       | Existing route                              | Contents                                                                       |
| --------------- | ------------------------------------------- | ------------------------------------------------------------------------------ |
| Discover/sample | `GET /v1/cli/arenas/rescue-room`            | Context, metrics, public Episodes, Doctrine schema/sample and capabilities     |
| Starter         | `GET /v1/rescue-room/starter-kit`           | Input/scenario/schema archive; manifest SHA-256 checked by SDK                 |
| Practice        | `POST /v1/rescue-room/doctrine-evaluations` | `{ episodeId, doctrine }` → outcomes, actions, transcript and payment evidence |

[OpenAPI](../../../openapi/frontier-v1.yaml) defines `RescueRoomDoctrineEvaluationInput` and `CliRescuePracticeResult`. The SDK uses `FrontierClient.evaluations.practice`. [Full developer quickstart](../../development/guides/RESCUE_AGENT_QUICKSTART.md).

## SDK example

From the monorepo root with a Web server running:

```text
pnpm exec tsx packages/sdk/examples/rescue-practice.ts http://localhost:3000
```

[Executable source](../../../packages/sdk/examples/rescue-practice.ts). Built consumers import from the private workspace package below; this does not imply npm publication.

```ts
import { FrontierClient } from "@frontier/sdk";

const client = new FrontierClient({ baseUrl: "http://localhost:3000" });
const manifest = await client.arenas.get("rescue-room");
const run = await client.evaluations.practice({
  arenaId: "rescue-room",
  context: manifest.context,
  episodeId: manifest.episodes[0]!.id,
  artifact: manifest.artifact.sample, // Replace with your validated Doctrine
});

console.log(run.correctness, run.values, run.resultHash);
console.log(run.raw); // Recorded actions, transcript, replay and credit evidence
```

Retain the original manifest/context before running. HTTP callers send both `X-Frontier-Context-Hash` and `X-Frontier-Runtime-Context-Hash` from that manifest. Context changes return 409; do not silently fetch a new Context and mix it into the old comparison set.

Returning a hash is not itself independent verification. Use the explicit SDK integrity verifier and separately compare against the local evaluator/replay. Full bash/curl examples from the earlier edition remain in the [source archive](../../development/history/docs-cleanup-2026-09-13/README.md).

## Independent outcomes and evidence

| SDK outcome               | Direction | Meaning                                     |
| ------------------------- | --------- | ------------------------------------------- |
| `totalUserLossUsd`        | Minimize  | Modeled asset loss in a fictional protocol  |
| `servedProtocolDemandPpm` | Maximize  | Fraction of demand served; 1,000,000 = 100% |
| `netResponseSpendCredits` | Minimize  | Game credits spent on response/information  |

Correctness is a hard gate. `compareRuns` requires matching origin, Episode, Context and metric definitions. No weighted overall winner is introduced.

- `doctrineHash`: normalized artifact.
- `evaluationHash`: Doctrine result, context and evidence.
- `outcome.resultHash` / `outcome.transcriptHash`: game outcomes/events.
- `paymentEvidence`: **game-credit** Orders/Receipts, not onchain payments.
- `replay`: recorded-action reproduction, not LLM/chain-of-thought reproduction.
- Retain `state: simulated`, `strategyState: deterministic-rules`, `paymentState: game-credits`, `rewardEligibility.eligible: false`.

## Offline integration verification

```text
pnpm exec tsx scripts/verify-rescue-submission-api.ts
```

This injects fetch into actual API handlers without network sockets or environment/key/wallet access. It checks OpenAPI route/schema references, Starter SHA, repeated inputs, local evaluator/action replay, supplied artifact/outcome/transcript/payment hashes, tamper rejection, Context 409 and invalid-input 400. Non-allowlisted routes fail; model-call count must be zero.

The September 12 run passed 12 injected requests with expected 200/409/400 responses and zero inference/network/payments. The first Episode `episode-fabafc1906b4` produced `0 USD / 845915 ppm / 46 Rescue Credits`, evaluation hash `0x144c9a882f88b116019f963cf7c3d868527b27ea642ef7784cff4b10fc914df4`. Dominated candidates remain dominated; multiple winners are not manufactured.

This injected check is not public network verification. Later [public HTTP checks](../../evidence/verification/PUBLIC_VERIFICATION_2026-09-13.md) and [Bazantic execution](BAZANTIC_RESCUE_LIVE.md) have their own evidence.

## Excluded paths

Paid `/v1/rescue-room/commander-evaluations`, loopback `/operator/rescue/jobs` and real tokens are separate; Practice never silently invokes them. Rescue submission persistence/Final Entry, unknown Final, independent market, production jobs and Pool rewards remain incomplete.

[Operator Sepolia evidence](../../evidence/deployments/sepolia-rescue-service-demo.json) does not make each Practice run paid. This API alone does not establish ENS, gateway or CRE integration.
