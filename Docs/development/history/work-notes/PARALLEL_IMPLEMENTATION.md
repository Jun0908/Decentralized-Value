# Plan 9 / Plan 11 / Plan 12 — Parallel Implementation Record

Batch started: 2026-09-11. English current edition: 2026-09-13.

This records a completed, user-authorized first implementation batch, not permission to start additional parallel work. Current priorities are in [Plans](../../plans/README.md) and [production readiness](../../../evidence/verification/PRODUCTION_READINESS_2026-09-13.md). The [original record](../plan-history-2026-09-13/PARALLEL_IMPLEMENTATION.md) is preserved unchanged.

## Ownership and integration rules

The batch began at `b1f2350`, using separate worktrees and branches. The integration owner retained shared API entrypoints, root package/lockfile changes, and common documentation. Existing uncommitted work and Ocean development were preserved.

| Track       | Historical worktree / branch                   | Owned scope                                                           |
| ----------- | ---------------------------------------------- | --------------------------------------------------------------------- |
| Plan 9      | `DV-plan9-payments` / `codex/plan9-payments`   | Payment-policy module, exports, negative tests                        |
| Plan 11     | `DV-plan11-evidence` / `codex/plan11-evidence` | Versioned evaluation envelope and tests                               |
| Plan 12     | `DV-plan12-tooling` / `codex/plan12-tooling`   | Contract synchronization, package verification, generated SDK outputs |
| Integration | Main working copy                              | Rescue adapter, integration tests, shared configuration/docs          |

These names describe historical ownership; they do not assert that the worktrees still exist.

Each owner reported its exact diff, tests, and remaining boundaries. Integration selected the relevant changes rather than blindly cherry-picking entire branches. Shared files were rechecked against the advancing main branch.

## Frozen boundaries

1. Payments reuse order/action/manifest/receipt identities. Chain state does not rewrite game-result hashes.
2. Request/result context and deterministic outcomes are separate from execution time, job ID, and transaction evidence.
3. The monorepo's API/OpenAPI contract is authoritative; the older SDK repository is a reuse source.
4. A schema referring to a snapshot or round does not prove ENS admission, entry freeze, or CRE execution.
5. Prepared transaction intent is not payment. Reservation, signing, submission, confirmation, receipt, and balances require distinct evidence.

The first batch excluded UI, public deployment, account changes, wallet creation, paid inference, transactions, and Push.

## Integrated work

- [x] Dedicated ownership and worktree setup.
- [x] Unit tests and typechecks for all three tracks.
- [x] Selected-diff integration and real Rescue evaluation-envelope adapter.
- [x] SDK/CLI, contract-generation, distribution, lint, and type regression checks.
- [x] Current-state and remaining-scope documentation.

Source commits:

- Plan 9: `121c0865bbf0a3bb660ee47c7f19b7a966338673`.
- Plan 11: `2f885506bd56f7db8a8023c96b1dd82c013f4e05`, with review fix `b81372c83cd9dd9bd0e11f5e8535c3bbc2ffe4d4`.
- Plan 12: `d952a620ca7984d4e1811417aca47a46c667c418`.

Main advanced to `9c02131` during integration. Tests were rerun while preserving unrelated changes. A verification-only package/lockfile diff in the Plan 12 worktree was not treated as the integration owner's dependency update.

## Recorded verification

| Check                                              | Result in this batch                                           |
| -------------------------------------------------- | -------------------------------------------------------------- |
| Tooling build and workspace typecheck              | Passed                                                         |
| TypeScript suite                                   | 453 passed / 11 opt-in Redis tests skipped                     |
| CLI/SDK generated-contract checks                  | Passed without rewriting files                                 |
| CLI workflows                                      | Five local fixture-account workflows passed                    |
| Package verification                               | Empty-consumer tarball ESM/SDK/NodeNext/CLI passed             |
| Rescue envelope                                    | Same result in Node 22.22.1, browser-target V8, and Bun 1.2.21 |
| Web production build                               | Passed                                                         |
| Changed-code lint/format/diff checks               | Passed                                                         |
| Tracked-file secret scan                           | Passed for its stated scope                                    |
| Foundry, real Redis, official CRE, payments, Linux | Not run in this batch                                          |

Two existing HTTP tests timed out under simultaneous heavy builds. A standalone rerun passed without weakening assertions or timeout settings. Missing SDK dist prompted the CI tooling-build prerequisite.

Review also replaced repeated artifact reads with a single normalized snapshot and removed locale-dependent ordering from the new envelope, with regression tests.

## Subsequent work

Later authorized batches added real AI/Payment evidence, official CRE simulation, live ENS/MCP demonstrations, and public practice checks. Those later results are in [Plan 9](../../plans/Plan9.md), [Plan 11](../../plans/Plan11.md), and [Plan 12](../../plans/Plan12.md); they do not retroactively turn this first batch into a live-network test.

For future delegation, obtain an explicit parallel-work request, assign nonoverlapping files, preserve dirty work, and coordinate shared integration files. The current documentation edit starts no agents and performs no external mutations.
