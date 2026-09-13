# External integrations

External services extend Frontier Protocol but do not define its values. Public deterministic evaluation remains demonstrable without optional account credentials or hardware. [Current status](STATUS.md) · [Environment configuration](development/guides/ENVIRONMENT.md).

Blank template values mean unconfigured or optional features, not automatically unused code. Local configuration, deployment configuration and actual successful execution are different evidence.

## Sponsor execution: current boundary

| Integration         | Recorded execution                                                                                                                             | Remaining boundary                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| ENSv2               | `frontierdemo.eth` → Rescue public Practice discovery; single-key grant/update/pause/restore/revoke, seven Sepolia transactions                | General runner-list discovery and independent service market are not established by this Rescue capability |
| Chainlink CRE       | Official CLI 1.33.0 / SDK 1.20.1 normal/confidential local simulation; private pack, salted receipt and explicit-reveal replay agree with Node | No live TEE attestation, network deployment, onchain commitment or production Final                        |
| Bazantic            | External gpt-5-nano agent calls two free MCP tools three times; same-context baseline/candidate evaluation and independent reproduction        | Results tie; hosted Recipe remains draft/unexecuted/unpublished, no gateway payment or Recipe A/B benefit  |
| Sponsor evidence UI | Public `/sponsors/demo` checked September 13 on desktop/mobile with matching JSON downloads                                                    | Viewing saved evidence does not run models, transfer tokens or execute CRE                                 |

[ENS evidence](evidence/deployments/ensv2-rescue-demo.json) · [CRE evidence](evidence/deployments/chainlink-cre-private-pack.json) · [Bazantic evidence](evidence/deployments/bazantic-rescue-agent-demo.json) · [Recording/source guide](hackathon/sponsors/SPONSOR_DEMO.md).

Earlier failed login/routing attempts are retained as historical records, not current claims that these later successful executions never happened.

## Vercel

The production UI, same-origin `/v1/*` routes and `/openapi.yaml` share:

<https://web-rho-seven-d6te7t3f0y.vercel.app>

Environment-dependent evidence fails closed; unavailable live values are not replaced by fixtures presented as live. The latest public browser check observed `commanderAvailable: true`, but **did not execute a new AI episode**. Key/provider validity, complete model runs, Ocean request duration and recovery require separate verification. [Public browser QA](evidence/verification/ARENA_BROWSER_QA_2026-09-13.md) · [Production follow-up](evidence/verification/PRODUCTION_READINESS_2026-09-13.md).

A local key does not configure Vercel, and a successful source Push is not proof of a particular deployment's completion.

## Ethereum Sepolia: reward demonstrations

`FrontierRewardPool` and `FrontierDemoToken` completed funding, immutable allocation commitment, distribution, `RewardPaid` and recipient balance verification.

