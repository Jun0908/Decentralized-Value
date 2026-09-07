**Comparison Target**

- Source visual truth: `apps/web/public/images/weighted-score-vs-open-frontier.png`
- Implementation screenshots: `tmp/design-qa/hero-final-1045.png`, `tmp/design-qa/hero-final-1045-measured.png`, and `tmp/design-qa/hero-final-illustration-1045.png`
- Responsive evidence: `tmp/design-qa/hero-final-1024.png`, `tmp/design-qa/hero-final-1440.png`, and `tmp/design-qa/hero-final-mobile.png`
- Route and theme: `/`, dark theme, unauthenticated public landing page
- Primary viewport: 1045 × 900 CSS px at device scale factor 1
- Responsive viewports: 1024 × 900, 1440 × 1000, and 390 × 844 CSS px at device scale factor 1
- Source dimensions: 1536 × 1024 px. It is rendered proportionally at 514.44 × 344.64 CSS px in the primary implementation capture; no density resampling was needed for the browser capture.
- Implementation dimensions: full-view capture 1045 × 900 px; focused illustration capture 515 × 345 px; density 1×.
- States: ready and successful live-proof execution.

**Full-view Comparison Evidence**

- The implementation preserves the source illustration's warm paper, black ink, lime, blue, and coral visual language while placing it against the existing black product shell.
- The hierarchy matches the approved brief: plural-values eyebrow, three-line thesis, concise explanation, two stable CTAs, one simple comparison visual, then the live EVM proof.
- At 1024 × 900, the thesis, both CTAs, comparison visual, live proof metrics, and three-item evidence strip remain visible without horizontal overflow.
- At 1440 px, the heading remains at three lines. At 390 px, the heading remains at three lines and both CTAs are visible before the illustration.

**Focused Region Comparison Evidence**

- The focused illustration capture was compared in the same visual input as the 1536 × 1024 source asset and the full Hero capture.
- The asset is not recreated with CSS or SVG. The source raster is rendered directly with its original 3:2 aspect ratio, clear labels, intact paper texture, and no visible stretching or crop loss.
- The visible copy remains legible at the primary desktop size and retains the intended single-score-versus-open-frontier contrast.

**Findings**

- No actionable P0, P1, or P2 differences remain.
- Fonts and typography: the display hierarchy is strong, the H1 is capped at three lines across tested breakpoints, supporting text is at least 14 px, and monospace evidence text remains readable.
- Spacing and layout rhythm: Hero columns, CTA spacing, proof panel, and evidence strip align cleanly; no horizontal overflow was observed.
- Colors and visual tokens: the lime accent, near-black shell, warm paper, blue, and coral are consistent with the approved direction and maintain clear contrast.
- Image quality and asset fidelity: the generated hand-drawn illustration is sharp at all tested sizes, preserves its aspect ratio, and is not replaced by a code-native approximation.
- Copy and content: the approved eyebrow, thesis, body, CTA labels, EVM metrics, status messages, result hash, and Sepolia verification label are present.
- Interaction: the live-proof request returned HTTP 200. Button, verification link, and proof-panel dimensions were identical before and after execution. The success state updated only the proof panel.
- Accessibility and runtime: semantic headings, figure alternative text, live status, and button disabled state are present. No application console errors were reported in the final browser pass.

**Comparison History**

1. Initial desktop comparison found a P2 wrapping issue at 1440 px: the H1 occupied four lines, exceeding the approved maximum. The display size cap and available line width were adjusted. Post-fix evidence in `tmp/design-qa/hero-final-1440.png` shows exactly three lines.
2. Post-fix comparison at 1045 × 900 found no P0/P1/P2 differences. The full-view and focused illustration captures show the intended hierarchy and asset fidelity.
3. Interaction comparison verified zero layout shift: the Run button remained 172 × 44 px, the Sepolia link remained 142.81 × 44 px, and the proof panel remained 998 × 219.75 px before and after the successful request.

**Open Questions**

- None.

**Implementation Checklist**

- [x] Keep the H1 at three lines or fewer.
- [x] Use the approved hand-drawn comparison asset in the Hero.
- [x] Keep both CTA positions fixed during execution.
- [x] Update only the proof panel after a successful run.
- [x] Verify desktop, narrow desktop, and mobile layouts.
- [x] Verify the live evaluation request and final status copy.

**Follow-up Polish**

- No blocking polish remains for this Hero handoff.

final result: passed
