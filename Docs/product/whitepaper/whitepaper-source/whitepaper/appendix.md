# Technical Appendix

This appendix connects the claims in the whitepaper to the current implementation, mathematics, schemas, and public evidence. Some types are simplified for explanation. The canonical definitions remain in the repository source code.

## A. Challenge Manifest V2

```typescript
type ChallengeManifestV2 = {
  schemaVersion: "2";
  id: string;
  slug: string;
  name: string;
  lifecycle: "PRACTICE" | "OPEN" | "FINAL_EVALUATION" | "SETTLED";

  sponsor: {
    name: string;
    wallet: Address | null;
    statement: string;
  };

  valueTension: string;
  artifactType: string;
  hardConstraints: string[];
  metrics: OutcomeMetric[];
  contexts: ContextManifest[];
  activeContextId: string;

  workload: {
    publicHash: Bytes32;
    finalCommitment: Bytes32 | null;
  };

  submission: {
    methods: ("INLINE" | "UPLOAD" | "GITHUB")[];
    sourceVisibility: "PUBLIC" | "DELAYED_PUBLIC" | "PRIVATE";
    opensAt: DateTime | null;
    closesAt: DateTime | null;
    maxRevisions: number;
  };

  reviewEndsAt: DateTime | null;
  reward: PreviewReward | FundedReward;
};
```

A non-Practice challenge requires both a funded reward and a final-workload commitment. The manifest is a versioned contract for preserving comparability, not merely data displayed in the interface.

## B. Context Manifest

```typescript
type ContextManifest = {
  id: string;
  version: string;
  name: string;
  description: string;
  datasetHash: Bytes32;
  constraintHash: Bytes32;
  metricsHash: Bytes32;
  evidenceLevel: 0 | 1 | 2 | 3 | 4;
};
```

When the context changes, an outcome produced by the same artifact is treated as a different result.

## C. Value Pool Manifest

The current 72-Hour Disaster Response implementation uses the following manifest shape.

```typescript
type ValuePoolManifest = {
  schemaVersion: "1";
  poolId: string;
  challengeId: string;
  source: "BUILT_IN" | "COMMUNITY";
  funderId: Bytes32 | null;
  funderLabel: string;
  name: string;
  valueStatement: string;
  rule:
    | { type: "MAXIMIZE_METRIC"; metric: string }
    | {
        type: "MINIMIZE_QUALIFIED_COST";
        metric: "totalProcurementCost";
        minWorstCaseDeliveredKits: number;
        minRegionalFairnessPpm: number;
      }
    | { type: "FRONTIER_CONTRIBUTION" }
    | { type: "PROTECT_REGION"; regionId: string };
  ruleLabel: string;
  poolCredits: number;
  contextHash: Bytes32;
  status: "PRACTICE" | "COMMITTED";
  manifestHash: Bytes32;
};
```

The community-created pool in the current implementation is a Protect a Region Practice Pool. It allocates Practice credits only and does not increase the current Sepolia settlement amount.

## D. Outcome Metric and Normalization

```typescript
type OutcomeMetric = {
  key: string;
  name: string;
  direction: "MINIMIZE" | "MAXIMIZE";
  unit: string;
  lowerBound: number;
  upperBound: number;
};
```

Every metric is normalized into a range from 0 to 1,000,000. Values outside the declared bounds are clamped.

```text
MAXIMIZE:
  normalized = (value - lowerBound)
             / (upperBound - lowerBound)

MINIMIZE:
  normalized = (upperBound - value)
             / (upperBound - lowerBound)
```

The implementation multiplies the result by 1,000,000 and rounds it to an integer. Because the bounds change both hypervolume and rewards, they are not merely display settings. They are value judgments that must remain public.

## E. Dominance and Pareto Frontier

A correct Artifact A dominates B when A is no worse than B on every metric and strictly better on at least one.

```text
A dominates B
  iff
    correctness(A) = true
    and for every metric m: A[m] is no worse than B[m]
    and for at least one metric m: A[m] is strictly better than B[m]
```

Incorrect artifacts never enter the frontier. Frontier membership is computed over the complete field and stably sorted by result ID, so submission order cannot affect membership.

The current exact-hypervolume implementation is intended for settlement-sized frontiers with no more than six metrics.

## F. Contribution and Reward

```text
frontierExpansion[i]
  = max(0, HV(baseline + i) - HV(baseline))

exclusiveContribution[i]
  = max(0, HV(all results) - HV(all results without i))

eligibleWeight[i]
  = exclusiveContribution[i]
  × reproducibilityFactor[i]
  × evidenceFactor[i]

reward[i]
  = pool × eligibleWeight[i] ÷ Σ eligibleWeight[j]
```

