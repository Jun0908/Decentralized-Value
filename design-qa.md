# Design QA — Plan 7 disaster replay

## Evidence

- Source visual truth: `Docs/plans/Plan7.md` and `apps/web/public/images/disaster-response-network-normal.png`
- Rendered implementation: `http://localhost:3000/arenas/emergency-supply#build`, Codex in-app browser tab 26
- Implementation screenshot path: unavailable; the browser surface returned an in-session image capture but did not expose a file path
- Viewport: 1265 × 712 browser pixels
- Source asset: 1536 × 1024 pixels
- Implementation capture: 1265 × 712 pixels; CSS viewport and device density were not exposed by the browser surface
- State checked: default Strategy v2, East Port shutdown, initial placement, route failure, recovery, final result; a second strategy and Aftershock cascade were also checked

## Full-view comparison evidence

The replay uses the supplied network composition as the full-width stage rather than approximating it in CSS. The loadout remains visible at left while route markers cross the map, and the result overlays all four regions. Direct visual inspection found the intended dark/lime visual language, clear stage hierarchy, and a readable result state.

A required combined side-by-side comparison board could not be opened: the in-app browser blocked the data URL under its URL security policy and explicitly prohibited alternate workarounds. The source and implementation were therefore opened and inspected separately, which is insufficient for a formal passing result under the Design QA skill.

## Focused region evidence

Focused checks covered the replay toolbar, shipment markers, route-failure callout, recovery vault, four coverage bars, and comparison row. Text and controls were readable after the contrast fix, and the generated normal-state asset removed premature red failure marks.

## Required fidelity surfaces

- Fonts and typography: existing product display and mono hierarchy are preserved; phase headline and small trace labels remain legible at the checked viewport.
- Spacing and layout rhythm: evaluation now scrolls directly to the replay card, keeping loadout, toolbar, and most of the map in one viewport.
- Colors and tokens: existing black, white, lime, and red semantic tokens are reused. Secondary replay controls now use a dark surface with white text.
- Image quality and fidelity: the 1536 × 1024 project raster is rendered with Next Image; no CSS drawing or placeholder replaces the network art.
- Copy and content: phase labels state the exact quantities returned by the evaluator; the comparison uses signed cost, kit, and percentage-point deltas.

## Findings

- No known product P0/P1/P2 issue remains from the separately inspected states.
- Formal visual comparison remains blocked because the two artifacts could not be put into one permitted comparison input.

## Comparison history

1. P1 contrast: replay controls inherited lime background with white text. Fixed with a dark button surface, white text, and lime hover state. Post-fix browser capture showed readable controls.
2. P2 sequencing: the original background exposed red failure marks during the initial-placement phase. Generated a non-destructive normal-state sibling asset and moved failure signaling to the timed UI. Post-fix capture showed no red X before the failure phase.
3. P2 viewport focus: evaluation originally scrolled to the section heading, leaving most motion below the fold. It now scrolls to the replay experience with sticky-navigation offset. Post-fix capture showed the full loadout and active route map immediately.

## Primary interactions tested

- Run practice simulation
- 15-second autoplay across placement, disruption, recovery, and result
- Replay
- Scenario switch
- Improve strategy return
- Strategy preset change and previous-result comparison

Server output showed no runtime exception during these interactions. Direct browser-console collection was not available on the active surface.

## Implementation checklist

- [x] Exact evaluator trace drives the visual replay
- [x] Worst scenario autoplays
- [x] Other scenarios remain selectable
- [x] Replay and Improve strategy work
- [x] Result shows cost, worst delivery, worst-region coverage, losses, recovery, and previous delta
- [ ] Re-run formal QA when a permitted combined comparison capture is available

final result: blocked
