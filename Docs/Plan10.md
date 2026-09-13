# Plan 10 — Ocean Commons

Created: 2026-09-10. English current edition: 2026-09-13.

Ocean Commons explores cooperation under uncertainty: a fleet shares a living resource, each captain has limited observations and spending authority, and agents can pay for information, restraint, and mutual support.

This edition consolidates the current design rather than repeating superseded experiments. The [complete original record](archive/plan-history-2026-09-13/Plan10.md) preserves all 74 development sections, including unsuccessful experiments and revised interpretations. Older references such as “Plan 10 §67” refer to that historical record.

## 1. Current position

Production follow-up: the user reports `SEASON_UNCONFIGURED` on the public AI season endpoint. Public discovery is missing, and the season's synchronous duration needs deployment-specific validation. The model path described below exists in code and recorded local runs; publicly runnable AI remains an open release gate. See [production readiness](PRODUCTION_READINESS_2026-09-13.md).

- [x] Deterministic sea, fleet, negotiation, wallet, escrow, and replay engine.
- [x] Partial observations through soundings, finite fuel, and context-dependent fishing choices.
- [x] Illustrated voyage with accepted proposals, rejected offers, purchases, breaches, and outcomes.
- [x] Editable entry builder, JSON editor, and file import representing the same artifact.
- [x] Scripted reference matches and a separate real-LLM mission path.
- [x] Sandbox submission of deterministic entries over 12 public seeds.
- [x] Recorded Sepolia reference-match entries, sealing, and three funded outcome pools.
- [ ] Durable external-participant competition, unknown final, and participant reward claims.
- [ ] Further validation of cooperation incentives and repeatable policy/model performance.

The latest recorded Phase 0 result is **8 of 10 criteria passed**, with criteria #4 and #6 still open. Earlier 10/10 and 9/10 results refer to previous rule versions. The playable arena and reference-pool funding do not replace these research gates.

## 2. Game thesis

Fishing improves a boat's immediate livelihood but changes a shared resource. A captain can also pay another boat to leave a ground alone, share observations, cap catch, or contribute to joint arrangements.

The central decisions are:

- Where to sail and how much effort to spend.
- Whether available observations justify that choice.
- Which agreements are worth offering or accepting.
- How much money to reserve, spend, or expose through escrow.
- Whether a promise still makes sense as conditions change.

A contract is not automatically beneficial. Payments can purchase useful restraint or information, fail to change behavior, or displace activity elsewhere. Value is evaluated from simulated consequences, not the number of agreements or persuasive dialogue.

Wallet permissions are enforced by the match loop. An agent's prose cannot authorize additional spending or a prohibited contract.

## 3. Model, observations, and agreements

The seeded world includes multiple grounds, stock growth and spillover, vessel capabilities, travel/effort fuel, demand/prices, and weather shocks. Each transition is reproducible from the scenario and recorded actions.

Current observations expose soundings and boat history rather than omniscient stock totals. Readings can be stale or uncertain. All competing policy implementations must use the same public observation boundary; direct access to hidden stock or evaluator formulas would invalidate a comparison.

Fuel is a hard budget. The engine limits or rejects unaffordable activity and records the reason. These rules belong to the committed scenario/context.

The five permitted agreement kinds cover catch limits, conservation buyouts, mutual aid, conservation funding, and sounding exchange. Terms, acceptance, escrow, compliance, release, and refund are structured records. Only catch-limit and conservation-buyout contracts can be breached by fishing; exchanging readings does not impose an unstated fishing ban.

Rescue Room purchases a deliverable. Ocean Commons can purchase restraint—an action deliberately not taken—as well as information. Shared wallet/escrow abstractions should preserve this semantic difference.

## 4. User entry and execution modes

`OceanEntry` has four parts:

| Field     | Meaning                                                                 | Enforcement                      |
| --------- | ----------------------------------------------------------------------- | -------------------------------- |
| `name`    | Strategy name, up to 80 characters                                      | Schema                           |
| `mission` | Standing captain instructions, up to 2,000 characters                   | Input to the LLM mission path    |
| `wallet`  | Initial budget, per-contract and seasonal caps, allowed agreement kinds | Match loop                       |
| `sailing` | Effort, reserve behavior, and contract behavior                         | Deterministic policy interpreter |

