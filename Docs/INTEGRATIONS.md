# External integrations

External services extend Frontier Protocol but do not define the product. The public evaluator must remain demonstrable without optional account credentials or hardware.

## Vercel — active

The production UI, `/v1/*` API routes, and `/openapi.yaml` share this origin:

<https://web-rho-seven-d6te7t3f0y.vercel.app>

Environment-dependent evidence must fail closed. Missing public contract or transaction values display an unavailable state rather than a fixture presented as live.

## Ethereum Sepolia — reward demonstration complete

`FrontierRewardPool` and `FrontierDemoToken` completed the demonstration path: funding, immutable allocation commitment, distribution, `RewardPaid`, and recipient balance verification.

- [Machine-readable deployment evidence](deployments/sepolia-reward-demo.json)
- [Allocation commitment](https://sepolia.etherscan.io/tx/0x96fd7a9d1f4a3bbd2fa7a9ea28d250a16e8eedbaff05b51a4f33e581c3839f2c)
- [RewardPaid](https://sepolia.etherscan.io/tx/0xd976a968aefeb66d7e60fba7a9cf64c8711195fc3652aeccc20c7448069ad708)

This does not mean a production participant tournament has settled.

Classic Emergency Supply has a separate participant-addressed pool at `0x120160ec7d3a6bc649f8f060f3a82cbdb059c962`, funded with a finite 100,000 FDT at `0x57ffcce9342c69ab07a1f405fe5f70f919e0351b`. Its Vercel relayer owns only the pool, holds limited Sepolia gas, and cannot mint more tokens. Public deployment evidence is recorded in [`deployments/sepolia-plan5-reward.json`](deployments/sepolia-plan5-reward.json).

## Bazantic — optional agent distribution

The API source of truth is `openapi/frontier-v1.yaml`. The operation map is `bazantic/mcp-tools.json`, and agent instructions are in `bazantic/recipe.md`.

A gateway and 16-tool MCP surface were activated in the external dashboard during project setup. Marketplace publication was pending verification. Because service and Recipe identifiers are not stored as repository evidence, the local readiness check must not invent them.

When maintaining the integration:

1. deploy the same-origin API first;
2. register the published OpenAPI document;
3. take the exact gateway endpoint from the dashboard or `baz gateway list --json`;
4. never construct a gateway URL manually;
5. use the provider's payment-aware client for paid operations;
6. keep optional gateway failure outside the main demo path.

## ENSv2 — optional and not configured

The codebase has a chain-aware fail-closed boundary for runner discovery and authorization. No live parent name, subname hierarchy, delegated permission mutation, or current runtime evidence is configured. Do not describe ENS authorization as active until those transactions and resolved records exist.

## Privy — account UX active

The client is configured for Google, email, or wallet login and creates an Ethereum embedded wallet for users who do not already have one. `NEXT_PUBLIC_PRIVY_APP_ID` and `PRIVY_VERIFICATION_KEY` are active in production. Email and wallet login are enabled in the Privy project; Google OAuth still requires project-dashboard activation.

## Upstash Redis — active

The competition store persists participants, revisions, evaluations, Final Entries, idempotency records, and reward receipts through a provider-neutral boundary. The Upstash resource is attached to the Vercel project for Production, Preview, and Development through `KV_REST_API_URL` / `KV_REST_API_TOKEN`. The public challenge API reports `durable-redis` when this adapter is active.

Secret Gate uses a separate `frontier:secret-gate:v1` namespace for trusted 30-minute group snapshots and one-day nullifier replay protection. Production enrollment and entry fail closed without durable Redis.

## Semaphore V4 — public offchain implementation active

Secret Gate pins `@semaphore-protocol/identity`, `group`, and `proof` to 4.14.3. The depth-3 4.13.0 proof artifacts are checked into the web public assets with recorded SHA-256 hashes, so browser proof generation does not depend on a cross-origin artifact fetch.

The current Gate verification is offchain. No Sepolia Semaphore group, Gate contract transaction, or onchain nullifier evidence has been created, so the UI must not display an onchain-verified state.

## Participant reward relayer — configured

The participant-addressed payout is enabled through a dedicated, limited Sepolia relayer. It owns the `FrontierRewardPool` but not the token, so it cannot mint. The server verifies pool ownership and chain, enforces a per-reward cap, checks the finite prefunded balance, commits a participant-specific allocation, distributes once, waits for confirmation, and persists the receipt in Redis.

## Rescue Room Agent boundary — local OpenAI Controlled Practice

Rescue Room keeps deterministic Reference Commanders and also exposes a local participant Playbook path through `@openai/agents 0.17.2` and fixed model `gpt-5.6-luna`. The API key is read only by the server. The browser submits a Playbook and Episode id; the model receives only the current public state and produces one structured Action per independent turn. Model, SDK, Prompt version, response/request ids, token usage, Public View Hash, and Action are retained as provenance. Chain of Thought is neither requested nor stored.

The local credential was used for a successful real-API smoke run on 2026-09-10. This does not imply that the current public Vercel deployment has the credential. Missing credentials fail with `COMMANDER_UNCONFIGURED`; AI runs are limited to three per client per ten minutes. OpenAI execution is an observed inference boundary, while the resulting Action sequence is the input to deterministic replay.

Service Agent outputs still come from the committed simulator, and reserve/release/refund events use Rescue Credits in an offchain game ledger. Rescue Credits are not tokens. The repository now contains the six-decimal `rUSD-DEMO` test token, `RescueServiceEscrow`, its interface and tests, a deployment script, and deterministic reconciliation of Game Orders with future Sepolia evidence. None of those contracts is deployed or connected. No Commander wallet delegation, Service Agent wallet assignment, live Sepolia Service transaction, ENS provider discovery, Hidden Final, or reward settlement is configured. Payment states must remain labeled `simulated` and `game-credits`, never `committed` or `paid`.

## Ledger — archived and unused

Ledger hardware is not available and is not required by the public application, evaluator, or Sepolia reward path. The historical adapter remains in the repository only as prior optional work. Do not reintroduce Ledger configuration, signing claims, or recovery steps into the main demo unless the project owner explicitly restores that scope and real device evidence is produced.

## Environment safety

Copy `.env.example` to `.env.local` only for optional live configuration. Never commit `.env`, private keys, wallet material, API secrets, or payment credentials. `pnpm env:check` reports key readiness without printing values.
