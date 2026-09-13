# Rescue information-value study

Design date: 2026-09-12. **Design and local design-hash generation only; no real comparative AI execution.** The recorded paid-AI response losing to a fixed strategy remains unchanged.

## Question and controls

“An AI paid” and “the purchased analysis was useful” are different questions. Start by testing use of analysis from a fixed Pulse Monitor, not provider selection.

| Arm                  | Purchase/time/balance         | Analysis shown to Commander          | Interpretation                                                   |
| -------------------- | ----------------------------- | ------------------------------------ | ---------------------------------------------------------------- |
| A: analysis-visible  | Fixed purchase prefix         | Specialist analysis for that Episode | Analysis available                                               |
| B: analysis-withheld | Same prefix as A              | Analysis body withheld               | A vs B isolates access to analysis content                       |
| C: no-purchase       | T+0, full budget, no purchase | None                                 | A vs C includes information, purchase cost and elapsed game time |

Recalculate Always Pause/Never Pause on the same Episodes. C cannot replace B: it changes information, cost and time together. Do not manufacture AI victories or multiple winners.

## Fix before viewing results

```sh
pnpm exec tsx scripts/prepare-rescue-information-study.ts
```

The design includes **all 35 public Episodes**, current published order, one repetition and three arms. This is known public data, not unseen scenarios or hidden Final. Initial design hash: `0x4c692fc8182664117950b575b32bfafd5ad20f81cdf783a87dfc136ceb8c5013`.

- Bind existing Practice/Manifest/Commander context, dataset version, proposed model configuration, Playbook, service specification and three independent axes.
- Generate one specialist analysis per Episode, shared by A/B; do not reuse another Episode's analysis.
- At most three decisions per arm, no further purchases/patches; simulator advances to T+60 afterward. This is not full incident-response evaluation.
- Same prompt, differing only the designated analysis field. Every arm/turn uses independent model calls without prior-arm conversation/output.
- Rotate order by Episode: A/B/C, B/C/A, C/A/B. No reproducible model seed assumption.
- Retain every scheduled slot. Report failure, interruption and budget-stop as missing, not only successful runs.

The design hash establishes local design identity, not public timestamp, entry freeze or final code/prompt commitment. Fix the runner code and complete prompts before the first approved paid call.

## Prevent information leakage

Removing only `paidAnalysis` from the existing continuation input is insufficient: `publicView.serviceReceipts` and `source: SERVICE` observations could leak the diagnosis.

The future experiment-specific projection must remove simulator service diagnoses from **all three arms**, then add real specialist analysis only to A. Preserve cost, game time, action history and protocol observations. Never expose true state, Episode definition/ID, hashes or other-arm results to the model; keep IDs/hashes on the evaluator/audit side. Inference from public observations is still possible, so this is not secret-Final protection.

A/B branch from the identical post-purchase state; later action-driven state divergence is allowed. Model wall-clock latency is not game time. Record runtime/tokens/real model costs as separate operational measures, and distinguish real delivery time from simulated delivery time.

## Evaluation and GO / PIVOT interpretation

1. **Technical gate:** every planned slot recorded, leakage tests, identical A/B prefixes, action replay agreement and invalid-action rejection. Without these, do not accept performance comparisons.
2. **Observed results:** same-Episode completed pairs show three-axis deltas, dominance, tradeoffs or ties. Always report all 35 planned slots, completions and failures. No weighted overall score.
3. **Interpretation:** A beating B is an example of useful analysis after the fixed purchase. A also beating C may show value including cost in that Episode. One repetition is not statistical superiority or generalization.
4. **Next decision:** absent differences may reflect paraphrased observations or constrained choices. Changed conditions require a new experiment version with old results retained. Do not decide the whole Arena's GO/PIVOT from this short continuation.

The current specialist interprets the same public observations as the Commander; it does not obtain exclusive new telemetry. This first study measures paid additional interpretation. Newly purchased data, generalization and unknown-Final competition are later design questions.

## Budget and remaining implementation

Maximum planned calls: 35 specialists + 315 Commander calls = **350 calls**. This is **not execution authorization or a budget approval**. The preparation script has no execution flag; it records zero approved/executed calls, spending and transfers.

- [x] Conditions and complete Episode list bound into a reproducible design hash.
- [x] Tests for all-Episode retention, determinism, tampering and no-execution boundary.
- [ ] Model-input projection, arm runner, leakage/partial-failure/action-replay tests.
- [ ] Final code/prompt freeze and remaining-budget/cost review.
- [ ] Real AI comparison with complete outcome analysis.
- [ ] Separate-distribution and unknown-Final extension.
