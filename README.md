# Frontier Protocol

Frontier Protocol is an open competition protocol for problems with more than one valid definition of “better.” Sponsors publish a problem, independent metrics, constraints, and a reward pool. Human builders and AI agents submit solutions. The shared evaluator rejects invalid entries, preserves every non-dominated tradeoff on a Pareto frontier, and allocates rewards by exclusive contribution instead of a hidden weighted score.

**Judge quickstart:** open the [public demo](https://web-rho-seven-d6te7t3f0y.vercel.app) and press **Run the 10-second EVM demo**. A preloaded Solidity codec is executed in a Cancun EVM and reproduces 8,200 calldata gas, 13,061 decoder gas, a correctness pass, 5.27% frontier contribution, and a deterministic result hash. The illustration shows why two different gas tradeoffs remain rewardable. Continue to Emergency Supply to see the same protocol applied to a social problem with editable inputs and nine exhaustive failure cases.

```text
Sponsor commitment → Builder / AI solution → Deterministic evaluator
                                              ↓
                         Pareto contribution → Ethereum reward allocation
```

The MVP has three working practice arenas: Ethereum Calldata Compression is the ten-second technical proof; Emergency Supply Allocation is the editable social application; Microgrid Dispatch proves that the same protocol supports three independent axes.

## Repository status

The Emergency Supply evaluator recalculates user-entered allocations across single-failure cases. The Calldata evaluator prices encoded bytes under EIP-2028 and executes compiled Solidity decoder bytecode in a local Cancun EVM. Microgrid Dispatch measures cost, worst-case delivered energy, and carbon at the same time. Every evaluator keeps contexts separate, compares independent axes on a Pareto frontier, and returns deterministic evidence hashes.

The practice arena does not require hardware, a wallet, or signing credentials. It returns the explicit state `measured`, but does not claim that tournament settlement occurred. A Sepolia demonstration has completed token funding, immutable allocation commitment, `RewardPaid`, and a 10,000 FDT balance increase; World ID registration, durable participant storage, and final-day hidden evaluation remain tournament work. The earlier EVM order-book benchmark remains available as a technical sample.

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
| `pnpm deploy:reward-demo`                                     | Deploy and exercise the Sepolia demo reward path  |
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
GET  /v1/emergency-supply/replay
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

The `/v2/sandbox` state is process-local and resets on restart or serverless cold start. It is a working UX and evaluator integration, not a live tournament database. Private source is rejected until encrypted durable storage exists. The Sepolia reward-path demo is live and independently inspectable; World ID verification, hidden-final evaluation, and production tournament storage remain external activation work.

Production base URL: `https://web-rho-seven-d6te7t3f0y.vercel.app`

## Ethereum proof boundary

`FrontierRewardPool.sol` and `FrontierDemoToken.sol` implement the complete Sepolia settlement path: fund a fixed pool, commit one result root and allocation per challenge, distribute rewards, and retain an individual claim fallback. Unit tests cover double-commit, over-allocation, duplicate-recipient, distribution, and double-claim protection.

The UI reads only configured public evidence from `NEXT_PUBLIC_REWARD_POOL_ADDRESS`, `NEXT_PUBLIC_DEMO_TOKEN_ADDRESS`, allocation/payout transaction hashes, result root, recipient, block, and balance fields. If the required values are absent or malformed, it displays **Not deployed** and does not claim funding or payment. The browser-wallet proof can sign the challenge manifest without requesting a token approval or transaction.

Public Sepolia evidence: [deployment record](Docs/deployments/sepolia-reward-demo.json), [allocation commitment](https://sepolia.etherscan.io/tx/0x96fd7a9d1f4a3bbd2fa7a9ea28d250a16e8eedbaff05b51a4f33e581c3839f2c), and [RewardPaid transaction](https://sepolia.etherscan.io/tx/0xd976a968aefeb66d7e60fba7a9cf64c8711195fc3652aeccc20c7448069ad708).

## AI use and hackathon scope

The product thesis, choice of arenas, independent metrics, fairness model, reward philosophy, and UX priorities were directed by the human project owner. Codex and Claude Code were used as implementation partners for code generation, refactoring, tests, documentation, and UI review. Generated work was checked through deterministic fixtures, TypeScript, Vitest, contract tests where Foundry is available, production builds, and browser verification.

This repository started during the hackathon on 2026-09-05. Commit `88f8e7e` is the initial repository marker; the monorepo and product implementation begin at `a63a948`. There is no pre-existing production application represented as hackathon work. The commit history intentionally keeps planning, evaluators, contracts, integrations, UX, and finalist-readiness changes in reviewable stages.

- [Architecture and trust boundaries](Docs/architecture.md)
- [Emergency Supply evaluator and API](Docs/emergency-supply.md)
- [Calldata Compression evaluator and API](Docs/calldata-compression.md)
- [Frontend information architecture and arena expansion](Docs/frontend-architecture.md)
- [ENSv2 records and EAC plan](Docs/ens.md)
- [Bazantic registration and paid boundary](Docs/bazantic.md)
- [Demo script](Docs/demo-script.md) and [failure recovery](Docs/recovery.md)
- [Prize/evidence checklist](Docs/prize-checklist.md)
- [Implementation task list](Docs/IMPLEMENTATION_TASKS.md) and [decisions](Docs/implementation-decisions.md)
