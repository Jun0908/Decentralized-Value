# Ethereum Calldata Compression Frontier

**Status:** Active deterministic practice-arena specification. Tournament-layer limits are tracked in [`../STATUS.md`](../../STATUS.md).

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

## Editable rule Practice workbench

The web workbench accepts a bounded `calldata-rules-v1` artifact. Zero to four ordered rules choose a checked-in codec from the batch action count and recipient reuse percentage; the first matching rule wins. A fallback codec handles every remaining batch. Reuse is `(action count - unique recipients) / action count`, with address equality normalized to lowercase. Threshold comparisons use integer cross multiplication, not rounded display percentages.

```json
{
  "kind": "calldata-rules-v1",
  "schemaVersion": "1",
  "fallbackCodec": "packed",
  "rules": [
    {
      "minActions": 4,
      "maxActions": 255,
      "minReusePercent": 50,
      "codecId": "dictionary"
    }
  ]
}
```

The internal web endpoint `POST /api/calldata-lab` takes exactly `{ artifact, contextId }`. It accepts JSON up to 16 KiB, rejects unknown fields and contexts, and permits only the three fixed codec IDs, integer action bounds 1–255, and integer reuse thresholds 0–100. Each request reruns the public batches and all three reference policies in a local Cancun EVM. It does not cache arbitrary artifact keys.

The starter chooses Dictionary / Packed / Dictionary for repeated / mixed / boundary batches in `public-transfer-mix`. Its measured payload is **459 bytes**, with **5,172 calldata gas** and **17,185 decoder gas**. The same-context ABI reference is 14,112 / 19,590 gas. These are independent measurements, not a combined score or a claim that this starter is optimal over all possible artifacts.

Rule selection and encoding happen on the host. The selected checked-in decoder is called directly, so host selection cost, host encoding cost, and an onchain format-dispatch cost are not measured. There is no onchain dispatcher. The UI shows actual per-batch choices, original actions, exact encoded payload, byte-price arithmetic, returned/reference digest, published malformed-test results, same-context reference comparisons, and an in-memory previous-revision comparison. Switching contexts clears the revision comparison. Editing a rule labels the older displayed result as the last measured revision until another run completes.

The workbench exports the current artifact and the complete `calldata-rule-evidence-v1` result as JSON. Evidence includes artifact/context/result hashes, encoded bytes, per-batch decisions, reference runs, two gas axes, and correctness gates. It is a reproducible Practice snapshot; it is not a persisted submission, signed attestation, onchain commitment, or payout.

The rule lab uses a separate `calldata-rule-lab-v1` context hash committing the workload, compiler, actual runtime bytecode hashes, EVM version, rule/encoding semantics, metric definitions, explicit exclusions, and exact malformed corpus. Its corpus covers empty, short, truncated payloads, plus an out-of-range Dictionary index. It is bounded rather than exhaustive validation of all invalid byte strings. The original reference evaluator and `/v1/calldata-compression` API context/result hashes are unchanged.

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
