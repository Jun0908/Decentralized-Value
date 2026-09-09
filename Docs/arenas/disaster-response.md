# 72-Hour Disaster Response

`disaster-response-v2` is the primary social demo competition. The participant submits a small, inspectable Strategy v2 JSON artifact rather than five allocation numbers.

## Mission

Keep four regions supplied for 72 hours while ports, roads, rail routes, and suppliers can fail. A strategy chooses:

- primary supplier priority;
- emergency supplier priority after disruption;
- regional dispatch policy;
- kits reserved across backup routes;
- emergency recovery budget.

The evaluator uses five suppliers, four transport routes, four regions, three public training scenarios, and four final scenarios. The final set is committed by hash before evaluation and disclosed immediately in this instant demo. This is reproducible judging, not a scheduled hidden tournament.

## Independent outcomes

| Outcome | Direction | Meaning |
| --- | --- | --- |
| 72-hour procurement cost | Minimize | Maximum spend observed across the evaluated scenarios |
| Worst-case delivery | Maximize | Fewest kits delivered in any scenario |
| Worst-region coverage | Maximize | Lowest demand coverage received by any region in any scenario |

No weighted total combines these outcomes.

## Independent Value Pools

The arena has no overall score or overall winner. Four built-in funders publish independent rules and commit 2,500 FDT demo credits each:

- **Global Relief Fund:** highest worst-case delivered kits.
- **Donor Efficiency Pool:** lowest total cost among correct strategies.
- **Local Communities Pool:** highest worst-region coverage.
- **Frontier Expansion Pool:** proportional allocation across every strategy with positive exclusive frontier contribution.

The reference field deliberately demonstrates different recipients: `Resilience Mesh` receives the resilience allocation, `Budget Sprint` receives the efficiency allocation, and `Fair Reach` receives the fairness allocation. The frontier pool can split its budget across several strategies. Exact metric ties split a pool deterministically, and all allocations remain bounded by that pool's budget.

An authenticated user may also publish one **Protect a Region** practice pool. It maximizes that region's minimum coverage across all seven scenarios using existing evidence. Community pools allocate practice credits only and never increase the Sepolia settlement amount.

## Reproducibility and evidence

The context hash commits to the network, training scenarios, final-scenario commitment, constraints, metrics, and evaluator version. The result hash covers the normalized strategy and all seven scenario outcomes. Each outcome contains the disruption, shipment timeline, lost inventory, delivered kits, cost, and per-region coverage.

Every Value Pool has a canonical manifest hash covering its funder label, value statement, rule, budget, and context. Settlement evidence commits the selected result and committed pool-allocation breakdown together. The current demo pays the participant's committed total from one shared Sepolia reward path; it does not claim that four independently funded contracts exist.

Each outcome also returns a deterministic `replayTrace` with exact purchase batches, arrival hours, lost shipments, recovery purchases, budget use, and regional deliveries. The UI uses that trace for a 15-second autoplay of the worst scenario; the six other scenarios remain selectable. `replayTrace` is a presentation derivative of the same simulation and is excluded from the canonical JSON used by the existing result hash, preserving compatibility with prior evidence.

## API

```text
GET  /v1/disaster-response
POST /v1/disaster-response/evaluations
GET  /v1/challenges/disaster-response/starter-kit
POST /v1/challenges/disaster-response/join
POST /v1/challenges/disaster-response/value-pools
POST /v1/challenges/disaster-response/submissions
PUT  /v1/challenges/disaster-response/final-entry
GET  /v1/challenges/disaster-response/leaderboard
POST /v1/challenges/disaster-response/demo-settlement
```

The Plan 5 Classic arena remains independent at `/arenas/emergency-supply-classic`; its API and evaluator are unchanged.
