# Current implementation status

- **Last verified:** 2026-09-11
- **Public application:** <https://web-rho-seven-d6te7t3f0y.vercel.app>
- **Active plans:** [`Plan9.md`](Plan9.md) (Rescue Room), [`Plan11.md`](Plan11.md) (Sponsor integration), [`Plan12.md`](Plan12.md) (API / SDK / CLI). Parallel ownership and current batch: [`PARALLEL_IMPLEMENTATION.md`](PARALLEL_IMPLEMENTATION.md).

This document records the current capability boundary. Product rules live in [`PRODUCT.md`](PRODUCT.md), the active Rescue Room work is scoped in [`Plan9.md`](Plan9.md), and completed or superseded plans live under [`archive/`](archive/).

## Working now

### Parallel foundations — local only, not deployed

- Rescue payment preparation now validates an operator-owned Sepolia policy, curated Service/provider bindings, accepted Game Order hashes, per-order/cumulative limits, policy nonce and explicit wall-clock deadlines. It returns an unsigned `fundOrder` reservation intent with `paymentState: not-requested`. The immutable in-process snapshots are not durable atomic reservations; signing, RPC, approvals, receipts and actual payment remain unconnected.
- New versioned Evaluation Request / Result / Execution Evidence schemas preserve independent metrics and bind artifact, evaluator, context, aggregation and optional round/snapshot references. The new hash format uses locale-independent key ordering without changing legacy hashes. Execution records remain `unverified`; schema/hash checks are not signature, ENS, CRE or payment verification.
- A local public single-Episode Rescue adapter evaluates actual Doctrine inputs, checks replay, and wraps the result. `pnpm verify:rescue-envelope` compares native Node, a browser-target bundle in V8, and Bun when installed. This is not an official CRE/QuickJS run, a hidden Final, or an API endpoint.
- `contracts:cli:check` and `contracts:sdk:check` now detect generated-contract drift without modifying files. SDK generation preserves canonical Zod refinements and refreshes Practice fixtures. `verify:packages` installs freshly packed shared/SDK/CLI tarballs into an isolated consumer for ESM, NodeNext and CLI checks. The SDK's direct `viem` runtime dependency is declared.
- Existing Web/API response shapes, game outcomes and legacy hashes are unchanged by these foundations. Ocean API coverage, persistent AI Jobs, saved Rescue entries, real Sponsor execution and live Service payments are still pending.

Integrated Windows verification: tooling build, full workspace typecheck, 453 passing TypeScript tests (11 opt-in Redis cases skipped), both non-mutating contract checks, five CLI workflows, isolated package consumer verification, the production Web build, scoped ESLint/Prettier and diff checks. After concurrent heavy checks caused two existing CLI HTTP cases to exceed their 5-second limit, the unchanged suite passed when rerun alone. Foundry, real Redis, official CRE and live payments were not run. Details and remaining gates are recorded in the parallel implementation document. No package publication, deployment or payment was performed.

### Local SDK and CLI integration (not deployed)

The SDK and CLI implementation is integrated into this monorepo under `packages/sdk` and `packages/cli`; shared evaluator schemas remain canonical in `packages/shared`. The local packages are versioned as `@frontier/sdk` and `@frontier/cli` 0.3.0 with `@frontier/shared` 0.2.0. They are private workspace packages and have not been published to npm. The former `DV-ver2` and `SDK-Decentralized-Value` repositories remain provenance snapshots, not separate active implementations.

- Disaster Response: capability discovery, verified Starter Kit, offline input checks, context-locked Practice, independent-metric comparison, scoped CLI sessions, atomic idempotent revisions, history, exact artifact download, and Final Entry selection.
- Rescue Room: deterministic single-Episode Doctrine Practice and same-context comparison only. Saved submissions and Final Entry remain unsupported; simulated game credits remain distinct from tokens.
- Local Web routes: `/docs/cli`, `/cli/authorize`, and authenticated `/submissions/[id]?arena=disaster-response`. Results are loaded from the signed-in participant's saved history, not a client-provided score.
- Device authorization uses one-time exchange, expiring scoped sessions, revocation, origin checks, and OS credential storage on the CLI. Missing Privy configuration or required production Redis remains unavailable, not a simulated login success.
- `pnpm verify:cli` exercises the actual CLI against isolated local API/account fixtures, including a lost submission response and immutable resume. It does not register or submit to live accounts.

Integrated verification on Windows with Node.js 22.22.1 covers `build:tooling`, the full workspace typecheck, 375 passing TypeScript tests with 11 opt-in Redis cases skipped, five complete local-only CLI workflows, the production Web build, global ESLint, and six desktop/mobile browser route checks without console errors, framework overlays, blank pages, or horizontal overflow. The generated CLI OpenAPI contract is reproducible. Contract tests still require Foundry, which is not installed on this machine.

The final main TypeScript suite passes 290 tests with 11 opt-in Redis cases skipped. The first actual Redis submission run passed 6/7 and exposed a legacy hexadecimal-ID decoding bug. The decoder and surviving-key TTL upgrade are fixed and covered by regression tests, but the post-fix real-Redis rerun is pending because Docker cannot inspect/execute newly created containers. Do not treat this as completed real-Redis acceptance. Retry with `FRONTIER_VERIFY_REDIS=1 pnpm exec vitest run apps/web/src/lib/plan6-store.redis.test.ts` on a working isolated Docker host; do not point it at production Redis.

Live Privy browser authorization, deployed Upstash behavior, npm publication, and non-Windows runtime validation are not established by these local checks. The existing public deployment described below has not been updated by this work.

### Existing application

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
