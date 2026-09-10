# Current implementation status

- **Last verified:** 2026-09-10
- **Public application:** <https://web-rho-seven-d6te7t3f0y.vercel.app>
- **Active plan:** [`Plan9.md`](Plan9.md) — Rescue Room feasibility, deterministic incident simulation, and conditional Agent-to-Agent service market

This document records the current capability boundary. Product rules live in [`PRODUCT.md`](PRODUCT.md), the active Rescue Room work is scoped in [`Plan9.md`](Plan9.md), and completed or superseded plans live under [`archive/`](archive/).

## Working now

| Area | Proven capability |
| --- | --- |
| Public web application | The Top page explains the protocol and routes users to four working arenas. The UI and `/v1/*` API share one Vercel origin. |
| 72-Hour Disaster Response | Strategy v2 builder, seven deterministic scenarios, 15-second replay, revision history, one selected Final Entry, three independent outcomes, Value Pools, practice missions, Agent provenance, and Sepolia demo settlement. |
| Calldata Compression | Compiled Solidity decoder bytecode executes in EthereumJS EVM under Cancun rules. Calldata gas and decoder execution gas remain separate. |
| Community Microgrid Dispatch | Deterministic comparison across energy cost, worst-case delivered energy, and lifecycle carbon. |
| Shared evaluation | Correctness gates, direction-aware Pareto membership, normalized hypervolume, exclusive contribution, and deterministic hashes are covered by TypeScript tests. |
| Accounts and storage | Privy-backed account flows and separate Redis namespaces persist Disaster Response and Classic Emergency Supply participant state when production configuration is present. |
| Human and Agent entry | The Disaster Response Starter Kit publishes the Strategy schema, evaluator contract, scenarios, constraints, limits, baseline Agent, and reproduction command. Only measured outcomes affect allocation. |
| Reward contracts | `FrontierRewardPool` and `FrontierDemoToken` cover commitment, distribution, and claim fallback. A completed Sepolia demonstration records funding, allocation commitment, `RewardPaid`, and recipient balance evidence. |
| Classic fallback | The earlier Emergency Supply competition remains available at `/arenas/emergency-supply-classic` with its independent API and storage namespace. |
| Secret Gate reference application | A real Semaphore V4 proof is generated in a browser Web Worker, verified offchain against a trusted synthetic group snapshot, and protected against same-scope reuse by an atomic nullifier store. The public production route passed desktop and mobile verification. |
| Rescue Room Practice | A deterministic incident-response simulator runs seven Incident families, a curated six-Service market, budget reserve/release/refund, Reference Commander actions, Replay evidence, three independent outcomes, Pareto, and four Practice Value Pools. The local Phase 2 slice also accepts participant Playbooks through a fixed OpenAI Agents SDK runtime. Its Incident Storyboard, Live Stage, playback controls, outcome explanations, and three Playbook Presets are implemented for local UX verification. |

Sepolia evidence: [deployment record](deployments/sepolia-reward-demo.json), [allocation commitment](https://sepolia.etherscan.io/tx/0x96fd7a9d1f4a3bbd2fa7a9ea28d250a16e8eedbaff05b51a4f33e581c3839f2c), and [RewardPaid](https://sepolia.etherscan.io/tx/0xd976a968aefeb66d7e60fba7a9cf64c8711195fc3652aeccc20c7448069ad708).

## Partial or optional

| Area | Current boundary |
| --- | --- |
| Privy | Email and wallet login are enabled. Google OAuth still requires activation in the Privy project. |
| Generic submission sandbox | The `/v2/sandbox` store is process-local and resets on restart or serverless cold start. |
| Bazantic | A gateway and MCP surface were activated externally, but final service and Recipe identifiers are not committed as evidence. |
| ENS | A fail-closed discovery and authorization adapter exists; no live namespace or delegated permission evidence is configured. |
| Policy Artifact | The declarative contract is documented in the Starter Kit but arbitrary participant policies are not executed. |
| Legacy order-book sample | Retained as historical technical material; its throughput axis is simulated rather than observed chain throughput. |
| Ledger adapter | Retained as historical optional code and unused by the public path. |
| Secret Gate competition | The first controlled Chrome feasibility run verified all 32 proofs but returned `PIVOT`: latency and memory variance exceeded the declared stability gate. Personal-device measurements remain available, but the competition path is closed and no official leaderboard or Value Pool is active. |
| Rescue Room competition | Phase 0 returned `GO`; Phase 1 is complete; the local Controlled Practice can run a real AI Commander from a participant Playbook. Revision/final-entry storage, committed hidden Final packs, participant uniqueness, full-field recomputation, and Sepolia Service Payment remain incomplete. Game-credit payments are simulated and explicitly not tokens. |

## Not yet a production tournament

- Participant uniqueness enforcement
- Isolated execution of arbitrary untrusted source code
- Scheduled hidden-final evaluation, deadline, and automatic entry lock
- Multi-runner threshold attestations, disputes, or slashing
- Scheduled final-day allocation and participant payout
- A mainnet token or any monetary-value claim

## State language

| State | Meaning |
| --- | --- |
| `measured` | A deterministic evaluator produced a result |
| `simulated` | A modeled boundary is clearly labeled |
| `committed` | Corresponding onchain evidence exists |
| `paid` | Transfer/event and recipient evidence exist |
| `Practice` | Measurement is real while the production tournament layer remains incomplete |

## Active next change

Rescue Room Evaluator v2 is complete: the internal Safe state of a False Positive no longer leaks through the Commander's uncertain Public View. A repeat run of 2,000 deterministic Episodes across 10 Baseline Policies still returned `GO` in 62,690 ms; Raw Evidence is stored at [`../benchmarks/rescue-room/results/latest.json`](../benchmarks/rescue-room/results/latest.json). Desktop and Mobile browser verification passed without horizontal overflow or console errors, and a real AI Commander run also completed with Action replay verification. The next gate is Reference / AI comparison, Pool eligibility feedback, accessibility review, and a five-person first-use test. Durable revisions, Final Entry, and a committed hidden Final remain later gates; until then this is Controlled Practice and is not reward-eligible.
