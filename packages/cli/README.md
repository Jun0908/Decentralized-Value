# Frontier CLI

Local implementation of the 0.3.0 CLI. No account, deployment, or package publication is performed by building or testing this package.

`frontier --help` and `frontier --help --json` use the same definitions as `pnpm reference`.
`--project` accepts a project directory (or its frontier.json). `--base-url` selects an API origin for browsing. The default is http://localhost:3000.

Environment authentication requires both `FRONTIER_TOKEN` and `FRONTIER_TOKEN_ORIGIN`. The latter must exactly identify the selected API origin. Interactive login stores credentials only in the OS keychain using @napi-rs/keyring. Unavailable keychains fail without a plaintext fallback.

## Workspace coordination

The root workspace installs dependencies. This package uses the private `@frontier/sdk` and `@frontier/shared` workspace packages, with shared schemas remaining canonical under `packages/shared`. Its package manifest records the remaining dependencies. Tests use local fakes and an optional synthetic OS-vault roundtrip; no external accounts are used.

JSON mode emits one envelope to stdout, including errors. Progress and confirmations use stderr. Mutations require confirmation or `--yes`; `--json` never implies consent. Submit resume reuses the immutable saved request and idempotency key.

## Local verification

Run `pnpm build`, `pnpm typecheck`, and `pnpm test` from this package. `pnpm test:integration` runs a loopback HTTP API with synthetic identities. `pnpm test:vault` creates a random synthetic OS keychain entry, checks it, and deletes only that entry. It prints no secret.

Practice waits synchronously even without `--wait`. A failed correctness gate preserves the full run and exits 8. Network failures never automatically retry practice. Use the operation ID printed by submit to resume uncertain submissions after a disconnect. The immutable operation JSON records `prepared`; a separate receipt records confirmed server persistence. Neither implies final-entry selection, commitment, or payment.

Exit codes: 0 success, 1 internal error, 2 input/configuration, 3 authentication/confirmation, 4 context/comparison, 5 unsupported/unavailable, 6 rate limit, 7 network/timeout/unknown completion, 8 completed evaluation with failed correctness.

Human output uses compact arena/run/submission tables and per-metric practice/comparison summaries. `--json` keeps the complete versioned result envelope. Project loading verifies the cached schema and manifest against the lock. An interrupted context update is rejected by normal commands; `context update --yes` can restore consistent cached files using the current manifest.

The integrated local boundary is Windows/Node 22 with a loopback fixture API. The optional keychain roundtrip is not part of the default suite. Real browser/Privy authorization, other operating systems, durable Redis concurrency, and remote deployment are verified by their owning integration tasks, not by these local fakes.
