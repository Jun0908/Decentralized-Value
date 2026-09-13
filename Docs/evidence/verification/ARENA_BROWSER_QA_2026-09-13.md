# Public Arena browser verification — 2026-09-13

## Verdict

The six tested non-billable Arena flows completed on the public application. This is **not an all-clear**: Ocean and Rescue have confirmed narrow-screen clipping, Ocean's cooperation unit is inconsistent, and Ocean's discovery endpoint still returns 404. Live AI completion and real payments were deliberately not exercised.

Target: https://web-rho-seven-d6te7t3f0y.vercel.app

Browser: Playwright-controlled Chromium, 1440 × 1000 and 390 × 1000 CSS-pixel viewports. The narrow viewport is a responsive desktop-browser check, not physical-phone, touch, Safari or Firefox verification. No login or existing participant identity was used. Tests used normal UI clicks, text input, selections and downloads; DOM evaluation was inspection only. No mocked evaluation response was used.

## QA inventory and observed results

| Arena                     | Exercised controls and state changes                                                                                                                 | Result                                                                                                                                                                                                                                                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Calldata                  | Measure default rules; change minimum reuse to 100; remeasure; compare revisions; download evidence; change measurement context                      | Actual measurement requests returned 200. Correctness passed; artifact and metrics changed; downloaded result hash matched response. Old comparison cleared on context change. Narrow-screen First Mission completed.                                                                                                       |
| Microgrid                 | Run default policy; grid cap 12 → 2; step next/back; rerun; download; verify replay; switch Day → Classic → Day                                      | Cost 2635 → 1975 USD, unserved 5 → 12 MWh, carbon 7980 → 4780 kg. Same context, changed policy hash. UI replay verification passed. Narrow-screen comparison fit its container and First Mission completed.                                                                                                                 |
| Secret Gate               | Create disposable identity; enroll; generate and submit actual proof; resubmit same proof; run four-proof local benchmark; change benchmark settings | Both widths received an offchain receipt backed by durable Redis. Both duplicates returned expected 409 / NULLIFIER_ALREADY_USED. Desktop benchmark verified 4/4 proofs; recorded settings stayed at two parallel slots after changing the control to three. Narrow-screen First Mission completed; PIVOT remained visible. |
| Rescue Room               | Edit Doctrine name and evidence count; inspect artifact; run; pause/step/skip story; download evidence; change Doctrine and retry; replay            | Evaluation returned 200, edited artifact propagated, debrief and hidden-state reveal appeared, Doctrine replay verified, previous revision appeared after retry. Narrow-screen second-alert/Keep It Running run completed. Game credits remained separate from real tokens.                                                 |
| Ocean Commons             | Change name and effort policy; switch Builder/JSON; malformed JSON then restore; replay first/last round; change seed                                | Deterministic browser preview updated: sparing vs flat-out changed livelihood 313 → 256 DemoUSD, restraint 43% → 0%, cooperation −0.004 → 0.003 for the tested season. Builder/JSON effort value agreed. Round controls and seed selection worked. This did **not** run the model-backed mission or server submission.      |
| 72-Hour Disaster Response | Spend less / Survive more presets; run simulations; select disaster scenario; narrow-screen Balance run; skip animated replay to result              | Evaluation requests returned 200 and different result hashes under the same context. Seven scenario tabs were present. The narrow-screen replay reached H+72 and showed region deliveries and three separate outcome values.                                                                                                |

Off-happy-path checks included malformed Ocean JSON, invalid Microgrid charge/discharge prices, duplicate Gate proofs, and Calldata context changes. Errors were shown or comparisons cleared as appropriate. Mode switches, revisions, replay controls and result downloads were also explored beyond the first run. This is coverage of the listed paths, not exhaustive testing of every control or parameter combination.

## Findings, ordered by priority

### P1 — Ocean's main scene is clipped on narrow screens

At a 390px viewport (375px layout width after the scrollbar), `.ocean-stage` and `.ocean-replay-section` measured **788px** wide inside a **343px** competition shell. The body had 804px of scrollable content but both body and root used `overflow-x: hidden`. The offshore ground, nursery label, legend and nearby explanation could be cut off. DOM root-width checks alone falsely looked clean.

Reproduce: open `/arenas/ocean-commons` at 390px, choose Sparing, then scroll to Voyage replay and select the last round. Screenshot: `.playwright-mcp/audit-ocean-390-result.png`. Initial view and desktop result were also captured.

Recommended follow-up: constrain the grid's intrinsic minimum width and the replay/legend children; make the map responsive or provide an explicit usable map pan/zoom design. Do not merely hide the overflow again. Recheck all grounds, labels and playback controls visually.

### P1 — Rescue's hero copy and primary action are clipped

At 390px, `.rescue-storyboard-hero` was 343px wide, but `.rescue-storyboard-copy` was about 383px wide. Its heading extended to x=380 while the hero clipped at x=359. The screenshot confirms truncated heading/description and the primary button's right edge.

Reproduce: open `/arenas/rescue-room` at 390px without scrolling. Screenshot: `.playwright-mcp/audit-rescue-room-390-initial.png`.

Recommended follow-up: remove intrinsic-width overflow in the copy/action group, account for inner padding, and allow appropriate heading wrapping/scaling. Keep the illustration and CTA visible. The actual Doctrine execution still completed through normal UI input in this audit.

