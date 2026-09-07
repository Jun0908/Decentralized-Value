# Frontier Protocol

Frontier Protocol rewards solutions that improve one or more independently measured values without hiding tradeoffs in a single score. The MVP has three live practice arenas: Emergency Supply Allocation, Ethereum Calldata Compression, and the three-axis Microgrid Dispatch sample.

## Repository status

The Emergency Supply evaluator recalculates user-entered allocations across single-failure cases. The Calldata evaluator prices encoded bytes under EIP-2028 and executes compiled Solidity decoder bytecode in a local Cancun EVM. Microgrid Dispatch measures cost, worst-case delivered energy, and carbon at the same time. Every evaluator keeps contexts separate, compares independent axes on a Pareto frontier, and returns deterministic evidence hashes.

The practice arena does not require hardware, a wallet, or signing credentials. It returns the explicit state `measured`, but does not claim that tournament settlement occurred. World ID registration, final-day hidden evaluation, and Sepolia reward distribution remain deployment work. The earlier EVM order-book benchmark remains available as a technical sample.

Public demo: <https://web-rho-seven-d6te7t3f0y.vercel.app>

The concept-first homepage links to the data-driven catalog at `/arenas`. Canonical arena routes are `/arenas/emergency-supply`, `/arenas/calldata-compression`, and `/arenas/microgrid-dispatch`; previous demo URLs redirect safely. Measurement requires no wallet, test token, ENS name, or hardware. The optional submission sandbox uses a wallet address as an ephemeral participant identifier and clearly states that it is neither signed nor durable.

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

| Command                                                       | Purpose                                           |
| ------------------------------------------------------------- | ------------------------------------------------- |
| `pnpm dev`                                                    | Start the Next.js web application                 |
| `pnpm env:check`                                              | Validate environment keys without printing values |
| `pnpm lint`                                                   | Run ESLint and check Solidity formatting          |
| `pnpm format:check`                                           | Check formatting                                  |
| `pnpm typecheck`                                              | Type-check all workspace packages                 |
| `pnpm test`                                                   | Run Vitest and Foundry unit/fuzz tests            |
| `pnpm benchmark:orderbook`                                    | Generate the measured order-book frontier fixture |
| `pnpm --filter @frontier/calldata-compression compile:codecs` | Compile reference Solidity decoders               |
| `pnpm demo:seed`                                              | Validate/rebuild idempotent local demo state      |
| `pnpm demo:check`                                             | Report local and external demo readiness          |
| `pnpm security:scan`                                          | Scan tracked source for likely committed secrets  |
| `pnpm build`                                                  | Build contracts and the web production bundle     |
| `pnpm run ci`                                                 | Run the full local CI sequence                    |

## Workspace

```text
apps/web                 Next.js App Router application
apps/api                 Frontier HTTP API
apps/runner              Reproducible benchmark runner
packages/emergency-supply Versioned scenario and deterministic evaluator
packages/calldata-compression Versioned batches, Solidity codecs, and EVM evaluator
packages/microgrid-dispatch Deterministic three-axis extensibility example
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
GET  /v1/calldata-compression
POST /v1/calldata-compression/evaluations
GET  /v1/microgrid-dispatch
POST /v1/microgrid-dispatch/evaluations
POST /v1/evaluations
POST /v2/sandbox/participants/register
POST /v2/sandbox/submissions
GET  /v2/sandbox/participants/{participantId}/submissions
PUT  /v2/sandbox/final-entry
GET  /openapi.yaml
```

The `/v2/sandbox` state is process-local and resets on restart or serverless cold start. It is a working UX and evaluator integration, not a live tournament database. Private source is rejected until encrypted durable storage exists. Sepolia deployment, World ID verification, hidden-final evaluation, and transaction evidence remain external activation work.

Production base URL: `https://web-rho-seven-d6te7t3f0y.vercel.app`

- [Architecture and trust boundaries](Docs/architecture.md)
- [Emergency Supply evaluator and API](Docs/emergency-supply.md)
- [Calldata Compression evaluator and API](Docs/calldata-compression.md)
- [Frontend information architecture and arena expansion](Docs/frontend-architecture.md)
- [ENSv2 records and EAC plan](Docs/ens.md)
- [Bazantic registration and paid boundary](Docs/bazantic.md)
- [Demo script](Docs/demo-script.md) and [failure recovery](Docs/recovery.md)
- [Prize/evidence checklist](Docs/prize-checklist.md)
- [Implementation task list](Docs/IMPLEMENTATION_TASKS.md) and [decisions](Docs/implementation-decisions.md)
