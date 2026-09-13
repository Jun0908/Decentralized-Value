# Ocean Commons — Integration Notes

Original record: 2026-09-10–11. English current edition: 2026-09-13.

This is a historical integration handoff. Ocean is now integrated into the Web app and has later entry, API, and reference-settlement work. Use [Plan 10](../Plan10.md) for current status. The [original handoff](../archive/plan-history-2026-09-13/ocean-commons-merge.md) remains unchanged.

## Initial branch boundary

The `arena/ocean-commons` branch originally added a standalone package, simulator script, and plan, with a workspace importer added to the lockfile. It intentionally avoided Rescue's shared API, registry, runner, SDK, contracts, and root-document integration points.

That historical isolation is not a guarantee that a new merge will be conflict-free. Inspect current status, branch ancestry, and exact diffs before integrating; do not overwrite unrelated work.

## Package responsibilities

- `types.ts`, `rng.ts`, `scenario.ts`: sea, boat, agreement, and seeded-world definitions.
- `engine.ts`: state transition and fuel enforcement.
- `negotiation.ts`: proposal/acceptance, escrow, compliance, and settlement.
- `agents.ts`, `match.ts`: public observations, reference policies, wallet authority, and match loop.
- `evaluator.ts`: independent outcomes, counterfactuals, replay, Pareto, and hashes.
- `manifest.ts`, `voyage.ts`: public context and illustrated replay projection.
- Later `entry.ts` and `submission.ts`: editable entry contract and public-seed evaluation.

The original package reused shared primitives and viem. It did not prematurely generalize the Rescue implementation.

## Shared primitives: reuse without conflating meaning

Both arenas need bounded wallets, escrow, structured orders/proposals, deterministic transitions, seeded scenarios, and independent outcomes.

Rescue escrow pays for a service deliverable. Ocean escrow can pay for restraint, with engine-measured compliance and refund on breach. Extract common infrastructure only after preserving those domain semantics.

## Subsequent integration

The Web registry and adapter now connect the Ocean workbench and illustrated voyage. The historical integration also added the package dependency and styles.

An overlapping alternative UI used retired outcome keys and undefined CSS classes. Integration retained the useful presentation ideas while restoring the current axes: **livelihood / restraint / cooperation**. Future changes must preserve the mission-input experience and use defined, verified styles.

Historical test counts and feasibility decisions—19 tests, later 40 tests, and a two-of-three monotonicity gate—belong to their dated rule versions. They are not the latest Plan 10 result.

## Current handoff

- Preserve the live workbench, editable artifact, sandbox submission, and recorded reference-pool funding.
- Keep ephemeral sandbox storage distinct from durable competition.
- Add Ocean's public discovery/OpenAPI/SDK contract under [Plan 12](../Plan12.md).
- Address the reported public-AI configuration and duration risks in [production readiness](../PRODUCTION_READINESS_2026-09-13.md).
- Do not represent earlier “not pushed,” “no Web,” or “no pool” notes as current status.

For code changes, run package typecheck/tests and integration checks. UI changes need desktop/mobile and console verification. No merge or source-code change is performed by this English edition.
