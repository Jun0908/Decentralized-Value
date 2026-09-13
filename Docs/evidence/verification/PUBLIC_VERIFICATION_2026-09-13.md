# Public site and submission-link verification — 2026-09-13

Target: <https://web-rho-seven-d6te7t3f0y.vercel.app>. These checks used real public HTTPS, separately from the local preview.

## Scope and later observations

This historical check covered pages, deterministic Practice, real proof handling, saved evidence and non-AI SDK requests. It **did not test public AI inference**. A subsequent initial production review found an unavailable Commander flag, Ocean discovery 404, Rescue parent 404 and stale payment metadata. The later [six-Arena browser audit](ARENA_BROWSER_QA_2026-09-13.md) observed Commander availability true and corrected Rescue navigation/metadata, but still found Ocean discovery missing and two mobile clipping defects. [Production follow-up](PRODUCTION_READINESS_2026-09-13.md).

These dated results are not an all-features production-readiness approval. Later source changes and live AI execution need their own verification.

## Relationship to published source

- Pushed commit: [033a73c](https://github.com/Jun0908/Decentralized-Value/commit/033a73cc77d045affb3c2703c42313c6e2c4ca69), including the three lower-Arena practice labs and illustrations.
- GitHub's Vercel status was success. [Deployment status](https://vercel.com/jkawai0908-9469s-projects/web/43ktWN1dv4GhVbnhMxDNSynPKy5P). Public pages exposed the corresponding controls/images.
- The connected Vercel account could not list the project, so no management-API production-alias/SHA reconciliation or runtime-log audit was performed. Evidence here is GitHub status plus actual public behavior.
- First Missions were added afterward; their initial local verification is not retroactively part of this commit's public check. The later browser audit separately exercised them.

## Executed checks

| Target                                                                 | Observed                                                                                                                            | Boundary                                                                                                           |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Calldata                                                               | 1440/390 px: real EVM measurement, rule edit, revision/context change, download/hash agreement                                      | No arbitrary participant code or Ethereum transaction                                                              |
| Microgrid                                                              | Both widths: policy changes, execution, three-axis comparison, replay recalculation, JSON and Classic switch                        | Deterministic modeled training, not a physical grid                                                                |
| Secret Gate                                                            | Both widths: real proof accepted, duplicate HTTP 409, receipt reports durable-redis; four-proof generation/verification also passed | No Redis restart, multi-region race or long-term-operation certification; competition remains PIVOT                |
| Three illustrations                                                    | Both widths: actual image loading, aspect ratio, three-step copy and overflow checks                                                | Concept artwork is not measurement evidence                                                                        |
| Home / Arena list / upper three Arenas / sponsors / English submission | Fourteen views, HTTP 200, no unexpected console errors or document-level overflow                                                   | Upper Arenas were entrance/display checks, not all execution paths; later deeper audit found clipped inner content |
| Sponsor JSON                                                           | ENS/CRE/Bazantic downloads matched committed JSON; six downloads across widths                                                      | Recorded executions, not new transactions/inference                                                                |
| Public Rescue API → SDK                                                | Six HTTP requests all 200; manifest, Starter, two Doctrine evaluations, Starter hash, SDK integrity and repeated result agree       | Anonymous non-billable Practice, not signatures, payment, Final or independent-user success                        |

The lower labs had no unexpected console errors, prohibited colors or horizontal overflow in checked views. Secret Gate's expected HTTP 409 console messages were counted separately, one per width. Two disposable public commitments were enrolled and each used once; private identities were not published. New AI calls and transfers: zero.

## Reproduction and local artifacts

```powershell
pnpm exec tsx scripts/verify-arena-labs.ts https://web-rho-seven-d6te7t3f0y.vercel.app --public-practice
pnpm exec tsx scripts/verify-arena-stories.ts https://web-rho-seven-d6te7t3f0y.vercel.app --public-practice
pnpm exec tsx scripts/verify-public-submission.ts
pnpm exec tsx scripts/verify-rescue-practice-onboarding.ts https://web-rho-seven-d6te7t3f0y.vercel.app
```

The first command creates disposable groups and consumes proofs in the real store; it does not pay. Reruns affect rate limits/state and should not be unbounded.

Ignored local screenshots/results: `.frontier/arena-public-qa/`, `.frontier/arena-public-story-qa/`, `.frontier/public-submission-qa/`. These are local QA, not public evidence replacements. The submission check timestamp was 2026-09-12T23:41:21Z, September 13 in Japan.

## Submission confirmations still separate

- [English submission copy](../../hackathon/submission/SUBMISSION_COPY_EN.md) describes each sponsor's implemented and unfinished scope.
- Final voiced-video URL/access and application submission were not verified by this check.
- The owner selected ENS, Chainlink and Bazantic; prize category, participation track, judging start commit and actual human contributions remain owner-confirmed.
- Later local code is not part of this earlier published-commit check. Unknown Final, third-party market, hosted Recipe and live TEE remain distinct unfinished gates.
