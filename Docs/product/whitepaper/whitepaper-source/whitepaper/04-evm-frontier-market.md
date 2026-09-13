# 4. Current Demonstrations

{% hint style="success" %}
**Current Implementation**

This chapter documents functionality that can be inspected in the public application or repository as of September 9, 2026. Future plans are separated into the [Roadmap](09-protocol-and-roadmap.md) and [Technical Appendix](appendix.md).
{% endhint %}

Value Decentralization currently uses three different contexts—a social strategy, an Ethereum engineering tradeoff, and an energy-allocation problem—to experiment with Shared Evidence and independent outcomes.

## 4.1 72-Hour Disaster Response

This is the primary social demonstration. A participant creates a small, inspectable Strategy v2 JSON artifact for a network of five suppliers, four transport routes, and four regions.

The evaluator runs three public training scenarios and four instant-final scenarios committed in advance by hash. The current demo reveals those final scenarios immediately in the submission response. It demonstrates reproducible judging, not a scheduled hidden tournament.

### Independent outcomes

| Outcome | Direction | Meaning |
| --- | --- | --- |
| 72-hour procurement cost | Minimize | Highest spend observed across the evaluated scenarios |
| Worst-case delivery | Maximize | Fewest kits delivered in any scenario |
| Worst-region coverage | Maximize | Lowest demand coverage received by any region |

The evaluator never converts these outcomes into one weighted total.

### What the strategy chooses

- normal supplier priority;
- emergency supplier priority after disruption;
- regional dispatch policy;
- kits reserved across backup routes; and
- emergency recovery budget.

### Evidence

The Context Hash commits to the network, training scenarios, final-scenario commitment, constraints, metrics, and evaluator version. The Result Hash covers the normalized strategy and the outcomes of all seven scenarios.

Each outcome includes the disruption, shipment timeline, lost inventory, delivered kits, cost, and per-region coverage. The replay trace shown in the UI is derived deterministically from the same simulation, but is excluded from canonical JSON to preserve compatibility with the existing Result Hash.

[Open 72-Hour Disaster Response](https://web-rho-seven-d6te7t3f0y.vercel.app/arenas/emergency-supply)

## 4.2 Ethereum Calldata Compression

This demonstration evaluates a real Ethereum engineering tradeoff. Sending fewer bytes reduces calldata cost, but more sophisticated encoding may increase decoder execution gas.

| Codec | Calldata | Decoder | Position |
| --- | --- | --- | --- |
| Standard ABI | Large and padded | Simple | Dominated on both axes |
| Fixed-width Packed | Small | Lowest decoder gas | Remains on the frontier |
| Address Dictionary | Lowest calldata gas | More complex than Packed | Remains on the frontier |

The public demonstration reproduces the following result for the Packed codec:

| Calldata gas | Decoder gas | Correctness | Frontier contribution |
| ---: | ---: | :---: | ---: |
| 8,200 | 13,061 | PASS | +5.27% |

The Solidity decoder is compiled with solc 0.8.36, optimizer runs 200, metadata bytecode disabled, and Cancun as the EVM target. Its runtime bytecode executes inside EthereumJS EVM. The evaluator measures EVM execution gas, not CPU time or browser speed.

[Open Calldata Compression](https://web-rho-seven-d6te7t3f0y.vercel.app/arenas/calldata-compression)

## 4.3 Community Microgrid Dispatch

This demonstration independently measures three outcomes within a fixed, versioned scenario:

- minimize energy cost;
- minimize lifecycle carbon; and
- maximize worst-case delivered energy.

It uses different inputs and an arena-specific evaluator, while reusing the shared concepts of Context, Outcome, Pareto, Contribution, and Evidence.

[Open Microgrid Dispatch](https://web-rho-seven-d6te7t3f0y.vercel.app/arenas/microgrid-dispatch)

## 4.4 Historical Prototype: Parallel Orderbook

The Orderbook Arena comparing gas efficiency and parallel throughput was an early prototype used while developing the idea. It is not the current main demonstration.

Its parallel-throughput axis is a declared simulation, not observed chain throughput. References in earlier material to a 5,000 USDC pool, three-runner threshold signatures, runner bonds and slashing, a Challenge Manager, or artifact royalties are not evidence of functionality in the current public demo.

## 4.5 Current evidence level

All three public arenas are classified as Evidence Level 0. They are simulations or practice measurements with deterministic fixtures, evaluator versions, and Result Hashes.

The current system does not claim to provide:

- isolated execution of arbitrary untrusted source code;
- participant uniqueness through World ID or another deployed mechanism;
- a scheduled hidden-final round;
- a deadline scheduler or automatic entry lock;
- multi-runner threshold attestations;
- a dispute and slashing process; or
- a mainnet token or a token with monetary-value claims.

{% hint style="warning" %}
An executable demo, a recorded Sepolia payment, and a completed production tournament are three different claims.
{% endhint %}
