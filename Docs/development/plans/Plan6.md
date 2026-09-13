# Frontier Protocol Plan 6 — 72-Hour Disaster Response

> Historical plan. Current rules live in `Docs/product/arenas/disaster-response.md`; current capability boundaries live in `Docs/STATUS.md`.

**Last updated:** 2026-09-08

**Status:** Hackathon demo implemented. Scheduled tournament infrastructure remained deferred.

## Outcome

Plan 6 replaced the primary static-allocation experience with a strategy-based disaster-response game while preserving the Plan 5 implementation as a Classic fallback.

- Primary route: `/arenas/emergency-supply`
- Primary challenge: `disaster-response-v2`
- Primary durable namespace: `frontier:plan6`
- Classic fallback: `/arenas/emergency-supply-classic`
- Classic challenge: `emergency-supply-v1`
- Classic durable namespace: `frontier:plan5`

The new arena delivered Strategy v2, three public scenarios, four committed instant-final scenarios, three independent metrics, four awards, revision history, one selected Final Entry, visual replay, and Sepolia demo settlement.

## Product objective

The earlier experience looked like a form containing five supplier quantities. Plan 6 reframed it as a game:

> Build a delivery strategy that survives 72 hours of disruptions and competes across cost, resilience, and fairness.

The intended mental model was:

```text
A disaster interrupts suppliers and routes
  -> the submitted strategy reroutes and purchases recovery inventory
  -> aid reaches four regions under different deadlines
  -> cost, worst-case delivery, and regional fairness are measured separately
  -> multiple strategies can receive recognition for different values
```

## World and public data

The scenario modeled:

- a 72-hour response window;
- five suppliers connected through port, rail, road, and air routes;
- four regions with different demand and deadlines;
- inventory, transport capacity, lead time, route concentration, and a USD 72,000 budget;
- supplier outages, route closures, inventory loss, and demand pressure.

The public package included the network, supplier properties, training scenarios, Strategy schema, sample strategy, constraints, metrics, and evaluator version.

Four final scenarios were committed and revealed immediately in the demo response. This supported reproducibility but was explicitly not a scheduled hidden-final tournament.

## Strategy v2

The safe initial artifact was declarative rather than arbitrary code. It controlled:

- primary supplier purchase order;
- backup and recovery supplier priority;
- quantity reserved through backup routes;
- emergency budget retained for post-disruption purchases;
- regional distribution policy.

All input paths normalized to one schema. Arbitrary code would require isolated execution, CPU/time/memory limits, and disabled network access; that capability was not added.

## Correctness gate

A strategy was ineligible when it used unknown entities, invalid quantities, duplicate or incomplete priority lists, an invalid budget split, an unsupported policy, or nondeterministic behavior.

Correctness remained a prerequisite rather than another score.

## Independent metrics

- **72-hour cost — minimize:** the maximum total spend across declared scenarios
- **Worst-case delivery — maximize:** the minimum kits delivered across scenarios
- **Worst-region coverage — maximize:** the lowest regional demand coverage observed across all scenarios

These outcomes were never merged into an overall score. Pareto membership used all three dimensions even when a chart projected only two.

## Simulation flow

For each scenario, the evaluator:

1. applied the submitted initial purchase order and reserve choice;
2. applied the declared supplier or route disruption;
3. calculated lost or delayed inventory;
4. used the remaining emergency budget and recovery priority;
5. allocated arrived inventory according to the regional policy;
6. recorded cost, delivered kits, per-region coverage, losses, and recovery evidence.

The complete result was deterministic and independent of submission order.

## Visual experience

The arena used a consistent supply-network illustration for four understandable states:

1. initial inventory placement;
2. route or supplier disruption;
3. recovery purchase and rerouting;
4. final regional coverage and outcome summary.

Scenario tabs, an event timeline, route markers, and coverage bars connected the measured evidence to the visible story. The worst scenario played automatically, while every other scenario remained inspectable.

## Competition and reward model

The arena included seed strategies designed to expose meaningful tradeoffs. It recognized distinct outcomes for efficiency, resilience, fairness, and frontier contribution rather than declaring one overall winner.

Revisions and one selected Final Entry were persisted. The demo recalculated the complete field together so that arrival order could not change Pareto membership or allocation.

Sepolia settlement reused the Plan 5 adapter and remained a demonstration. It did not imply a scheduled final-day production payout.

## Implementation milestones

| Milestone | Result |
| --- | --- |
| Scenario, Strategy v2, constraints, metrics, and hashes | Implemented |
| Deterministic simulator and three-axis evaluator | Implemented |
| Durable revisions and selected Final Entry | Implemented |
| Network illustration and scenario replay | Implemented |
| Distinct awards and demo allocation | Implemented |
| Sepolia demonstration settlement | Implemented |
| Scheduled deadline and automatic Final Entry lock | Deferred |
| Secret final-scenario storage until deadline | Deferred |
| Participant uniqueness | Deferred |

## Verification

Tests covered strategy validation, scenario calculations, metric direction, three-dimensional Pareto membership, order independence, hashes, revision state, Final Entry ownership, settlement idempotency, and the distinction between demo and production lifecycle states.

Desktop and mobile checks covered the builder, replay, scenario selection, results, and recovery states.

## Design clarifications added after implementation

The later portion of Plan 6 addressed usability issues discovered after the first build:

- distinguish authenticated users from merely detected wallets;
- explain what each strategy parameter changes;
- expose supplier cost, capacity, route, and arrival-time tradeoffs;
- show how the USD 72,000 budget is split between initial purchases and recovery;
- explain how regional distribution policy affects delivery and fairness;
- derive award and frontier explanations from evaluator evidence;
- keep hashes available for verification without putting them before human-readable outcomes.

These clarity goals were completed in Plan 7.

## Deferred production boundary

- isolated participant code execution;
- hidden final scenarios held until a real deadline;
- scheduled entry lock and evaluation;
- participant uniqueness;
- multiple independent runner attestations;
- dispute and slashing mechanisms;
- mainnet assets or monetary-value claims.
