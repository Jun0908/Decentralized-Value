# 2. Definition and Shared Language

## 2.1 Definition of Value Decentralization

> A design philosophy that prevents judgments about what matters from being concentrated in one score, one funder, or one rule; enables multiple independent allocations from shared, verifiable evidence; and creates the conditions for values without markets to develop new markets and industries of their own.

This definition requires more than a general commitment to diversity. Values must be translated into public rules, their contexts and evidence must be fixed, and different actors must be able to support different outcomes without changing the underlying facts.

## 2.2 What it is not

- It is not merely a dashboard displaying two or more metrics.
- It does not convert multiple values into a 50/50 or otherwise weighted average.
- It does not select one supposedly balanced answer.
- It does not turn the Pareto Frontier into a new universal answer.
- It does not make safety, correctness, rights, or minimum protections tradable against rewards.
- It does not assume that recording something on a blockchain makes the evaluator correct.
- It does not claim that the entire evaluation process is already decentralized.

## 2.3 Minimum vocabulary

| Concept | Definition | Example |
| --- | --- | --- |
| Value Tension | Values that are difficult to maximize simultaneously but cannot responsibly be ignored | cost and resilience, speed and fairness |
| Hard Constraint | A minimum condition that must not be traded against another value | correctness, rights, budget limits, safety |
| Artifact | An executable proposal for addressing the same problem | strategy, code, allocation rule, institutional rule |
| Context | The conditions and evaluator version under which a result is valid | workload, region, budget, disaster scenario |
| Outcome Vector | Independent measurements of an artifact | cost, worst delivery, regional coverage |
| Shared Evidence | Results and supporting material referenced by different Value Pools | outcomes, traces, Context Hash, Result Hash |
| Value Pool | A public value statement, rule, budget, and context | resilience, efficiency, or fairness pool |
| Pareto Frontier | The set of results not dominated by another artifact across all outcomes | cheap, fair, and resilient alternatives coexisting |
| Frontier Contribution | The non-dominated outcome space attributable to an artifact | exclusive hypervolume contribution |
| Evidence Level | The type and strength of evidence supporting a result | simulation, observation, reproduction |
| Settlement | A commitment to the final allocation and the corresponding reward transfer | Sepolia allocation and RewardPaid event |

## 2.4 Shared evidence and plural judgment

Value Decentralization does not make facts relative. It fixes the dataset, constraints, metrics, evaluator, artifact, and outcomes as shared evidence whenever possible.

What it decentralizes is the judgment about which improvements should receive support.

```text
SHARED EVIDENCE ≠ ONE SHARED VALUE JUDGMENT
```

Different Value Pools can reference the same evidence and produce different allocations. No pool represents the whole system, and budgets across pools are not recombined into a master score.

## 2.5 Context as a first-class object

There is no universal outcome or frontier independent of context. The same code can behave differently when the compiler, workload, or EVM revision changes. The same disaster-response strategy can produce different outcomes when suppliers, transport networks, demand, or disruption scenarios change.

The system therefore records an **artifact’s outcome within a specific context**, rather than ranking the artifact in the abstract. A context includes the dataset, constraints, metrics, evaluator version, and Evidence Level required to preserve comparability.

{% hint style="warning" %}
Outcomes from different contexts must not be mixed into the same leaderboard or frontier without an explicit comparability rule.
{% endhint %}

## 2.6 Market formation is not automatic

Turning a value into an independent metric does not automatically create a market. It may produce superficial optimization or simply create another composite score.

Market formation requires continuity across at least the following elements:

- the value can be described independently;
- metrics and Hard Constraints are public;
- evidence makes outcomes reproducible;
- a Value Pool provides independent capital;
- multiple artifacts can respond to the same demand;
- demand for the value recurs over time; and
- evaluators, standards, specialists, and adopters can develop around it.

Value Decentralization is not a catalog of values. It is an attempt to open this process of market formation.
