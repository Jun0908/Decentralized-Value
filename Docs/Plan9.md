# Plan 9 — Rescue Room

Created: 2026-09-10. English current edition: 2026-09-13.

Rescue Room is an incident-response arena in which a Commander allocates limited time, information, and budget while deciding whether to investigate, hire a specialist, intervene, or wait.

This edition consolidates the active design and latest evidence. The [unaltered original plan](archive/plan-history-2026-09-13/Plan9.md) retains the detailed phase specifications and dated development history. Historical checkboxes are not a current availability matrix. See [Plans](PLANS.md) for ownership across projects.

## 1. Current position

Production follow-up: the public API currently reports `commanderAvailable: false`. Recorded operator AI and payment demonstrations are separate from public Web inference. Restore and verify the public AI path before describing it as available to visitors. See [release blockers](PRODUCTION_READINESS_2026-09-13.md).

| Area                            | Verified capability                                                                                              | Next gate                                                                                 |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Game foundation                 | Deterministic simulator, seven incident families, ten baselines, replay, three independent outcomes; Phase 0 GO  | Generalizing AI performance and value-of-information study                                |
| Practice                        | Public doctrine practice, curated services, credit ledger, editable strategy, controlled AI runtime              | Durable revisions and final-entry lifecycle                                               |
| Experience                      | Illustrated incident theatre, parameter explanations, replay, baseline comparisons                               | First-time user comprehension testing                                                     |
| Agent-to-agent payment          | Operator-managed real AI purchase, distinct service-model invocation, Sepolia escrow payment and separate refund | Independent providers and production execution controls                                   |
| Purchased-analysis continuation | Three recorded Commander decisions, replayed outcomes, independent pool previews                                 | Broader autonomous response and controlled comparisons                                    |
| Public presentation             | Public Web, English submission view, sponsor evidence, developer quickstart                                      | Final submission and any subsequent deployment verification                               |
| Tournament                      | Design and reusable components                                                                                   | Entry freeze, unknown multi-episode final, full-field allocation, and participant rewards |

The current achievement is a playable practice arena with a verifiable AI-service payment demonstration. The complete external-participant tournament remains a separate milestone.

## 2. Design thesis

**Information has a cost. Delay, intervention, and inaction also have costs.**

The Commander sees observations, not the incident's true state. Additional monitoring, audits, second opinions, patches, and verification consume game time and budget. A useful strategy must decide not just what to do, but what it is worth learning first.

The aim is not to reward persuasive incident reports. Structured actions change the simulator; its outcomes determine the result. Internal chain of thought is neither required nor scored.

### Core vocabulary

- **Episode:** one incident or false positive, from initial alert to termination.
- **World state:** hidden cause, severity, propagation, balances, and relevant dependencies.
- **Observation:** information available to the Commander at that point.
- **Commander:** the participant's decision-making agent.
- **Service:** a scoped capability that returns evidence or an artifact, without independent authority to operate the protocol.
- **Order / evidence receipt / payment receipt:** the linked request, deliverable, and reserve/release/refund records.
- **Doctrine:** a deterministic strategy artifact interpreted by the arena.
- **Playbook:** instructions and authority bounds for the controlled AI Commander.
- **Rescue Credits:** simulated response budget, not tokens.
- **Final entry:** the single frozen artifact selected for an official round; distinct from a practice run.

## 3. Invariants

Correctness is a hard gate. Compare only results sharing evaluator, generator, episode pack, service catalog, action/runtime limits, constraints, metrics, and aggregation rules.

Keep outcome directions independent. Do not create an overall weighted score or force multiple winners. A Commander that dominates every axis should win that comparison.

Pareto membership, contribution, hashes, and allocations must be deterministic and submission-order independent. AI branding, prose quality, model identity, and practice count are provenance, not reward signals.

Keep simulated outcomes, measured execution, commitments, service payments, and rewards distinct. Practice credits are not tokens; a hash match is not proof of a payment or a correct diagnosis.

## 4. Game and information boundaries

