# Frontier Protocol Plan 3 — From Practice Arenas to a Frontier Market

> Historical plan. Use `Docs/STATUS.md`, `Docs/PRODUCT.md`, and `Docs/ARCHITECTURE.md` for the current product boundary.

**Last updated:** 2026-09-07

**Purpose:** Connect deterministic arena evaluation to explicit frontier contribution, reward allocation, and verifiable settlement.

## Objective

Plan 3 moved the product beyond a practice site with Pareto charts. It aimed to make this causal chain understandable and testable:

```text
A sponsor publishes a value tension
  -> a builder submits an artifact
  -> every artifact is measured under the same context and evidence level
  -> the protocol calculates how much the artifact expands the frontier
  -> a public rule allocates rewards to that contribution
  -> attestation and settlement finalize the evidence
```

## Priority decisions

The plan prioritized:

1. deterministic frontier-contribution measurement;
2. challenge manifests with sponsor intent, conditions, duration, and reward configuration;
3. first-class context and evidence levels;
4. clear product vocabulary;
5. an honest adapter boundary for adding new arena types.

Participant uniqueness, multiple revisions with one Final Entry, hidden-final workloads, multi-runner attestation, disputes, and live settlement were treated as later tournament infrastructure.

## Implemented work

### Accurate public claims

- Clarified that the registry generates presentation metadata and routes, while each new problem type still needs an evaluator adapter.
- Added product language explaining that Frontier Markets reward expansions of what is possible.
- Added plain-language definitions for the product vocabulary.
- Separated Practice, Open, Final Evaluation, and Settled lifecycle states.

### Frontier contribution

- Added metric direction, unit, lower and upper bounds, and a fixed reference point.
- Added deterministic normalization, direction-aware Pareto comparison, two-dimensional hypervolume, frontier expansion, and exclusive contribution.
- Kept baseline artifacts in the comparison set while excluding them from rewards.
- Added input-order independence and deterministic hash tests.
- Applied the shared calculation to Supply and Calldata evaluators.
- Displayed before/after frontier area, candidate expansion, exclusive contribution, and reward preview.

### Challenge and context model

- Added versioned challenge manifests and immutable context hashes.
- Represented datasets, constraints, metric settings, evaluator versions, and evidence levels explicitly.
- Ensured results from different contexts or evidence levels are not mixed.

### Extensibility

- Added shared outcome-vector types and evaluator adapters.
- Added the three-axis Microgrid arena without replacing the common Pareto engine.
- Added typed SDK and submission-sandbox surfaces.
- Added deterministic reward allocation and demo reward contracts.

## Reward rule

The plan distinguished evaluation-time expansion from final reward contribution:

```text
eligible weight = normalized exclusive contribution
                x reproducibility factor
                x evidence factor

reward = distributable pool
       x eligible weight
       / total eligible weight
```

Rules fixed by the plan:

- Use `frontierExpansion` to explain the immediate effect of a candidate.
- Use order-independent `exclusiveContribution` for final allocation.
- Correctness failures, dominated entries with zero contribution, and baseline artifacts receive no contribution reward.
- Compare only entries with matching contexts and evidence levels.
- Fix factors, bounds, rounding, and no-winner handling before the challenge opens.

Later Value Pool work evolved reward allocation beyond this single generic formula while preserving the deterministic and order-independent requirements.

## Product principles preserved

- Correctness precedes performance comparison.
- Independent metrics are not collapsed into one hidden weighted score.
- The same artifact and context reproduce the same outcomes and hashes.
- Missing signatures, runner evidence, transactions, or payouts remain visibly unavailable.
- Practice results, previews, Sepolia demonstrations, and production settlement stay distinct.

## Result and remaining boundary

The shared manifest, adapter, contribution, reward-preview, and three-arena foundation was implemented. The plan did not complete a funded production Frontier Market.

The following production items remained deferred:

- participant uniqueness;
- durable tournament-wide identity and Final Entry enforcement;
- hidden-final workloads and deadline automation;
- multi-runner attestations and disputes;
- funded production pools and scheduled participant settlement;
- complete evidence-backed lifecycle labels in every surface.

Later plans delivered durable demo competition state and Sepolia demonstration rewards. They did not complete the production-tournament items above.
