# Orderbook Artifacts

The four comparable implementations live in `packages/contracts/src/orderbook` and share `IOrderBook` plus one hard-constraint reference model:

- `PackedBook` packs each order into one word but mutates one global sequence, trading low gas for global contention.
- `FrontierBook` packs orders and distributes the sequence across four shards.
- `ShardedBook` scopes mutable state by market and uses a wide struct, trading higher gas for maximum modeled parallelism.
- `BadBook` intentionally drops the amount field. It is a negative control that must fail correctness and never reach the frontier.

`benchmarks/evm-orderbook/results/latest.json` is the generated machine-readable comparison. See the [archived benchmark methodology](../../Docs/archive/legacy/orderbook-benchmark-methodology.md) for the real-EVM/simulation boundary. This order-book arena is a legacy technical sample, not the current product proof.
