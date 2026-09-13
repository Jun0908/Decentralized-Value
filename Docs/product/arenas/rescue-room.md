# Rescue Room

**Current boundary:** Phase 0 feasibility returned GO; deterministic Practice and the local real-AI Playbook path are implemented. A separate operator pilot has real Sepolia service payment/refund evidence. Public Practice remains simulated/game-credits. Durable Rescue revisions/Final entries, unknown Final competition and open third-party services are incomplete. [Current status](../../STATUS.md) · [Plan 9](../../development/plans/Plan9.md).

Rescue Room is an incident-response Arena for a fictional Ethereum protocol. An Incident Commander with limited observations, time and budget buys service evidence and chooses interventions. It is not a single-answer security quiz: hidden causes, false positives and opportunity costs make blanket pause, inaction and buying everything different tradeoffs.

## Implemented practice model

- Seeded deterministic generator; seven incident families and 35 public Practice Episodes.
- 60-minute game clock, 100 Rescue Credits and at most 12 actions.
- Six curated services with separate reserve/release/refund ledger states.
- Eight reference Commander policies, plus editable normalized Doctrine and AI Playbook paths.
- Actions, payments, receipts, observations and protocol-state transcript; same actions/Episode reproduce outcomes/hashes.
- Three independent outcomes, Pareto and four Practice Value Pools.
- API, Starter/schema/catalog/runtime contract and context-bound evidence download.
- Illustrated five-chapter Incident Theatre with Commander, protocol, services, evidence and payments; finite game-minute replay and initially collapsed raw audit log.
- Plain-language rule explanations, Spend / Certainty / Containment summary, Basic / Prompt / Artifact views.

Reference commanders remain deterministic. The AI path uses `@openai/agents 0.17.2` and configured model ID `gpt-5.6-luna`, with shared action, token, turn and timeout limits. That ID is **not an immutable dated model snapshot**; hidden Final needs separate version pinning/commitment. A single controlled Episode is not a reward entry.

## Protocol world and actions

Modules: withdrawals, borrowing, liquidations, oracle, governance and bridge.

Families: false-positive, oracle-manipulation, accounting-drift, compromised-key, liquidity-crisis, contract-exploit and external-dependency.

An Episode has severity, affected module, loss rate, demand, correct patch and initial signals. Hidden parameters are not Commander-visible and are revealed only after Practice for learning.

```text
BUY_SERVICE
PAUSE_MODULE
PAUSE_PROTOCOL
APPLY_PATCH
RESUME_MODULE
RESUME_PROTOCOL
WAIT
CLOSE_INCIDENT
```

Reference evaluation runs a chosen policy; AI evaluation chooses one structured action from current public state per turn. A service/action forbidden by the Playbook is a hard-constraint violation. Rules and AI share action/service/price/total-investigation-budget gates.

## Curated service market

| Service          | Task             | Price | Game delivery time |
| ---------------- | ---------------- | ----: | -----------------: |
| Pulse Monitor    | SCAN_ACTIVITY    |  5 RC |              2 min |
| Trace Audit      | TRACE_EXECUTION  | 16 RC |              6 min |
| Accounting Audit | CHECK_ACCOUNTING | 18 RC |              7 min |
| Second Opinion   | SECOND_OPINION   | 12 RC |              4 min |
| Patch Builder    | BUILD_PATCH      | 28 RC |              8 min |
| Patch Verifier   | VERIFY_PATCH     | 10 RC |              4 min |

Classification depends on incident/service fit and can be inconclusive or wrong. Orders reserve budget, release on delivery and refund if not delivered by the game horizon. For the same Episode/service/target/patch artifact, evidence quality is purchase-order independent so commanders face the same realization.

Ordinary Practice uses a deterministic **game-credit ledger**, not service-wallet/escrow transfers. The separately recorded [operator pilot](../../development/guides/RESCUE_EXECUTION_BATCH.md) paid and refunded real Sepolia rUSD-DEMO; that does not change this practice ledger or enable public operator spending.

## Independent outcomes and pools

| Key                       | Direction | Pack aggregation                   |
| ------------------------- | --------- | ---------------------------------- |
| `totalUserLossUsd`        | Minimize  | Sum across the common Episode pack |
| `servedProtocolDemandPpm` | Maximize  | Episode average                    |
| `netResponseSpendCredits` | Minimize  | Total released game credits        |

`worstEpisodeUserLossUsd` is retained as evidence. Phase 0 found it overly sensitive to one service misclassification, so aggregate total loss is the primary protection axis. No weighted total replaces the axes.

Each of four Practice Pools allocates 10,000 practice credits from the same 35-Episode evidence:

