# Plan 12 — Public API, SDK, and CLI

Created: 2026-09-11. English current edition: 2026-09-13.

Make the same arena capabilities usable by people in the Web app and by external agents through a discoverable, typed, verifiable contract.

This edition consolidates the current requirements and execution record. The [original plan](archive/plan-history-2026-09-13/Plan12.md) preserves the detailed original inventory and dated checkpoints. The current monorepo is the source of truth.

## 1. Current position

| Area                | Delivered                                                                                   | Remaining                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| SDK/CLI integration | Existing SDK and CLI integrated into the monorepo                                           | Broader arena coverage                                                       |
| Contract tooling    | Nonmutating generation checks, fixtures/provenance, CI integration                          | Complete public response schemas and unified documentation generation        |
| Distribution checks | Real tarballs installed in an empty consumer; ESM, NodeNext, CLI smoke                      | Linux verification, release/version matrix, npm publication                  |
| Rescue practice     | Typed API/SDK flow, explicit integrity verification, public six-request preflight           | Public AI execution and competition lifecycle                                |
| Operator jobs       | Single-host persistent Rescue jobs, authenticated loopback HTTP, separate SDK/client script | Multi-host production jobs, public events/cancel, external-owner scopes      |
| Ocean               | Working domain engine, Web entry builder, sandbox submission, AI season route               | Discovery, OpenAPI/generated SDK types, durable public execution             |
| Final/pools         | Existing domain-specific components                                                         | End-to-end Rescue/Ocean freeze, unknown final, allocation, and reward access |

The public preflight on 2026-09-13 verified **non-AI doctrine practice**, not publicly available inference. The subsequent review confirmed `commanderAvailable: false`, missing Ocean discovery, mixed arena ID fields, and stale payment showcase metadata. See [production readiness](PRODUCTION_READINESS_2026-09-13.md).

## 2. Immediate release priorities

These take precedence over adding more arena features:

1. **Public AI readiness:** verify the Vercel project/environment, server-side credentials, model access, budget, concurrency, and deployment configuration. Enable only an explicitly bounded execution path, then perform an authorized live smoke test.
2. **CRE build/lint compatibility:** exclude generated workflow bundles from ESLint and verify lint both before and after generation. This does not mean suppressing errors in authored workflow source.
3. **Ocean duration and recovery:** measure the actual function and application limits; add a suitable route duration and/or bounded persistent execution. Preserve the same game horizon and replay rules.
4. **Ocean discovery contract:** add metadata and typed operation schemas, then generate SDK/CLI contracts and check a real external-client journey.
5. **Canonical arena identity:** provide one stable arena identifier with explicit challenge/context fields while preserving legacy compatibility.
6. **Navigation:** add a `/rescue-room` landing page or redirect to the canonical arena route.
7. **Evidence-backed payment metadata:** report the recorded Sepolia showcase without implying that public practice transfers tokens.

Configuration alone is not a successful AI run. A longer request timeout alone is not durable execution. A saved successful operator run is not evidence of public endpoint readiness.

## 3. Source and compatibility strategy

