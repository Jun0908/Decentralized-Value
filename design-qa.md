# Rescue Room — Design QA

English translation of the development QA record. Dates, measurements, findings and pass/fail results below describe the recorded checks, not new browser runs. The [original source](Docs/development/history/design-qa-original-2026-09-13.md.txt) is preserved unchanged. Artifact paths identify local QA captures, not published downloads.

## Ocean / Rescue responsive regression — 2026-09-13

- Do not treat `html.scrollWidth === html.clientWidth` as proof of fit: `overflow-x: hidden` can conceal a clipped child grid. Inspect the bounds and internal scroll width of the actual map, legend, controls and hero copy.
- Use shrinkable grid tracks (`minmax(0, 1fr)`) and `min-width: 0` for these nested surfaces. Do not mask min-content overflow with another hidden-overflow wrapper.
- Rescue headings, both hero actions, and the illustrated story loop must not overlap at 320 / 390 / 768 / 1440 CSS pixels.
- Ocean's map, legend, replay controls and voyage history must fit their containers. Explicitly scrollable landscape tables are a different case.
- Cooperation efficacy is **stewardship points per 1000 DemoUSD**, not a percentage. Its negative values are valid; do not rescale or clamp the evaluator to make the card look simpler.
- Re-run `ARENA_QA_ORIGIN=http://127.0.0.1:3016 pnpm exec tsx scripts/verify-arena-layout.ts` (PowerShell: set `$env:ARENA_QA_ORIGIN` separately). Screenshots and numeric checks are written to ignored `.frontier/arena-layout-qa/` for visual review.
- Local production-build regression passed at all four widths, including replay pause / resume / first / last round, API discovery, history width and hero overlap checks. Eight screenshots reviewed. This is not a deployed-site, physical-device, authenticated-flow, paid-inference or payment verification.

## First Missions for the three lower Arenas — 2026-09-13

Scope: the new `first-mission` following `arena-intro-story`. Calldata leads directly into two real measurements, Microgrid into a one-parameter change, and Secret Gate into four real operations. Existing generated illustrations were retained; this change generated no new images.

- Initial verification found that existing Microgrid button CSS gave the new component a white background. Styling was scoped to `.mission .steps .action` with a dark background and light text. Shared globals.css was not changed for this correction.
- Default / hover / disabled styling, the focus outline, and the active lime-and-dark pair were explicitly defined within the same scope.
- Real interactions completed at 1440 × 1000 / 390 × 1000 with no horizontal overflow or console errors. Expected duplicate-rejection 409 responses were counted separately.
- Distinguish unmeasured, being edited, same artifact, different context and invalid-input states. Do not turn learning progress into a score or reward.
- Captures: `.frontier/first-mission-qa/{calldata-compression,microgrid-dispatch,secret-gate}-{1440,390}-{initial,complete}.png`. The final Microgrid mobile capture was also rechecked for dark buttons.
- Automated verification: `scripts/verify-first-missions.ts`. Checks were added to detect inherited button/link background interference.

The earlier three Arena pages and submission links were separately verified over public HTTPS. This First Mission record describes the local implementation at that point. Final result: passed within the local First Mission scope.

## Contrast correction scope

- Report source: the user-provided screenshot of “Replay evidence timeline,” browser-translated into Japanese, with white text on a lime background.
- Existing full-page source visual reference: `artifacts/ux-audit-rescue-room/selected-option-2.png`
- Existing full-page comparison: `artifacts/ux-audit-rescue-room/30-source-implementation-qa.png`
- Before-fix reproduction in the same state: `artifacts/ux-audit-rescue-room/31-replay-contrast-before.png`
- After-fix focused capture: `artifacts/ux-audit-rescue-room/32-replay-contrast-after.png`
- After-fix desktop: `artifacts/ux-audit-rescue-room/33-rescue-result-contrast-desktop.png`
- After-fix mobile: `artifacts/ux-audit-rescue-room/33-rescue-result-contrast-mobile.png`
- Route: `http://localhost:3000/arenas/rescue-room`
- State: completed Controlled Practice with the Evidence Timeline and Outcome visible.

