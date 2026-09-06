# Frontier Protocol

Frontier Protocol rewards artifacts that expand the space in which multiple independently measured values can coexist. The ETHOnline 2026 MVP begins with an EVM arena comparing gas efficiency and parallel throughput under shared correctness constraints.

## Repository status

Phases 0–7 now have a locally verified vertical slice: deterministic Solidity benchmarks, Pareto settlement contracts, fail-closed ENS discovery, a zero-configuration demo API, Bazantic service material, Privy-ready Next.js UI, and demo automation. The real benchmark currently contains four artifacts and three non-dominated points.

The public demo does not require hardware or signing credentials. Evaluation responses use the explicit terminal state `simulated` and never fabricate a signature or transaction. Live Sepolia deployment, ENSv2 names/EAC delegation, Bazantic registration/A/B runs, Privy login, and video evidence remain optional integration work.

Public demo: <https://web-rho-seven-d6te7t3f0y.vercel.app>

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

The Arena and Artifact screens use only the checked-in Foundry result. Sponsor Debug distinguishes configuration from live evidence. Run `pnpm demo:check -- --strict` before a live presentation; the non-strict form is useful while provisioning and prints a recovery action for every missing boundary.

The Next.js deployment also exposes the Bazantic-ready API on the same origin:

```text
GET  /v1/health
GET  /v1/arenas
POST /v1/evaluations
GET  /openapi.yaml
```

Production base URL: `https://web-rho-seven-d6te7t3f0y.vercel.app`

- [Architecture and trust boundaries](Docs/architecture.md)
- [ENSv2 records and EAC plan](Docs/ens.md)
- [Bazantic registration and paid boundary](Docs/bazantic.md)
- [Demo script](Docs/demo-script.md) and [failure recovery](Docs/recovery.md)
- [Prize/evidence checklist](Docs/prize-checklist.md)
- [Implementation task list](Docs/IMPLEMENTATION_TASKS.md) and [decisions](Docs/implementation-decisions.md)
