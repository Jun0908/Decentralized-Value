# Frontier Protocol

Frontier Protocol rewards artifacts that expand the space in which multiple independently measured values can coexist. The ETHOnline 2026 MVP begins with an EVM arena comparing gas efficiency and parallel throughput under shared correctness constraints.

## Repository status

Phase 0 is complete: the pnpm monorepo, strict TypeScript configuration, quality commands, environment validation, CI, and implementation-decision log are in place. Protocol schemas and benchmark code start in Phase 1.

## Requirements

- Node.js 22 or later
- pnpm 11.24.0 through Corepack

## Setup

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm env:check
pnpm run ci
```

Copy `.env.example` to `.env.local` only when local integration values are needed. Never commit `.env.local`, private keys, Ledger passwords, Bazantic credentials, or wallet material.

## Commands

| Command             | Purpose                                           |
| ------------------- | ------------------------------------------------- |
| `pnpm dev`          | Start the Next.js web application                 |
| `pnpm env:check`    | Validate environment keys without printing values |
| `pnpm lint`         | Run ESLint across the workspace                   |
| `pnpm format:check` | Check formatting                                  |
| `pnpm typecheck`    | Type-check all workspace packages                 |
| `pnpm test`         | Run unit tests                                    |
| `pnpm build`        | Produce the web production build                  |
| `pnpm run ci`       | Run the full local CI sequence                    |

## Workspace

```text
apps/web                 Next.js App Router application
apps/api                 Frontier HTTP API
apps/runner              Reproducible benchmark runner
packages/contracts       Foundry contracts (Phase 2)
packages/sdk             Typed Frontier client
packages/shared          Shared validation and protocol types
packages/ens-adapter     ENSv2 integration boundary
packages/ledger-adapter  Ledger integration boundary
artifacts/orderbook      Comparable Solidity artifacts (Phase 1)
benchmarks/evm-orderbook Deterministic benchmark harness (Phase 1)
bazantic                 Bazantic gateway and Recipe material
openapi                  Versioned Frontier API specification
Docs                     Source briefs, decisions, and task tracking
```

See [the implementation task list](Docs/IMPLEMENTATION_TASKS.md) and [implementation decisions](Docs/implementation-decisions.md) for the current plan.
