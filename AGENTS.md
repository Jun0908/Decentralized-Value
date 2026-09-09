# Frontier Protocol agent guide

Frontier Protocol rewards correct solutions that expand a reproducible Pareto frontier. Independent values stay separate, every comparable result uses the same committed context, and Ethereum makes final reward evidence verifiable.

## Start here

Read only the documents relevant to the task:

- [`Docs/STATUS.md`](Docs/STATUS.md): what works now and what remains incomplete
- [`Docs/PRODUCT.md`](Docs/PRODUCT.md): product rules and vocabulary
- [`Docs/ARCHITECTURE.md`](Docs/ARCHITECTURE.md): system and trust boundaries
- [`Docs/arenas/`](Docs/arenas/): evaluator-specific rules
- [`Docs/DEMO.md`](Docs/DEMO.md): public demo and recovery flow
- [`Docs/INTEGRATIONS.md`](Docs/INTEGRATIONS.md): external services and deployment state
- [`openapi/frontier-v1.yaml`](openapi/frontier-v1.yaml): public API contract

`README.md` is the public entry point. `Docs/archive/` is historical context, not an active requirement. Work under `apps/web/` also follows its generated `AGENTS.md`.

## Product invariants

- Correctness is a hard gate.
- Compare results only when evaluator, dataset, constraints, metrics, and evidence context match.
- Keep every metric and its direction independent; avoid hidden weights.
- Pareto, contribution, context hashes, and result hashes remain deterministic and submission-order independent.
- Treat `measured`, `simulated`, `committed`, and `paid` as distinct states. Practice credits are not tokens.
- Public claims must match available evidence.

## Working approach

1. Check `git status` and preserve unrelated work.
2. Read the relevant current document, nearby implementation, and tests.
3. Make the smallest coherent change.
4. Add or update deterministic tests when behavior changes.
5. Update `Docs/STATUS.md` when the implementation boundary changes, and `README.md` when the public claim or quickstart changes.
6. Run checks proportional to the change.

Useful checks:

```bash
pnpm env:check
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test:ts
pnpm test:contracts
pnpm --filter @frontier/web build
```

Use `pnpm run ci` for the complete suite. Frontend changes also need desktop/mobile browser verification and a console-error check.

## Repository map

```text
apps/web                     Next.js UI and same-origin routes
apps/api                     Frontier HTTP API logic
apps/runner                  reproducible runner service
packages/shared              schemas, Pareto, contribution, and hashes
packages/disaster-response   72-hour strategy evaluator
packages/emergency-supply    classic allocation evaluator
packages/calldata-compression Solidity/EVM evaluator
packages/microgrid-dispatch  three-axis evaluator
packages/contracts           reward contracts and deployment scripts
openapi                      public API specification
Docs                         current specifications and archived history
```

## Safety

Keep secrets and wallet material out of output and Git. Treat deployment, payment, registration, and account changes as external actions that need clear user scope. Optional services should fail visibly when unavailable.
