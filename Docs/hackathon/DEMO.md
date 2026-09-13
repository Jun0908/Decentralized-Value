# Public demo walkthrough

Start with [72-Hour Disaster Response](https://web-rho-seven-d6te7t3f0y.vercel.app/arenas/emergency-supply). This guide explains what a reviewer can inspect; video production scripts and editing notes are local-only.

## Evaluate a strategy

1. Choose a strategy and edit its supply or recovery settings.
2. Run Practice and inspect the disruption replay.
3. Compare cost, worst-case delivery and worst-region coverage independently.
4. Inspect the allocation previews for Efficiency, Resilience, Fairness and Frontier Expansion.
5. Open the evaluation evidence and inspect the context and result hashes.

Strategies are evaluated under a shared context. Pool previews demonstrate independent allocation rules; they are not automatic token payments. A strategy may lead on every axis—multiple winners are not required.

## Inspect recorded AI and payments

The [English Rescue demo](https://web-rho-seven-d6te7t3f0y.vercel.app/rescue-room/submission/en) presents recorded real Commander/specialist calls, a Sepolia service payment, simulated incident outcomes and Pool allocation previews. Opening the page starts no new inference or transfer.

The separate reward demonstration includes an [allocation commitment](https://sepolia.etherscan.io/tx/0x96fd7a9d1f4a3bbd2fa7a9ea28d250a16e8eedbaff05b51a4f33e581c3839f2c) and [RewardPaid transaction](https://sepolia.etherscan.io/tx/0xd976a968aefeb66d7e60fba7a9cf64c8711195fc3652aeccc20c7448069ad708). FDT and rUSD-DEMO are demonstration tokens without claimed monetary value; practice credits are separate.

## Inspect sponsor integrations

Open the [sponsor evidence page](https://web-rho-seven-d6te7t3f0y.vercel.app/sponsors/demo) for ENSv2 permission transactions, official CRE local simulation and external AI using Bazantic MCP. The [sponsor guide](sponsors/SPONSOR_DEMO.md) links source code, execution evidence and reproduction commands.

## Reproduce and recover

- Recalculate recorded Rescue outcomes without API keys or payments: `pnpm verify:rescue:submission-replay`.
- If the public application is unavailable, use the [local setup guide](../development/guides/ENVIRONMENT.md).
- If an explorer or optional integration is unavailable, inspect the [recorded evidence](../evidence/README.md). Do not repeat transactions merely to display a demo.
- Check [STATUS](../STATUS.md) for the implementation boundary and dated verification results.

[Submission overview](README.md) · [Documentation home](../README.md)
