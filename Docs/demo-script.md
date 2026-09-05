# 90–120 second demo script

1. **0:00–0:15 — Thesis.** Open the home page: progress has multiple independent axes; a weighted score hides tradeoffs.
2. **0:15–0:35 — Real frontier.** Enter the orderbook arena. Point to correctness as the hard gate and the three measured non-dominated designs on the SVG chart.
3. **0:35–0:50 — Reproducibility.** Open FrontierBook. Show commit, artifact hash, context hash, compiler, gas, and throughput. Explain that unavailable attestations are not faked.
4. **0:50–1:10 — ENS identity.** Open Runners. Resolve the live runner and change one delegated record; refresh to show runtime behavior follows ENS.
5. **1:10–1:30 — Ledger evidence.** Submit the prepared interesting artifact. Show correctness first, device EIP-712 approval, recovered address matching ENS, result hash, and Key Ring-provisioned scoped credential.
6. **1:30–1:45 — Settlement.** Show the Sepolia attestation transaction and the frontier update.
7. **1:45–2:00 — Agent distribution.** Show Bazantic MCP discovery, paid evaluation via the exact gateway endpoint, and the Recipe-vs-raw result improvement.

Before presenting, run `pnpm demo:seed`, `pnpm demo:check -- --strict`, and `pnpm ci`. If a live dependency fails, open Sponsor Debug, name the failed boundary, follow `Docs/recovery.md`, and continue with the last verified local frontier without claiming a live transaction.