The fictional protocol supports module-level containment as well as broad intervention. Incident causes include benign withdrawal spikes, oracle manipulation, accounting drift, compromised keys, liquidity crises, contract exploits, and external-dependency failures.

The action vocabulary is:

```text
BUY_SERVICE
PAUSE_MODULE / PAUSE_PROTOCOL
APPLY_PATCH
RESUME_MODULE / RESUME_PROTOCOL
WAIT / CLOSE_INCIDENT
```

Each action has a strict schema. Services cannot directly modify protocol state. A patch must refer to an available purchased artifact; free text cannot grant authority.

Actions and scheduled deliveries advance a deterministic game clock. API latency, Ethereum confirmation delays, and gas-market fluctuations do not alter competitive outcomes. Game prices and delivery times belong to the fixed evaluation context.

### Curated service market

Start with scoped monitoring, trace/accounting audits, second opinions, patch construction, and patch verification. Their manifests define capability, target, version, price, delivery time, evidence schema, failure/refund policy, and any wallet/escrow references.

Service quality must not depend on the order in which a Commander consumes shared randomness. Equivalent purchases under the same episode and request conditions receive the same evidence realization.

The competitive simulator currently uses deterministic service evidence. A future AI-backed catalog should generate, validate, and commit equivalent service responses once per evaluation context. The operator pilot is a separate real-service execution path, not evidence that every simulated specialist is an independently operated AI.

Open registration, auctions, dynamic provider competition, subcontracting, reputation tokens, arbitrary patch execution, and dispute juries follow only after the curated market demonstrates value.

## 5. Scenario and final design

Generate a causal hidden world, not a randomly assembled narrative. Hidden parameters govern severity, affected modules, loss and propagation, demand, pause side effects, recoverability, patch suitability, telemetry, and service availability/quality.

Include false positives and serious incidents with overlapping initial observations. Immediate full pause, automatic audit, buying every service, and never intervening must each have plausible costs.

Derive exogenous randomness from versioned episode/event/service keys rather than a mutable global random stream. Test termination, budget-feasible paths, observation consistency, capability boundaries, and absence of hidden-state leakage.

### Practice

Publish the evaluator, schema, catalog, training distribution, and starter artifacts. Extensive practice is permitted. Personal/BYO-agent contexts must remain separate from controlled reference-runtime comparisons.

### Final roadmap

- [ ] Persist authenticated revisions and select one final artifact per participant.
- [ ] Commit the context, runtime, service catalog, and a separate multi-episode final pack before evaluation.
- [ ] Freeze entries atomically at the deadline; prohibit intervention and post-result replacement.
- [ ] Fix turn, token, service-call, action, budget, timeout, and recovery rules across entries.
- [ ] Evaluate the full frozen field, then reveal and reproduce the recorded results.
- [ ] Define organizer seed-selection and withholding risks explicitly; a secret-seed commitment alone does not eliminate organizer bias.
- [ ] Add participant uniqueness and isolated external-agent execution before claiming those protections.

A future seed could combine a precommitted secret salt and a specified future Ethereum block value, with a fixed reveal/failure policy. This is a design option, not a deployed randomness mechanism.

Public practice and immediate-reveal demos are not scheduled hidden finals. A large configuration count does not establish resistance to exhaustive practice.

## 6. Replay, correctness, and independent value

Record observations, structured actions, orders, deliverables, payment events, game time, state transitions, patches, termination, and final outcomes. Separate Commander-visible information from evaluator-only evidence until disclosure is allowed.

The canonical chain binds episode, artifact/runtime context, transcript, result, and allocation. Wall-clock timestamps, API IDs, transaction hashes, and free-form rationale belong in execution/provenance records, not deterministic game-result hashes.

Replay reproduces a recorded action sequence. It does not promise identical outputs from a new LLM invocation.

Hard constraints enforce schemas, budget, permissions, valid references, runtime limits, and transcript integrity. A valid but poor decision—unnecessary pause, delayed containment, or an ineffective patch—is reflected in outcomes, not silently disqualified.

