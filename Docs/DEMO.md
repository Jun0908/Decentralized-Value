# Judge demo and recovery guide

The demo is product-first. Spend most of the time in the public application and never wait for an optional external service during judging.

## Before recording

```bash
pnpm demo:seed
pnpm demo:check
pnpm typecheck
pnpm test:ts
pnpm --filter @frontier/web build
```

Also confirm desktop and mobile layouts, clipboard access for reproduction commands, and zero browser-console errors.

## Four-minute flow

### 0:00-0:30 — What the protocol changes

Open the [public Top page](https://web-rho-seven-d6te7t3f0y.vercel.app).

> Most competitions combine cost, safety, and quality into one weighted score. Whoever chooses those weights quietly chooses the winner. Frontier keeps each value independent and rewards every correct solution that adds a useful tradeoff.

Point to the Sponsor -> Builder/Agent -> Evaluator -> Ethereum flow.

### 0:30-1:10 — Run the Ethereum proof

Press **Run the live EVM proof**. Show the reproduced Packed codec result:

- `8,200` calldata gas;
- `13,061` decoder execution gas;
- correctness `PASS`;
- `5.27%` frontier contribution.

Dictionary minimizes calldata gas while Packed minimizes decoder gas, so both remain rewardable. Standard ABI loses on both axes and is dominated. The evaluator ran real compiled Solidity bytecode under Cancun rules.

### 1:10-2:20 — Change a social solution

Open Emergency Supply, change the five supplier allocations while keeping the total at 1,000, and evaluate.

Show:

1. correctness;
2. total cost and worst-case delivered kits;
3. before/after frontier contribution;
4. all nine supplier/route failures;
5. context and result hashes;
6. the exact reproduction request.

Explain that the API recalculates the entered numbers; the screen is not selecting a precomputed artifact.

### 2:20-3:00 — Show multiple valuable winners

Run the Agent A/B/C replay. A is cheapest. B costs more but preserves more deliveries after a failure. C costs more than B and delivers less, so C is dominated. A and B divide practice credits according to exclusive contribution; C receives zero.

The replay is calculated from the complete set, so submission order cannot alter the result.

### 3:00-3:40 — Verify Ethereum settlement

Open the [allocation commitment](https://sepolia.etherscan.io/tx/0x96fd7a9d1f4a3bbd2fa7a9ea28d250a16e8eedbaff05b51a4f33e581c3839f2c) and [RewardPaid transaction](https://sepolia.etherscan.io/tx/0xd976a968aefeb66d7e60fba7a9cf64c8711195fc3652aeccc20c7448069ad708). Show the reward pool, demo token, block, events, and recipient balance evidence.

State clearly that this is a completed Sepolia demonstration payout, not a completed production tournament.

### 3:40-4:00 — Close

> Frontier does not crown one hidden-weight winner. It gives humans and agents the same measurable problem, preserves different useful tradeoffs, and rewards whoever expands what is possible.

## Safe claims

| You may say | Do not imply |
| --- | --- |
| The evaluator measures user input deterministically | Every arena accepts arbitrary untrusted code |
| Compiled Solidity runs in a Cancun EVM | The measurement itself happens onchain |
| The Sepolia demonstration reward was paid | A live production tournament has settled |
| Practice credits show contribution allocation | Practice credits are tokens |
| A wallet can sign the manifest | The signature is a tournament entry or payout approval |

## Recovery

| Failure | Recovery |
| --- | --- |
| Public deployment unavailable | Run `pnpm --filter @frontier/web build` and `pnpm --filter @frontier/web start` locally |
| Sepolia RPC or Explorer slow | Use the recorded deployment JSON and transaction links; do not redeploy during the demo |
| Optional ENS unavailable | Keep the fail-closed state visible and continue with the evaluator and reward proof |
| Bazantic gateway unavailable | Continue through the public same-origin API; the gateway is not the product critical path |
| Clipboard permission denied | Show the reproduction request on screen and copy it manually if needed |
| An evaluation fails | Restore the preloaded valid input and repeat under the same context |

The safe fallback is always a checked-in reproducible input plus the deterministic evaluator. Describe the resulting evidence precisely and never upgrade a local result into a live-integration claim.
