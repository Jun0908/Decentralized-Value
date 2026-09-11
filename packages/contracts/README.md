# Frontier Protocol Contracts

Foundry workspace for the deterministic order-book artifacts and protocol contracts. The deployment script now includes `FrontierDemoToken` and `FrontierRewardPool`; the pool commits one immutable result root and allocation per challenge, supports owner-triggered batch distribution, and leaves an individual claim path.

```bash
forge build --root packages/contracts
forge test --root packages/contracts
forge snapshot --root packages/contracts --snap .gas-snapshot
```

The Sepolia deployment script requires `DEPLOYER_PRIVATE_KEY` and `SEPOLIA_RPC_URL`. It deliberately deploys the allow-list identity adapter. The demo token is explicitly a Sepolia test asset with no monetary-value claim, and one million demo tokens are minted directly into the newly deployed reward pool.

After exporting a funded deployer key, RPC URL, and `ETHERSCAN_API_KEY` in the shell (or placing them in an ignored `packages/contracts/.env`), run `pnpm deploy:sepolia` from the repository root. Foundry writes the broadcast receipts under the ignored `broadcast/` directory; copy the public contract addresses and transaction hashes into deployment evidence before committing. Until that evidence exists, the web application must continue to show `Not funded` and must not claim that rewards were sent.

## Rescue Room service payments

`RescueUSDDemo` and `RescueServiceEscrow` form a separate Sepolia-only showcase. The token uses six decimals and the symbol `rUSD-DEMO`; it has no monetary value or USD redemption claim. The escrow binds each payment to an Episode context, Commander Action, curated Service manifest, deliverable, receipt, and acceptance hash. It enforces a 50-token Order ceiling and a 100-token Episode ceiling in both the deployment script and contract constructor.

`pnpm deploy:rescue-payments:sepolia` additionally requires public addresses in `RESCUE_COMMANDER_WALLET`, `RESCUE_POLICY_EXECUTOR`, `RESCUE_DELIVERY_ATTESTOR`, and the six `RESCUE_*_AGENT_WALLET` variables referenced by `DeployRescuePayments.s.sol`. Deployment is an external transaction: do not run it until those roles are intentionally assigned and the Sepolia funding scope is approved. The deployment script deliberately cannot approve tokens from the Commander wallet; the later Policy Executor must submit an exact, Episode-bounded allowance instead of an unlimited approval. A successful broadcast alone is not `paid` evidence; deposit, delivery, release, event, and provider balance evidence must also be recorded.
