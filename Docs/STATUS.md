# Current implementation status

- **Last verified:** 2026-09-08
- **Public application:** <https://web-rho-seven-d6te7t3f0y.vercel.app>

This is the only current status document. Historical checklists and numbered plans under `archive/` must not override it.

## Implemented and demonstrable

| Capability | Evidence |
| --- | --- |
| Judge-oriented Top page | Explains the protocol, runs the live EVM proof, and links to Sepolia evidence |
| Calldata Compression evaluator | Compiled Solidity decoders execute in EthereumJS EVM with Cancun rules; calldata and decoder gas are measured independently |
| Emergency Supply evaluator | User-entered allocations are checked and evaluated across five supplier and four route failures |
| Microgrid evaluator | Deterministic Pareto comparison across cost, worst-case energy, and lifecycle carbon |
| Shared frontier math | Direction-aware Pareto membership, normalized hypervolume, expansion, and exclusive contribution |
| Reproducible evidence | Context-bound deterministic result hashes and detailed failure or batch evidence |
| Public web/API deployment | Next.js UI, `/v1/*` routes, and `/openapi.yaml` share one Vercel origin |
| Reward contracts | `FrontierRewardPool` and `FrontierDemoToken` implement commitment, distribution, and claim fallback with Foundry coverage |
| Sepolia reward-path demo | Token funding, allocation commitment, `RewardPaid`, and a 10,000 FDT recipient balance increase are recorded publicly |
| Submission sandbox | Revision history and one selected final entry work with ephemeral process-local state |
| Emergency Supply Plan 5 application | Competition lobby, rules, downloadable five-file Starter Kit, Visual/JSON/upload submission workspace, real evaluation, revision history, frontier leaderboard, Final Entry, and reward status are implemented with API coverage |

Sepolia evidence: [deployment record](deployments/sepolia-reward-demo.json), [allocation commitment](https://sepolia.etherscan.io/tx/0x96fd7a9d1f4a3bbd2fa7a9ea28d250a16e8eedbaff05b51a4f33e581c3839f2c), and [RewardPaid](https://sepolia.etherscan.io/tx/0xd976a968aefeb66d7e60fba7a9cf64c8711195fc3652aeccc20c7448069ad708).

## Partial or optional

| Capability | Honest boundary |
| --- | --- |
| Privy account | The client offers Google, email, or wallet login, distinguishes `authenticated` from wallet discovery, creates an embedded wallet for users without one, and provides logout/link-wallet controls. Protected APIs verify access and identity tokens. The Production verification key is configured; Google OAuth remains disabled in the Privy project while email and wallet login are enabled. |
| Plan 5 durable storage | A Redis adapter persists participants, submissions, evaluations, Final Entry, and reward records. Vercel Upstash installation is waiting for the project owner to accept the provider terms, so production writes fail closed. |
| Plan 5 participant reward | A dedicated Sepolia reward pool is funded with a finite 100,000 FDT demo balance. Its limited relayer has no token mint authority. The orchestrator commits one participant allocation, waits for `RewardPaid`, and stores the receipt; Production contract and relayer variables are configured. |
| Bazantic | A gateway and MCP tool surface were activated externally; Marketplace verification was pending and service/Recipe identifiers are not committed as repository evidence |
| ENSv2 | Adapter and fail-closed boundary exist, but no current parent name, delegated permission, or live runtime evidence is configured |
| Privy | Optional wallet UX requires an external App ID and is not required for measurement |
| Order-book benchmark | Retained as a legacy technical sample; its parallel-throughput axis is a declared simulation, not observed chain throughput |
| Ledger adapter | Retained as historical optional code, but no device evidence exists and it is not used by the public demo or reward path |

## Not implemented as a production tournament

- Active production participant and submission storage (adapter implemented; Upstash connection pending)
- World ID or another deployed uniqueness check
- Arbitrary untrusted source compilation and isolated execution
- Hidden final datasets or workloads
- Deadline scheduler and automatic final-entry lock
- Multi-runner threshold attestations and dispute/slashing flow
- Scheduled final-day allocation and payout for real participants
- Mainnet token or any token with a monetary-value claim

## State vocabulary

| State | Allowed claim |
| --- | --- |
| `measured` | A deterministic evaluator produced a result |
| `simulated` | A non-live boundary was modeled and is explicitly labeled |
| `committed` | A result or allocation has corresponding onchain evidence |
| `paid` | A verified transfer/event and recipient evidence exist |
| `Practice` | Measurement is real, but the production tournament layer is incomplete |

Never infer one state from another.

## Now / Next / Later

### Now

- Accept the free Upstash integration terms so the already implemented durable adapter receives Production credentials.
- Deploy and rehearse the Emergency Supply path from login through reload, Final Entry, and a fresh recipient transaction.

### Next

- Add a real participant uniqueness policy before changing the demo round into a production tournament.
- Store the final Bazantic identifiers and experiment evidence if that sponsor submission remains in scope.
- Add durable storage and a real participant uniqueness mechanism before describing an arena as `Open`.
- Isolate arbitrary participant source execution before accepting code as a tournament submission.

### Later

- Hidden final evaluation, deadline automation, disputes, multiple attestations, and production settlement orchestration.
