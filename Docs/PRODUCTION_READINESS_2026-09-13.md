# Production Readiness — Review Follow-up

Date: 2026-09-13. Source: user-supplied Claude Code review, followed by local source inspection and four nonmutating public GET checks.

Status: **documented and partially independently reproduced; fixes not implemented in this documentation task.**

This supplements the earlier [public verification report](PUBLIC_VERIFICATION_2026-09-13.md). That report covered pages, deterministic practice, proof handling, evidence downloads, and a non-AI SDK journey. It did not test public paid AI execution.

## 1. Findings and evidence

| Finding                         | Evidence available in this review                                                                                                                                                                                                                      | Required change                                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Public AI unavailable           | Independently reproduced `GET /v1/rescue-room`: 200, `commanderAvailable: false`. User reports Ocean POST 503 / `SEASON_UNCONFIGURED`; the source's matching error path requires an available OpenAI backend/key. No paid POST was repeated.           | Configure and validate the intended production AI path with explicit cost/concurrency limits, then verify a real authorized run.      |
| Long Ocean request              | Source awaits a complete season in one HTTP request; no `maxDuration` found under Web source. User reports a local 180-second wait and historical 3–6-minute seasons. Actual Vercel project limits were not inspected.                                 | Verify project/runtime limits; choose a bounded request duration or persistent incremental/job execution without changing game rules. |
| CRE-generated bundles linted    | `eslint.config.mjs` lacks a workflow-generated-directory ignore. User reports six `no-this-alias` errors in generated bundles. The complete CI failure/count was not independently rerun.                                                              | Add the narrow generated-bundle ignore and test both clean and post-CRE-build lint.                                                   |
| Ocean undiscoverable            | Source omits Ocean from `/v1/arenas`; no Ocean OpenAPI entry. Public `GET /v1/ocean-commons` independently returned 404. A season POST route and sandbox support do exist.                                                                             | Add metadata/discovery and versioned request/result/error schemas; generate SDK/CLI support.                                          |
| Mixed list identifiers          | Public seven-entry list independently returned two `challengeId` objects and five `arenaId` objects; one challenge ID is bytes32.                                                                                                                      | Add a canonical arena identity without breaking legacy IDs; keep challenge/context IDs distinct.                                      |
| Rescue parent URL               | `/rescue-room` independently returned 404; no parent `page.tsx` exists in source. Child evidence pages exist.                                                                                                                                          | Add a landing page or redirect to `/arenas/rescue-room`; test navigation.                                                             |
| Stale Sepolia showcase metadata | Public response and source both contain `contract-implemented-not-deployed` and null addresses; a test fixes that old string. Existing saved payment evidence records deployment/payment. User also reports chain reads; these were not repeated here. | Expose validated deployment/showcase evidence separately from deterministic practice and update the contract/tests.                   |

Public origin checked: <https://web-rho-seven-d6te7t3f0y.vercel.app>. Four GET requests were made; no credential values were read, no model inference was triggered, and no chain transactions were sent.

The unavailable flag shows that the deployed runtime lacks an available Commander configuration under the current code. It does not by itself prove the key is absent from every Vercel environment or that no operator-run AI has ever executed.

## 2. Priority and ownership

| Priority | Work                                                            | Owner                                            |
| -------- | --------------------------------------------------------------- | ------------------------------------------------ |
| P0       | Public AI configuration, spend controls, and bounded live smoke | Plan 12 infrastructure, Plan 9/10 runtime owners |
| P0       | CRE-generated bundle exclusion and clean/post-build lint        | Plan 11 integration tooling                      |
| P0       | Ocean request-duration/recovery path                            | Plan 10 execution semantics + Plan 12 API/jobs   |
| P1       | Ocean discovery/OpenAPI/SDK                                     | Plan 12, with Plan 10 artifact contract          |
| P1       | Canonical arena identifiers with compatibility                  | Plan 12 shared registry                          |
| P1       | Rescue parent navigation                                        | Plan 9 Web integration                           |
| P1       | Evidence-backed deployment metadata                             | Plan 9 payment model + Plan 12 public contract   |

Complete the small lint/navigation/metadata fixes alongside—not instead of—the AI execution gate. Public secret configuration and a paid smoke require the intended deployment and spending scope to be clear.

## 3. Public AI acceptance gate

- Confirm the exact Vercel project, production environment, deployed revision, and supported model.
- Store the key as a server-side secret, never under `NEXT_PUBLIC_`, in Git, or in a public artifact.
- Confirm provider budget and application limits before enabling an anonymously callable expensive endpoint. In-memory/IP-only limits are not sufficient evidence of a global spending cap.
- Deploy the configuration change; environment changes do not alter an existing deployment. [Vercel environment variables](https://vercel.com/docs/environment-variables).
- Return accurate capability/readiness information and a useful disabled-state message.
- Run one explicitly authorized, capped real inference path in each required arena. Record model provenance, elapsed time, usage, completion/failure, and replayable evidence.
- Verify timeout, duplicate submission, and disconnect behavior without automatic duplicate spending.

A passing readiness Boolean is necessary but not sufficient: a valid key, model authorization, execution duration, and budget must all work in the deployed environment.

## 4. Duration decision

Do not assert a universal short Vercel timeout or guaranteed 504. Vercel supports configurable function durations; the applicable limit depends on deployment settings and runtime. Its current documentation also describes extended duration for supported plans/runtimes. The actual project configuration remains to be checked. [Vercel function duration](https://vercel.com/docs/functions/configuring-functions/duration).

Choose among:

1. An explicitly bounded single-season request if measured duration fits the verified deployment limit with headroom.
2. Server-authoritative, persisted per-round execution with idempotent sequencing and resumable progress.
3. A durable worker/job service with polling or events.

Streaming is useful for visibility but does not make state durable or bypass execution limits. Do not shorten the season or replace the live model with a fixture merely to make a smoke pass under the old context.

## 5. Acceptance checks for the remaining fixes

- **Lint:** authored workflows still receive lint; generated bundles do not. Run lint after generating both CRE workflows, then run the remaining CI stages and report each result.
- **Discovery:** Ocean appears with a stable ID, metadata, supported/available capabilities, typed input/output/errors, starter information, and actual operation URLs.
- **IDs:** old clients keep working; new clients use one explicit canonical arena field. Context/challenge identity retains its existing meaning.
- **Navigation:** the parent route resolves to the intended experience on desktop/mobile; child evidence routes remain valid.
- **Payments:** manifest/API metadata matches validated deployment evidence, while practice remains `game-credits`. Do not change evaluator/result hashes to report an operational deployment.
- **Regression:** preserve existing validation, deterministic hashes, proof rejection, and independent metrics. Regenerate fixtures/types only when their public contract genuinely changes.

## 6. Evidence to preserve

The user reports successful public page checks, input validation, sandbox revision limits, production/local Ocean hash agreement, working deterministic evaluators, safe rejection of invalid proofs, and passing TS/Solidity tests. These positives remain part of the review, with their original execution scope and counts; they do not substitute for public AI verification.

Recorded Sepolia payment and official CRE simulation evidence should remain visible. The corrective action is to align machine-readable availability with actual capabilities, not to erase demonstrated work or imply broader completion.

This task updates plans and evidence boundaries only. No runtime fix, secret registration, deployment, paid AI run, or Push has been performed.
