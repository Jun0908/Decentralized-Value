# Submission copy — English draft

Draft only. Do not submit until the owner confirms the event track, eligible development period, contribution statement, final commit, and public links.

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

ENS, Bazantic and official CRE execution must not be claimed as completed integrations on the strength of local adapters or tests. Sponsor-specific claims require separate live or qualifying simulation evidence.

## Owner confirmation — fill before submission

- Event track and eligibility: **owner to confirm**.
- Event-period starting commit and final submission commit: **owner to confirm**.
- Existing code versus eligible new work: **attach a checked diff; do not use this draft as proof of event timing**.
- AI assistance: AI coding assistants helped with implementation, tests, documentation, and preparation of demo materials. **Owner must confirm the actual scope and describe their own real contribution.**
- Public repository, demo, and narrated video links: **insert verified URLs after publication**.
- Selected sponsor prizes and matching evidence: **owner to confirm; omit unsupported claims**.

The current local silent video and narration are listed in [RESCUE_HANDOFF.md](RESCUE_HANDOFF.md). Local file paths are not substitutes for public submission links.