The builder, JSON editor, and file import edit one artifact. `checkOceanEntry()` returns all validation failures rather than stopping at the first issue.

The historical form count is 98,762,112 combinations, with slider steps defined in code. This is a count of input combinations, not evidence of strategic depth or resistance to exhaustive search.

### Deterministic practice and sandbox submission

Reference approaches use explicit scripted policies. The user's entry is compared with three published references, not presented as a match against third-party submissions.

`/v2/sandbox/participants/register` and `/v2/sandbox/submissions` support `ocean-commons-v1`. `evaluateOceanEntry()` evaluates all 12 published submission seeds. The recorded development-server check took 85 ms and matched the local hash over repeated runs. An invalid artifact returned `correctness: false` with validation failures rather than a server error.

Sandbox storage is ephemeral and can be lost on restart. Public seeds are practice/evaluation fixtures, not a hidden final. A mission string in a deterministic submission is not proof that an LLM ran.

### AI mission

The separate mission path invokes an actual model against scripted background boats. It uses three seasons, requested separately, retaining earlier completed seasons if a later request fails. Recorded timings were approximately three to six minutes per season; they are observations, not latency guarantees.

Model errors, incomplete matches, and spending limits must remain visible. Replaying a saved voyage does not incur or reproduce a new model inference. Persistent jobs and externally supported SDK/CLI contracts are follow-up work under [Plan 12](Plan12.md).

## 5. Independent outcomes

| Metric               | Direction | Interpretation                                                                          |
| -------------------- | --------- | --------------------------------------------------------------------------------------- |
| Livelihood           | Maximize  | Economic outcome under the arena's fixed aggregation                                    |
| Restraint efficacy   | Maximize  | How much forgone catch remains in the water under the defined counterfactual            |
| Cooperation efficacy | Maximize  | Stewardship improvement per expenditure under the defined no-cooperation counterfactual |

The current metric keys are `livelihood`, `restraint`, and `cooperation`. Older stewardship/resilience measures remain relevant evidence but are not the current three competition axes.

Counterfactual evaluation is model-based. It reuses the fixed scenario and specified intervention rules; it is not a real-world causal experiment. Keep the implementation, aggregation, bounds, and counterfactual definitions versioned with the context.

Correctness and authority checks precede comparison. No weighted total is introduced. Multiple pools can support different results using the same evidence, but multiple winners are not a required outcome.

## 6. What the experiments establish

### Context dependence

The historical 7,200-match sweep (120 seeds × 60 settings) found substantial seed-policy interaction. Its estimated variance shares were:

| Axis        | Seed main effect | Policy main effect | Interaction |
| ----------- | ---------------: | -----------------: | ----------: |
| Livelihood  |            38.3% |               7.7% |       53.9% |
| Restraint   |            35.2% |               3.4% |       61.5% |
| Cooperation |            19.7% |               3.1% |       77.2% |

This indicates that policy outcomes depend on the scenario. It does **not** show that an agent can infer all relevant conditions from available observations or capture the interaction as skill. Hindsight-optimal policies are upper bounds, not attainable player results.

### Recorded model comparison

A preregistered 16-seed comparison did not find statistically significant differences on the three axes. A later descriptive reanalysis of the same data estimated standardized differences of +0.375 for livelihood, +0.097 for restraint, and −0.507 for cooperation.

The earlier interpretation that nonsignificance proved “no skill” was withdrawn. Conversely, the positive livelihood estimate is not sufficient evidence of established model superiority. A separately preregistered, adequately powered study is needed. No new paid inference is authorized by this plan.

### Agreement visibility and compliance

Expanding sounding offers beyond the broker raised their recorded frequency from 4 in 20 seasons to 20 in 20 seasons, occurring in 18 of those seasons.

A compliance bug had treated sounding exchange as a fishing prohibition. After correcting contract-type handling, recorded breaches in an 80-season run fell from 69 to 9. The remaining overages had a median of 3% and were all within 25% of the cap. This is consistent with estimation error near catch limits; it is not an isolated causal proof about intent.

Phase 0 criterion #4—agreement-driven stewardship improvement—and #6—fewer breaches with increased escrow—remain unmet in the latest record. The possibility that #6 assumes intentional defection rather than estimation error should be examined in a new versioned experiment, not retroactively marked as a pass.

