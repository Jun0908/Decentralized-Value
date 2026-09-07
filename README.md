# Value Decentralization

**Powered by Frontier Protocol**

> Reward every valid solution that expands what is possible.

Frontier Protocol is an Ethereum-native reward protocol for problems with more than one valid definition of “better.” Sponsors publish independent goals and correctness rules. Builders and AI agents submit solutions. Deterministic evaluators preserve every non-dominated tradeoff on a Pareto frontier, and Ethereum makes the final reward allocation publicly verifiable.

[Open the public demo](https://web-rho-seven-d6te7t3f0y.vercel.app) · [Verify the Sepolia reward](https://sepolia.etherscan.io/tx/0xd976a968aefeb66d7e60fba7a9cf64c8711195fc3652aeccc20c7448069ad708)

## How it works

```text
Sponsor publishes goals, constraints, and a reward pool
  -> Builder or AI agent submits a valid solution
  -> Evaluator measures every solution under the same public context
  -> Pareto analysis keeps distinct useful tradeoffs
  -> Ethereum records the result and distributes rewards
```

A solution does not win by maximizing one hidden weighted score. It remains valuable when no other valid solution is better on every independent axis. Reward allocation is based on how much useful frontier area each solution contributes.

## Working proofs

### Ethereum Calldata Compression

The Top page runs compiled Solidity decoder bytecode in a local Cancun EVM. The preloaded Packed codec deterministically reproduces:

- `8,200` calldata gas
- `13,061` decoder execution gas
- correctness `PASS`
- `5.27%` frontier contribution

Dictionary encoding uses less calldata while Packed decoding uses less execution gas, so both remain rewardable. Standard ABI loses on both axes and is dominated.

### Emergency Supply Allocation

Users allocate 1,000 emergency kits among five suppliers. The API recalculates total cost, worst-case delivery, all nine single-failure scenarios, correctness, Pareto status, frontier contribution, and deterministic hashes from the submitted allocation. This is an editable social application of the same protocol, not a precomputed animation.

### Extensible arenas

Community Microgrid Dispatch measures cost, worst-case delivered energy, and lifecycle carbon across three independent axes. It demonstrates that Frontier Protocol is not limited to one dashboard or two metrics.

## Why Ethereum

Evaluation is performed offchain because arena-specific computation can be expensive. Ethereum is used where a neutral public record matters: committing the final allocation, preventing it from being silently rewritten, and exposing reward events to every participant.

The Sepolia demonstration completed token funding, allocation commitment, `RewardPaid`, and a 10,000 FDT recipient balance increase:

- [Deployment record](Docs/deployments/sepolia-reward-demo.json)
- [Allocation commitment](https://sepolia.etherscan.io/tx/0x96fd7a9d1f4a3bbd2fa7a9ea28d250a16e8eedbaff05b51a4f33e581c3839f2c)
- [RewardPaid transaction](https://sepolia.etherscan.io/tx/0xd976a968aefeb66d7e60fba7a9cf64c8711195fc3652aeccc20c7448069ad708)

The token is a Sepolia demonstration asset and has no monetary-value claim.

## Run locally

Requirements: Node.js 22+, pnpm 11.24.0 through Corepack, and Foundry 1.8.1 for contract tests.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Run the complete local verification suite with:

```bash
pnpm run ci
```

Optional integrations use `.env.local`. The repository ignores `.env` and `.env.*` except `.env.example`; never commit private keys, wallet material, or service credentials.

## Current boundary

The public practice evaluations and Sepolia reward-path demonstration are real. A production tournament with durable participant storage, World ID uniqueness, arbitrary source isolation, hidden final workloads, and scheduled final settlement is not deployed. The UI must not describe those incomplete capabilities as live.

See [current implementation status](Docs/STATUS.md) for the exact boundary.

## Documentation

- [Product and competition model](Docs/PRODUCT.md)
- [Architecture and trust boundaries](Docs/ARCHITECTURE.md)
- [Current status and next work](Docs/STATUS.md)
- [Demo and recovery guide](Docs/DEMO.md)
- [Optional integrations](Docs/INTEGRATIONS.md)
- [Emergency Supply specification](Docs/arenas/emergency-supply.md)
- [Calldata Compression specification](Docs/arenas/calldata-compression.md)

Historical plans and superseded sponsor-specific briefs are retained under `Docs/archive/` for provenance, but they are not current implementation instructions.

## Hackathon provenance

This repository began during the hackathon on 2026-09-05. The product thesis, arena choices, metrics, fairness model, reward philosophy, and UX priorities were directed by the human project owner. Codex and Claude Code were used as implementation partners; generated work was checked through deterministic fixtures, TypeScript, Vitest, Foundry tests, production builds, and browser verification.
