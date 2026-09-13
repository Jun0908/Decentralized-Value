# Plan 11 — Sponsor Integrations

Created: 2026-09-11. English current edition: 2026-09-13.

Connect three complementary boundaries: **ENSv2 for identity and delegated permissions, Bazantic for agent access, and Chainlink CRE for reproducible confidential-workflow evaluation.**

This is the consolidated current plan. The [original specification and execution history](archive/plan-history-2026-09-13/Plan11.md) remains unchanged. Game design belongs to [Plan 9](Plan9.md) and [Plan 10](Plan10.md); public API/tooling belongs to [Plan 12](Plan12.md).

## 1. Current evidence

| Integration   | Demonstrated                                                                                                                                  | Next milestone                                                                    |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| ENSv2         | Existing name, scoped text-record permissions, seven Sepolia transactions, service discovery, pause rejection, and revoked delegate rejection | Round-bound evaluator admission, signed dispatch, and fixed-block snapshots       |
| Chainlink CRE | Official standard/confidential local simulation, fresh secret pack, commitment, handler execution, explicit reveal, and Node replay           | Durable final lifecycle, live confidential execution, and on-chain final receiver |
| Bazantic      | Actual external AI using MCP to discover and evaluate Rescue candidates; gateway route repair; recipe draft                                   | Hosted recipe execution/publication and preregistered recipe A/B study            |
| Presentation  | Public English sponsor page, three evidence downloads, representative source links, and recording material                                    | Selected-prize eligibility and final submission confirmation                      |

