# Ethereum Calldata Compression Frontier

**Status:** Active deterministic practice-arena specification. Tournament-layer limits are tracked in [`../STATUS.md`](../STATUS.md).

`calldata-compression-v1` is a deterministic practice arena for a real Ethereum tradeoff: sending fewer bytes lowers transaction calldata cost, while a more sophisticated encoding can require more EVM gas to decode.

## Public workload

Every codec receives the same versioned workload, `transfer-batches-2026-09-v1`:

- Repeated recipients: 10 actions over two addresses
- Mixed recipients: 6 actions over six addresses
- Boundary values: zero, maximum `uint64`, maximum `uint32`, and repeated addresses

Each action contains a recipient address, `uint64` amount, and `uint32` nonce. The reference result is an iterative state digest over all decoded actions. A codec fails correctness if any digest differs or if its decoder accepts the published malformed input.

The scenario and already measured comparison points are returned by:

```text
GET /v1/calldata-compression
```

## Reference codecs

- Standard ABI uses Solidity ABI tuple-array encoding. It is padded and easy to decode.
- Fixed-width packed stores each action in 32 bytes with no ABI offsets or word padding.
- Address dictionary stores each unique address once and uses one-byte indexes in actions.

These are checked-in reference implementations for the practice UI. Arbitrary participant source compilation and sandboxing remain a separate tournament-layer feature.

## Correctness hard gate

- Every encoded batch must execute without reverting.
- Every returned state digest must equal the reference digest.
- Empty or malformed encodings must revert.
- The compiler, optimizer, runtime bytecode, EVM revision, and workload are committed by the context hash.
- A failing codec cannot enter the Pareto frontier regardless of its gas values.

## Measured axes

### Calldata gas — minimize

Only the encoded payload is counted. Each zero byte costs 4 gas and each non-zero byte costs 16 gas under EIP-2028. The evaluator records zero bytes, non-zero bytes, encoded length, and gas for every batch before summing them.

### Decoder execution gas — minimize

The checked-in Solidity contracts are compiled with solc 0.8.36, optimizer runs 200, metadata bytecode disabled, and Cancun as the EVM target. The evaluator calls `decodeAndExecute(bytes)` by executing the compiled runtime bytecode in EthereumJS EVM with Cancun rules and sums the EVM-reported `executionGasUsed`.

Transaction base gas, calldata intrinsic gas, and deployment gas are excluded from this second axis. This prevents counting calldata twice and isolates the cost of decoding and applying the prescribed digest operation.

CPU time, browser speed, RPC estimation, and network conditions are not scoring inputs.

## Reproducibility

The context hash covers the workload, compiler settings, EVM revision, codecs, and calldata pricing rule. The result hash covers that context, per-batch byte counts, EVM gas, output digests, correctness checks, and Pareto result. Timestamps are excluded.

Submit a practice measurement with:

```json
{ "codecId": "dictionary" }
```

```text
POST /v1/calldata-compression/evaluations
```

This endpoint performs a real local EVM measurement. It does not claim participant source isolation, hidden final evaluation, signed attestation, World ID registration, Sepolia settlement, or token transfer.
