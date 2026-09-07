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

## Privy — optional wallet UX

Privy is a human onboarding and wallet convenience layer, not part of deterministic evaluation. It requires `NEXT_PUBLIC_PRIVY_APP_ID`. Measurement must remain usable when it is absent.

## Ledger — archived and unused

Ledger hardware is not available and is not required by the public application, evaluator, or Sepolia reward path. The historical adapter remains in the repository only as prior optional work. Do not reintroduce Ledger configuration, signing claims, or recovery steps into the main demo unless the project owner explicitly restores that scope and real device evidence is produced.

## Environment safety

Copy `.env.example` to `.env.local` only for optional live configuration. Never commit `.env`, private keys, wallet material, API secrets, or payment credentials. `pnpm env:check` reports key readiness without printing values.