## 7. Recorded Sepolia reference-pool demonstration

The latest original record documents nine successful Sepolia transactions: four entry records, match sealing, token approval, and three outcome-support transactions.

The measured inputs came from four published reference entries evaluated over the same 12 seeds as sandbox submissions:

| Reference       | Livelihood | Restraint | Cooperation |
| --------------- | ---------: | --------: | ----------: |
| Work the season |     269.82 |    1.0425 |     0.00160 |
| Fill the hold   |     306.08 |    0.0000 |     0.00000 |
| Hold back       |     260.06 |    0.6720 |    −0.00027 |
| Closed wallet   |     254.88 |    0.5043 |     0.00024 |

Closed wallet uses the same sailing settings as Work the season with no permitted agreements.

The on-chain reference match retained Work the season and Fill the hold on the frontier. Each pool received 10,000 FDT of support: livelihood selected Fill the hold; restraint and cooperation selected Work the season. The recorded contract balance was 30,000 FDT, the match was sealed, and the frontier contained two entries.

The contract encoding scales each axis by one million and adds 0.5 to cooperation before unsigned encoding. This preserves the intended per-axis ordering at the chosen precision; it does not combine axes into a score.

**These were operator-owned reference beneficiaries, not third-party prize recipients.** Funding and recorded allocations are distinct from a completed participant payout. FDT is a test/demo token.

Source: [reference-match generator](../scripts/ocean-reference-match.ts), [transaction script](../scripts/settle-ocean-match.sh), and [original record, section 74](archive/plan-history-2026-09-13/Plan10.md). This documentation edit did not send or independently recheck chain transactions.

## 8. Experience and evidence

The voyage scene shows the sea and boats, resource uncertainty, spending, proposals, rejections, and state changes. It should let a visitor understand the game and one season's decisions without reading an unbounded log.

Reference practice uses a multi-season match and per-axis summaries. AI missions use a separate three-season presentation with per-season details. A small match illustrates variability; it is not sufficient to establish a stable skill ranking.

The user can change authority or sailing choices, rerun, and inspect the consequences. The next revision should continue improving parameter meaning and distinguish scripted controls from model instructions.

Store scenario/context, entry, wallet rules, observations, proposals, acceptance/refusal, transfers, actions, outcomes, and replay hashes. Private model credentials and internal chain of thought are not part of public evidence.

## 9. Next milestones

1. **External participant continuity:** durable entries and results, authenticated ownership, revision export, and restart-safe retrieval.
2. **Strategy validation:** preregister a new study of cooperation and restraint, with appropriate sample size, same-seat comparisons, observation parity, and retention of ties/failures.
3. **Competition lifecycle:** one frozen entry, committed unknown multi-season packs, equal runtime limits, full-field comparison, and reproducible disclosure.
4. **Execution/API:** versioned typed Ocean discovery and result contracts, durable AI jobs, explicit cost authority, and SDK/CLI support.
5. **Participant settlement:** distinct beneficiary ownership, allocation commitments, and verified claim/payment receipts tied to the same final field.

Do not turn public reference matches or sandbox registration into claims of completed unknown-final competition. Do not alter metric definitions after observing results without versioning and disclosing the change.

## 10. Ownership and checks

Primary files are under `packages/ocean-commons/src/`: `engine.ts`, `match.ts`, `negotiation.ts`, `agents.ts`, `entry.ts`, `submission.ts`, `evaluator.ts`, and `voyage.ts`. Web integration uses the Ocean workbench and voyage stage.

Keep Rescue-specific logic separate. Coordinate shared API, registry, schema, package/lockfile, and public documentation edits through the integration owner.

Required checks include deterministic transition/replay, conservation and fuel, wallet authority, contract-specific compliance, escrow/refunds, observation projection, invalid entries, aggregation, hashes, and order-independent frontier calculations. Frontend changes require desktop/mobile interaction and console checks.

The latest original Phase 0 record reports 42 passing tests; later entry and integrated-project test records are separate. Current public-page verification is recorded in [PUBLIC_VERIFICATION_2026-09-13.md](PUBLIC_VERIFICATION_2026-09-13.md). This edition changes documentation, not game rules or experimental results.
