# Value Decentralization

[日本語](README_JA.md)

**[Presentation on Canva](https://canva.link/r63xqej7g7c78d3)**

**Decentralize how progress is defined—not just how value is transferred.**

**Shared evidence. Independent values. Verifiable settlement.**

Most competitions collapse cost, performance, resilience, fairness, or safety into one weighted score. That looks objective, but the weights already encode one definition of what “better” means.

Value Decentralization is an open evaluation protocol for **sharing evidence without forcing everyone to share the same values**. Correct solutions are measured under the same published context, each outcome stays independent, and different Value Pools can support efficiency, resilience, fairness, or genuinely new tradeoffs—without inventing one global winner or one master score.

[Live Product](https://web-rho-seven-d6te7t3f0y.vercel.app) · [Architecture](https://web-rho-seven-d6te7t3f0y.vercel.app/architecture) · [Sepolia Reward](https://sepolia.etherscan.io/tx/0xd976a968aefeb66d7e60fba7a9cf64c8711195fc3652aeccc20c7448069ad708) · [Whitepaper](https://github.com/Jun0908/Decentralized-Value-Whitepaper)

## Judges: see the protocol in 60 seconds

Sponsor integrations now have recorded ENSv2 Sepolia permission transactions, official CRE local simulation with private-input/reveal replay, and a real external AI using Bazantic MCP. [Recording guide, evidence, and representative source](Docs/sponsors/SPONSOR_DEMO_RECORDING.md). The [sponsor evidence page](https://web-rho-seven-d6te7t3f0y.vercel.app/sponsors/demo) is publicly available (verified 2026-09-13). These are separate demonstrations, not a completed hidden Final tournament or a Bazantic-hosted Recipe execution.

### 1. Run a real EVM evaluation

**[Ethereum Calldata Compression](https://web-rho-seven-d6te7t3f0y.vercel.app/arenas/calldata-compression)**

This arena does not animate precomputed numbers. It **executes compiled Solidity decoder bytecode inside an EthereumJS Cancun EVM**.

Reference result for the Packed codec in the original public transfer-mix context:

| Calldata gas | Decoder gas | Correctness | Frontier contribution |
| -----------: | ----------: | :---------: | --------------------: |
|      `8,200` |    `13,061` |   `PASS`    |              `+5.27%` |

Dictionary encoding uses less calldata. Packed decoding uses less execution gas. Neither dominates the other, so both survive on the Pareto frontier. Standard ABI is worse on both axes and falls off the frontier.

### 2. Keep multiple definitions of progress alive

**[72-Hour Disaster Response](https://web-rho-seven-d6te7t3f0y.vercel.app/arenas/emergency-supply)**

A strategy across five suppliers, four routes, and four regions is replayed against seven disruption scenarios. The evaluator keeps these outcomes independent:

- 72-hour cost — minimize
- worst-case delivery — maximize
- worst-region coverage — maximize

The same evidence can then feed separate Efficiency, Resilience, Fairness, and Frontier Expansion pools. **There is no overall score and no universal winner.**

### 3. Verify that an allocation was actually paid

- [Allocation commitment](https://sepolia.etherscan.io/tx/0x96fd7a9d1f4a3bbd2fa7a9ea28d250a16e8eedbaff05b51a4f33e581c3839f2c)
- [RewardPaid](https://sepolia.etherscan.io/tx/0xd976a968aefeb66d7e60fba7a9cf64c8711195fc3652aeccc20c7448069ad708)
- [Machine-readable deployment evidence](Docs/deployments/sepolia-reward-demo.json)

The Sepolia demonstration completes the path from allocation commitment to `RewardPaid` and records a `10,000 FDT` recipient balance increase. FDT is a demonstration token and carries no claim of monetary value.

### Rescue Room: an AI hired another AI and paid it

The public [Rescue operations page](https://web-rho-seven-d6te7t3f0y.vercel.app/rescue-room/operations) explains a verified Commander → specialist → Sepolia escrow payment of **5 rUSD-DEMO**, plus a separate **5 rUSD-DEMO timeout refund**. [Public transaction evidence](Docs/deployments/sepolia-rescue-service-demo.json) and the [Japanese operator runbook](Docs/RESCUE_EXECUTION_BATCH.md) describe the exact scope. The evidence page was verified publicly available on 2026-09-13; viewing it does not execute a new AI run or payment.

These are separate real model calls and operator-controlled wallets. The purchased service interprets supplied observations; its diagnosis is not proven correct. The public [submission demo](https://web-rho-seven-d6te7t3f0y.vercel.app/rescue-room/submission) shows that analysis fed back into three recorded real Commander decisions, replays their simulated outcomes, and compares three independent Pool previews. In this recorded episode, doing nothing dominates the AI response; the demo does not hide that result. Run `pnpm verify:rescue:submission-replay` to reproduce the recorded game outcome and Pool allocation from public inputs without API keys. [Submission scope and narration draft](Docs/HACKATHON_SUBMISSION.md).

rUSD-DEMO has no monetary value. An open third-party service market, hidden Final competition, and Rescue reward settlement are **not yet complete**.

For the English recorded-run demo, open the public [English submission page](https://web-rho-seven-d6te7t3f0y.vercel.app/rescue-room/submission/en). Both submission pages were verified publicly available on 2026-09-13. The [handoff guide](Docs/RESCUE_HANDOFF.md) includes a two-minute English narration, a locally recorded silent video, and clean-room replay / SDK HTTP verification. Video publication and public live-AI readiness are separate from these evidence-page checks.

Developers can follow the [Rescue Practice quickstart](Docs/RESCUE_AGENT_QUICKSTART.md) and run `pnpm exec tsx scripts/verify-rescue-practice-onboarding.ts http://localhost:3000` to check the existing non-billable API, Starter digest, result integrity and repeatability. This does not enter a Final or make a payment.

[Bazantic Gateway / MCP Practice](Docs/sponsors/BAZANTIC_RESCUE_LIVE.md) was verified on 2026-09-12: public Manifest and Doctrine evaluations work through the existing gateway, with repeated results matching the local evaluator. The strategy-comparison Recipe is a saved, unexecuted draft—not a published autonomous-agent run or paid tournament.

---

## The core idea

> **Shared evidence does not require shared values.**

A conventional weighted score might do this:

```text
40% cost + 35% resilience + 25% fairness = one winner
```

Value Decentralization keeps the measurements separate:

```text
                    ┌─ Efficiency Pool
Shared Evidence ────├─ Resilience Pool
                    ├─ Fairness Pool
                    └─ Frontier Expansion Pool
```

Pareto is not a replacement ideology or a new sovereign score. It is a **safeguard against deleting useful tradeoffs too early**.

## What is technically different

### 1. A deterministic multi-objective engine, not a chart

[`packages/shared/src/multiobjective.ts`](packages/shared/src/multiobjective.ts) handles the protocol-level comparison logic:

- `MINIMIZE` and `MAXIMIZE` metrics in one engine
- hard-constraint gating before performance comparison
- normalization against published bounds
- full Pareto frontier recomputation
- exact hypervolume up to 6 dimensions
- exclusive frontier contribution
- stable ordering so submission order cannot change the result

For a Frontier Expansion pool, an artifact’s exclusive contribution is the outcome-space area lost when that artifact is removed:

```text
exclusive[i] = HV(all results) - HV(all results without i)
```

Reward allocation then uses deterministic integer arithmetic and fixed tie-breaks.

### 2. Evaluation becomes an evidence chain

Challenges, artifacts, outcomes, and allocations are bound together rather than stored as unrelated rows:

```text
dataset + constraints + metrics + evaluator version
                         ↓
                    Context Hash
                         ↓
artifact + measurements + correctness
                         ↓
                     Result Hash
                         ↓
pool rules + final allocations
                         ↓
                   Allocation Root
                         ↓
              Ethereum commitment/payment
```

Canonical serialization and cryptographic hashing make changes to evaluator context, artifacts, or outcomes visible in the resulting evidence.

### 3. Real bytecode, real EVM execution

In Calldata Compression, candidate codecs are compiled and their runtime bytecode executes under Cancun rules. The evaluator checks, together:

- equality with the reference decoded output
- malformed-input rejection
- calldata gas
- decoder execution gas

The evidence therefore comes from the executable artifact itself, not from a self-reported benchmark.

### 4. Real browser-side zero-knowledge proving

**[Secret Gate](https://web-rho-seven-d6te7t3f0y.vercel.app/arenas/secret-gate)** uses Semaphore V4:

- a disposable identity is created in the browser
- only its public commitment is enrolled
- a real membership proof is generated in a Web Worker
- the server verifies the proof
- an atomic nullifier store rejects same-scope reuse

The private identity itself does not need to become public application state.

### 5. Turn nondeterministic AI into reproducible evidence

**Rescue Room** supports deterministic reference commanders and a participant AI Commander path using the OpenAI Agents SDK.

We do **not** claim that rerunning an LLM produces identical reasoning. Instead, the reproducible boundary is:

```text
Public View Hash
      ↓
Structured Action
      ↓
Action Record
      ↓
Deterministic Replay
      ↓
Same Outcome / Result Hash
```

The protocol reproduces what the agent actually did, not its hidden chain of thought.

---

## Six arenas, one protocol

| Arena                             | Independent outcomes                                 | State                    |
| --------------------------------- | ---------------------------------------------------- | ------------------------ |
| **72-Hour Disaster Response**     | cost ↓ · worst-case delivery ↑ · regional coverage ↑ | Demo competition         |
| **Ethereum Calldata Compression** | calldata gas ↓ · decoder gas ↓                       | Practice                 |
| **Community Microgrid Dispatch**  | cost ↓ · worst-case energy ↑ · carbon ↓              | Practice                 |
| **Secret Gate**                   | proof latency ↓ · memory ↓                           | Practice / observational |
| **Rescue Room**                   | user loss ↓ · demand served ↑ · response spend ↓     | Controlled Practice      |
| **Ocean Commons**                 | livelihood ↑ · restraint ↑ · cooperation ↑           | Practice                 |

Each domain needs its own evaluator, but the protocol primitives remain shared: **Context, Hard Constraints, independent Outcomes, Pareto, Evidence, and Value Pools**.

### Practice workbenches

The three workbenches and their introduction illustrations were verified on the public deployment on September 13, 2026, after commit `033a73c`. [Public verification and exact scope](Docs/PUBLIC_VERIFICATION_2026-09-13.md). Later local onboarding changes require their own deployment verification.

- **Calldata:** edit bounded codec-selection rules, inspect packing and decoding, measure real EVM gas, and download same-context evidence. Arbitrary participant code is not executed. [English plan and completed scope](Docs/Plan-Calldata.md).
- **Microgrid:** operate a six-turn modeled day with battery policy, weather, outage replay, and separate cost / unserved energy / operational carbon outcomes. This is a new context, not the classic 100 MWh challenge above. [English plan and completed scope](Docs/Plan-Microgrid.md).
- **Secret Gate:** follow a real proof from browser identity to one-use entry, resend the same proof, and inspect explained execution settings. Latency/memory remain personal observations; the competition remains `PIVOT`. [English plan and completed scope](Docs/Plan-SecretGate.md).

These changes do not complete hidden Final evaluation, persistent entries, or reward settlement. See each plan for verification evidence and exclusions.

Current implementation and next milestones are organized in the [English plan index](Docs/PLANS.md). Public AI execution requires the follow-up in the [production readiness review](Docs/PRODUCTION_READINESS_2026-09-13.md); working practice pages and saved AI evidence do not imply that new model runs are available on the public deployment.

For local setup, see [Environment Configuration](Docs/ENVIRONMENT.md): blank template fields mean unconfigured features, not necessarily unused variables. `pnpm env:check` checks local formats; `pnpm env:check --example` checks the credential-free template. Neither verifies live services.

For a loopback-only preview of all three labs, including real Secret Gate verification with development-only memory storage, follow the [local preview instructions](Docs/Plan-SecretGate.md#local-preview-instructions). It does not use production Redis or enable AI/payment routes. Recheck with `pnpm exec tsx scripts/verify-arena-labs.ts http://127.0.0.1:3014`.

## Why Ethereum

The goal is not to force every domain-specific computation onchain.

Evaluations can involve simulation, compilation, EVM execution, ZK proving, or AI action replay, so those workloads remain domain-specific and offchain. Ethereum is used at the boundary where participants should not have to trust an operator to rewrite the final allocation after seeing the result.

In the current demonstration path, `FrontierRewardPool`:

- commits one allocation per challenge
- rejects reservations beyond funded balance
- prevents duplicate reward destinations within the same allocation
- provides participant claim fallback
- emits public `RewardPaid` events

Ethereum does **not** prove that an offchain evaluator is socially correct. It makes clear **what was committed and what was actually paid**.

## Evidence without overclaiming

This project deliberately separates different evidence states instead of calling everything “verified.”

| State       | Meaning                                                                      |
| ----------- | ---------------------------------------------------------------------------- |
| `measured`  | a deterministic evaluator produced a result                                  |
| `simulated` | a modeled boundary is explicitly labeled                                     |
| `committed` | corresponding onchain evidence exists                                        |
| `paid`      | transfer/event and recipient evidence exist                                  |
| `Practice`  | measurement is real while the production tournament layer remains incomplete |

The public evaluators and Sepolia reward demonstration are real. That does not mean a production tournament has already been fully deployed.

## Working today

- compiled Solidity bytecode execution in a Cancun EVM
- direction-aware Pareto, exact hypervolume, and exclusive contribution
- context-bound deterministic result hashing
- Disaster Response strategy builder, seven scenarios, replay, revision, and Final Entry flow
- deterministic 3-axis Microgrid evaluation
- real browser-side Semaphore V4 proof generation
- deterministic Rescue Room simulation plus AI Playbook path
- Redis-backed participant state for production-configured competition paths
- Sepolia allocation commitment and `RewardPaid` demonstration
- same-origin public API and OpenAPI surface

For the exact implementation boundary, see [`Docs/STATUS.md`](Docs/STATUS.md).

## Architecture

```text
Challenge
  │
  ├─ Hard Constraints
  ├─ Independent Metrics
  ├─ Versioned Context
  └─ Independent Value Pools
          │
          ▼
Human / AI Agent
          │
       Artifact
          │
          ▼
Deterministic Evaluator
  ├─ Correctness Gate
  ├─ Outcome Vector
  ├─ Pareto Frontier
  ├─ Hypervolume / Contribution
  └─ Context + Result Evidence
          │
          ▼
Independent Allocations
          │
          ▼
Ethereum Commitment / Settlement
```

## Local development

Requirements:

- Node.js `22+`
- pnpm `11.24.0`
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

## Repository map

```text
apps/web                      Next.js application + same-origin routes
apps/api                      reusable API / competition orchestration
apps/runner                   evaluation / attestation boundary
packages/shared               schemas, hashes, Pareto, hypervolume, allocation
packages/disaster-response    seven-scenario Strategy evaluator
packages/calldata-compression Solidity codecs + Cancun EVM evaluator
packages/microgrid-dispatch   deterministic energy evaluator
packages/secret-gate          Semaphore policy / evidence
packages/rescue-room          incident simulator / AI action replay
packages/ocean-commons        multi-agent commons simulator
packages/contracts            Solidity settlement contracts
openapi/frontier-v1.yaml      public API source of truth
```

## Long-term ambition

The ambition is larger than building a better competition platform.

We want any community to be able to define a value, make it measurable and verifiable, attach independent demand to improving it, and keep that value from disappearing inside somebody else’s weighting function.

If that demand persists, new builders, evaluators, standards, companies, and eventually entirely new industries can form around values that markets previously ignored.

**Ethereum decentralized who can own and transact. Value Decentralization asks the next question:**

> **Can we decentralize how progress itself is defined?**

## Documentation

- [Whitepaper](https://github.com/Jun0908/Decentralized-Value-Whitepaper)
- [Product model](Docs/PRODUCT.md)
- [Architecture and trust boundaries](Docs/ARCHITECTURE.md)
- [Current implementation status](Docs/STATUS.md)
- [Demo guide](Docs/DEMO.md)
- [External integrations](Docs/INTEGRATIONS.md)

## Provenance

Development began during ETHOnline on 2026-09-05. The human project owner directed the product thesis, arena choices, metrics, fairness model, and reward philosophy. Codex and Claude Code supported implementation. Generated work is checked through deterministic fixtures, TypeScript and Foundry tests, production builds, benchmarks, and browser verification.
