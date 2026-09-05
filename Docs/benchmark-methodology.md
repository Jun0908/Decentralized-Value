# Order-book Benchmark Methodology

## Reproducible context

`orderbook-v1` places 32 orders across eight deterministic markets. All implementations receive the same side, price, amount, caller, ordering, Solidity version, optimizer flags, and EVM revision. The checked-in result records the source commit, compiler settings, deployed-bytecode hash, context hash, workload version, repetition count, and timestamp.

Run it with:

```bash
pnpm benchmark:orderbook
```

## Measurement boundary

- `gasPerOrder` is real EVM execution gas. A Foundry test records `gasleft()` around the 32 placement calls. The benchmark runs five fresh deterministic Foundry executions and keeps the median.
- `parallelThroughput` is a deterministic contention simulation, not wall-clock EVM throughput. The harness derives scheduling lanes from storage design: one global lane for `PackedBook`, four lanes for `FrontierBook`, and one lane per market for `ShardedBook`. It schedules one operation per lane per wave and scales effective parallelism by the declared reference rate of 100 operations/second/lane.
- The 100 operations/second/lane rate is an explicit normalization assumption. It makes relative contention visible; it is not a claim about a specific production chain, machine, or parallel EVM.
- `correctness` is a hard constraint checked against the reference model before Pareto computation. Metrics for `BadBook` are preserved as diagnostic evidence but are never eligible for the frontier.

The throughput model is deliberately small and versioned. Replacing it with a real parallel-EVM runner requires a new workload/context hash so historical attestations cannot silently change meaning.