| Outcome                | Direction | Interpretation                                 |
| ---------------------- | --------- | ---------------------------------------------- |
| Total user loss        | Minimize  | Assets lost under the simulated incident       |
| Served protocol demand | Maximize  | Demand served under the fixed pack aggregation |
| Net response spend     | Minimize  | Nonrefunded simulated response expenditure     |

Units, bounds, rounding, and episode aggregation must be fixed in the manifest.

### Independent pools

- **User Protection:** support minimum user loss, splitting exact ties deterministically.
- **Availability:** maximize demand served subject to a published protection threshold.
- **Treasury Stewardship:** minimize spend subject to published protection and availability thresholds.
- **Frontier Expansion:** allocate by positive exclusive contribution under the published multiobjective rule and eligibility conditions.

Show the full frontier separately from reward-eligible entries. Zero-spend strategies may be Pareto-optimal without qualifying for a particular pool. Eligibility is explicit; it is not a hidden weight.

## 7. Implementation and evidence

### Simulator feasibility

The recorded Phase 0 study used 2,000 seeds, ten baselines, and five packs of 400 episodes. After fixing purchase-order dependence and public-state leakage, evaluator v2 was rerun.

| Observation                                 |                                                      Recorded result |
| ------------------------------------------- | -------------------------------------------------------------------: |
| Deterministic replay                        |                                                                 Pass |
| Single fixed policy dominating all outcomes |                                                                 None |
| Full frontier                               |                                                           7 policies |
| Adaptive policy                             |                                             Remained on the frontier |
| Episodes where services helped / hurt       |                                                          1,315 / 596 |
| Incident-dependent first actions            |                                                                    3 |
| Covered incident families                   |                                                               7 of 7 |
| Pack sensitivity                            | Seven common frontier policies; one pack also included monitor-first |
| Runtime / preregistered ceiling             |                                                  62,690 / 120,000 ms |

[Raw evidence](../benchmarks/rescue-room/results/latest.json), recorded evidence hash: `0xa5da26f534ff1345a3139f2579edafc4ea8dd40c7b3abc5c16650be8977bceb3`.

This supports the simulator's playable-practice GO decision, not a claim that LLMs outperform fixed strategies. The seeded-random policy's low-spend frontier membership was retained.

### Controlled AI practice

The recorded v1 runtime used OpenAI Agents SDK 0.17.2, model ID `gpt-5.6-luna`, reasoning effort `none`, at most 12 model turns, 400 output tokens per turn, 20 seconds per request, and 90 seconds per episode. Each turn receives the current public state and emits one structured action.

The model identifier is not an immutable dated snapshot. A final round needs a committed resolved model version or an equivalent frozen execution policy.

The 2026-09-10 smoke run purchased four simulated services and replayed to the same result hash: loss 0 USD, demand served 100%, spend 63 Credits. It used ten requests, 16,317 tokens, and 21,771 ms. [Recorded run](../benchmarks/rescue-room/results/ai-smoke-latest.json).

### Strategy Game UX

The implemented loop is **edit doctrine/playbook → lock → run → watch → compare → change one rule**. Reference policies are baselines rather than the primary player input.

The theatre groups transcript events into decision beats with five chapters: Alert, Investigate, Decide, Recover, Outcome. Commander, protocol, and service actors show the direction of purchases and returned evidence. The latest decision explains its effect; raw logs are available as an initially closed audit view.

Ten strategy controls explain authority and tradeoffs. Spend / Certainty / Containment summaries are display aids, not evaluation scores. Prompt editing controls the AI Playbook; model/runtime limits remain part of the fixed context.

Automated desktop/mobile, replay, baseline, reduced-motion, console, overflow, and contrast checks passed in the recorded UX batch. First-time testing with five people remains open: target ten-second understanding, a start within sixty seconds, and an explanation of what one changed rule gained and sacrificed. Automated checks do not establish those comprehension results.

### Sepolia operator pilot

A real Commander selected `pulse-monitor`; a separate model invocation produced the analysis. The operator-managed flow linked request, observation, order, deliverable, acceptance, and payment hashes.

