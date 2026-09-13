# Rescue Room: submission verification

Initial asset/check date: 2026-09-12. Updated 2026-09-13 to distinguish current public access from the original local-only batch. [Current submission copy](SUBMISSION_COPY_EN.md) · [Public verification](../../evidence/verification/PUBLIC_VERIFICATION_2026-09-13.md) · [Original record](../../development/history/docs-cleanup-2026-09-13/README.md).

Code and evidence pages were subsequently pushed and publicly checked. ENS permission transactions, official CRE private-pack simulation and external AI through Bazantic MCP now have separate execution evidence. This does not certify a published voiced video or a submitted application.

## Recorded demo

Public English page: <https://web-rho-seven-d6te7t3f0y.vercel.app/rescue-room/submission/en>.

The page presents saved real-model and Sepolia payment evidence, three continuation decisions, simulated outcomes and independent Pool previews. It retains the comparison with Never Pause. This is recorded evidence, not a fresh model call or transfer.

The [sponsor guide](../sponsors/SPONSOR_DEMO.md) documents the separate integration demonstrations. Footage, narration and production handoffs are local-only; the verification details below remain public.

## Independent startup and real HTTP check

A `git archive` of `83d3225` was extracted into an empty temporary directory without secrets. Only the new HTTP verification script was additionally copied for testing. This tested independent startup of existing public Practice, not distribution of every later SDK feature.

1. `pnpm install --frozen-lockfile --ignore-scripts` passed using the local package cache.
2. `pnpm verify:rescue:submission-replay` reproduced the recorded Outcome, Transcript and Pool comparison hashes.
3. `pnpm build:tooling` passed.
4. `pnpm --filter @frontier/web exec next dev --hostname 127.0.0.1 --port 3012` served the isolated copy.
5. `pnpm exec tsx scripts/verify-rescue-submission-http.ts http://127.0.0.1:3012` checked the submission page and made six real SDK HTTP requests, all 200. Starter digest, repeated Result Hash and complete local evaluator agreement passed.
6. The owned test server was stopped afterward; the user's existing localhost:3000 was not stopped.

The copy contained no `.env`, `.env.local`, Web local env, `secrets/` or private operator journals. It reused the same Windows OS, Node and package cache. This is not Linux or independent third-party-user verification. Later public SDK checks are recorded separately.

## Safe reproduction and recording commands

```powershell
# Public saved-action replay: no key, inference or RPC
pnpm verify:rescue:submission-replay

# Real non-billable HTTP against an existing local Web server
pnpm exec tsx scripts/verify-rescue-submission-http.ts http://localhost:3000

# English-page desktop/mobile verification; no model/payment
pnpm exec tsx scripts/record-rescue-submission-en.ts

# Explicitly rerecord silent WebM, approximately two minutes
pnpm exec tsx scripts/record-rescue-submission-en.ts --record

# Local private-pack commit/reveal/replay preparation
pnpm exec tsx scripts/verify-cre-secret-pack.ts

# Local Bazantic comparison harness; --full shows complete fixture history
pnpm exec tsx scripts/verify-bazantic-readiness.ts
```

The original MP4 was converted from WebM with local FFmpeg. Rerecording does not automatically regenerate MP4. Do not present old footage as proof of a newly changed UI.

## SDK integrity and package verification

`verifyRescueDoctrinePracticeIntegrity({ request, run })` checks a retained original request against artifact, evaluation, outcome, transcript and supplied payment-evidence hashes, including supplied Order/Receipt references.

The original SDK addition checked 35 Episodes × three presets inside 11 added tests. The later CI correction registers that 105-case matrix as independent tests under the default timeout. A built SDK tarball was separately installed offline, with lifecycle scripts disabled, into an empty consumer; export execution, tamper rejection and strict NodeNext typechecking passed without added dependencies.

Hash consistency is not evaluator re-execution, a signature, diagnostic truth, payment confirmation or authentication of wholly fabricated but internally consistent data. [SDK details](../../../packages/sdk/README.md).

## Local sponsor preparation versus later execution

The original private-pack preparation generated three Episodes and a 256-bit salt, then checked commitment, evaluation, explicit in-memory reveal and replay; pack/order/artifact/context/metric tampering was rejected. A browser-target bundle executed in Node V8 agreed. That preparation alone was not official CRE or a TEE. The later [official CRE evidence](../../evidence/deployments/chainlink-cre-private-pack.json) supersedes the earlier “not yet simulated” status, while live TEE/network execution remains unproven.

The local Bazantic A/B harness fixes task, prompt, model settings, API, context, Episode, seed and tool limits, retaining failed/tied/worse pairs. Its four standard pairs are deterministic fixtures intentionally choosing different presets, not real Recipe-improvement evidence. Trusted injected runners are not arbitrary-code sandboxes. Later [gateway/AI evidence](../sponsors/BAZANTIC_RESCUE_LIVE.md) establishes live MCP use but still not hosted Recipe execution or controlled A/B benefit.

## Verification recorded for the original handoff

- TypeScript: **718 passed / 11 skipped**.
- Workspace typecheck, Web production build, scoped lint/format and generated CLI/SDK contract checks.
- English/Japanese submission desktop/mobile navigation; English console/overflow/contrast/download checks.
- Public replay, local secret-pack verifier, four fixture A/B pairs, SDK consumer and isolated Web real HTTP.
- No contract changes, contract test rerun, official CRE, live gateway or public deployment check in that **original** batch.
- Zero new model calls or chain transactions during footage/replay verification; ZIP/video remained ignored.

Later sponsor/public verification must not be silently counted as tests run during that earlier batch.

## Owner confirmation before submission

1. Confirm participation category, chosen prizes, deadline and judging start commit in the owner's dashboard.
2. Add/review the owner's voice and final edit.
3. Describe ENS/Chainlink/Bazantic evidence and unfinished scope accurately. Reauthentication, buying another ENS name or a new transfer is not required just to show the recorded minimum demo.
4. Use verified public Web/GitHub links; verify later local changes separately before claiming they are deployed.
5. Confirm AI disclosure and actual human contributions, then send the application.

Related: [developer preflight](../../development/guides/RESCUE_AGENT_QUICKSTART.md), [information-study design](../../development/plans/rescue-information-study.md), [submission change inventory](../../development/history/work-notes/SUBMISSION_CHANGE_INVENTORY.md), [manual confirmation checklist](HACKATHON_SUBMISSION.md). Information-value study execution and final form submission are not completed by this handoff.
