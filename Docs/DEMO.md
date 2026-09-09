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

Open **Ethereum Calldata Compression**, then press **Measure this codec**. Show the reproduced Packed codec result:

- `8,200` calldata gas;
- `13,061` decoder execution gas;
- correctness `PASS`;
- `5.27%` frontier contribution.

Dictionary minimizes calldata gas while Packed minimizes decoder gas, so both remain rewardable. Standard ABI loses on both axes and is dominated. The evaluator ran real compiled Solidity bytecode under Cancun rules.

### 1:10-2:30 — Build and break a disaster-response strategy

Open **72-Hour Disaster Response**. Pause on the first illustration: suppliers and routes are on the left, a disaster breaks part of the network, and aid must still reach every region on the right.

Choose a preset, change the recovery budget or regional priority, then press **Run practice simulation**. The worst scenario opens automatically and reaches the result in about 15 seconds. Let the replay show:

For a first-time walkthrough, select one optional learning mission—low cost, disaster resilience, regional fairness, or frontier exploration—and point out the **Practice only / no reward effect** label. The mission reports progress but never changes the evaluator or Value Pool allocation.

1. the exact starting loadout and recovery vault;
2. the broken route and lost inventory;
3. the replacement suppliers and recovery spend;
4. all four region outcomes, maximum scenario cost, worst-case delivery, and worst-region coverage.

Use **Replay** only if the judge asks. Open **Verify committed evaluation evidence** to show the context, committed final-scenario, and result hashes.

Explain that the evaluator executes the submitted Strategy v2 against three public training and four committed instant-final scenarios. It is not selecting a precomputed result.

If the judge asks about Agents, download the Starter Kit and point to `evaluation-contract.json`, `baseline-agent.mjs`, and `agent-submission.example.json`. Human and Agent entries use the same endpoint, context, evaluator, and limits. Agent name/version/objective are stored as provenance, while only measured outcomes affect support.

### 2:30-3:10 — Show decentralized value

Before submission, point to the four Value Pools. Different funders publicly support resilience, efficiency, fairness, and frontier expansion; there is no overall score or overall winner.

In **Value Allocations**, show that `Resilience Mesh`, `Budget Sprint`, and `Fair Reach` receive different pools at the same time. The Frontier Expansion Pool splits proportionally across positive exclusive contributions. If time allows, sign in and add a **Protect Highland Clinic** practice pool to show how a new public value changes who receives support without changing the evidence or creating a global ranking.

Then submit and select a Final Entry. The complete field is recalculated together, so submission order cannot change frontier membership or pool allocation.

### 3:10-3:45 — Verify Ethereum settlement

Open the [allocation commitment](https://sepolia.etherscan.io/tx/0x96fd7a9d1f4a3bbd2fa7a9ea28d250a16e8eedbaff05b51a4f33e581c3839f2c) and [RewardPaid transaction](https://sepolia.etherscan.io/tx/0xd976a968aefeb66d7e60fba7a9cf64c8711195fc3652aeccc20c7448069ad708). Show the reward pool, demo token, block, events, and recipient balance evidence.

State clearly that this is a completed Sepolia demonstration payout, not a completed production tournament.

### 3:45-4:00 — Close

> Frontier does not crown one hidden-weight winner. It gives humans and agents the same measurable problem, preserves different useful tradeoffs, and rewards whoever expands what is possible.

## Safe claims

| You may say | Do not imply |
| --- | --- |
| The evaluator measures user input deterministically | Every arena accepts arbitrary untrusted code |
| Compiled Solidity runs in a Cancun EVM | The measurement itself happens onchain |
| The Sepolia demonstration reward was paid | A live production tournament has settled |
| Practice credits show contribution allocation | Practice credits are tokens |
| A community Value Pool changes practice allocation | The community pool funded or changed the Sepolia payout |
| A wallet can connect through Privy | The connection is a tournament entry or payout approval |
| The instant demo reveals a precommitted final scenario set | A scheduled hidden-final tournament has run |
| Secret Gate generates a real Semaphore proof in the browser and verifies it offchain | The proof was verified on Ethereum or establishes a real identity |

## Optional Secret Gate walkthrough

After the primary demo, open **Secret Gate** and create a disposable identity. Explain that the secret remains in the browser and only its commitment joins an eight-member synthetic group snapshot. Create the snapshot, press **Prove and enter**, and show the offchain verification receipt. Press it again to demonstrate nullifier replay rejection.

The personal-device benchmark runs real proofs but is not an official competition result. The first controlled feasibility run was a `PIVOT`, so do not describe the latency-memory frontier or proposed Value Pools as settled competition evidence.

## Recovery

| Failure | Recovery |
| --- | --- |
| Public deployment unavailable | Run `pnpm --filter @frontier/web build` and `pnpm --filter @frontier/web start` locally |
| New disaster-response UI fails during judging | Open `/arenas/emergency-supply-classic`; the Classic competition is preserved independently |
| Sepolia RPC or Explorer slow | Use the recorded deployment JSON and transaction links; do not redeploy during the demo |
| Optional ENS unavailable | Keep the fail-closed state visible and continue with the evaluator and reward proof |
| Bazantic gateway unavailable | Continue through the public same-origin API; the gateway is not the product critical path |
| Clipboard permission denied | Show the reproduction request on screen and copy it manually if needed |
| An evaluation fails | Restore the preloaded valid input and repeat under the same context |

The safe fallback is always a checked-in reproducible input plus the deterministic evaluator. Describe the resulting evidence precisely and never upgrade a local result into a live-integration claim.