Reward calculation uses integer parts per million. Incorrect artifacts and baselines receive an eligible weight of zero. After integer division, the remainder is distributed one unit at a time in descending eligible-weight order, with participant ID as the deterministic tie-breaker.

This formula is the rule of the Frontier Expansion Pool. Other Value Pools use different rules, including metric maximization, qualified cost minimization, and regional protection.

## G. Current Evaluator Specifications

### G.1 72-Hour Disaster Response

| Item | Current specification |
| --- | --- |
| Artifact | Strategy v2 JSON |
| Network | five suppliers, four routes, four regions |
| Scenarios | three public training + four committed instant-final |
| Outcomes | total cost, worst-case delivery, worst-region coverage |
| Evidence Level | 0 — Synthetic simulation |
| Result evidence | seven scenario outcomes, timeline, loss, delivery, cost, coverage |

### G.2 Calldata Compression

| Item | Current specification |
| --- | --- |
| Artifact | checked-in codec choice |
| Workload | repeated, mixed, and boundary transfer batches |
| Runtime | compiled Solidity bytecode in EthereumJS Cancun EVM |
| Outcomes | calldata gas, decoder execution gas |
| Correctness | matching digest, rejection of malformed input |
| Evidence Level | 0 — Synthetic simulation / Practice measurement |

### G.3 Microgrid Dispatch

| Item | Current specification |
| --- | --- |
| Artifact | dispatch configuration |
| Context | fixed, versioned scenario |
| Outcomes | cost, lifecycle carbon, worst-case delivered energy |
| Evidence Level | 0 — Synthetic simulation |

## H. Evidence and Settlement Chain

```text
Context Evidence
  datasetHash
  constraintHash
  metricsHash
  evaluatorVersion
        ↓
Result Evidence
  contextHash
  normalizedArtifact
  outcomeVector
  detailedMeasurements
        ↓
Value Pool Evidence
  valueStatement
  allocationRule
  budget
  contextHash
  manifestHash
        ↓
Settlement Evidence
  selectedResult
  poolAllocationBreakdown
  allocationRoot
  transaction
  event
```

## I. Ethereum Settlement Guarantees

The current contract identified as `FrontierRewardPool` enforces:

- one Allocation commitment per challenge;
- reserved rewards cannot exceed the pool balance;
- one wallet cannot receive the same challenge reward twice; and
- a participant skipped during batch distribution retains an individual claim path.

The contract name is a historical implementation identifier, not the product name.

Public evidence:

- [Allocation commitment](https://sepolia.etherscan.io/tx/0x96fd7a9d1f4a3bbd2fa7a9ea28d250a16e8eedbaff05b51a4f33e581c3839f2c)
- [RewardPaid](https://sepolia.etherscan.io/tx/0xd976a968aefeb66d7e60fba7a9cf64c8711195fc3652aeccc20c7448069ad708)

## J. Reproduction

Local repository verification:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test:ts
pnpm --filter @frontier/web build
```

Primary public API routes:

```text
GET  /v1/disaster-response
POST /v1/disaster-response/evaluations
GET  /v1/calldata-compression
POST /v1/calldata-compression/evaluations
GET  /v1/microgrid-dispatch
GET  /openapi.yaml
```

Calldata Compression Practice measurement:

```json
{ "codecId": "packed" }
```

## K. Trust and Threat Model

| Risk | Current treatment | Remaining work |
| --- | --- | --- |
| Result rewriting | Context, Result, and Allocation Evidence | independent attestations |
| Metric gaming | public constraints, versioned context, Hard Constraint gate | hidden final, adversarial workload |
| Submission order | full-field recalculation, stable sorting | verification at larger scale |
| Untrusted code | checked-in artifacts only | isolated arbitrary compilation |
| Sybil participation | account-bound demo paths | deployed uniqueness policy |
| Evaluator concentration | reproducible inputs and source | multi-runner threshold |
| Invalid social metric | explicit rule and context | participatory design, rights review |
| Reward dispute | public Sepolia event | dispute and slashing process |

## L. Explicit Non-Claims

As of September 9, 2026, Value Decentralization does not claim that:

- a production tournament has been completed;
- arbitrary participant code can be executed safely;
- the final workload remains completely hidden until a deadline;
- multiple runners have threshold-attested the result;
- a dispute and slashing process is operating;
- a Community Value Pool has added funding to the Sepolia reward;
- FDT and Practice credits are the same thing;
- FDT has monetary value;
- Ethereum automatically proves the correctness of the offchain evaluator; or
- simulation results prove real-world social effects.

## M. Document Provenance

- Whitepaper version: 1.0
- Last verified against implementation: September 9, 2026
- Current public application: [Value Decentralization](https://web-rho-seven-d6te7t3f0y.vercel.app)
