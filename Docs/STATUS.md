# Current implementation status

- **Last verified:** 2026-09-11
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
| Rescue Room Practice | A deterministic incident-response simulator runs seven Incident families, a curated six-Service market, budget reserve/release/refund, Commander actions, Replay evidence, three independent outcomes, Pareto, and four Practice Value Pools. Players can edit a versioned Doctrine Artifact through explained Basic settings, inspect Prompt and normalized JSON views, lock it to an Incident, follow reason-coded decisions in an illustrated five-chapter Incident Theatre, and compare the same Episode against Always Pause / Never Pause / the previous revision. Every Service purchase now binds its Order, Commander Action, Service Manifest, Deliverable, and Receipt with deterministic hashes and appears in a separate Payment Journey. Rules and AI Playbooks share Service, Action, single-price, and total-investigation-budget gates; the AI path uses a fixed OpenAI Agents SDK runtime. |

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
| Rescue Room competition | Phase 0 returned `GO`; Phase 1 is complete; the local Controlled Practice accepts editable deterministic Doctrine Artifacts and can run a real AI Commander from a participant Playbook. The six-decimal `rUSD-DEMO` token, `RescueServiceEscrow`, interface, deploy script, evidence schema, and duplicate/overspend/delivery/refund tests are implemented locally. Sepolia deployment, role-wallet assignment, Policy Executor transaction adapter, live receipts, durable revision/final-entry storage, Incident Shift, committed hidden Final packs, participant uniqueness, and full-field recomputation remain incomplete. Game-credit payments are simulated and explicitly not tokens. |

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

Rescue Room Strategy Game UX Pass B0/B1とPass Cはローカル実装済み。`rescue-doctrine-v0`は編集可能なBasic Rule、権限、予算上限をHash付きの決定論的Artifactへ正規化し、InterpreterはPublic View Hashに対する理由付きActionを記録する。Workbenchは各Ruleの意味とTradeoff、`Spend / Certainty / Containment`の読みやすいSummary、Basic / Prompt / Artifact Viewを提供する。Live SimulationはCanonical Transcriptを変更せず、Game Minute単位のStory Beat、3 Actor、Agent間PaymentとEvidence、Protocol Action、5 Chapter、6 Module、3 Outcomeを一つのIncident Theatreで表示する。自動Desktop / Mobile検証はReplay、同一Episode Baseline、AI Control、横Overflow、Contrast、Console Errorまで通過した。次のGateは5人の初見テストであり、Durable Revision Diff、Incident Shift、Final Entry、Committed Hidden Finalは未完成のため、現在もReward対象外のControlled Practiceである。
