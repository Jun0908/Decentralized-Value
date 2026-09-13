# Value Decentralization

[日本語](README_JA.md)

## Who gets to decide what “better” means?

Most systems hide that decision inside a weighted score. **Value Decentralization makes it plural.**

An evaluation protocol prototype for communities funding better strategies: measure results once, preserve their tradeoffs, and let independent **Value Pools** decide what to support.

**Measure once. Preserve the tradeoffs. Let values diverge.**

**[Try the demo](https://web-rho-seven-d6te7t3f0y.vercel.app/arenas/emergency-supply)** · [Recorded AI + payment demo](https://web-rho-seven-d6te7t3f0y.vercel.app/rescue-room/submission/en) · [Sponsor evidence](https://web-rho-seven-d6te7t3f0y.vercel.app/sponsors/demo)

![Concept illustration: one weighted score collapses alternatives; an open frontier preserves different kinds of progress.](apps/web/public/images/weighted-score-vs-open-frontier.png)

_Concept: preserve useful alternatives rather than force one overall score. A single strategy can still excel on every axis._

## See the difference in 60 seconds

Start with **72-Hour Disaster Response**, a simulated supply operation:

1. **Choose a strategy.** Decide how supplies travel through five suppliers, four routes and four regions.
2. **Inspect the tradeoffs.** Seven disruption scenarios measure cost, worst-case delivery and worst-region coverage separately.
3. **Compare Value Pools.** Efficiency, Resilience and Fairness apply different allocation rules to the same evidence; Frontier Expansion supports new tradeoffs.

A cheaper strategy need not serve the hardest-hit region best. The protocol keeps that disagreement visible instead of hiding it in an overall score. Explore how each Pool’s allocation preview responds to those tradeoffs.

## What is technically different?

- **Comparable, reproducible results.** Correctness is a hard gate. Evaluator, dataset, constraints and metrics define a shared context; hashes bind that context to each artifact and outcome. Only matching contexts are compared.
- **Independent values, deterministic mathematics.** The [comparison engine](packages/shared/src/multiobjective.ts) handles metric directions, Pareto tradeoffs, exact hypervolume up to six dimensions and submission-order-independent contribution.
- **Execution, not self-reported performance.** Calldata Compression runs compiled Solidity decoders inside a Cancun EVM. [AI action replay](packages/rescue-room/src/submission-replay.ts) reproduces recorded decisions and simulated outcomes—not an LLM’s hidden reasoning or a new inference run.

## Why Ethereum?

Evaluation stays offchain. Ethereum records the allocation commitment and payment so observers can check what was fixed and what was transferred.

The [reward contract](packages/contracts/src/FrontierRewardPool.sol) bounds reservations by funded balance, prevents repeat challenge commitments and provides participant claims. A separate Sepolia demonstration records an [allocation commitment](https://sepolia.etherscan.io/tx/0x96fd7a9d1f4a3bbd2fa7a9ea28d250a16e8eedbaff05b51a4f33e581c3839f2c), [RewardPaid](https://sepolia.etherscan.io/tx/0xd976a968aefeb66d7e60fba7a9cf64c8711195fc3652aeccc20c7448069ad708) and a **10,000 FDT** recipient balance increase.

FDT is a Sepolia demonstration token with no claimed monetary value.

## Rescue Room: an AI hired another AI and paid it

In a recorded incident-response pilot, a Commander selected a specialist, a separate model call delivered analysis, and Sepolia escrow paid **5 rUSD-DEMO**. A separate undelivered order refunded **5 rUSD-DEMO**. [Payment evidence](Docs/evidence/deployments/sepolia-rescue-service-demo.json).

Purchased analysis fed into three recorded Commander decisions. Replay those actions, compare user loss, availability and response spending, and inspect how independent Pools allocate support from the same evidence.

The pilot combines **recorded real model calls and Sepolia service payments** with simulated protocol actions and Pool allocation previews. Wallets are operator-controlled; rUSD-DEMO is a test token without monetary value, distinct from practice credits.

## Sponsor integrations: inspect the implementation

| Sponsor             | Role and demonstrated execution                                                                                                                                 | Source / evidence                                                                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ENSv2 · Sepolia** | Discover a Rescue service; delegate one text-record permission, pause discovery and revoke access. Seven recorded transactions.                                 | [Discovery](packages/ens-adapter/src/rescue.ts) · [Permission flow](scripts/demo-ens-rescue.ts) · [Evidence](Docs/evidence/deployments/ensv2-rescue-demo.json) |
| **Chainlink CRE**   | Confidential handler evaluates a private scenario pack; official CRE CLI local simulation produces a salted receipt, followed by reveal and independent replay. | [Handler](workflows/chainlink-cre/rescue-envelope/secret-pack/main.ts) · [Evidence](Docs/evidence/deployments/chainlink-cre-private-pack.json)                 |
| **Bazantic**        | An external AI uses MCP to discover the API and evaluate two strategies in the same context, with results independently reproduced by the local evaluator.      | [Agent integration](apps/api/src/bazantic-rescue-agent.ts) · [Evidence](Docs/evidence/deployments/bazantic-rescue-agent-demo.json)                             |

Each integration has its own execution evidence. [Sponsor walkthrough](Docs/hackathon/sponsors/SPONSOR_DEMO.md).

## Six Arenas, one protocol

Six Arenas explore one protocol: **Disaster Response, Calldata Compression, Microgrid, Secret Gate, Rescue Room and Ocean Commons**. [Explore the product](https://web-rho-seven-d6te7t3f0y.vercel.app).

Explore editable strategies, deterministic practice and result replay, alongside recorded AI/service-payment evidence and a separate Sepolia reward demonstration.

[Implementation status and evaluation findings](Docs/STATUS.md) · [Architecture and trust boundaries](Docs/ARCHITECTURE.md).

## Run locally and reproduce a result

Requires Node.js 22+ and pnpm 11.24.0.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Replay the recorded Rescue outcome and Pool comparison **without API keys, new inference or transactions**:

```bash
pnpm verify:rescue:submission-replay
```

Optional AI, storage and chain operations use the [environment configuration guide](Docs/development/guides/ENVIRONMENT.md). Run the full check suite with `pnpm run ci` (Foundry 1.8.1 required). [Verification reports](Docs/evidence/verification/README.md).

## Reference

[Slides on Canva](https://canva.link/r63xqej7g7c78d3) · [Whitepaper](https://github.com/Jun0908/Decentralized-Value-Whitepaper) · [API contract](openapi/frontier-v1.yaml) · [Documentation](Docs/README.md)
