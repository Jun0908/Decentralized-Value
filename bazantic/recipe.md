# Rescue Room: preserve tradeoffs in non-billable Practice

Use this Recipe to propose and evaluate a deterministic Rescue Doctrine against a public Practice Episode. An external agent may help author the Doctrine; the evaluator itself is a deterministic simulator, not an AI model call. This Recipe does not authorize inference charges, payments, account registration or Final entry.

## Tools and authority

These are the local experiment's proposed aliases, **not evidence of registered or activated Bazantic tools**. Verify real Gateway discovery separately before live integration.

| Local alias         | Existing API                                | SDK equivalent                                                                                                      |
| ------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `get_manifest`      | `GET /v1/cli/arenas/rescue-room`            | `client.arenas.get("rescue-room")`                                                                                  |
| `get_starter`       | `GET /v1/rescue-room/starter-kit`           | `client.arenas.downloadStarter("rescue-room", manifest)`                                                            |
| `evaluate_doctrine` | `POST /v1/rescue-room/doctrine-evaluations` | `client.evaluations.practice({ arenaId: "rescue-room", artifact: doctrine, context: manifest.context, episodeId })` |

Only these non-billable Practice operations are in scope. Do not call `commander-evaluations`, legacy paid `/v1/evaluations`, Operator jobs, wallet/RPC operations or submission/Final routes. Other examples in the Starter archive do not authorize executing those workflows.

## Procedure

1. Read the manifest. Require available, unauthenticated Doctrine Practice, `evidenceState: simulated`, `paymentState: game-credits` and `rewardEligible: false`. Lock the full Context, runtime Context, manifest hash, evaluator/data versions, metric definitions and exact public Episode ID. Refuse unknown or hidden Episodes.
2. Download the Starter and verify its SHA-256 against the manifest. Read the Doctrine schema, sample, public alerts, Service catalog and hard constraints. Change only schema-supported fields; never invent an operation, provider identity or hidden incident state.
3. Explain all three independent outcomes with directions and units: user loss is minimized, served protocol demand is maximized, and net response spend is minimized. Practice spend is Rescue Credits, not Sepolia tokens. Correctness is a hard gate, not a weighted metric.
4. Choose a valid Doctrine and briefly explain its tradeoff using observable evidence. No internal chain of thought is required. Use the fixed experiment budget and declared Episodes/seeds. Do not change task/tools/model/settings or discard failed, equal or worse trials.
5. Evaluate the exact locked Episode and Context. Direct API requests must include `X-Frontier-Context-Hash` and `X-Frontier-Runtime-Context-Hash`. Check returned Context, Doctrine identity, evaluation/result hashes and replay agreement. Context mismatch means incomparable, not a win or permission to reuse a previous result.
6. Compare only matching Contexts and Episodes. Among correct results, A dominates B only if A is no worse on every metric and strictly better on at least one. Report ties, tradeoffs and regressions explicitly. Do not create a weighted total or force multiple winners.
7. Report Doctrine, correctness, each metric with direction/unit, Episode, Context/runtime/manifest hashes, Doctrine hash, evaluation hash and outcome result hash. Label outputs `simulated / Controlled Practice / not reward eligible`. A replay check verifies deterministic outcomes, not AI superiority, live Gateway operation or paid service delivery. Never describe a simulated result as signed or settled.

## Stop conditions

On HTTP 401, 402 or 403, stop the trial and report the status without copying credentials or payment-challenge bodies. Do not purchase access, attach wallets, fetch credentials, retry another endpoint or fall back to paid tools. Stop on invalid Starter bytes, changed Context, malformed output or exhausted tool budget. Preserve failed trials. Future real-agent A/B needs separate authorization and identical prompt/model/settings/tools/API snapshot/seed on both arms; only this Recipe's presence may differ.
