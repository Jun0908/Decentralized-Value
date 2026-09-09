# Product and competition model

## Product thesis

Many competitions combine cost, safety, speed, and quality into one weighted score. Whoever chooses those weights quietly chooses what “better” means and often chooses the winner before participants begin.

Frontier Protocol keeps independent values separate. Funders publish distinct Value Pools instead of hiding their priorities inside one organizer-controlled score. A correct solution can receive support for resilience, efficiency, fairness, or the new Pareto-frontier area it contributes.

> Reward every valid solution that expands what is possible.

## The protocol in five steps

1. Sponsors publish a challenge, independent metrics, hard constraints, a fixed evaluation context, and Value Pools with explicit rules and budgets.
2. Human builders and AI agents submit solutions under the same opportunity and compute limits.
3. A deterministic evaluator rejects incorrect solutions and measures every surviving solution on every declared axis.
4. Each Value Pool evaluates the same evidence under its own public rule; Pareto analysis also preserves solutions that add a new tradeoff.
5. Ethereum commits the selected result and allocation evidence and makes reward distribution publicly auditable.

There may be several winners. A cheaper solution and a more resilient solution can both be valuable when neither is strictly better than the other on every axis.

In the current Disaster Response practice arena, Human and AI Agent submissions share one published Strategy schema, evaluator version, context, constraints, metrics, practice rate limit, revision limit, and single Final Entry rule. Optional learning missions only guide exploration. Agent identity, prose, and number of attempts are evidence, not reward signals; Value Pools use correctness and measured outcomes only.

## Core concepts

| Term | Meaning |
| --- | --- |
| Challenge | Public problem, rules, metrics, context, deadline, and reward configuration |
| Artifact | A participant's submitted solution |
| Hard constraint | A correctness rule that must pass before scoring |
| Outcome vector | One measured value for every independent metric |
| Context | Versioned dataset, evaluator, constraints, metrics, and execution settings |
| Pareto frontier | Valid solutions for which no other solution is at least as good everywhere and better somewhere |
| Frontier contribution | The useful outcome area uniquely added by a solution |
| Value Pool | A funder's public value statement, deterministic allocation rule, budget, context, and manifest hash |
| Settlement | The committed final allocation and reward transfer |

## How it differs

- A conventional single-score competition asks who ranks first after metrics are combined. Frontier Protocol asks which distinct tradeoffs expand the possible set.
- A prediction market rewards accurate beliefs about what will happen. Frontier Protocol rewards working solutions that expand what can be achieved.
- A generic optimization dashboard helps one operator choose. Frontier Protocol gives many participants the same rules, reproducible measurement, public attribution, and verifiable reward allocation.

## Current arena portfolio

| Arena | Independent goals | Product role |
| --- | --- | --- |
| Ethereum Calldata Compression | Minimize calldata gas and decoder execution gas | Main Ethereum technical proof |
| 72-Hour Disaster Response | Minimize 72-hour cost while maximizing worst-case delivery and worst-region coverage | Primary social competition with strategy, disaster replay, independent Value Pools, community value creation, and demo settlement |
| Community Microgrid Dispatch | Minimize cost and carbon while maximizing worst-case delivered energy | Three-axis extensibility proof |

Detailed active specifications are under `Docs/arenas/`. The arena registry adds shared presentation and routing; a genuinely new problem shape still requires an evaluator adapter and deterministic tests.

The original five-number Emergency Supply Allocation remains available as a Classic fallback. It is not the primary arena and has its own independent API and storage namespace.

## Fairness model

- Everyone receives the same published rules and public workload.
- Correctness failures never enter the frontier.
- Contexts and evidence levels are never mixed in one comparison set.
- Submission order cannot affect frontier membership or reward allocation.
- Public practice evaluation is separated from any future hidden final workload.
- A final tournament must define participant uniqueness, equal submission limits, one selected final entry, and a committed deadline before accepting entries.

## Why Ethereum is part of the product

Ethereum does not make the evaluator correct by itself. Its role is to make final commitments and payouts difficult for an operator to rewrite after seeing the result. Computation stays offchain; challenge commitments, final allocation evidence, and rewards can be verified onchain.
