# Calldata Arena — Implementation Plan

Updated: 2026-09-13. This is the consolidated English edition. The [original development record](../history/plan-history-2026-09-13/Plan-Calldata.md) is preserved unchanged.

## Objective

Make compression strategy tangible: edit a rule, measure actual EVM execution, and see how transmission cost and decoding cost move independently.

The workbench turns three fixed codecs into an editable rule artifact. Its illustrated introduction follows actions → packing → encoded bytes → decoder → matching digest. Illustrations explain the concept; measurements and downloaded evidence establish the result.

## Current delivery

- [x] Editable `calldata-rules-v1` artifact with ordered rules and a fallback.
- [x] Per-batch selection reasons, packing diagrams, byte counts, digest checks, and malformed-input results.
- [x] Actual checked-in Solidity runtime execution in a Cancun EVM.
- [x] Independent EIP-2028 calldata gas and decoder execution gas.
- [x] Same-context comparison with Standard ABI, reference codecs, and the previous measured revision.
- [x] Artifact, context, and measured result export as JSON.
- [x] Dedicated illustration, responsive layout, accessible controls, and explicit button-state contrast.
- [x] Existing practice verified on public HTTPS at commit `033a73c`.
- [x] First Mission implemented and verified locally; publication of this later addition remains a separate step.

Public verification: [2026-09-13 report](../../evidence/verification/PUBLIC_VERIFICATION_2026-09-13.md). Illustration provenance: [asset record](../../product/arenas/ILLUSTRATIONS.md).

## Rules and measurement contract

The artifact accepts zero to four priority-ordered rules. Conditions use integer action counts from 1 to 255 and recipient reuse from 0 to 100 percent. A fallback selects one of the three existing codecs. Users can add, remove, reorder, inspect, and download the rules.

`POST /api/calldata-lab` is the internal practice endpoint. It reads at most 16 KiB of streamed JSON and rejects unknown fields, codecs, contexts, and out-of-range values. Each request measures the candidate and references; it does not create an unbounded artifact cache.

Correctness is a hard gate: decoded digests must match and the published malformed-input corpus must be rejected. Invalid execution is not placed on the frontier. This corpus is a defined test set, not a proof covering every malformed input.

The context binds the rule interpreter, artifact rules, compiler/runtime hashes, corpus, and metric accounting. Existing `/v1/calldata-compression` behavior and legacy reference result hashes remain unchanged. Different contexts are never combined.

Host-side rule selection and encoding costs are outside the reported EVM gas. This workbench selects checked-in codecs; it is not an arbitrary-code compilation sandbox or an on-chain automatic codec dispatcher.

## First Mission

1. Measure the starter rules.
2. Change Minimum reuse from 50 to 100.
3. Measure again and inspect the two independent deltas.

In the verified public workload, the starter selects Dictionary / Packed / Dictionary: 459 bytes, 5,172 calldata gas, and 17,185 decoder gas. Standard ABI uses 14,112 / 19,590 gas in the same context. Raising reuse to 100 selects Packed for all batches: 8,200 / 13,061 gas.

The mission therefore exposes a real tradeoff: transmission **+3,028 gas**, decoding **−4,124 gas**. No combined score determines which change is better.

Progress is derived from valid measured results, not button clicks. An unchanged artifact, invalid draft, unmeasured edit, or different context cannot complete the comparison. Mission badges are learning indicators, not reward signals.

## Verification record

The focused package and API suite passed 31 tests, including determinism, property order, rule priority, comparison-order invariance, invalid artifacts, response snapshot isolation, stream limits, and legacy codec hashes.

Desktop 1440px and mobile 390px checks covered edit → execute → compare → download → change context. The actual HTTP EVM response and downloaded result hash matched. Context changes cleared the previous comparison. Console, overflow, and contrast checks passed.

The later First Mission batch passed the Web build, changed-file lint, and the full TypeScript suite: 821 passed / 11 skipped, including three new shared progress tests. These are dated execution records, not checks rerun by this documentation edit.

```bash
pnpm exec vitest run packages/calldata-compression/src/index.test.ts packages/calldata-compression/src/lab.test.ts apps/web/src/app/api/calldata-lab/route.test.ts --maxWorkers=2
pnpm exec tsx scripts/verify-arena-labs.ts http://127.0.0.1:3014
pnpm exec tsx scripts/verify-first-missions.ts http://127.0.0.1:3014
```

Local preview: <http://127.0.0.1:3014/arenas/calldata-compression>. See the [shared preview instructions](Plan-SecretGate.md#local-preview-instructions). Screenshots and reports are under `.frontier/arena-labs-qa/` and `.frontier/first-mission-qa/`.

## Next milestones

- [ ] Publish the locally verified First Mission and recheck the deployed interaction.
- [ ] Test whether first-time users can explain the two gas costs and the effect of their rule change.
- [ ] Evaluate a broader encoder/decoder artifact space with isolated execution.
- [ ] Design a separate final workload, durable revisions, participant authorization, and a frozen entry flow before tournament use.
- [ ] Add commitments and funded rewards only after those competition gates pass.

The current release is an editable, measured practice lab. Its small public workload and codec set do not yet establish a generalizing AI competition.