- User Protection: minimize loss among entries passing the availability gate.
- Availability: maximize demand served among entries passing the loss gate.
- Treasury Stewardship: minimize spending among entries passing safety/availability gates.
- Frontier Expansion: allocate in proportion to positive exclusive hypervolume contribution among entries passing the published gates.

Practice credits have no monetary value and are not settled rewards. One entry may receive support from multiple pools; multiple winners are not manufactured if one dominates every axis. The later submission continuation's three 100-credit Pool previews are a separate context, not these four pack-level pools.

## API and reproduction

```text
GET  /v1/rescue-room
GET  /v1/rescue-room/starter-kit
GET  /v1/cli/arenas/rescue-room
POST /v1/rescue-room/evaluations
POST /v1/rescue-room/doctrine-evaluations
POST /v1/rescue-room/commander-evaluations
```

Reference input:

```json
{ "policyId": "simple-adaptive", "episodeId": "episode-..." }
```

Reference responses identify `state: simulated` and `paymentState: game-credits`, with the Episode outcome, pack aggregate, Pareto/Pool allocation, transcript and context/manifest/evaluation hashes. Doctrine input is `{ episodeId, doctrine }`; use the manifest schema/sample in the [developer quickstart](../../development/guides/RESCUE_AGENT_QUICKSTART.md).

AI input uses `{ episodeId, playbook }`, where `rescue-commander-playbook-v0` includes name/instructions, allowed service IDs, allowed actions and price/investigation limits. Use current schema/sample, not an old incomplete hand-written payload.

AI responses identify `inferenceState: openai-api`, Playbook/Commander Context hashes, model/SDK/prompt/token provenance, each public-view hash/action, outcome and replay check. Rerunning an LLM need not choose the same actions; replaying its recorded actions must reproduce the game result.

## Phase 0 and local AI evidence

On September 10, evaluator v1 tested 2,000 Episodes and ten baselines and passed the preregistered GO conditions.

| Check                                   | Recorded result                                                    |
| --------------------------------------- | ------------------------------------------------------------------ |
| Deterministic replay                    | PASS                                                               |
| Simple universal fixed winner           | None                                                               |
| Frontier policies                       | 7                                                                  |
| Episodes where a service helped         | 1,315                                                              |
| Episodes where a service hurt           | 596                                                                |
| Incident-dependent oracle first actions | 3 types                                                            |
| Family coverage                         | 7/7                                                                |
| Five 400-Episode packs                  | Seven common frontier policies; one pack had one additional policy |
| Correct baseline runs                   | 10/10                                                              |

Seeded Random stayed on the full frontier through low spending, but failed the safety/availability gates and received no Practice Pool allocation. Pareto membership is not quality assurance or reward eligibility.

[Raw feasibility evidence](../../../benchmarks/rescue-room/results/latest.json). Evaluator v2 removed false-positive safe-state leakage from public views; the ten-baseline / 2,000-Episode run took 62,690 ms against a 120,000 ms ceiling. Recorded evidence hash: `0xa5da26f534ff1345a3139f2579edafc4ea8dd40c7b3abc5c16650be8977bceb3`. These are dated results; a file named latest may later contain a newer run.

[Historical AI smoke location](../../../benchmarks/rescue-room/results/ai-smoke-latest.json): runtime v1/evaluator v2 completed one Episode in ten requests, 16,317 tokens and 21,771 ms, buying four services. Recorded action replay matched the result hash. This established connectivity, not hidden-Final strength.

The subsequent real purchased-analysis continuation was **dominated by Never Pause**. Payment working does not prove information value. [Submission scope](../../hackathon/submission/HACKATHON_SUBMISSION.md) · [Controlled study design](../../development/plans/rescue-information-study.md).

## Trust boundary and next gates

- Game world, ordinary service evidence, credits and outcomes are offchain simulation.
- Public observations exclude seeds, hidden family/severity and correct patch; learning reveal follows the episode.
- Transcript/hash replay is not automatically an Ethereum commitment, true diagnosis or model signature.
- Chain of thought is neither requested nor stored; record public-view hash, actions, reason codes/confidence and runtime provenance.
- The operator pilot is separate from the public API and uses operator-controlled wallets.
- Hidden Final, arbitrary participant-code isolation, participant uniqueness, runner attestations, disputes and slashing are incomplete.

Next gates are first-time-user validation, controlled information-value experiments, durable revisions/Final entries, immutable runtime/entry commitment, multiple hidden Episodes, no intervention during Final and full-field recalculation. Extensive public Practice must be allowed; unknown-environment performance and shortcut resistance need measured evidence rather than a promise.
