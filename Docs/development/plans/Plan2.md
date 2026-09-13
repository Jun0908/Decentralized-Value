# Frontier Protocol Plan 2 — Two Measured Competition Arenas

> Historical plan. Use `Docs/STATUS.md`, `Docs/PRODUCT.md`, and the arena specifications for current requirements.

**Last updated:** 2026-09-07

**Purpose:** Define a shared competition model for Emergency Supply Allocation and Ethereum Calldata Compression.

## Outcome

Plan 2 delivered runnable practice slices for two arenas.

### Emergency Supply Allocation

- Versioned supplier, route, price, capacity, and failure data
- User-entered allocations rather than preselected artifact IDs
- Hard-constraint validation for integers, non-negative values, exact totals, capacity, and known suppliers
- Exhaustive evaluation of five supplier failures and four route failures
- Two independent metrics: procurement cost and worst-case delivered kits
- Pareto comparison against published baseline strategies
- Deterministic context and result hashes
- HTTP endpoints, interactive UI, and automated tests

### Ethereum Calldata Compression

- Versioned public transfer batches with repeated addresses and boundary values
- Standard ABI, fixed-width packed, and address-dictionary codecs
- Checked-in Solidity decoders compiled with pinned settings
- Round-trip and decoded-state correctness checks
- Malformed-encoding rejection
- Exact EIP-2028 calldata gas
- Actual EVM execution gas from compiled runtime bytecode under Cancun rules
- Two-axis Pareto comparison, batch evidence, context hash, and result hash
- HTTP endpoints, interactive UI, and automated tests

## Competition model proposed by the plan

The plan separated four concepts:

- **Participant:** one registered competition identity
- **Submission:** one revision sent during the open period
- **Final Entry:** the single revision selected for final evaluation
- **Evaluation:** a result produced under a fixed public or final context

The intended lifecycle was:

```text
Read the challenge and limits
  -> register one participant identity
  -> submit multiple revisions under equal quotas
  -> select one Final Entry
  -> evaluate every Final Entry on one committed workload
  -> calculate the final Pareto frontier
  -> distribute Sepolia demo rewards
```

Participant uniqueness was designed around World ID by default, with sponsor allowlists or wallet-only registration as alternatives. This identity layer was not delivered and remains outside the current production boundary.

## Shared challenge manifest

The proposed manifest fixed the following before a round opened:

- challenge and evaluator versions
- public and final dataset commitments
- hard constraints
- metric names, directions, units, and bounds
- allowed source-input modes
- source-visibility policy
- submission and compute quotas
- identity policy
- deadline and round lifecycle
- reward token, pool, and allocation policy

Any material rule change would create a new challenge or context rather than silently modifying existing results.

## Fair submission rules

- Every participant receives the same revision and compute limits.
- A valid new revision becomes the provisional Final Entry so that forgetting a manual selection does not erase participation.
- Participants may return to an earlier valid revision while the round is open.
- Only one Final Entry per participant reaches final evaluation and reward calculation.
- Correctness failure excludes an entry before performance comparison.
- Submission order cannot affect Pareto membership or reward allocation.

The plan considered inline source, file upload, and Git commit references. Public, delayed-publication, and private-source policies were to be explicit. Isolated execution of arbitrary participant source was not delivered.

## Evaluation rules

### Emergency Supply

- `totalProcurementCost`: minimize
- `worstCaseDeliveredKits`: maximize
- Enumerate every declared single supplier and route failure.
- Reject invalid totals, capacity violations, unknown entities, non-integer quantities, and nondeterministic output.

### Calldata Compression

- `calldataGas`: minimize
- `decodeExecutionGas`: minimize
- Require exact round-trip behavior and the expected final state.
- Reject malformed decoding, forbidden dependencies, execution failures, and nondeterministic output.

### Shared Pareto rule

Entry A dominates entry B only when A is at least as good on every declared metric and strictly better on at least one. Invalid entries never enter the comparison set.

## Public and final evaluation design

Public evaluation was intended for iteration with visible workloads. Final evaluation was intended to use a dataset committed before the deadline, hidden until the round closed, then revealed for reproduction. Only the public practice layer was delivered in Plan 2.

## Settlement design

The proposed final settlement required:

- one frozen Final Entry per participant
- complete evaluation of the full final set
- deterministic result and evidence roots
- allocation that cannot exceed the funded pool
- protection against duplicate commitments and duplicate payment
- batch distribution with an individual claim fallback
- public transaction, event, and recipient-balance evidence

Later plans delivered a Sepolia demonstration path, but not the scheduled production-tournament lifecycle described here.

## Delivered and deferred boundary

| Area | Plan 2 result |
| --- | --- |
| Two deterministic practice evaluators | Delivered |
| Shared constraints, Pareto logic, hashes, API, and UI | Delivered |
| Arbitrary source isolation | Deferred |
| World ID uniqueness | Deferred |
| Hidden final workload and deadline scheduler | Deferred |
| One-person/one-final-entry enforcement | Deferred as a production identity guarantee |
| Scheduled final settlement | Deferred |

The order-book benchmark remained a legacy technical sample. DEX routing, simulated throughput, Ledger hardware, ENS, Bazantic, private-repository OAuth, mainnet tokens, and monetary-value claims were outside this plan's critical path.
