# Documentation reorganization — 2026-09-13

Scope: the user-approved five-purpose layout, not a feature release or deployment. Start navigation at [Docs home](../../README.md).

**Later same-day layout update:** the owner clarified that the earlier plans were also created during this hackathon. The current layout now has four purpose-based folders: all Plans 1–12 are together in `development/plans/`, with supporting records in `development/history/`. The former Archive split is removed. The demo guide lives under `hackathon/recording/`, leaving five root documents. The five-folder layout described below is the earlier checkpoint, not the current navigation contract.

The follow-up preserved 42 source/evidence files byte-for-byte, translated the root Design QA document while retaining its original, and passed five documentation tests covering layout, Plans 1–12, relative links/heading anchors and the English contrast rules. It did not rerun browser, inference, payment or deployment checks. [Current development sequence](../../development/plans/README.md).

## Changes

- Kept six project-wide entry documents at the root and grouped detail under `product`, `development`, `hackathon`, `evidence`, and `archive`.
- Preserved familiar Plan filenames. Each purpose index explains reading order rather than repeating a live status table.
- Moved four completed batch/connection/inventory notes to Archive. Active coordination, setup guides, recording material and submission copy have distinct homes.
- Updated relative navigation, README/AGENTS hints, TypeScript imports, evidence readers/writers and the Rescue public evidence URL to the new paths.
- Kept raw historical JSON, originals, PDF and image bytes unchanged. Internal provenance paths in recorded JSON remain historical; they were not rewritten to make old records look newly generated.
- Replaced stale copied availability statements in Plan 9/12 with references to STATUS. No failed experiment, pending gate or unfavorable outcome was removed.

## Verification

- Three deterministic structure tests added; the targeted API, sponsor evidence, public operator, SDK integrity and structure selection passed **154 tests across five files**.
- Workspace TypeScript checks passed. Generated SDK contract/provenance was synchronized after its canonical source's evidence URL moved.
- Recorded Rescue submission replay passed with the same outcome/transcript/comparison hashes; **no model call and no chain transaction**. This replay is not authentication of original model or payment provenance.
- The migration checked **41 protected files** byte-for-byte, including **24 raw originals** and all 11 JSON evidence records. The original SHA manifests remain valid.
- Navigation checks passed across 109 Markdown files and 540 relative links, with no missing file or heading targets.
- Full ESLint and repository Prettier checks passed. The local production build passed with Webpack; this does not verify the default Turbopack build.
- Playwright checked five local production pages at desktop and mobile widths (10 page checks), with successful responses, visible headings and no browser console or page errors. All three sponsor evidence downloads matched the relocated JSON records, and the Rescue API returned the updated evidence path. Representative desktop/mobile screenshots were reviewed.
- These checks are separate from any public deployment. Local supporting logs and screenshots live in ignored `.frontier/`; they are not published evidence links.

This work does not resolve the previously observed Windows job-lock `EPERM`, certify full CI, rerun Solidity, execute paid operations or deploy the site. Its scope is organization, preserved evidence and functioning consumers of the relocated files.
