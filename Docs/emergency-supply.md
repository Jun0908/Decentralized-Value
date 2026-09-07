# Emergency Supply Allocation Frontier

`emergency-supply-v1` is the first user-controlled Frontier Protocol arena. It does not select a checked-in Artifact ID: every request supplies a new allocation and the API recalculates the result.

## Inputs

The participant allocates exactly 1,000 whole emergency kits across five published suppliers. Each supplier has a fixed unit price, capacity, and delivery route. Two low-cost suppliers share one seaport, so supplier count alone does not guarantee route diversity.

The versioned public context is returned by:

```text
GET /v1/emergency-supply
```

## Hard constraints

- Every supplier allocation is a non-negative integer.
- The allocation totals exactly 1,000 kits.
- No supplier capacity is exceeded.
- Unknown suppliers are rejected.
- Evaluation uses only the checked-in data version.

An invalid plan keeps diagnostic metrics but is never eligible for the Pareto frontier.

## Measured axes

### Total procurement cost — minimize

For each supplier, the evaluator multiplies allocated kits by the published unit cost, then sums the result. It does not use a live exchange rate, oracle, probability, or hidden weight.

### Worst-case delivered kits — maximize

The evaluator enumerates all five single-supplier outages and all four unique route closures. For each failure it removes every affected allocation and records the delivered quantity. The metric is the minimum delivered quantity across those nine outcomes.

## Reproducibility

The context hash commits to the arena ID, data version, target, vendor data, and complete failure list. The result hash commits to that context, the normalized allocation, every failure outcome, both metrics, constraint results, and Pareto comparison. Neither hash contains a timestamp.

The same allocation and data version therefore produce the same evidence and result hash.

## Example request

```json
{
  "allocations": {
    "harbor-aid": 300,
    "northstar": 150,
    "inland-works": 300,
    "local-grid": 150,
    "airbridge": 100
  }
}
```

Submit it to:

```text
POST /v1/emergency-supply/evaluations
```

This request is a real deterministic measurement. It is not an official tournament submission and does not claim a World ID proof, signed attestation, Sepolia settlement, or token transfer. Those remain separate Plan 2 deployment phases.
