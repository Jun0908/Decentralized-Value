# Frontier Protocol

Frontier Protocol rewards solutions that improve one or more independently measured values without hiding tradeoffs in a single score. The primary MVP arena is now Emergency Supply Allocation: minimize procurement cost while maximizing the number of emergency kits delivered after any one supplier or route fails.

## Repository status

The repository includes a locally verified Emergency Supply Allocation vertical slice. A user enters a fresh allocation, the API validates the shared constraints, recalculates cost, enumerates all nine published single-failure cases, and compares the measured result with the current Pareto frontier. The result includes data and context versions plus a deterministic hash.

The practice arena does not require hardware, a wallet, or signing credentials. It returns the explicit state `measured`, but does not claim that tournament settlement occurred. World ID registration, final-day hidden evaluation, and Sepolia reward distribution remain deployment work. The earlier EVM order-book benchmark remains available as a technical sample.

Public demo: <https://web-rho-seven-d6te7t3f0y.vercel.app>

The homepage leads to the interactive arena at `/emergency-supply` (`/demo` redirects there). Change the allocation, call the real evaluation API, and inspect exactly which failure produces the worst result. No wallet, test token, ENS name, or hardware is required for this practice flow.

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

Copy `.env.example` to `.env.local` only when optional live integration values are needed. The repository ignores `.env` and `.env.*` files except `.env.example`; never commit private keys, Bazantic credentials, or wallet material.

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
packages/emergency-supply Versioned scenario and deterministic evaluator
packages/contracts       Foundry contracts and deployment scripts
packages/sdk             Typed Frontier client
packages/shared          Shared validation and protocol types
packages/ens-adapter     ENSv2 integration boundary
packages/ledger-adapter  Archived optional hardware adapter; unused by the public demo
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

The Emergency Supply screen evaluates the allocation sent by the user; it is not a selection among precomputed artifact IDs. The older Arena and Artifact screens use the checked-in Foundry result. Sponsor Debug is kept out of the primary product navigation and distinguishes configuration from live evidence for developers.

The Next.js deployment also exposes the Bazantic-ready API on the same origin:

```text
GET  /v1/health
GET  /v1/arenas
GET  /v1/emergency-supply
POST /v1/emergency-supply/evaluations
POST /v1/evaluations
GET  /openapi.yaml
```

Production base URL: `https://web-rho-seven-d6te7t3f0y.vercel.app`

- [Architecture and trust boundaries](Docs/architecture.md)
- [Emergency Supply evaluator and API](Docs/emergency-supply.md)
- [ENSv2 records and EAC plan](Docs/ens.md)
- [Bazantic registration and paid boundary](Docs/bazantic.md)
- [Demo script](Docs/demo-script.md) and [failure recovery](Docs/recovery.md)
- [Prize/evidence checklist](Docs/prize-checklist.md)
- [Implementation task list](Docs/IMPLEMENTATION_TASKS.md) and [decisions](Docs/implementation-decisions.md)