The SDK source repository was [SDK-Decentralized-Value](https://github.com/Jun0908/SDK-Decentralized-Value), inspected at `f84d82512c43d0dc2b34a416d9821691c774dd89`. The existing `packages/sdk`, `packages/cli`, tests, and fixtures were already integrated when this plan began.

The first batch ported the missing contract-generation and package-verification workflow to the current monorepo. Do not re-merge unrelated history, replace newer code with the old repository, or maintain two manually edited API type sources.

If a separate distribution repository remains useful, export a verified release from the monorepo. Preserve old URLs, synchronous practice behavior, context checks, and existing clients while adding versioned capabilities.

The original inventory reported 63 paths/operations and 46 success responses without body schemas. Those were point-in-time counts, not a current automated completeness claim. Regenerate an explicit gap inventory during the next contract change.

## 4. Public API contract

### Schema generation

- [x] Port contract synchronization and package verification.
- [x] Add nonmutating `contracts:cli:check` and `contracts:sdk:check`.
- [x] Generate SDK types, request schemas, practice fixtures, and direct-source provenance.
- [x] Preserve Zod business refinements, including `superRefine`, in the adopted generation path.
- [ ] Complete success and error body schemas for exposed operations, starting with Ocean.
- [ ] Centralize public schemas without importing server-only auth, storage, or secrets.
- [ ] Define operation IDs, context preconditions, authentication, idempotency, 429 behavior, and asynchronous responses.
- [ ] Check handwritten runtime response validators as well as generated TypeScript types.
- [ ] Generate CLI help/reference, examples, and Web command documentation consistently.

Check mode must fail on missing or changed output without creating or rewriting files. Provenance identifies direct generation inputs; it is not a proof of every transitive runtime dependency.

### Arena registry and capability discovery

- [ ] Map stable arena ID, Web slug, challenge/round ID, context, and operation URLs from a shared registry.
- [ ] Reuse registry data in list/detail responses, CLI manifests, SDK adapters, and the Web.
- [ ] Preserve `supported` versus `available`, with reasons for unavailable capabilities.
- [ ] Separate deterministic practice, AI practice, storage, entry selection, freeze, evidence, and rewards.
- [ ] Publish artifact schemas, examples, outcome direction/unit/bounds, hard constraints, public episodes, runtime limits, auth, storage durability, and cost type.
- [ ] Version manifest/project/lock contracts. Discovering an unknown arena does not authorize an unsupported artifact.
- [ ] Add Ocean metadata and its existing season operation to OpenAPI; do not merely append an untyped label to the list.

Ocean's mission-based AI season and deterministic `OceanEntry` submission are different capabilities. Both require the relevant [Plan 10](Plan10.md) contract. Neither accepts arbitrary code or participant-selected hidden-final seeds.

### Result and execution envelope

Reuse [Plan 11](Plan11.md)'s versioned envelope rather than creating a competing hash system.

| Layer                | Contents                                                                           |
| -------------------- | ---------------------------------------------------------------------------------- |
| Context              | Evaluator, data, constraints, metrics, aggregation, episode/pack, comparison scope |
| Input                | Schema version, normalized artifact hash, source and disclosure policy             |
| Deterministic result | Correctness, failures, independent outcomes, episode evidence, result hash         |
| Execution evidence   | Job, mode, model/usage, time, signature/report/transaction references              |
| State                | Simulation/measurement, commitment, payment, and reward states independently       |

- [ ] Connect Ocean season results to typed context/artifact/result evidence.
- [ ] Add golden replay tests; timestamps and job/transaction IDs must not change deterministic result hashes.
- [ ] Define owner-only and public projections for mission, prompt, artifact, and transcript.
- [ ] Keep future observations and hidden-final data out of responses and errors.
- [ ] Distinguish practice credits, model charges, gateway fees, on-chain service payments, and rewards.

The API's current hardcoded `contract-implemented-not-deployed` showcase field is stale. Update it through a versioned deployment-evidence/read-model boundary; retain `paymentState: game-credits` for ordinary practice. Deployment knowledge should not silently mutate the deterministic game context.

## 5. Long-running AI execution

Ocean currently waits for a complete season inside one HTTP request. A durable alternative must preserve sequential game state, cost controls, and replay—not simply keep a socket open longer.

Proposed public operations are capabilities, not currently available URLs:

| Operation            | Required behavior                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| Create evaluation    | Validate owner, context, artifact, limits, and idempotency; return job identity and status location |
| Get job              | Queued/running/succeeded/failed/cancelled/reconciliation state, progress, result reference          |
| Get events           | Bounded cursor-based observation/action/service history                                             |
| Get result/evidence  | Completed bundle, with partial state explicitly distinguished                                       |
| Request cancellation | Stop future work where possible; do not imply refund or rollback of completed inference             |

Required implementation:

- [ ] Persist input/context, owner, lease, progress, checkpoint, result, and cost reservations; separate HTTP handling from execution.
- [ ] Bind owner + operation + idempotency key to input hash. Same key/different input must conflict.
- [ ] Use atomic claims, lease/fencing, and spending reservations under concurrent requests.
- [ ] Test duplicate workers, restart, lease expiry, timeout, completion/cancel races, and stale-writer rejection.
- [ ] If a provider request may have completed but its response was lost, record ambiguity and reconcile; do not automatically spend again.
- [ ] Fix model calls, tokens, cost, runtime, concurrent jobs, and retry policy server-side.
- [ ] Fix final-round checkpoint/recovery rules before entry; retries must not become selection for favorable model outputs.
- [ ] Keep existing short synchronous practice compatible.

For incremental per-round execution, persist the authoritative state and sequence server-side, bind checkpoints to owner/artifact/context, prevent duplicate round execution, and keep hidden state out of client-controlled payloads. A client-submitted “next state” is not a trustworthy checkpoint.

Streaming can improve progress visibility but does not remove a function's execution limit or provide durable restart semantics. Select a deployment-compatible path after measuring actual limits.

## 6. Implemented Rescue operator path

This is a limited single-host pilot, not the proposed public job service.

| Operation | Existing loopback route              | Boundary                                                                    |
| --------- | ------------------------------------ | --------------------------------------------------------------------------- |
| Create    | `POST /operator/rescue/jobs`         | 201 new / 200 same request; creation does not execute                       |
| List      | `GET /operator/rescue/jobs`          | Authenticated owner's jobs                                                  |
| Get       | `GET /operator/rescue/jobs/:id`      | Safe state, bounded event history, result                                   |
| Run       | `POST /operator/rescue/jobs/:id/run` | Explicit execution of an eligible queued job; 202 is not completion/payment |

`rescue-job-v1` persists ownership, input-bound idempotency, exclusive claim, fencing, and results to files. Ambiguous execution and interrupted running jobs require reconciliation instead of an automatic restart.

The server validates bearer auth, loopback binding/host, origin, and a 64 KiB input limit. Input is restricted to the existing public episode and normalized playbook workflow request.

`RescueOperatorClient` provides list/create/get/run using explicit loopback URL and authentication injection, response/job-ID checks, and safe error output.

`pnpm rescue:jobs` is a separate operator script with list/get/create/run, fixed `http://127.0.0.1:4318`, ignored-file token loading, and summary-only output. It is not a newly published command in the public `frontier` CLI.

The recorded 41 store/HTTP/SDK/CLI tests cover restart, ownership, duplicate requests, stale workers, ambiguous failures, and redaction. See [Plan 9 payment evidence](deployments/sepolia-rescue-service-demo.json). Public jobs, production DB/multi-host execution, dedicated events/cancel APIs, and external scopes remain follow-up work.

## 7. Storage, final entries, pools, and evidence

- [ ] Add owner-scoped single-submission retrieval, cursor pagination, and artifact export.
- [ ] Expose selected entry/revision/round state with optimistic concurrency for changes.
- [ ] Separate selection, deadline, freeze, evaluation, reveal, allocation, and payment.
- [ ] Enable Rescue/Ocean final operations only after their domain lifecycle exists.
- [ ] Return context, comparison-set hash, baseline, and metric definitions with frontier/pool queries.
- [ ] Reject invalid candidates before frontier admission and reject mixed-context comparison.
- [ ] Expose pool-specific allocation reasons and receipts without producing an overall score.
- [ ] Version evidence bundles and enforce disclosure timing and permissions.

An on-chain commitment does not by itself establish correct evaluation. A pool preview does not establish payment.

## 8. SDK and CLI

Keep existing `FrontierClient`, context locks, starter SHA verification, comparison, timeout, safe origins, authentication, and resumable submission.

### SDK

- [x] Add explicit `verifyRescueDoctrinePracticeIntegrity`.
- [x] Check requested artifact/context/episode, five hash layers, supplied receipt/order references, and displayed values.
- [x] Verify normal/tampered inputs in 11 tests covering 105 internal cases and in the tarball consumer.
- [ ] Add typed Ocean discovery/practice and explicit deterministic versus AI modes.
- [ ] Add public job creation, polling, events, download, and cancellation only alongside actual server operations.
- [ ] Verify selected entry IDs against request IDs inside the SDK, not only in the CLI.
- [ ] Extend individual submission retrieval and same-context multi-result/pool inspection.
- [ ] Add bounded JSON response size, external AbortSignal, and path-prefix gateway tests.
- [ ] Keep credentials bound to approved origins; separate gateway auth/fees from API bearer auth.

Integrity verification is explicit and scoped. Schema validation, hash matching, evaluator replay, signature checks, model provenance, and on-chain payment checks are separate levels. The integrity helper does not establish all of them.

### CLI

Retain init, offline check, context inspect/update, practice, local runs, comparison, device auth, resumable submit, and entry selection.

Future commands should support arena discovery, job status/wait/download, entry status, frontier/pool inspection, and evidence verification. They are proposals until implemented.

- [ ] Specify JSON schema, stdout/stderr, exit codes, timeout, and partial-result behavior.
- [ ] Keep `--json` separate from consent. Preserve explicit execution confirmation, idempotency, and credential storage.
- [ ] Distinguish local run IDs from server job IDs and client wait timeout from job cancellation.
- [ ] Make model budgets explicit without authorizing token transfers.
- [ ] Detect changed local evidence; reading valid JSON is not integrity verification.
- [ ] Keep offline `check` distinct from evaluation and add batching only with bounded cost/concurrency/failure handling.

## 9. Distribution and verification

The first tooling batch built shared/SDK/CLI, packed real artifacts, installed them in an empty consumer outside the workspace, and verified ESM, SDK execution, strict NodeNext typing, and CLI help/version. It also corrected the SDK's runtime `viem` dependency and pinned the generator.

CI runs `build:tooling` before tests requiring SDK dist. Generation checks must not modify source files. Package verification installs dependencies but does not publish packages or call paid Frontier services.

Recorded later checks include:

- Twelve injected API requests for discovery, starter, practice, context errors, and tampering.
- An isolated `83d3225` copy without secret files: public replay, tooling/Web startup, and six real local HTTP requests.
- Public HTTPS preflight on 2026-09-13: six successful non-AI requests, starter SHA, integrity, and repeatability.
- Twenty-one preflight tests covering auth/402/429/503, altered context/results, invalid starter, and timeout.

The preflight uses only three same-origin free routes, at most six requests, no credentials, redirects, automatic retries, or automatic 402 payments.

```bash
pnpm build:tooling
pnpm contracts:cli:check
pnpm contracts:sdk:check
pnpm verify:packages
pnpm verify:cli
pnpm verify:rescue:submission-replay
pnpm exec tsx scripts/verify-rescue-practice-onboarding.ts https://web-rho-seven-d6te7t3f0y.vercel.app
```

These are documented checks, not all rerun by this translation. Linux, real participant authentication, full public AI execution, and npm publication need separate evidence. See the [developer quickstart](RESCUE_AGENT_QUICKSTART.md) and [SDK README](../packages/sdk/README.md).

## 10. Milestones and ownership

| Milestone                                  | Exit condition                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| P0-A: tooling                              | Generated-contract drift detected; real package consumers pass                             |
| P0-B: release readiness and Ocean contract | Public AI readiness accurately reported; bounded run verified; Ocean typed discovery works |
| P1-A: registry/envelope                    | API, SDK, CLI, and Web share capability/context identity                                   |
| P1-B: production jobs                      | Owner isolation, restart/race tests, bounded costs, explicit reconciliation                |
| P1-C: external agent journey               | Start Ocean run, reconnect, retrieve, compare same context, verify evidence                |
| P2: final/pools/sponsors                   | Expose only implemented freeze/evaluation/allocation/payment capabilities                  |

Plan 9 owns Rescue behavior and payments; Plan 10 owns Ocean rules and outcomes; Plan 11 owns identity/workflow/commitment integration. Plan 12 owns discoverability, contracts, external execution, tooling, and compatibility.

Coordinate shared API entrypoints, schemas, package/lockfiles, and public docs. This English edition records required changes without implementing them or enabling paid operations.
