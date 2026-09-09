# Frontier Protocol Plan 7 — Replay, Value Pools, and Agent Clarity

> Historical plan. Current behavior is summarized in `Docs/STATUS.md` and specified in `Docs/arenas/disaster-response.md`.

**Last updated:** 2026-09-09

**Status:** The replay, Value Pool, rules, explanation, learning, and Agent-entry work was implemented and locally verified. Production-tournament infrastructure remained deferred.

## Part 1 — Fifteen-second disaster replay

### Objective

Show the causal path from a submitted strategy to its measured result in about fifteen seconds.

### Sequence

1. **0–3 seconds: initial placement**
   - Show purchased inventory leaving suppliers.
   - Show the emergency budget held in reserve.
2. **3–6 seconds: disruption**
   - Mark the failed route or supplier.
   - Remove lost inventory and display the exact loss.
3. **6–10 seconds: recovery**
   - Show replacement purchases and rerouting.
   - Display recovery spending.
4. **10–15 seconds: result**
   - Show coverage for all four regions.
   - Show cost, worst-case delivery, and worst-region coverage.

The worst scenario played automatically. Replay, scenario switching, and return-to-builder controls remained available. All visible quantities came from the evaluator's replay trace rather than a separate animation fixture.

### Result

- Exact purchase, loss, repurchase, route, and regional-delivery traces were added.
- The trace drove the network illustration and moving shipment markers.
- The replay reached its result within fifteen seconds.
- The result included previous-strategy deltas.
- Existing submissions, rewards, and the Classic fallback remained intact.

## Part 2 — Independent Value Pools

### Objective

Replace organizer-defined award labels with explicit funders, public value statements, deterministic rules, and separate budgets.

### Initial pools

| Value Pool | Public value statement | Rule | Demo budget |
| --- | --- | --- | ---: |
| Global Relief Fund | Deliver the most aid even in the worst disaster | Maximize worst-case delivery | 2,500 FDT credits |
| Donor Efficiency Pool | Reduce spending among correct strategies | Minimize cost | 2,500 FDT credits |
| Local Communities Pool | Avoid leaving the least-served region behind | Maximize worst-region coverage | 2,500 FDT credits |
| Frontier Expansion Pool | Add useful options not provided by existing strategies | Allocate across positive exclusive contribution | 2,500 FDT credits |

### Allocation rules

- There is no overall score or overall winner.
- Resilience, efficiency, and fairness remain separate pool decisions.
- Exact ties split a pool deterministically.
- The Frontier Expansion Pool distributes proportionally across every Final Entry with positive exclusive contribution.
- Rounding residue follows deterministic result-hash order.
- Allocations cannot exceed each pool's budget.
- Submission order cannot affect frontier membership, contribution, or allocation.
- Practice credits, previews, commitments, and payments remain distinct states.

```text
entry allocation = pool budget
                 x entry exclusive contribution
                 / total positive exclusive contribution
```

### Fund a Value practice flow

An authenticated user could add one durable practice pool through a safe `Protect a Region` template:

- choose one of four regions;
- define a pool name and public value statement;
- set a practice-credit budget;
- maximize that region's minimum coverage across all scenarios.

The template reused existing measured evidence and executed no arbitrary rule code. The added pool could support a previously unrewarded strategy without changing the evaluator or creating an overall ranking.

### Data and settlement boundary

Every built-in and community pool used the same manifest shape: pool ID, challenge ID, funder label, name, value statement, rule type and parameters, credits, context hash, lifecycle state, and manifest hash.

The Sepolia demo paid each participant's combined amount from the existing reward pool while preserving the per-pool breakdown in result and allocation evidence. It did not claim that four independent funders deposited into four independent contracts.

## Part 3 — Rules and strategy clarity

### Problem addressed

The first replay showed what happened but did not sufficiently explain:

- what the participant was trying to achieve;
- how each parameter affected the simulation;
- what improved or regressed from the previous revision;
- why a pool supported a strategy;
- what humans and AI agents were expected to optimize.

### Rules shown before interaction

The UI summarized the shared USD 72,000 budget, seven scenarios, correctness gate, three independent metrics, four Value Pools, and the absence of an overall winner.

It explained the causal role of each parameter:

| Parameter | Decision controlled | Main tradeoff |
| --- | --- | --- |
| Primary buying order | Which suppliers are used first before disruption | Unit price, capacity, arrival time, and route concentration |
| Backup and recovery priority | Which suppliers are used for reserve and recovery | Cheap recovery versus fast recovery |
| Reserve kits | How much of the target is purchased through backup routes | Normal procurement versus route diversification |
| Emergency budget | How much of USD 72,000 is retained after initial purchasing | Initial inventory versus recovery capacity |
| Region policy | Which regions receive arrived inventory first | Deadlines, total delivery, and fairness |

### Deterministic explanations

After evaluation, the product derived and displayed:

- parameter-level differences from the previous revision;
- outcome differences;
- a decision trace from purchase through loss, recovery, and delivery;
- up to three main causes of the worst scenario;
- the scenario evidence that determined each metric;
- possible next moves with explicit tradeoffs;
- the pool rule, evidence value, comparison set, formula, and rounding reason behind each allocation.

Human-readable outcomes appeared before hashes. Display explanations were derived from evaluator data and did not alter result-hash compatibility.

## Part 4 — Learning missions and Agent entry

### Practice missions

Users could choose guidance for low cost, disaster resilience, regional fairness, or frontier exploration. Missions affected only coaching and completion feedback. They introduced no hidden weights and had no effect on evaluator results or Value Pool allocation.

### Fair Agent interface

The Starter Kit published:

- Strategy v2 schema;
- evaluator and context versions;
- public scenarios;
- independent metrics and hard constraints;
- common rate and revision limits;
- a baseline Agent;
- API examples and a reproduction command;
- an Agent submission example.

Human UI and Agent API submissions used the same schema, evaluator, context, and limits. Agent name, version, objective, generated Strategy JSON, and revision history were stored as provenance. Attempt count and prose length were never reward signals; only correctness and measured outcomes affected allocation.

## Implemented result

- Fifteen-second deterministic replay
- Scenario selection and replay controls
- Four built-in Value Pool manifests
- Proportional frontier-pool allocation with deterministic rounding
- Durable `Protect a Region` practice pool
- Pre-play rules and parameter explanations
- Strategy and outcome diffs
- Decision trace and failure explanations
- Pool qualification and allocation explanations
- Four practice learning missions
- Machine-readable Agent entry and provenance
- API, OpenAPI, product, architecture, demo, arena, and status documentation updates

Verification covered deterministic explanation tests, API tests, TypeScript tests, workspace type checking, ESLint, Prettier, production build, desktop/mobile layouts, horizontal overflow, and browser runtime errors. Foundry formatting could not run in the environment used for the final Plan 7 check because Foundry was not installed.

## Deferred production boundary

- isolated CPU/time/memory-limited execution of arbitrary Agent code;
- training scenarios separated from final scenarios held secret until a deadline;
- deadline scheduling and automatic Final Entry lock;
- participant uniqueness;
- multi-runner attestation;
- mainnet assets or monetary-value claims.

Until these exist, the current product remains an instant demo competition rather than a production or hidden-final tournament.