### P2 — Ocean cooperation units disagree

The initial metric card displays `Cooperation efficacy — Maximize · %`. The result/evaluator describe **stewardship points per 1,000 DemoUSD**. The local source confirms `%` in `apps/web/src/lib/arenas.ts` and the per-spend unit in `packages/ocean-commons/src/evaluator.ts`. Unify the displayed unit with the evaluated quantity; do not silently alter the evaluator or rescale historical results.

### P2 — Ocean API discovery remains missing

Read-only `GET /v1/ocean-commons` returned 404. Its browser preview working does not establish an agent-discoverable API. This is a remaining integration issue, not a failed browser simulation.

## Errors, readiness and exclusions

- Unexpected browser console errors: **0** in the listed flows. The two deliberately duplicated Gate entries generated two expected 409 resource-error messages. No other failing browser request was captured by the audit listener.
- Initial views of all six Arenas loaded images without broken-image indicators or framework error overlays. Initial desktop/mobile screenshots and selected result screenshots were visually reviewed. Visual signoff fails for the two clipping findings even though document-level width checks passed.
- Supplemental public GET: Rescue now reports **`commanderAvailable: true`**, and the AI launch button is enabled. This supersedes the earlier observed false flag, but does not verify provider authorization, inference cost, timeout behavior or completed AI episodes.
- Supplemental public GET: Sepolia showcase is now `operator-pilot-paid`. `/rescue-room` responds rather than returning 404. These observations are not proof of a specific Vercel deployment SHA or new chain verification.
- Excluded: AI inference, chain payments, authentication, funding, protected submissions, Final entries, Ocean server-side submissions and reward settlement. No existing wallet was used. Gate enrollment/entry created **two disposable public Practice groups/receipts**; the four-proof benchmark used local verification scopes.
- Local runner caveat: `pnpm exec` attempted an automatic dependency installation and failed with ENOENT in the Ledger package directory. `playwright` and `tsx` were unavailable from the repo at that point. No repeated install or dependency repair was attempted. Verification continued using the separate Playwright browser tool. The local dependency issue is not counted as a public Arena failure.

## Evidence and handoff

Raw structured records: `.playwright-mcp/arena-public-audit-2026-09-13.json`.

The audit captured 22 screenshots under `.playwright-mcp/audit-*.png` plus downloaded public evidence JSON. These are local, Git-ignored verification artifacts, not published repository assets. Browser-tool logs contain the actual control calls, responses and harness errors. Initial harness failures (missing URL/import support and over-specific selectors) were corrected; they were not attributed to the product.

The browser session was closed after verification. No product source was changed, committed, pushed or deployed for this audit. Only this report and local QA artifacts were written. The recommended next implementation is the two mobile clipping fixes, followed by Ocean's unit/discovery inconsistencies.

## Subsequent local implementation and regression — 2026-09-13

The four findings above are corrected **locally**, not retroactively removed from the public audit:

- Ocean scene/grid intrinsic minimums now fit the available viewport; tablet history also fits.
- Rescue hero copy/actions can shrink/wrap within the parent, including the CTA layout.
- Cooperation uses the existing evaluator unit, stewardship points per 1,000 DemoUSD; no evaluator or historical-outcome rescaling.
- `GET /v1/ocean-commons` and an Ocean `/v1/arenas` entry expose the current descriptor, 24 public seeds and explicit practice/settlement boundaries. OpenAPI/generated SDK descriptor types match. The older CLI manifest's distinct metric context was not silently replaced.

`scripts/verify-arena-layout.ts` passed against the owned preview at `http://127.0.0.1:3016`, with 320/390/768/1440 px checks and eight reviewed screenshots in ignored `.frontier/arena-layout-qa/`. Ocean's previously 788px-wide scene fits a 343px container at the 390px viewport. Rescue heading/action fit; no unexpected console errors. Direct Ocean first/last/pause/resume controls and a deterministic Rescue Doctrine POST returning 200 with an outcome also passed. Discovery returned 200 and Ocean appeared once in the list.

The English onboarding command separately passed six actual local HTTP requests, 12,577-byte Starter digest, independent integrity and repeated result agreement. These are non-billable checks without keys or wallets.

Typecheck, full ESLint, changed-code format, generated SDK contract check and Webpack build (41 pages) passed. One full TypeScript run passed 1,046 tests / 11 skipped, but the **latest rerun failed: 1,045 passed / 1 failed / 11 skipped**, with recurring Windows `EPERM` during job-store `writer.lock` acquisition. The isolated 18-test file passed. The existing code retries `EEXIST`, not this `EPERM`; the underlying filesystem cause is not established. No lock was deleted or runtime lock-safety behavior changed. This is an unresolved intermittent regression risk, not a fully green CI claim. The second 105-case synchronous matrix was parameterized without relaxing the default timeout or dropping cases. Default Turbopack and fresh Solidity checks were not performed.

PowerShell reproduction:

```powershell
$env:ARENA_QA_ORIGIN = 'http://127.0.0.1:3016'
node --import tsx scripts/verify-arena-layout.ts
```

This follow-up did not deploy, Push, invoke models or transfer funds. Public/mobile verification after deployment remains a separate gate.
