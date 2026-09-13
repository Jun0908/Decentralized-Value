# Documentation

Choose the route relevant to your task. [STATUS](STATUS.md) describes the current implementation; the [Plan 1–12 index](development/plans/README.md) presents the development sequence created during ETHOnline 2026.

## Review the project

- [Product model](PRODUCT.md): independent values, correctness gates and comparable evidence.
- [Current status](STATUS.md): implementation and verification details.
- [Architecture](ARCHITECTURE.md): system and trust boundaries.
- [Demo walkthrough](hackathon/DEMO.md), [submission scope](hackathon/submission/HACKATHON_SUBMISSION.md) and [English submission copy](hackathon/submission/SUBMISSION_COPY_EN.md).

## Review sponsor integrations

- [Integration overview](INTEGRATIONS.md)
- [Sponsor demo, evidence and representative source](hackathon/sponsors/SPONSOR_DEMO.md)
- [ENS / CRE / Bazantic index](hackathon/sponsors/README.md)
- [Machine-readable deployment records](evidence/deployments/)

## Build or participate

- [Environment configuration](development/guides/ENVIRONMENT.md)
- [Rescue developer quickstart](development/guides/RESCUE_AGENT_QUICKSTART.md)
- [API contract](../openapi/frontier-v1.yaml), [SDK](../packages/sdk/README.md) and [CLI](../packages/cli/README.md)
- [Arena specifications](product/arenas/)
- [Rescue operator runbook](development/guides/RESCUE_EXECUTION_BATCH.md)

## Four purpose-based folders

The root contains five project-wide documents: this index, `STATUS.md`, `PRODUCT.md`, `ARCHITECTURE.md` and `INTEGRATIONS.md`. The public demo guide lives in `hackathon/DEMO.md`; video-production material is local-only.

| Purpose                                                    | Folder                                |
| ---------------------------------------------------------- | ------------------------------------- |
| Product rules, Arenas and whitepaper                       | [product/](product/README.md)         |
| Plans 1–12, setup guides and hackathon development history | [development/](development/README.md) |
| Submission, sponsor demonstrations and recording           | [hackathon/](hackathon/README.md)     |
| Verification reports and machine-readable evidence         | [evidence/](evidence/README.md)       |

**Earlier plans and development records are work from this hackathon, not pre-event development.** Plans 1–12 share one folder and index. Supporting iterations and unchanged originals live under [development/history](development/history/README.md), replacing the former Archive split.

Some original plans and snapshots retain their source language. English indexes explain their role. The [Japanese concept paper](product/whitepaper/Value_Decentralization_Whitepaper_JP.pdf) remains source-language material.

Owner-operation notes, internal coordination and video-production documents are consolidated under Git-ignored `Docs/local-only/`. Video output under `artifacts/video-demo/` is also ignored. This local folder is not part of the four public documentation sections. Public documentation must not link to local-only files. Keep implementation plans, asset-generation provenance, development records, test results and execution/payment evidence published.

## Maintenance

Keep current availability in STATUS, rules in product specifications, development plans in `development/plans/`, and dated test observations in `evidence/verification/`. Link to those sources instead of copying changing status tables.

Do not split numbered plans by completion status. Preserve the development sequence; mark the date and implementation status inside the document. Supporting reviews, handoffs and source snapshots belong in `development/history/`.

Keep raw evidence and original snapshot bytes unchanged. Paths inside historical JSON are provenance, not necessarily current navigation links. When moving authored documents, repair incoming and outgoing links. Do not change experimental results during editorial cleanup.

`pnpm exec vitest run tests/docs-structure.test.ts` checks the folder layout, unified Plans 1–12 and documentation links. The [earlier reorganization report](evidence/verification/DOCS_REORGANIZATION_2026-09-13.md) describes its dated five-folder checkpoint, not the current layout.

Repository entry: [README](../README.md). Coding guide: [AGENTS.md](../AGENTS.md).
