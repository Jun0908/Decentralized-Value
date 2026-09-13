# Microgrid Practice — Implementation Plan

Updated: 2026-09-13. This is the consolidated English edition. The [original development record](archive/plan-history-2026-09-13/Plan-Microgrid.md) is preserved unchanged.

## Objective

Let users change a battery policy and watch a community balance cost, continuity of supply, and operational carbon through a simulated day.

The illustration connects solar and wind generation, a battery, the community, and an external-grid outage. The day replay makes each policy's consequences visible. It represents a simulation, not an operating power installation.

## Current delivery

- [x] Day strategy and Classic mix modes on the same page.
- [x] Two public days with six four-hour intervals, including weather, generation, demand, price, and an evening outage.
- [x] Four editable policy controls with plain-language explanations.
- [x] Battery state, energy-flow illustration, step controls, automatic replay, and downloadable evidence.
- [x] Independent cost, unserved-energy, and carbon comparison against fixed baselines and the previous revision.
- [x] Versioned simulator, policy, context, and result hashes with replay verification.
- [x] Desktop and mobile verification, including a stacked comparison layout on small screens.
- [x] Existing practice verified on public HTTPS at commit `033a73c`.
- [x] First Mission implemented and verified locally; this later addition has not yet been pushed or deployed.

Public verification: [2026-09-13 report](PUBLIC_VERIFICATION_2026-09-13.md). Illustration provenance: [asset record](ARENA_ILLUSTRATIONS.md).

## Model and policy contract

The day simulator uses `microgrid-day-practice-v1` and `microgrid-policy-v1`. It is separate from the original `microgrid-dispatch-v1` 100 MWh allocation challenge; the legacy API, manifest, and hashes remain unchanged.

Battery assumptions:

- 20 MWh capacity, initially containing 6 MWh.
- Per interval, at most 8 MWh of charging input or discharge output.
- 90% efficiency in each direction.
- Integer kWh accounting, nonnegative quantities, capacity bounds, and interval energy conservation.
- Initial stored energy carries USD 300 and 2,100 kg of carbon attribution.
- No terminal-energy credit. Renewable-generation cost includes curtailed production.

Controls set reserve level, the price that triggers discharge, charging during inexpensive periods, and the maximum grid import per interval. The evaluator reports cost in USD, unserved energy in MWh, and operational carbon in kgCO₂. All three are minimized independently.

The workbench retains the current and previous in-page revisions. Context changes clear comparison history. Invalid policies show errors rather than producing substitute results. Ties, dominance, and tradeoffs are computed from simulator outcomes.

This is an aggregate energy model. Power flow, voltage, frequency, grid stability, battery degradation, live electricity markets, and measured weather forecasting are outside its current scope.

## First Mission

1. Run the starter policy on Storm day.
2. Change only Grid import cap from 12 to 2.
3. Run again and inspect all three outcomes.

The verified difference is cost **−660 USD**, unserved energy **+7 MWh**, and carbon **−3,200 kg**. Lower grid use reduces spending and emissions while leaving more demand unmet. No weighted total resolves that value choice.

Completion requires a valid changed artifact evaluated in the same context. Clicking Run, leaving an invalid draft, changing the day, or editing without measuring does not complete the mission. Learning progress does not affect evaluation or rewards.

## Implementation map

- [practice.ts](../packages/microgrid-dispatch/src/practice.ts): pure simulator, policy validation, context, replay verification, and independent comparison.
- [practice.test.ts](../packages/microgrid-dispatch/src/practice.test.ts): 22 added tests; 24 focused package tests including existing coverage.
- [microgrid-day-practice.tsx](../apps/web/src/components/microgrid-day-practice.tsx): policy editor, illustrated flow, replay, comparison, and JSON download.
- [microgrid-dispatch-demo.tsx](../apps/web/src/components/microgrid-dispatch-demo.tsx): Day / Classic selection without replacing classic evaluation.

The browser-safe `./practice` export adds no new dependency.

## Verification record

Package typecheck, focused tests, changed-file lint, and formatting passed. Desktop 1440px and mobile 390px checks exercised policy edits, two runs, previous-revision comparison, JSON download, independent Node replay, Classic mode, and context reset.

An initial mobile comparison-table overflow was fixed by using labeled cards at widths of 600px or less. Subsequent checks found no overflow, console errors, or prohibited color pairings.

The later First Mission batch passed the Web build, changed-file lint, and the full TypeScript suite: 821 passed / 11 skipped. These are dated verification results, not checks rerun by this documentation edit.

```bash
pnpm exec tsx scripts/verify-arena-labs.ts http://127.0.0.1:3014
pnpm exec tsx scripts/verify-first-missions.ts http://127.0.0.1:3014
```

Local preview: <http://127.0.0.1:3014/arenas/microgrid-dispatch>. See the [shared preview instructions](Plan-SecretGate.md#local-preview-instructions). Evidence is under `.frontier/arena-labs-qa/` and `.frontier/first-mission-qa/`.

The downloaded full `MicrogridDayResult` can be passed directly to `verifyMicrogridReplay(json)`.

## Next milestones

- [ ] Publish and verify the locally implemented First Mission.
- [ ] Test first-time understanding of the four controls and energy-flow replay.
- [ ] Extend API discovery, durable revisions, and server-side submission only under a separately versioned contract.
- [ ] Establish unknown-final and AI-strategy feasibility with broader scenarios before opening competition.
- [ ] Add final entries and rewards only after competition infrastructure is ready.

The current two public days are a reproducible learning environment. They do not establish operational grid safety, AI performance on unknown conditions, or a completed reward tournament.
