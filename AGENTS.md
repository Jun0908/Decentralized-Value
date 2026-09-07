# Frontier Protocol agent instructions

This file is for coding agents. `README.md` is the Judge- and human-facing project entry point; do not turn it into an internal task log.

## Mission

Frontier Protocol rewards valid solutions that expand a reproducible Pareto frontier. It keeps independent values separate instead of hiding them inside one weighted score, measures every participant under the same committed context, and uses Ethereum to make reward allocation verifiable.

## Read only what the task needs

Start with:

1. `Docs/STATUS.md` for what is actually working now.
2. `Docs/PRODUCT.md` for product rules and vocabulary.
3. `Docs/ARCHITECTURE.md` for system and trust boundaries.
4. The relevant file under `Docs/arenas/` for evaluator work.
5. `Docs/DEMO.md` for Judge-facing or demo work.
6. `Docs/INTEGRATIONS.md` only for external-service work.

`Docs/archive/` contains historical plans, reviews, and superseded assumptions. Never treat archived text as a current requirement unless the user explicitly revives it and the current docs are updated first.

The nested `apps/web/AGENTS.md` also applies to work under `apps/web/` and contains generated Next.js-specific rules.

## Sources of truth

- Product intent and competition rules: `Docs/PRODUCT.md`
- Implemented, partial, and missing capabilities: `Docs/STATUS.md`
- System boundaries: `Docs/ARCHITECTURE.md`
- Arena measurement rules: `Docs/arenas/*.md` plus evaluator tests
- Public API: `openapi/frontier-v1.yaml`
- Sepolia proof: `Docs/deployments/sepolia-reward-demo.json`
- Public claims and first-run instructions: `README.md`

When code, tests, and docs disagree, do not silently choose the most impressive claim. Verify the implementation, correct `Docs/STATUS.md`, and keep public language within the proven boundary.

## Non-negotiable product rules

- Correctness is a hard gate, not another score.
- Compare outcomes only when evaluator version, dataset, constraints, metrics, and evidence context match.
- Preserve each independent metric and its direction. Do not introduce hidden weights.
- Pareto and contribution calculations must be deterministic and independent of submission order.
- Do not include timestamps or request-specific randomness in context or result hashes.
- `measured`, `simulated`, `committed`, and `paid` are different states.
- Practice credits are not tokens. A preview is not settlement.
- Never claim ENS authorization, World ID uniqueness, a signature, a transaction, or a payout without corresponding evidence.
- The public demo does not require Ledger hardware. Do not put Ledger back on its critical path.
- The Sepolia demo token has no monetary-value claim.

## Current implementation boundary

The public demo has real deterministic evaluators for Calldata Compression, Emergency Supply, and Microgrid Dispatch. The Calldata evaluator executes compiled Solidity bytecode under Cancun rules. Emergency Supply evaluates user-entered allocations across nine exhaustive single failures. The reward contracts have a completed Sepolia demonstration.

Production tournament storage, World ID uniqueness, arbitrary participant source isolation, hidden-final evaluation, and scheduled final-day settlement are not complete. Read `Docs/STATUS.md` before changing UI claims.

## Repository map

```text
apps/web                     Next.js UI and same-origin API routes
apps/api                     Frontier HTTP API logic
apps/runner                  reproducible runner service
packages/shared              schemas, Pareto, contribution, and hashes
packages/emergency-supply    social evaluator
packages/calldata-compression Solidity/EVM evaluator
packages/microgrid-dispatch  three-axis evaluator
packages/contracts           Foundry contracts and deployment scripts
openapi                      public API specification
bazantic                     gateway and Recipe material
Docs                         current human-readable specifications
```

## Change workflow

1. Inspect `git status` and preserve unrelated user changes.
2. Read the relevant current doc and nearby tests before editing.
3. Make the smallest coherent change; do not revive archived scope accidentally.
4. Add or update deterministic tests for changed behavior.
5. Update `Docs/STATUS.md` when the proven capability boundary changes.
6. Update `README.md` only when the Judge-facing product claim or quickstart changes.
7. Run checks proportional to the change.

Common checks:

```bash
pnpm env:check
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test:ts
pnpm test:contracts
pnpm --filter @frontier/web build
```

Use `pnpm run ci` for the complete local suite. Frontend changes also require desktop/mobile browser verification and a console-error check.

## Documentation hygiene

- Do not create `Plan5.md`, one-off audit files, or duplicate status documents in `Docs/`.
- Put current decisions into the existing canonical document.
- Track immediate work as `Now`, `Next`, or `Later` in `Docs/STATUS.md`.
- Put completed or superseded planning material in `Docs/archive/`.
- Keep module-specific instructions beside the module when they are truly local.
- Fix inbound links whenever a document moves.

## Security and external state

- Never print or commit `.env` values, private keys, wallet secrets, API secrets, or Ledger material.
- Do not hand-edit deployment evidence to make a feature look complete. Generate or verify it from the actual deployment flow.
- External deployment, payment, registration, or account mutation requires explicit task scope.
- Missing external configuration must fail closed and remain visible as unavailable or not configured.