## Viewports and image dimensions

- User-provided image: 237 × 95 px
- Before-fix focused image: 181 × 33 px
- After-fix focused image: 218 × 43 px
- Desktop: CSS viewport 1440 × 1000, deviceScaleFactor 1, image 1440 × 1000 px
- Mobile: CSS viewport 390 × 844, deviceScaleFactor 1, image 390 × 844 px
- Focused captures show the same button in the same interaction state. Japanese browser translation changes label width, but the foreground/background tokens being compared are the same.

## Permanent contrast rules

The following rules apply throughout this project:

- **Never pair** `var(--lime)`, `#c7ff45`, or an equivalent bright yellow-green background with white, near-white or `var(--ink)` text.
- On lime backgrounds, use dark text equivalent to `#111` and meet at least WCAG 4.5:1 contrast for normal text.
- White or near-white text requires a sufficiently dark background and at least WCAG 4.5:1 contrast for normal text.
- Buttons, pills, tabs and badges must explicitly set both `background` and `color` in the same selector/state. Do not rely on the shared `button` background or inherited parent text color.
- Check default / hover / focus / active / disabled separately. Preserve legibility and padding when browser translation makes labels longer.
- During Design QA, inspect visible interactive elements on actual desktop and mobile pages. Any bright-background/bright-text pair makes the `final result: blocked`.

Use these two base pairs:

- Primary: lime background `#c7ff45` + dark text `#111`
- Secondary: dark background `#0d1013` + light text `#f4f1e8`; hover uses dark background `#151a1d` + lime text `#c7ff45`

## Findings

- [P1] A Secondary Action became unreadable with light text on a lime background.
  - Location: the shared `button` and `.secondary-action` rules in `apps/web/src/app/globals.css`; Rescue Room's `Replay evidence timeline`.
  - Evidence: before-fix computed text color was `rgb(213, 215, 216)`, with background `rgb(199, 255, 69)`. Contrast was severely insufficient.
  - Impact: the replay label could not be read, effectively breaking a primary Evidence Replay entry point. The shared class could affect other pages.
  - Fix: `button.secondary-action` explicitly sets a dark background and light foreground in one rule, with dark-background/lime-text hover styling. Page-specific foreground-only overrides were aligned with the same meaning.

## Comparison history

### Iteration 1 — blocked

- Compared the user-provided image with `31-replay-contrast-before.png`.
- P1: near-white text on lime made the label unreadable.
- Cause: `.secondary-action` set only the text color and inherited the shared `button` lime background.

### Iteration 2 — passed

- Changed shared `button.secondary-action` styling to dark background + light text.
- After-fix `32-replay-contrast-after.png`: computed text `rgb(244, 241, 232)`, background `rgb(13, 16, 19)`, contrast ratio `16.89:1`.
- Rechecked completed desktop/mobile states in `33-rescue-result-contrast-desktop.png` and `33-rescue-result-contrast-mobile.png`.
- Checked all five Secondary Actions visible after a Rescue Room run: zero forbidden pairs.
- Checked 32 visible Secondary Actions across 12 primary routes: zero forbidden pairs. Every route returned HTTP 200 with zero console errors.

## Full-view comparison evidence

Desktop and mobile Outcome pages were checked for the hierarchy of Evidence Timeline, Replay, the three next-strategy buttons and Evidence Download. Primary actions use lime + dark; secondary actions use dark + light. No horizontal overflow, clipped buttons or overlaps were observed.

## Focused region comparison evidence

Compared the same Replay button in `31-replay-contrast-before.png` and `32-replay-contrast-after.png`. Before the fix, text and background had similar luminance and indistinct edges. Afterward, light text was visible on a dark pill at `16.89:1` contrast in the normal state. The hover-equivalent state observed on mobile also remained legible with a dark background and lime text.

