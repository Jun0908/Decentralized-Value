# Value Decentralization

**Frontier Protocol rewards useful tradeoffs without hiding them inside one score.**

Most competitions combine cost, performance, safety or resilience into a weighted total. That produces a clean ranking, but the weights have already decided which kind of improvement matters most.

Value Decentralization keeps each metric independent and lets funders publish separate Value Pools with visible rules and budgets. Correct solutions can receive support for efficiency, resilience, fairness, or the new Pareto-frontier area they contribute—without one overall winner.

[Live product](https://web-rho-seven-d6te7t3f0y.vercel.app) · [Sepolia reward](https://sepolia.etherscan.io/tx/0xd976a968aefeb66d7e60fba7a9cf64c8711195fc3652aeccc20c7448069ad708) · [Architecture](https://web-rho-seven-d6te7t3f0y.vercel.app/architecture)

## A result you can reproduce

The Calldata Compression arena runs compiled Solidity decoder bytecode inside an EthereumJS Cancun EVM. The preloaded Packed codec produces:

| Calldata gas | Decoder gas | Correctness | Frontier contribution |
| -----------: | ----------: | :---------: | --------------------: |
|      `8,200` |    `13,061` |   `PASS`    |              `+5.27%` |

Dictionary encoding uses less calldata. Packed decoding uses less execution gas. Neither dominates the other, so both remain rewardable. Standard ABI performs worse on both axes and receives no frontier reward.

The measurement and result hash are calculated from executable bytecode rather than a precomputed animation.

**[Run the live EVM proof](https://web-rho-seven-d6te7t3f0y.vercel.app/arenas/calldata-compression)**

## How it works

```text
Public goals, constraints, and Value Pools
        ↓
Builder or AI agent submits a solution
        ↓
Correctness gate and deterministic measurement
        ↓
Independent pool rules and Pareto contribution
        ↓
Ethereum allocation and reward
```

Each challenge fixes its dataset, hard constraints, metrics and evaluation environment before results arrive. Invalid artifacts never enter the performance comparison.

A valid result remains on the frontier when no other result performs at least as well on every axis and strictly better on one. Its exclusive contribution is the frontier area lost when that result is removed.

```text
contribution[i] = HV(frontier) - HV(frontier without result[i])

reward[i] = rewardPool × contribution[i] ÷ totalContribution
```

The same evidence can therefore unlock different rewards without asking one sponsor to compress every value into a preferred weighting.

## Why Ethereum

Arena-specific evaluation runs offchain, where different datasets and execution environments are practical. Ethereum handles the boundary that participants should be able to verify independently.

The Sepolia demonstration records the final allocation, prevents a second commitment or duplicate claim and emits the reward event publicly.

- [Deployment record](Docs/deployments/sepolia-reward-demo.json)
- [Allocation commitment](https://sepolia.etherscan.io/tx/0x96fd7a9d1f4a3bbd2fa7a9ea28d250a16e8eedbaff05b51a4f33e581c3839f2c)
- [RewardPaid transaction](https://sepolia.etherscan.io/tx/0xd976a968aefeb66d7e60fba7a9cf64c8711195fc3652aeccc20c7448069ad708)

The demonstration increased the recipient balance by `10,000 FDT`. FDT is a Sepolia demonstration token with no claim of monetary value.

## Three working arenas

### Ethereum Calldata Compression

Measures calldata gas and decoder execution gas while requiring the Solidity decoder to reproduce the reference result and reject malformed input.

[Measure a codec](https://web-rho-seven-d6te7t3f0y.vercel.app/arenas/calldata-compression)

### 72-Hour Disaster Response

Builds a response strategy across five suppliers, four routes and four regions, then replays seven disruption scenarios. Independent Value Pools reward the cheapest valid strategy, strongest worst-case delivery, fairest regional coverage and positive frontier contribution without declaring an overall winner.

The arena also includes four practice-only learning missions and a machine-readable AI Agent path. Its Starter Kit publishes the Strategy schema, evaluator contract, public scenarios, equal usage limits, baseline Agent and reproduction command. Human and Agent entries are measured by the same evaluator; Agent metadata and effort never affect rewards.

[Build a response strategy](https://web-rho-seven-d6te7t3f0y.vercel.app/arenas/emergency-supply)

### Community Microgrid Dispatch

Measures energy cost, worst-case delivered energy and lifecycle carbon as three independent axes.

[Build a dispatch](https://web-rho-seven-d6te7t3f0y.vercel.app/arenas/microgrid-dispatch)

Each arena supplies its own inputs, correctness checks and metrics. The challenge shell, frontier engine and settlement interface remain shared.

## Beyond a better competition

Ethereum made ownership and participation more open. Value Decentralization applies the same direction to a quieter question: which improvements receive capital?

When price is the only visible axis, the cheapest solution wins. Keeping environmental impact separate can leave room for low-cost, low-carbon, locally resilient and circular approaches to develop at the same time.

The protocol does not choose society's values. Communities publish the axes, bounds and correctness rules. Those choices stay visible, and another community can create a market with different rules.

## Current status

Working today:

- compiled Solidity execution in a Cancun EVM;
- deterministic correctness, metric and Pareto evaluation;
- editable Disaster Response and Microgrid simulations;
- independent Value Pool manifests, deterministic allocations, and a community Protect a Region practice pool;
- `84` automated TypeScript tests in the local build evidence;
- a publicly inspectable Sepolia reward-path demonstration.

The public evaluators and Sepolia reward demonstration are real. Disaster Response and Classic Emergency Supply participant state use durable Redis storage in production. Participant uniqueness, isolated arbitrary-code execution, hidden final workloads, and scheduled final settlement are not deployed.

See [Docs/STATUS.md](Docs/STATUS.md) for the exact implementation boundary.

## Run locally

Requirements:

- Node.js `22+`
- pnpm `11.24.0` through Corepack
- Foundry `1.8.1` for contract tests

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Run the full verification suite:

```bash
pnpm run ci
```

Optional integrations use `.env.local`. Never commit private keys, wallet material or service credentials.

## Documentation

- [Product model](Docs/PRODUCT.md)
- [Architecture and trust boundaries](Docs/ARCHITECTURE.md)
- [Current implementation status](Docs/STATUS.md)
- [Demo and recovery guide](Docs/DEMO.md)
- [Optional integrations](Docs/INTEGRATIONS.md)

## Provenance

Development began during the hackathon on 2026-09-05. The human project owner directed the product thesis, arena choices, metrics, fairness model and reward philosophy. Codex and Claude Code supported implementation. Generated work was checked through deterministic fixtures, TypeScript and Foundry tests, production builds and browser verification.
