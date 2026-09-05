# Frontier Protocol Contracts

Foundry workspace for the deterministic order-book artifacts and the Phase 2 protocol contracts.

```bash
forge build --root packages/contracts
forge test --root packages/contracts
forge snapshot --root packages/contracts --snap .gas-snapshot
```

The Sepolia deployment script requires `DEPLOYER_PRIVATE_KEY` and `SEPOLIA_RPC_URL`. It deliberately deploys the Phase 2 allow-list identity adapter; the ENSv2-backed adapter replaces this boundary in Phase 3.

After adding a funded deployer key, RPC URL, and `ETHERSCAN_API_KEY` to an ignored local environment file, run `pnpm deploy:sepolia`. Foundry writes the broadcast receipts under the ignored `broadcast/` directory; copy the public contract addresses and transaction hashes into deployment evidence before committing.