The pilot deployed `RescueUSDDemo` and `RescueServiceEscrow`, used distinct Commander/Executor/Attestor/Provider roles, paid **5 rUSD-DEMO** to the provider, and refunded **5 rUSD-DEMO** on a separate undelivered order. Recorded final balances were provider 5 and Commander 95. [Public payment evidence](deployments/sepolia-rescue-service-demo.json).

This is an actual Sepolia test-token payment between distinct agent roles under operator-managed wallets. It is not a third-party marketplace or evidence of real-world token value.

Payment authority binds chain, token, escrow, provider, order, context, price, budget, and deadline. The execution path uses persistent reservations, a signed-transaction journal, receipt/balance checks, and explicit reconciliation. Ambiguous inference or transaction state is not automatically replayed.

The single-host durable job and loopback HTTP/SDK/CLI path is covered by [Plan 12](Plan12.md). Public practice does not implicitly authorize transfers.

### Purchased analysis to subsequent decisions

The saved analysis was returned to the Commander for three further decisions: **WAIT → WAIT → PAUSE_MODULE (withdrawals)**. The recorded actions then advanced the simulation to T+60.

| Entry                    |  Loss | Demand served | Response spend |
| ------------------------ | ----: | ------------: | -------------: |
| Recorded AI continuation | 0 USD |      71.1274% |      5 Credits |
| Never Pause baseline     | 0 USD |          100% |      0 Credits |

The baseline dominates in this episode. The result remains part of the demonstration; no replacement episode was selected to manufacture an AI win. Each of the three pool previews independently allocates 100 preview credits, not real rewards.

The short continuation connects purchased analysis to decisions and outcomes. It does not establish the causal benefit of buying that analysis or complete autonomous patch/resume handling. See [public replay](deployments/rescue-submission-replay.json) and [submission handoff](RESCUE_HANDOFF.md).

## 8. Next implementation priorities

1. **User understanding:** run the first-time comprehension study and fix demonstrated issues without changing evaluator semantics.
2. **Information value:** implement the masked-input and arm-runner design in [RESCUE_INFORMATION_STUDY.md](RESCUE_INFORMATION_STUDY.md). Compare analysis-visible, analysis-masked with the same purchased prefix, and no-purchase arms across all 35 public episodes. Freeze model, prompt, code, three-turn cap, outcomes, and failure handling before execution. The design's maximum 350 calls is a ceiling, not spending authorization.
3. **Competition state:** durable revisions, frozen entries, unknown packs, equal execution windows, and full-field comparison.
4. **Production service execution:** authenticated external participants/providers, durable multi-host cost control, private evidence access, reconciliation, and independent service provenance.
5. **Commitments and rewards:** bind final transcripts and allocation roots to verified settlement, reusing existing reward primitives where their contracts match.

GO requires reproducibility, meaningful contextual choices, useful and costly information, and nontrivial independent outcomes. PIVOT if a fixed strategy dominates, additional purchases monotonically win, or lookup alone resolves unknown finals. STOP competition work if causal structure, fairness, or operating cost cannot meet the preregistered conditions. A useful replay/payment demo can remain valuable independently of tournament feasibility.

## 9. Ownership and verification

Reuse shared schemas, canonical hashes, multiobjective evaluation, contribution, and settlement. Reuse existing competition/store patterns after checking semantics; do not rewrite Plan 6 or abstract the whole system before the domain needs it.

Plan 9 owns Rescue simulation, Commander/service behavior, UX, and payment semantics. Plan 11 owns sponsor execution/identity evidence; Plan 12 owns external API/tooling and job contracts. Shared API entrypoints and lockfiles require coordinated changes.

Required tests cover hidden-state projection, keyed randomness, time/order, delivery/timeout, reserve/release/refund, overspend, pause/resume, patch validity, false positives, propagation, replay, metric bounds, ties, rounding, and order-independent full-field allocation. UI changes must preserve canonical outcomes and result hashes.

The [status document](STATUS.md) and [public verification report](PUBLIC_VERIFICATION_2026-09-13.md) distinguish recorded local checks, public deployment, and remaining operator tasks. This English edition changes documentation only.
