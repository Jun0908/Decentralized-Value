# Architecture and trust boundaries

Frontier Protocol separates public competition rules, deterministic measurement, identity, and settlement. Missing external evidence remains visible instead of being replaced with a convincing fixture.

## System flow

```text
Sponsor
  challenge manifest
    - dataset and evaluator version
    - hard constraints
    - independent metrics and directions
    - public/final context commitment
    - reward configuration
             |
             v
Builder or AI agent -> solution -> Frontier API -> deterministic evaluator
                                                   - correctness gate
                                                   - independent outcomes
                                                   - Pareto membership
                                                   - frontier contribution
                                                   - context/result hashes
                                                             |
                                                             v
                                                  reward allocation root
                                                             |
                                                             v
                                                  FrontierRewardPool
                                                   - commitAllocation
                                                   - distribute
                                                   - claim fallback
```

## Deterministic evaluation

Every arena commits the data, constraints, metrics, evaluator version, and execution settings into a context hash. A result hash covers the context, submitted solution, measured outcomes, correctness evidence, and frontier result. Timestamps and request-specific randomness are excluded.

Emergency Supply enumerates nine failure cases for every allocation. Calldata Compression executes compiled Solidity runtime bytecode in a local Cancun EVM. Microgrid Dispatch evaluates three axes with a fixed versioned scenario. New problem shapes require their own adapter and tests but use the same outcome, Pareto, contribution, and evidence types.

## Why computation is offchain

Arena-specific evaluation can require exhaustive scenarios, compiler execution, or an EVM. Keeping this work offchain is cheaper and makes new evaluators practical. Reproducible inputs, versioned contexts, and hashes allow another runner to repeat the measurement.

## Why settlement is on Ethereum

Ethereum prevents a single operator from silently rewriting a final reward allocation after the competition ends and exposes reward events to every participant. `FrontierRewardPool` enforces:

- one allocation commitment per challenge;
- reserved rewards cannot exceed the pool balance;
- a wallet cannot receive the same challenge reward twice;
- a participant skipped by batch distribution retains an individual claim path.

The Sepolia path is a demonstration settlement using a token with no monetary-value claim.

## Evidence chain

```text
dataset + evaluator + constraints + metrics
                    -> context hash
context hash + submitted solution + measurements
                    -> result hash
final results + reward calculation
                    -> allocation root
allocation root + reward transfer
                    -> Sepolia transactions and events
```

Changing an allocation changes its result hash. Changing data, constraints, metrics, or evaluator settings changes the context hash. The UI shows a live payment only when valid public addresses, transaction hashes, blocks, events, and balance evidence are configured.

## Web application structure

The primary user journey is:

1. `/` explains the protocol and presents a working Ethereum proof.
2. `/arenas` lists competitions from the shared Arena Registry.
3. `/arenas/[slug]` combines a common challenge shell with an arena-specific workbench.
4. Practice results show correctness, outcomes, Pareto status, contribution, and reproducibility evidence.
5. `/participate/[id]` exposes an explicitly ephemeral submission sandbox.

`apps/web/src/lib/arenas.ts` is the source of display metadata. `apps/web/src/lib/arena-adapters.tsx` maps an evaluator kind to its workbench and manifest loader. An unknown evaluator fails closed. Microgrid proves that Pareto membership and contribution can use all metrics while the chart projects any two axes.

Development and legacy surfaces such as `/arena`, `/artifact/*`, `/runners`, and `/sponsor-debug` are not part of the primary user navigation.

## Runtime layout

```text
apps/web                      Next.js UI and same-origin HTTP routes
apps/api                      reusable API handlers
apps/runner                   evaluation and attestation boundary
packages/shared               schemas, hashing, Pareto, contribution
packages/emergency-supply     allocation scenario and evaluator
packages/calldata-compression codecs, compiler output, EVM evaluator
packages/microgrid-dispatch   three-axis evaluator
packages/contracts            Foundry contracts and deployment scripts
packages/ens-adapter          optional ENS discovery/authorization boundary
packages/ledger-adapter       archived optional hardware boundary
openapi/frontier-v1.yaml      public API source of truth
```

## Current trust boundaries

- Deterministic evaluator behavior is covered by unit and API tests.
- The `/v2/sandbox` store is process-local memory and resets on restart or serverless cold start.
- Privy can establish a browser-wallet session without a raw-message signature; the session does not create a final onchain entry.
- World ID uniqueness, arbitrary source isolation, and hidden final evaluation are not configured.
- Sepolia reward funding, allocation commitment, payout, and balance evidence are complete for the demonstration path.
- ENS and Bazantic are optional integration boundaries, not prerequisites for the public demo.
- Ledger is not used by the public demo or reward path.

The same high-level flow is available as an accessible page at `/architecture` in the web application.
