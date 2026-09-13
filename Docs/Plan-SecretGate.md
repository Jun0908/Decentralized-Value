# Secret Gate — Proof Walkthrough Plan

Updated: 2026-09-13. This is the consolidated English edition. The [original development record](archive/plan-history-2026-09-13/Plan-SecretGate.md) is preserved unchanged.

## Objective and current decision

Make a real Semaphore V4 membership proof understandable: keep an identity secret in the browser, register its public commitment, prove membership, and demonstrate one-time use within a scope.

The proof walkthrough is implemented. The latency/memory competition remains **PIVOT**: all 32 proofs in the four-strategy, two-trial study verified correctly, while maximum latency CV was **0.595** and maximum memory CV **0.331**, above the preregistered **0.15** ceiling. [Raw measurement evidence](../benchmarks/secret-gate/results/latest.json).

Proof correctness and stable competitive measurement are separate achievements. The educational workbench does not reopen the leaderboard, value pools, or rewards.

## Current delivery

- [x] Illustrated secret → public commitment → synthetic eight-member group → proof → gate flow.
- [x] Separate identity creation, enrollment, proof submission, and duplicate-proof rejection controls.
- [x] Browser-only identity secrets, optional local persistence, and an explicit removal control.
- [x] Explanations of parallelism, artifact loading, and worker lifecycle.
- [x] Four-proof progress visualization with recorded settings and raw observations.
- [x] Original acceptance receipt retained after the duplicate request returns HTTP 409.
- [x] Dedicated responsive styles, keyboard focus, reduced-motion behavior, and explicit contrast.
- [x] Existing practice verified publicly at commit `033a73c`, including actual Redis-backed acceptance and duplicate rejection.
- [x] Four-step First Mission implemented and verified locally; the later mission addition is not yet pushed or deployed.

See the [public verification report](PUBLIC_VERIFICATION_2026-09-13.md) and [illustration record](ARENA_ILLUSTRATIONS.md). The illustration is explanatory, not proof evidence.

## Proof and measurement contract

The UI never puts the identity secret in HTTP input, displayed evidence, or logs. Only the public commitment is enrolled. The demo enrollment service knows the commitment and synthetic group root: this walkthrough does not establish real-world unlinkability, participant uniqueness, personhood, or production authorization.

The benchmark has 16 configurations: four parallelism settings, two artifact-loading modes, and two worker-lifecycle modes. Its queue diagram explains scheduling structure, not predicted time or memory.

All four actual proofs must finish verification. Timing begins with the batch, including artifact prefetch. With four samples, nearest-rank p95 equals the maximum completion time. Browser JavaScript heap estimates are not process RSS and do not measure all worker/WASM memory. Observations are not competition rankings.

Cancellation, failures, duplicate starts, and a two-minute worker timeout are handled explicitly. Cancelling after a gate request does not undo an accepted server-side proof. Existing API validation and nullifier protection remain intact.

## First Mission and acceptance flow

1. Create the browser identity.
2. Enroll its public commitment.
3. Generate and submit a real membership proof.
4. Resend that proof and verify HTTP 409 / `NULLIFIER_ALREADY_USED`.

The mission is complete only after actual acceptance and duplicate rejection. A click or animation is insufficient. The first receipt remains visible.

Stable controls are `secret-gate-create`, `secret-gate-enroll`, `secret-gate-enter`, and `secret-gate-duplicate`. The stage moves through idle, identity, enrolled, proving, verifying, entered, and duplicate-rejected.

`secret-gate-benchmark` runs four proofs. Check that all progress entries are verified, settings match the recorded evidence, and later edits do not rewrite an earlier observation.

## Verification record

Seven focused proof/settings tests covered all configuration structures, invalid inputs, p95, and real proofs using checked-in WASM/zkey artifacts. Package/Web typechecks and changed-file lint passed.

Desktop 1440px and mobile 390px checks completed the actual proof flow and four-proof benchmark. No mocked success response was used. Console checks reported no unexpected errors; the intended HTTP 409 was recorded separately.

Local browser verification initially used the actual route handlers with a development MemoryStore. Production still fails closed without Redis. Subsequent public checks on 2026-09-13 verified Redis-backed acceptance and duplicate rejection; restart recovery, long-term persistence, and multi-region behavior were not established by that check.

The later First Mission batch passed the Web build, changed-file lint, and the full TypeScript suite: 821 passed / 11 skipped. Full-duration browser timeout and cancellation tests were not part of the earlier lab run. These are dated records, not tests rerun during this documentation edit.

## Local preview instructions

Use an already running preview when its ports are occupied. Do not stop the user's port 3000 server or reboot the PC.

After building, start the Web preview in one terminal:

```powershell
pnpm --filter @frontier/web build
pnpm --filter @frontier/web exec next start -p 3013 -H 127.0.0.1
```

In a second terminal:

```powershell
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/preview-arena-labs.ts 3013 3014
```

Open <http://127.0.0.1:3014/arenas/secret-gate>. The loopback proxy serves the built Web app and connects only the two gate POSTs to actual development handlers. AI and payment POSTs are rejected. MemoryStore one-time-use state is lost on restart, so this preview is not a production gate.

```bash
pnpm exec tsx scripts/verify-arena-labs.ts http://127.0.0.1:3014
pnpm exec tsx scripts/verify-first-missions.ts http://127.0.0.1:3014
```

Screenshots and reports: `.frontier/arena-labs-qa/` and `.frontier/first-mission-qa/`.

## Next milestones

- [ ] Publish and verify the local First Mission.
- [ ] Check first-time understanding of secrets, commitments, proofs, and one-time use.
- [ ] Before reconsidering competition, preregister a feasibility study with controlled environments, sufficient repetition, stable metrics, raw evidence, and nontrivial independent outcomes.
- [ ] Evaluate any circuit, group/scope, arbitrary-code, or on-chain gate expansion as a separate scope.

UI completion does not satisfy the competition GO gate. AI inference, hidden finals, production identity, on-chain nullifiers, Sepolia transfers, and rewards are outside this walkthrough.
