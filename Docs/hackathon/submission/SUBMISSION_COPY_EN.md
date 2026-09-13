# Submission copy — English draft

Draft only. Do not submit until the owner confirms the event track, eligible development period, contribution statement, final commit, and public links.

Updated September 13, 2026. Technical claims below reflect recorded execution, not prize eligibility. Sponsor selection requested by the owner: ENS, Chainlink, and Bazantic.

## Project title

Value Decentralization — Shared Evidence, Independent Values

## Short description

An AI incident commander hires a specialist AI and pays it on Sepolia. Their recorded actions produce reproducible outcomes that independent Value Pools can support without collapsing every value into one weighted score.

## What it does

Who gets to decide what “better” means?

Value Decentralization separates shared measurement from value judgment. Rescue Room demonstrates this with an incident-response game for a fictional Ethereum protocol. An AI Commander sees incomplete information, hires a specialist, receives an analysis, and pays through a testnet escrow.

Our recorded demonstration returns that purchased analysis to the Commander for three follow-up decisions. The simulator measures user losses, protocol demand served, and response spending independently. Separate pool previews allocate support using their own metric.

The AI does not automatically win. In the recorded episode, doing nothing outperformed the paid response. We preserve that result: the ability to pay for intelligence is separate from whether the purchase was valuable.

Public replay inputs reproduce the recorded simulator outcome and pool allocations without API keys or private job files.

## How it is built

The project uses a TypeScript monorepo with a Next.js interface, reusable HTTP API and SDK, deterministic simulation and hashing, and Solidity escrow contracts. AI inference is an observed, nondeterministic process; recorded actions are replayed deterministically. API credentials and wallet material remain outside public evidence.

The Sepolia demonstration includes a five-token service payment and a separate timeout refund. The tokens are test assets with no claimed monetary value. Correct action execution is checked separately from the quality of a specialist's diagnosis.

## Current limitations

This is an operator-managed demonstration, not an open third-party service market. Protocol actions and game balances are simulated. Pool allocations shown in this demo are previews, not paid tournament rewards. The continuation is capped at three decisions. A hidden Final tournament and complete autonomous patch-and-resume workflow are not yet implemented.

These sponsor demonstrations are separate integrations, not one complete end-to-end tournament. CRE evidence is an official local simulation, not a live TEE attestation. Bazantic evidence is an external AI using MCP, not a hosted Recipe run or proof of Recipe-driven improvement.

## Working sponsor demonstrations

- **ENSv2:** The existing `frontierdemo.eth` name discovers the Rescue Practice API. Scoped permission for a single service text record was granted, exercised, paused, restored and revoked on Sepolia. Seven transactions and rejected operations are recorded. [Implementation](https://github.com/Jun0908/Decentralized-Value/blob/033a73cc77d045affb3c2703c42313c6e2c4ca69/packages/ens-adapter/src/rescue.ts) · [Evidence](../../evidence/deployments/ensv2-rescue-demo.json).
- **Chainlink CRE:** Official standard and confidential simulations matched independent Node evaluation. A fresh secret scenario pack was committed before execution, passed through the confidential handler, and later explicitly revealed for replay. This is local simulation, not network deployment, live TEE attestation or onchain Final commitment. [Implementation](https://github.com/Jun0908/Decentralized-Value/blob/033a73cc77d045affb3c2703c42313c6e2c4ca69/workflows/chainlink-cre/rescue-envelope/secret-pack/main.ts) · [Evidence](../../evidence/deployments/chainlink-cre-private-pack.json).
- **Bazantic:** An external OpenAI agent used Bazantic MCP to fetch the manifest and evaluate a baseline and a modified strategy. SDK integrity checks and independent evaluator replay matched. The two strategies tied; no improvement is claimed. Hosted Recipe execution, publication and Recipe-only A/B evidence remain incomplete. [Implementation](https://github.com/Jun0908/Decentralized-Value/blob/033a73cc77d045affb3c2703c42313c6e2c4ca69/apps/api/src/bazantic-rescue-agent.ts) · [Evidence](../../evidence/deployments/bazantic-rescue-agent-demo.json).

## Public entry points

- [Source repository](https://github.com/Jun0908/Decentralized-Value).
- [Explore the arenas](https://web-rho-seven-d6te7t3f0y.vercel.app/arenas).
- [Recorded sponsor evidence demo](https://web-rho-seven-d6te7t3f0y.vercel.app/sponsors/demo).
- [Recorded AI payment and decision demo — English](https://web-rho-seven-d6te7t3f0y.vercel.app/rescue-room/submission/en).

Public verification and its exact boundaries: [September 13 check](../../evidence/verification/PUBLIC_VERIFICATION_2026-09-13.md). Newly added local onboarding changes must not be described as deployed until their own deployment is verified.

## Owner confirmation — fill before submission

- Event track and eligibility: **owner to confirm**.
- Event-period starting commit and final submission commit: **owner to confirm**.
- Existing code versus eligible new work: **attach a checked diff; do not use this draft as proof of event timing**. The [technical change inventory](../../development/history/work-notes/SUBMISSION_CHANGE_INVENTORY.md) identifies a recent implementation interval, not the eligible event period.
- AI assistance: AI coding assistants helped with implementation, tests, documentation, and preparation of demo materials. **Owner must confirm the actual scope and describe their own real contribution.**
- Public repository and demo links: listed above. Narrated video URL and its access permissions: **owner to confirm**.
- Sponsor selection: **ENS / Chainlink / Bazantic, as requested by the owner**. Exact prize categories and eligibility remain owner-confirmed; a working integration is not proof of every prize requirement.

The current local silent video and narration are listed in [RESCUE_HANDOFF.md](RESCUE_HANDOFF.md). Local file paths are not substitutes for public submission links.
