# Frontier Protocol

Frontier Protocol rewards artifacts that expand the space in which multiple independently measured values can coexist. The ETHOnline 2026 MVP begins with an EVM arena comparing gas efficiency and parallel throughput under shared correctness constraints.

## Repository status

Phases 0 and 1 are complete. Phase 2 is complete locally: registries, EIP-712 attestation verification, runner authorization, Pareto settlement, Foundry tests, gas snapshots, and a reproducible Sepolia deployment script are present. Live Sepolia deployment and verification remain pending because no RPC URL or funded deployer signing method is configured.

## Requirements

- Node.js 22 or later
- pnpm 11.24.0 through Corepack
- Foundry 1.8.1

## Setup

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm env:check
pnpm run ci
```

Copy `.env.example` to `.env.local` only when local integration values are needed. Never commit `.env.local`, private keys, Ledger passwords, Bazantic credentials, or wallet material.

## Commands

| Command                    | Purpose                                           |
| -------------------------- | ------------------------------------------------- |
| `pnpm dev`                 | Start the Next.js web application                 |
| `pnpm env:check`           | Validate environment keys without printing values |
| `pnpm lint`                | Run ESLint and check Solidity formatting          |
| `pnpm format:check`        | Check formatting                                  |
| `pnpm typecheck`           | Type-check all workspace packages                 |
| `pnpm test`                | Run Vitest and Foundry unit/fuzz tests            |
| `pnpm benchmark:orderbook` | Generate the measured order-book frontier fixture |
| `pnpm build`               | Build contracts and the web production bundle     |
| `pnpm run ci`              | Run the full local CI sequence                    |

## Workspace

```text
apps/web                 Next.js App Router application
apps/api                 Frontier HTTP API
apps/runner              Reproducible benchmark runner
packages/contracts       Foundry contracts and deployment scripts
packages/sdk             Typed Frontier client
packages/shared          Shared validation and protocol types
packages/ens-adapter     ENSv2 integration boundary
packages/ledger-adapter  Ledger integration boundary
artifacts/orderbook      Artifact metadata and evidence
benchmarks/evm-orderbook Deterministic workload, harness, and measured results
bazantic                 Bazantic gateway and Recipe material
openapi                  Versioned Frontier API specification
Docs                     Source briefs, decisions, and task tracking
```

See [the implementation task list](Docs/IMPLEMENTATION_TASKS.md) and [implementation decisions](Docs/implementation-decisions.md) for the current plan.
