# Frontier Protocol Contracts

Foundry workspace for the deterministic order-book artifacts and protocol contracts. The deployment script now includes `FrontierDemoToken` and `FrontierRewardPool`; the pool commits one immutable result root and allocation per challenge, supports owner-triggered batch distribution, and leaves an individual claim path.

```bash
forge build --root packages/contracts
forge test --root packages/contracts
forge snapshot --root packages/contracts --snap .gas-snapshot
```

The Sepolia deployment script requires `DEPLOYER_PRIVATE_KEY` and `SEPOLIA_RPC_URL`. It deliberately deploys the allow-list identity adapter. The demo token is explicitly a Sepolia test asset with no monetary-value claim, and one million demo tokens are minted directly into the newly deployed reward pool.

After exporting a funded deployer key, RPC URL, and `ETHERSCAN_API_KEY` in the shell (or placing them in an ignored `packages/contracts/.env`), run `pnpm deploy:sepolia` from the repository root. Foundry writes the broadcast receipts under the ignored `broadcast/` directory; copy the public contract addresses and transaction hashes into deployment evidence before committing. Until that evidence exists, the web application must continue to show `Not funded` and must not claim that rewards were sent.
