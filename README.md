# Frontier Protocol

Frontier Protocol rewards artifacts that expand the space in which multiple independently measured values can coexist. The ETHOnline 2026 MVP begins with an EVM arena comparing gas efficiency and parallel throughput under shared correctness constraints.

## Repository status

Phases 0–7 now have a locally verified vertical slice: deterministic Solidity benchmarks, Pareto settlement contracts, fail-closed ENS discovery, Ledger DMK signing boundary, asynchronous HTTP API, Bazantic service material, Privy-ready Next.js UI, and demo automation. The real benchmark currently contains four artifacts and three non-dominated points.

Live Sepolia deployment, ENSv2 names/EAC delegation, Ledger-device signing, Bazantic registration/A/B runs, Privy login, public hosting, and video evidence remain explicitly pending because their accounts, hardware, funding, and credentials are not available. The UI and `demo:check` report these boundaries without placeholder IDs.

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
| `pnpm demo:seed`           | Validate/rebuild idempotent local demo state      |
| `pnpm demo:check`          | Report local and external demo readiness          |
| `pnpm security:scan`       | Scan tracked source for likely committed secrets  |
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

## Demo and integrations

Start the production UI locally:

```bash
pnpm --filter @frontier/web build
pnpm --filter @frontier/web start
```

The Arena and Artifact screens use only the checked-in Foundry result. Sponsor Debug distinguishes configuration from live evidence. Run `pnpm demo:check -- --strict` before a live presentation; the non-strict form is useful while provisioning and prints a recovery action for every missing boundary.

- [Architecture and trust boundaries](Docs/architecture.md)
- [ENSv2 records and EAC plan](Docs/ens.md)
- [Ledger DMK and Key Ring operations](Docs/ledger.md)
- [Bazantic registration and paid boundary](Docs/bazantic.md)
- [Demo script](Docs/demo-script.md) and [failure recovery](Docs/recovery.md)
- [Prize/evidence checklist](Docs/prize-checklist.md)
- [Implementation task list](Docs/IMPLEMENTATION_TASKS.md) and [decisions](Docs/implementation-decisions.md)
