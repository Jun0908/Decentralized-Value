# DV-ver2 / SDK and CLI — Integration Record

Integration recorded: 2026-09-11. English edition: 2026-09-13.

This is a completed integration record, not an instruction to merge the repositories again. The [original record](../archive/plan-history-2026-09-13/dv-ver2-integration.md) is preserved unchanged.

## Strategy and provenance

The Decentralized-Value history and newer implementation remained authoritative. Feature differences were integrated using a three-way comparison, without forcing unrelated histories together.

- Authoritative starting point: `2e1e5f7` — Rescue Room payment foundation.
- DV-ver2 application snapshot: `101e13f`.
- SDK-Decentralized-Value snapshot: `f84d825`.
- Integration branch: `integrate/dv-ver2-sdk-cli`.
- Historical worktree: `C:\Users\j_kaw\Desktop\DV-integration`.

The DV-ver2 application diff used the closest authoritative snapshot, `be18b30`, as its comparison base. This preserved later Ocean fixes and Rescue payment work while incorporating CLI/API/UI changes. The worktree path is historical and need not still exist.

## Imported capabilities

- CLI device authentication, scopes, one-time exchange, expiration, and revocation.
- Idempotent Disaster Response submission, history, download, and final-entry selection.
- CLI manifest, response schemas, OpenAPI contract, and generated snapshots.
- `/docs/cli`, `/cli/authorize`, and `/submissions/[id]`.
- Redis-compatible reads and regression tests.
- SDK 0.3.0 and CLI 0.3.0 sources.
- GitBook whitepaper material, diagrams, and SDK/CLI design documents.

SDK and CLI became private workspace packages using the authoritative shared package. `build:tooling` builds shared, SDK, then CLI.

## Rescue compatibility

The Rescue starter's `payment-contract.json` was added to the safe ZIP extraction allowlist. It is a public payment-contract description, not a secret or permission to spend. Simulated credits, tokens, commitments, and actual payments remain distinct.

## Deliberately excluded

Large collections of transient screenshots, regenerable tarballs/binaries, and integration-only handoff or temporary agent instructions were not imported.

A structured local report was regenerated at `artifacts/sdk-cli-verification/stack-report.json`. This verification did not use real accounts, public deployments, npm publication, or Sepolia transfers.

## Recorded checks

- `pnpm build:tooling` and `pnpm typecheck`.
- TypeScript tests: 375 passed / 11 skipped.
- `pnpm verify:cli`: five complete local-only workflows.
- Web production build and ESLint.
- Six desktop/mobile page checks, including Home, CLI Guide, CLI Authorize, Saved Submission, and Rescue Room.

Contract tests requiring Foundry, real Privy authentication, real Redis migration, npm release, and public deployment were not performed in that integration batch. Later evidence is recorded separately in [Plan 12](../Plan12.md) and [Status](../STATUS.md).
