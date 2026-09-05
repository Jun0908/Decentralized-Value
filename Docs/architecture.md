# Architecture

Frontier Protocol separates deterministic measurement from identity, signing, settlement, and presentation.

```text
Artifact → Frontier API → ENSv2 discovery → hosted runner
              ↓                              ↓
        async job store             correctness → benchmark
                                             ↓
Bazantic 402/MPP gateway ← API ← Ledger EIP-712 signature
                                             ↓
                                  Sepolia ParetoSettlement
                                             ↓
                                      Next.js web app
```

The benchmark fixture is the local read model. The current MVP intentionally uses an in-memory API job store: it is deterministic and adequate for the demo, but process restarts clear newly submitted artifacts and jobs. On-chain registries are the authority for deployed identities and attestations. A production indexer should replay contract events into durable Postgres storage keyed by chain ID, contract address, block hash, and log index.

Trust boundaries:

- API validates JSON and creates idempotent asynchronous jobs; it never chooses a hard-coded runner.
- ENSv2 is the live runner identity and endpoint directory. Malformed, inactive, non-HTTPS, or capability-mismatched entries fail closed.
- Runner verifies immutable hashes, gates metrics on correctness, and signs only after scoped credential provisioning succeeds.
- Ledger DMK owns the attestation signing operation; Wallet CLI Key Ring protects the hosted submit credential.
- Contracts recover and authorize the signer, reject replay, and maintain the two-dimensional frontier.
- Privy is restricted to end-user login/wallet interactions; it is not a runner signer.

All displayed benchmark numbers originate in `benchmarks/evm-orderbook/results/latest.json`. Missing external evidence is rendered as unavailable, never replaced by a fixture.