## Required fidelity surfaces

- Fonts / typography: preserved the existing monospace font, weight and size. Translated labels were not clipped.
- Spacing / layout: explicitly set the Secondary Action border and existing padding. Desktop/mobile layouts remained intact.
- Colors / tokens: separated primary and secondary foreground/background pairs and documented the forbidden pairing.
- Image quality: outside this correction's scope; the Incident Storyboard asset was unchanged.
- Copy / content: labels and the meaning of the Evidence were unchanged.

## Implementation checklist

- [x] Removed lime-background/white-text styling from shared Secondary Actions.
- [x] Corrected foreground-only overrides in Strategy Preset / Submit Bar.
- [x] Verified completed Rescue Room states on desktop/mobile.
- [x] Checked 32 visible Secondary Actions across 12 primary routes.
- [x] Checked HTTP status and console errors on all 12 routes.
- [x] Verified no horizontal overflow on Rescue Room desktop/mobile.
- [x] Added forbidden-color detection to the UI verifier.
- [x] Recorded the permanent prohibition in this document.

## Strategy Game UX Pass A — 2026-09-10

### Scope and source visual reference

- Selected design: `artifacts/ux-audit-rescue-room/34-strategy-game-selected.png` (1536 × 1088 px)
- Route: `http://localhost:3000/arenas/rescue-room`
- Implementation: `apps/web/src/components/rescue-room-workbench.tsx`, `apps/web/src/app/globals.css`
- Desktop: CSS viewport 1440 × 1000, deviceScaleFactor 1
- Mobile: CSS viewport 390 × 844, deviceScaleFactor 1
- States checked: Hero, before Doctrine selection, Reference Doctrine running, completed run, Previous Revision, and completed AI Commander run.

### Comparison evidence

- Desktop Hero: `artifacts/ux-audit-rescue-room/35-strategy-game-desktop-hero.png`
- Desktop Doctrine Builder: `artifacts/ux-audit-rescue-room/36-strategy-game-desktop-builder.png`
- Desktop Live Decision: `artifacts/ux-audit-rescue-room/37-strategy-game-desktop-live.png`
- Desktop Debrief: `artifacts/ux-audit-rescue-room/38-strategy-game-desktop-result.png`
- Mobile Doctrine Builder: `artifacts/ux-audit-rescue-room/39-strategy-game-mobile-builder.png`
- Mobile Debrief: `artifacts/ux-audit-rescue-room/40-strategy-game-mobile-result.png`
- Real AI Commander Debrief: `artifacts/ux-audit-rescue-room/41-strategy-game-ai-result.png`

### Comparison history

#### Iteration 1 — blocked

- Compared the source and first desktop implementation together. The hierarchy matched: dark grid, lime / cyan / orange, oversized heading, horizontal Doctrine rows, selected rules and Service Toolkit.
- [P1 / Mobile layout] The Lock CTA remained a two-column grid and overlapped explanatory copy.
- [P1 / Mobile comparison] The four-column baseline table was clipped offscreen, preventing simultaneous comparison of all three outcomes.
- [P2 / Content hierarchy] Repeating `Unknown incident. One doctrine.` in the Hero and Builder weakened the source's transition from briefing to Doctrine selection.
- Fix: changed the mobile deploy bar to one column, converted baselines into per-strategy three-outcome cards, and changed the Builder heading to `Choose your strategic doctrine.`.

#### Iteration 2 — passed

- Recompared the source, desktop Hero and desktop Builder together.
- All three Doctrines were selectable; rules and permitted services expanded only for the selected Doctrine. The primary CTA locks the strategy before execution.
- The live view shows four lanes—Protocol / Commander / Service Agents / Evidence—and a Decision Lens for Trigger / Rule / Cost-Time / State Change / Alternatives. The raw transcript moved into a secondary `details` element.
- The Debrief compares Your Commander / Always Pause / Never Pause / Previous Revision in independent User Loss, Demand Served and Spend columns, without a weighted score.
- Doctrine, Service, Lock CTA and baseline comparison fit a single column on mobile, with no horizontal overflow.
- The selected design's icon tiles had no equivalent existing icon set. Existing numbering, colors and borders were used consistently rather than fabricated SVG or CSS artwork.