The public [sponsor demonstration](https://web-rho-seven-d6te7t3f0y.vercel.app/sponsors/demo) displays saved execution evidence. Viewing it does not repeat model calls or transactions.

The 2026-09-13 public check established page and evidence availability, not live Web AI availability. A subsequent review found `commanderAvailable: false`; see the [production follow-up](PRODUCTION_READINESS_2026-09-13.md). Previously recorded real AI executions remain valid evidence of their own operator/MCP contexts.

## 2. Integration architecture

The initial evaluator is the existing deterministic Rescue doctrine interpreter. Reuse its simulation and replay logic; do not introduce a second scoring implementation or require LLM inference inside CRE.

The target flow is:

```text
Agent → Bazantic tools → practice and candidate revision
      → frozen entry + committed context
      → admitted evaluator / ENS snapshot
      → CRE hidden-input evaluation
      → result commitment → reveal and reproduction
      → independent value-pool allocations
```

This diagram is the target end-to-end architecture, not a claim that every transition is deployed.

A normal ENS-dispatched runner and a CRE workflow are distinct execution paths. A runner signature cannot substitute for a CRE report. Bind the admitted identity, code/workflow hash, context, and round before evaluation.

## 3. Shared evidence contract

The implemented versioned envelope separates `EvaluationRequestV2`, `EvaluationResultV2`, and `ExecutionEvidenceV1`. It binds artifact, context, evaluator code, complete metric definitions, aggregation version, and round/snapshot references.

- Deterministic results exclude timestamps, job UUIDs, execution IDs, and transaction hashes.
- Execution records carry those operational fields without changing game-result identity.
- Canonical ordering for the new envelope uses UTF-16 code-unit order, not locale-dependent sorting.
- Legacy attestation and arena hash formats remain compatible.
- Comparison-set identity is explicit; full-field frontier/contribution is recomputed after individual evaluation.
- Transport failures are errors, not fabricated zero-score results.
- Hash/schema correspondence is not proof that an evaluator ran, a signer was authorized, or a payment occurred.
- Free-text names, instructions, and recipe content cannot grant authority or become executable evaluator code.

The initial envelope's verification status remains `unverified`; stronger verification requires its own evidence. Request/result/job substitution, malformed JSON, duplicate/missing metrics, metadata injection, and tampering have regression coverage.

## 4. ENSv2

### Demonstrated service-discovery path

The existing `frontierdemo.eth` name carries the dedicated `frontier.rescue.service` text key. The recorded run granted scoped delegate authority, updated the service record, paused/restored discovery, and revoked the delegate.

Seven Sepolia transactions were confirmed. The post-revocation rejection was an `eth_call` failure, not an invented failed transaction. The service was active and delegate authority revoked at the end of the recorded run. Other records were preserved.

Discovery reached an allowed HTTPS Rescue API and verified its response. See [evidence](deployments/ensv2-rescue-demo.json), [adapter](../packages/ens-adapter/src/rescue.ts), and [execution script](../scripts/demo-ens-rescue.ts). The read-only recheck is `pnpm exec tsx scripts/verify-ens-rescue.ts`.

### Remaining admission and dispatch work

- [ ] Freeze chain, block number/hash, normalized name, registry/resolver, signer, admitted capabilities, and permission evidence in a round snapshot.
- [ ] Distinguish permission to edit a record from authorization to evaluate a round. An evaluator must not self-admit by writing “active.”
- [ ] Limit delegated text keys; test protected-key, other-name, resolver replacement, ownership, and redelegation bypasses.
- [ ] Choose eligible evaluators deterministically from the admitted set.
- [ ] Restrict endpoint origins, private/metadata addresses, redirects, body size, timeout, retries, and idempotency. ENS records are not unrestricted network authority.
- [ ] Validate returned artifact/context/outcomes, result hash, and signature before storing a result.
- [ ] Reject unresolved names, revoked roles, wrong capabilities/signers, and altered results without falling back to an unapproved demo runner.
- [ ] Preserve historical verification against its original snapshot; apply revocation to new dispatch under a predeclared round policy.

Use the adopted official ABI/deployment version when implementing these operations. The scoped service demo does not yet establish a complete decentralized evaluator-admission network.

## 5. Bazantic

### Demonstrated agent path

The existing gateway had a specification/route-table mismatch. The repair preserved 15 existing routes and prices and added only three free Rescue routes: manifest, starter, and doctrine evaluation.

Six gateway HTTP requests passed; starter SHA, SDK integrity, repeated evaluation, and local replay matched. MCP manifest discovery and candidate evaluation also passed.

An external OpenAI agent using `gpt-5-nano` then made three MCP tool calls: manifest, baseline evaluation, and candidate evaluation. All underlying HTTP requests succeeded. Its budget change from 90 to 60 Credits produced equal outcomes on the selected public episode. The tie is retained; it is not an improvement claim.

The hosted `rescue-room-strategy-comparison` recipe exists as a verified draft. Actual MCP author execution is distinct from running or publishing that hosted recipe.

Sources: [live connection record](sponsors/BAZANTIC_RESCUE_LIVE.md), [agent evidence](deployments/bazantic-rescue-agent-demo.json), [implementation](../apps/api/src/bazantic-rescue-agent.ts).

### Remaining recipe and experiment work

- [ ] Execute the hosted recipe, verify its exact identifier/version/content, and retain full safe tool traces.
- [ ] Publish only after its output and permission/payment boundaries are verified.
- [ ] Run a preregistered recipe/no-recipe comparison with identical task, model, prompt, settings, API tools, permissions, budgets, and success criteria.
- [ ] Retain every pair, including failures, invalid candidates, ties, and regressions.
- [ ] Report validity, calls, cost, elapsed time, and outcome differences independently; do not convert the protocol into an experimental weighted score.
- [ ] Confirm the selected prize's current requirements and submission category before claiming eligibility.

The local A/B harness passed 35 tests and four fixture pairs. Those fixtures are not real-model A/B evidence. Hosted publication, recipe uplift, and paid gateway/USDC execution remain outside the demonstrated result.

Do not expand the remaining specification-only routes, expose admin/reward actions, or automatically pay an HTTP 402 to make a demo pass.

## 6. Chainlink CRE

### Demonstrated confidential-workflow simulation

Official CLI 1.33.0 and SDK 1.20.1 ran standard and confidential workflows using the existing evaluator. Complete envelopes and existing hashes matched Node results.

A fresh nonproduction secret scenario pack was committed, supplied through the `handlerInTee` secret-input path, evaluated, and represented by a salted public receipt. Explicit reveal then enabled independent Node reproduction.

The work included Windows path handling, bundle/WASM handling, lazy initialization, JSON-null compatibility, and ASCII protocol-key ordering across V8 and QuickJS. It does not establish cross-runtime behavior for unrestricted Unicode input.

Sources: [evidence](deployments/chainlink-cre-private-pack.json), [workflow](../workflows/chainlink-cre/rescue-envelope/secret-pack/main.ts), [runbook](sponsors/chainlink-cre.md).

**This is official local simulation, not live TEE attestation, network deployment, or an on-chain final commitment.**

### Final lifecycle roadmap

```text
DRAFT → CONTEXT_COMMITTED → ENTRY_OPEN → ENTRIES_FROZEN
      → EVALUATING → RESULTS_COMMITTED → REVEALED → REPRODUCED
```

- [ ] Persist and atomically freeze participant ownership, artifact bytes, one entry per participant, deadline, and entry-set root.
- [ ] Commit generator, ordered pack, high-entropy salt, code/workflow, metrics, bounds, and aggregation before evaluation.
- [ ] Keep hidden inputs out of ordinary API responses, triggers, URLs, bundles, logs, errors, caches, and public reports.
- [ ] Execute the actual evaluator over hidden inputs rather than accepting a precomputed external score.
- [ ] Prevent repeated final queries from becoming an oracle for probing hidden conditions.
- [ ] Preserve failed evaluations with reasons; compute the whole comparable field before allocation.
- [ ] Reveal only the intended scenario data/salt after finalization, then verify commitments and reproduce results.
- [ ] Specify recovery, cancellation, withholding, and organizer pack-selection risks in advance.

The local pack functions support a bounded nonproduction pack and passed 31 new tests. They are not a production final store or proof of unbiased pack selection.

### Receiver and live execution

- [ ] Add a versioned generic final receiver rather than silently repurposing an older two-axis contract.
- [ ] Bind chain, round, context, entry-set root, forwarder, workflow identity, and accepted report metadata.
- [ ] Reject direct unauthorized calls, wrong workflow/chain/round, duplicate reports, unfrozen entries, and root replacement.
- [ ] Keep simulation and live trust configurations separate.
- [ ] Validate receipts/events if a result is written on-chain; a simulation-origin transaction is still not proof of live TEE execution.
- [ ] Add live execution only after the required account/network/confidential access and workflow evidence are available.

A result commitment, correct evaluator computation, fair input selection, and reward payment are separate claims.

## 7. Evidence and presentation rules

Store schema version, source provenance, dirty-bundle hashes when applicable, tool/runtime versions, commands, inputs and outputs, context/artifact/result hashes, network, execution mode, verification, commitments, and payment state.

Include actual ENS blocks/records, MCP/tool/recipe identifiers, or CRE workflow/report references where they exist. Missing external IDs remain absent with a reason; local placeholders are not substituted.

Never expose credentials, authorization headers, cookies, signing keys, or unrevealed salts. Redact failures as carefully as successes.

The current page is `/sponsors/demo`, with three evidence chapters and downloads. Earlier proposed separate sponsor routes are not an availability claim. The first view should explain the integration and evidence; raw logs are secondary. Follow the explicit light/dark contrast and accessibility rules.

## 8. Next priorities and verification

Immediate release-readiness work is tracked in [PRODUCTION_READINESS_2026-09-13.md](PRODUCTION_READINESS_2026-09-13.md): generated CRE bundles currently lack an ESLint ignore, public AI readiness is separate from saved sponsor evidence, and API payment metadata needs an evidence-backed update.

After those checks, prioritize hosted-recipe execution and its controlled comparison, then final-round state/admission/receiver work according to the selected submission scope.

Required tests include permission denial/revocation, fixed snapshots, signature/context substitution, endpoint rejection, malformed candidates, equal/failed A/B runs, secret leakage, freeze races, report replay, and order-independent allocation. Check generated-artifact lint both before and after CRE builds.

The user selected ENS, Chainlink, and Bazantic as sponsors. Sponsor selection does not establish Start Fresh/Continuity eligibility or compliance with every prize requirement. Original rule research is dated in the archived plan; current eligibility should be confirmed separately.

This English edition does not perform new inference, transactions, deployments, or sponsor submission.
