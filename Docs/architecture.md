# Frontier Protocol architecture

Frontier Protocol separates public competition rules, deterministic measurement, identity, and settlement. The public demo keeps missing external evidence visible instead of replacing it with a fixture.

```text
Sponsor
  └─ challenge manifest
       ├─ dataset hash
       ├─ constraint hash
       ├─ metrics hash
       └─ public/final context commitment
                ↓
Builder or AI Agent → solution input → Frontier API → deterministic evaluator
                                                     ├─ correctness
                                                     ├─ independent metrics
                                                     ├─ failure evidence
                                                     ├─ Pareto contribution
                                                     └─ result hash
                                                              ↓
                                              reward allocation root
                                                              ↓
                                      Sepolia FrontierRewardPool
                                            ├─ commitAllocation
                                            ├─ distribute
                                            └─ claim fallback
```

## Why computation is offchain

Emergency Supply enumerates nine failure cases for every submitted allocation. Calldata Compression executes compiled Solidity decoder bytecode in a local Cancun EVM. Performing these evaluations offchain is cheaper and makes new arena-specific evaluators practical. Deterministic inputs, evaluator versions, and hashes let another party reproduce the same result.

## Why settlement is on Ethereum

Ethereum is not used as decorative storage. It prevents the operator from rewriting a final allocation after the competition ends and exposes reward events to every participant. `FrontierRewardPool` enforces four settlement invariants:

- One allocation commitment per challenge.
- Reserved rewards cannot exceed the token balance held by the pool.
- A wallet cannot receive the same challenge reward twice.
- A participant skipped by batch distribution retains an individual claim path.

The demo token is a Sepolia-only asset with no monetary-value claim.

## Evidence chain

```text
dataset + constraints + metrics
             ↓
        context hash + solution
             ↓
          result hash
             ↓
       allocation root
             ↓
   Sepolia transaction + events
```

A changed allocation changes the result hash. A changed dataset, constraint, or metric changes the context/manifest commitment. A live payment is shown only when valid public contract addresses, transaction hash, and block number are configured.

## Current trust boundaries

- The evaluator is deterministic and covered by unit/API tests.
- The `/v2/sandbox` participant store is ephemeral memory; it is not tournament-ready durable storage.
- The optional browser signature proves wallet intent for a manifest but does not create a final onchain entry.
- World ID uniqueness and a hidden final workload are unconfigured.
- `FrontierRewardPool` and `FrontierDemoToken` are implemented and tested. The 2026-09-07 Sepolia demo completed funding, allocation commitment, payout, and recipient balance verification; its public record is `Docs/deployments/sepolia-reward-demo.json`.
- ENS and Bazantic are optional integration boundaries, not prerequisites for the public user demo.
- The archived Ledger adapter is not used by the public demo or reward path.

The same diagram is available as an accessible page at `/architecture` in the web application.