### Required fidelity surfaces

- Fonts / typography: preserved existing display sans and monospace fonts. Oversized headings, Doctrine names, rules and Evidence hierarchy followed the source. No desktop/mobile clipping.
- Spacing / layout: reproduced horizontal Doctrine rows, selected expansion, Toolkit / Value Focus separation and the bottom Lock CTA. Mobile uses a vertical stack.
- Colors / tokens: used only existing dark surfaces, lime, cyan and orange. No forbidden pairs on visible interactive elements.
- Image quality: used the existing high-resolution Incident Storyboard through Next Image, without stretching, halos or placeholders on desktop/mobile.
- Copy / content: explained what each strategy protects and sacrifices, hidden true state, information cost and simulated Game Credits before execution.
- States / interactions: checked three Doctrines, Reference / AI runtime switching, alert selection, advanced AI settings, Lock, Play / Pause / Step / Skip, raw log, baseline comparison, Previous Revision, Retry and Evidence Download.
- Accessibility: retained semantic buttons, `aria-pressed`, form labels, table roles, live regions, keyboard focus and reduced-motion handling. Zero desktop/mobile console errors.

### Automated verification

- `pnpm verify:rescue-room-ui` returned HTTP 200 on desktop/mobile.
- Verified three Doctrines, four decision lanes, baseline comparison, Previous Revision, six services and four Value Pools.
- Completed reference replay and real AI Commander action replay.
- No horizontal overflow, runtime overlay, console errors or forbidden contrast pairs on desktop/mobile.

final result: passed

## Rescue Room Incident Theatre Pass C — 2026-09-11

### Changes and evidence

- Strategy Builder: `artifacts/ux-audit-rescue-room/42-incident-theatre-desktop-builder.png`
- Desktop Incident Theatre: `artifacts/ux-audit-rescue-room/43-incident-theatre-desktop-live.png`
- Mobile Incident Theatre: `artifacts/ux-audit-rescue-room/44-incident-theatre-mobile-live.png`
- Desktop Debrief: `artifacts/ux-audit-rescue-room/45-incident-theatre-desktop-result.png`
- Real AI Commander Debrief: `artifacts/ux-audit-rescue-room/46-incident-theatre-ai-result.png`
- Implementation: `apps/web/src/components/rescue-incident-theatre.tsx`, `apps/web/src/components/rescue-room-workbench.tsx`, `apps/web/src/app/globals.css`

The live view changed from an ever-growing event log to one Incident Theatre showing five chapters, three actors, service payment, Evidence return, Protocol action and three outcomes together. The canonical transcript remains audit evidence, initially collapsed. Only playback groups events into story beats sharing the same game minute.

The Strategy Builder continuously explains all ten deterministic settings and their tradeoffs, summarized as `Spend / Certainty / Containment`. These are explanatory labels, not a weighted evaluation score. The AI Playbook distinguishes model tuning from Commander strategy.

### Automated verification

- Desktop/mobile returned HTTP 200; verified three actors, five chapters, ten parameter explanations and three strategy summaries.
- Verified the initially collapsed raw transcript, replay reset, Previous Revision and same-Episode baseline comparison.
- Mobile with `prefers-reduced-motion: reduce` reaches the final Evidence directly.
- No horizontal overflow, runtime overlay, console errors or forbidden contrast pairs on desktop/mobile.
- Forty deterministic Rescue Room/API tests, workspace typecheck and the Next.js production build passed.
- A real OpenAI Commander completed a run including service purchase and passed action-replay verification under the fixed runtime.

final result: passed
