# 9. Ecosystem and Roadmap

This chapter separates the current implementation from the institutional roles that could emerge if Value Decentralization develops further.

## 9.1 Current Implementation

As of September 9, 2026, the following capabilities can be demonstrated:

| Capability | Current evidence |
| --- | --- |
| 72-Hour Disaster Response | Strategy v2, seven scenarios, three outcomes, four Value Pools, replay, Final Entry |
| Calldata Compression | compiled Solidity decoder executed in a Cancun EVM; independent calldata-gas and decoder-gas measurements |
| Microgrid Dispatch | deterministic comparison across cost, carbon, and worst-case energy |
| Shared multi-objective math | direction-aware Pareto analysis, normalized hypervolume, exclusive contribution |
| Reproducible evidence | context-bound Result Hash and detailed outcomes |
| Reward contracts | Allocation commitment, distribution, and claim fallback |
| Sepolia demonstration | Allocation commitment, RewardPaid event, 10,000 FDT balance increase |

## 9.2 Partial or Optional

| Capability | Honest boundary |
| --- | --- |
| Account and wallet UX | depends on Privy configuration and is not required for measurement |
| Durable competition state | Redis adapters exist, but not every path constitutes a production tournament |
| Community Value Pool | authenticated Practice manifest; it does not increase the Sepolia payout |
| Legacy Orderbook | parallel throughput is a declared simulation |
| External adapters | integrations without credentials or public evidence fail closed |

## 9.3 Not a Production Tournament Yet

- deployed participant-uniqueness policy;
- isolated execution of arbitrary untrusted source code;
- scheduled hidden-final evaluation;
- deadline automation and final-entry locking;
- multi-runner threshold attestations;
- dispute and slashing flow;
- scheduled participant payout; and
- a mainnet token or token with monetary-value claims.

## 9.4 Roles that may emerge

These are institutional hypotheses, not claims about current revenue or adoption.

| Role | Responsibility | Possible incentive |
| --- | --- | --- |
| Value Pool Funder | publish a value statement, rule, context, and budget | support improvement aligned with its purpose |
| Artifact Builder | submit an executable strategy, codebase, or rule | pool allocation, adoption |
| Context Author | version datasets, metrics, and constraints | specification funding |
| Evaluator Maintainer | maintain a deterministic evaluation environment | execution funding |
| Rights Reviewer | audit non-tradable rights and minimum conditions | review funding |
| Independent Replicator | reproduce outcomes as a separate actor | replication funding |
| Challenger | discover metric gaming, bad measurements, or rule failure | challenge reward |
| Adopter | deploy an artifact and update operational evidence | operational value |

If one operator controls every role, evidence production and value judgment become concentrated again. Separating authority, responsibility, and funding is therefore a long-term research problem.

## 9.5 The repository as a public good

The current repository contains reusable components beyond a single interface.

```text
packages/shared                 common schemas and multi-objective math
packages/disaster-response      Strategy v2 and seven-scenario simulator
packages/calldata-compression   Solidity codecs and EVM evaluator
packages/microgrid-dispatch     energy dispatch evaluator
packages/contracts              allocation and reward contracts
packages/sdk                    API client
apps/api                        public API and competition orchestration
apps/web                        public application
```

Every new problem shape requires its own inputs, constraints, metrics, and evaluator, but it can reuse the shared vocabulary of Context, Outcome, Evidence, and Value Pools.

## 9.6 Roadmap

### Now — Honest Demonstration

- publish three working arenas;
- show different allocations from different Value Pools;
- expose the Context, Result, and Allocation Evidence chain;
- make the Sepolia demonstration payout publicly verifiable; and
- distinguish implemented functionality from future plans.

### Next — Credible Competition

- participant-uniqueness policy;
- isolation for arbitrary source execution;
- durable Final Entry and deadline lock;
- hidden-final workload;
- independent runner attestations; and
- dispute and appeal procedures.

### Later — Plural Institutions

- third parties can create and fund Value Pools;
- responsibilities are separated among Context Authors, Evaluators, and Funders;
- social pilots support independent reproduction;
- evidence can accumulate across Evidence Levels; and
- different regions and organizations can maintain different rules in an open registry.

{% hint style="info" %}
The objective is not to create one enormous evaluation authority. It is to create conditions under which different communities can share evidence while preserving different value judgments.
{% endhint %}