- [Deployment evidence](evidence/deployments/sepolia-reward-demo.json)
- [Allocation commitment](https://sepolia.etherscan.io/tx/0x96fd7a9d1f4a3bbd2fa7a9ea28d250a16e8eedbaff05b51a4f33e581c3839f2c)
- [RewardPaid](https://sepolia.etherscan.io/tx/0xd976a968aefeb66d7e60fba7a9cf64c8711195fc3652aeccc20c7448069ad708)

Classic Emergency Supply has a separate participant-addressed pool at `0x120160ec7d3a6bc649f8f060f3a82cbdb059c962`, funded with a finite 100,000 FDT at `0x57ffcce9342c69ab07a1f405fe5f70f919e0351b`. Its limited Sepolia relayer owns the pool, not the token, and cannot mint. [Classic evidence](evidence/deployments/sepolia-plan5-reward.json).

Ocean's **Open / funded** display refers to its recorded reference-match pools and settlement evidence. It does not certify public model seasons, independent third-party winners or unknown Final completion. [Ocean plan](development/plans/Plan10.md).

FDT and rUSD-DEMO are test/demo tokens with no monetary-value claim. A demonstration payment is not a completed production participant tournament.

## Bazantic: verified Rescue distribution

The API source is `openapi/frontier-v1.yaml`; operation mapping is `bazantic/mcp-tools.json`; agent instructions are in `bazantic/recipe.md`.

The initial setup had a 16-tool surface. On September 12, the existing gateway listed 64 tools but its old 15-route table returned 404 for Rescue. Three public Practice routes were added at zero price, preserving the old routes/prices. All six HTTP onboarding requests, Starter hash, SDK integrity and repetition passed. MCP manifest and two evaluations matched the full local evaluator output. Other routes are not covered by that success.

A two-tool `rescue-room-strategy-comparison` Recipe was saved/read back as a draft. The later external AI used its prompt through MCP, **not the Bazantic-hosted execution service**. [Details and reproduction](hackathon/sponsors/BAZANTIC_RESCUE_LIVE.md).

Maintenance order: publish the same-origin API, register its actual OpenAPI, obtain the exact gateway endpoint from the provider, then verify routed operations individually. Never invent a gateway URL. Paid operations require the provider's payment-aware client and separate scope; optional gateway failure must not block deterministic demos.

## ENSv2: Rescue discovery and single-key authority

The recorded Rescue capability uses the existing name's `frontier.rescue.service` text key. Discovery invokes the actual public API. The owner granted a delegate authority for that single key; update, pause, restore and revoke were exercised. Service is recorded active and delegate revoked. Paused discovery and post-revoke `eth_call` write rejection were checked; the latter is not an eighth failed transaction.

This does **not** replace the older runner job protocol. A prior September 12 check found the resolver for `frontierdemo.eth`, but `frontier.runners` at `runners.frontierdemo.eth` was null at block 11687106 with CCIP Read disabled. Ownership was confirmed at block 11687758. Those older runner observations remain a separate boundary; do not generalize Rescue success to every namespace. [Historical connection check](development/history/work-notes/EXISTING_SPONSOR_CONNECTION_CHECK.md).

## Privy and Upstash Redis

The client supports Google, email and wallet login, with an embedded Ethereum wallet for users without one. The existing deployment record reports configured public App ID and verification key, with email/wallet enabled; Google OAuth still requires project activation. This document does not claim a new live login test.

Competition persistence uses provider-neutral storage for participants, revisions, evaluations, Final Entries, idempotency and reward receipts. Upstash attaches via `KV_REST_API_URL` / `KV_REST_API_TOKEN`; configured challenge responses report `durable-redis`.

Secret Gate uses its own `frontier:secret-gate:v1` namespace, 30-minute trusted group snapshots and one-day nullifier reuse protection. Production enrollment/entry fail closed without durable storage. September 13 public proof acceptance and duplicate rejection verified this path, not every unrelated Redis migration.

## SDK and CLI authorization

Private TypeScript workspaces live at `packages/sdk` and `packages/cli`; build with `pnpm build:tooling`, then use `pnpm exec frontier`. The older SDK/DV-ver2 repositories are integration provenance, not separate active implementations. Packages are not published to npm.

Set `FRONTIER_CLI_ORIGIN` to the exact trusted Web origin before enabling device authorization; HTTPS except loopback. Never derive trust from Host/forwarded headers. Local default is `http://localhost:3000`; browser and CLI must use the same configured origin.

The approval page reuses Privy access/identity-token verification. Sessions have only `disaster:read`, `disaster:join`, `disaster:submit` and `disaster:entry`, not payments or unrelated APIs. Device codes expire after ten minutes; sessions after eight hours. Server storage hashes tokens; the CLI uses the OS credential vault with no plaintext fallback.

The separate `frontier:{cli-auth}:v1` Redis namespace supports atomic one-time exchange. Production requires durable Redis; memory is development-only. Disaster revision idempotency binds original payloads and retains new keys without the earlier 24-hour expiry. Surviving legacy bindings are validated/upgraded when read; expired bindings cannot be reconstructed from submissions alone. Audit before migration.

Live CLI Privy approval, production migration, npm publication and non-Windows credential behavior are not established by local tests. Anonymous Rescue Practice requires none of these credentials. [Quickstart](development/guides/RESCUE_AGENT_QUICKSTART.md).

## Semaphore V4

Secret Gate pins identity/group/proof packages at 4.14.3. Depth-3 4.13.0 proving artifacts are local public assets with recorded SHA-256, avoiding cross-origin proving-asset downloads.

Proof verification is **offchain**. No Sepolia Semaphore group, Gate transaction or onchain nullifier evidence has been established. Personal latency/memory observations are not an official competition; the feasibility decision remains PIVOT.

## Participant reward relayer

The existing participant-addressed path uses a dedicated, limited Sepolia relayer. It owns only its pool, checks ownership/chain/per-reward cap/prefunded balance, commits a participant-specific allocation, distributes once, waits for confirmation and persists the receipt in Redis. It cannot mint. This path does not authorize Rescue practice purchases or complete Rescue tournament payouts.

## Rescue AI Controlled Practice

The local participant Playbook path uses `@openai/agents 0.17.2` and the fixed configured `gpt-5.6-luna` model. Keys stay server-side. Each independent turn receives only public state and returns one structured Action. Provenance records model, SDK, prompt version, request/response IDs, token usage, Public View Hash and action, not chain of thought.

A real local API smoke run succeeded on September 10. Missing credentials return `COMMANDER_UNCONFIGURED`; limits allow three runs per client per ten minutes. Later public availability flags are not completed inference evidence. Actions, not model reasoning, form the deterministic replay boundary.

Ordinary services remain simulator-generated. Reserve/release/refund uses offchain Rescue Credits marked `simulated` / `game-credits`; these are not tokens.

## Rescue operator pilot and purchased-analysis continuation

On September 12 Japan time, a real Commander selected Pulse Monitor, a separate model supplied analysis, and escrow paid **5 rUSD-DEMO**. A separate order refunded **5 rUSD-DEMO**. [Evidence](evidence/deployments/sepolia-rescue-service-demo.json).

- Token: `0x1d8f2cc7fd630e2b382cb4053bdb8c377d9b3421`, six decimals, test-only.
- Escrow: `0x4fdfa92984dad65d6b593ec93614bfa99b4cd36c`.
- [Provider payment](https://sepolia.etherscan.io/tx/0x734280e06da7501b5b55352387a7efd8be9911e5ceab0c671402200e2ce87433) · [Commander refund](https://sepolia.etherscan.io/tx/0x46b71812525b22880f07ff7c4f8e3eae3eb403143a17016aabb1c5622b40bf4a).
- All role wallets are operator-controlled. Deliverable binding/format/reference checks are not diagnostic truth or independent-market evidence.
- The operator interface is bearer-authenticated loopback HTTP, separate SDK/client and single-host durable jobs. Execution is disabled by default; creation alone does not run.
- Unknown model/transaction state stops for reconciliation; signed transactions are checked before same-hash rebroadcast. Secret files and journals remain Git-ignored. No automatic stale-lock expiry.
- The descriptor's `operator-pilot-paid` reports **historical evidence**. Null Practice payment targets intentionally do not expose an enabled public payment service.

The original deliverable sidecar did not alter ordinary simulator outcomes. A later independent context returned that purchased analysis to a maximum-three-action Commander continuation: three new model calls, zero new chain transactions. Recorded outcomes were dominated by Never Pause. Public replay (`pnpm verify:rescue:submission-replay`) needs no key, inference or RPC, but does not prove model/payment authenticity by itself.

[Operator runbook](development/guides/RESCUE_EXECUTION_BATCH.md) · [Submission scope](hackathon/submission/HACKATHON_SUBMISSION.md). Public operations/submission pages read saved evidence; they do not enable the operator API, recruit providers, create a production Rescue database or settle a hidden Final.

## Ledger and environment safety

Ledger is historical optional code and unused by the public application/evaluator/reward path. Do not restore hardware-signing claims without explicit scope and real device evidence.

Use `.env.example` as the template for optional configuration; never commit keys, wallet material or private environment files. `pnpm env:check` reports formats/presence without values, not operational readiness.
