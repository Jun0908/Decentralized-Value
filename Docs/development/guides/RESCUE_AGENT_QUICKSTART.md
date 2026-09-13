# Rescue Practice: developer quickstart

Scope: **non-billable, single-Episode, deterministic Doctrine Practice**. This is not the AI inference API, real payment, server-side strategy persistence or Final Entry. The SDK is a private monorepo package; `npm install @frontier/sdk` is not a published installation path. [Current status](../../STATUS.md).

## 1. Start locally

Use Node.js 22+ and the repository-pinned pnpm version. Run at the repository root; no private files are needed for this practice path.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:tooling
pnpm --filter @frontier/web exec next dev --hostname 127.0.0.1 --port 3000
```

If port 3000 already serves this application, use it rather than starting another process. Installation may download dependencies. `--ignore-scripts` suppresses automatic lifecycle scripts; the explicit tooling build creates SDK/CLI output.

## 2. Check the connection

From another terminal:

```sh
pnpm exec tsx scripts/verify-rescue-practice-onboarding.ts http://localhost:3000
```

The verifier performs six HTTP requests:

1. Inspect the public manifest and its non-billable, non-reward capability boundary.
2. Download the Starter ZIP and verify SHA-256 without extracting or executing it.
3. Evaluate the Starter Doctrine with the fetched Context and Episode fixed in advance.
4. Verify artifact, evaluation, outcome, transcript and supplied payment-evidence integrity independently in the SDK.
5. Repeat the same input and compare hashes and all three independent outcomes.

Success returns `verified: true` and `repeatedHashMatch: true`. Failure exits nonzero with `phase`, `code` and `nextAction`, without printing arbitrary remote error details. The verifier does not load API keys, wallets or environment credentials, send authorization, call inference/payment routes, or automatically retry.

The public product was also checked with six real HTTP requests on 2026-09-13. To check the current deployment, use its exact origin:

```sh
pnpm exec tsx scripts/verify-rescue-practice-onboarding.ts https://web-rho-seven-d6te7t3f0y.vercel.app
```

Use only an owner-confirmed HTTPS origin: no path, query, fragment or embedded credentials. A historical successful check does not guarantee a later deployment is unchanged. [Public verification](../../evidence/verification/PUBLIC_VERIFICATION_2026-09-13.md).

## 3. Try your strategy

Pass your Doctrine as `artifact` in the [SDK example](../../../packages/sdk/examples/rescue-practice.ts). Start from the manifest's `artifact.sample` and change only fields allowed by the published schema. CLI input `check` is not a simulation.

```sh
pnpm exec tsx packages/sdk/examples/rescue-practice.ts http://localhost:3000
```

The example prints detailed evidence; the preflight above is shorter for initial diagnostics. Retain the original `context` and `episodeId` before execution. Do not reconstruct expected values from the returned result. Compare results from the same origin, context and Episode.

| Field                     | Meaning                                         | Direction |
| ------------------------- | ----------------------------------------------- | --------- |
| `totalUserLossUsd`        | User assets lost in the fictional protocol      | Minimize  |
| `servedProtocolDemandPpm` | Fraction of demand served; 1,000,000 means 100% | Maximize  |
| `netResponseSpendCredits` | Investigation/response spending in game credits | Minimize  |

Do not add these outcomes into one winner score. `correctness: false` excludes a result from comparison/allocation. `verified: true` establishes the checked operation/hash consistency, not strategy strength or diagnostic truth.

## 4. Handle failures explicitly

| Code                                        | Next action                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| `INVALID_ORIGIN`                            | Supply only the server origin                                             |
| `AUTH_REQUIRED` / `PAYMENT_REQUIRED`        | Stop; do not send credentials or pay a 402 for public Practice            |
| `RATE_LIMITED`                              | Wait, then explicitly rerun; do not flood retries                         |
| `CONTEXT_MISMATCH`                          | Fetch a fresh manifest and start a new comparison set                     |
| `STARTER_HASH_MISMATCH`                     | Do not execute the download; investigate distribution consistency         |
| `INTEGRITY_FAILED` / `REPEAT_MISMATCH`      | Reject the result; check evaluator/SDK version compatibility              |
| `REDIRECT_REJECTED`                         | Ask the operator for the final origin rather than following automatically |
| `TIMEOUT` / `UNAVAILABLE`                   | Check server/connectivity; timeout leaves server completion unknown       |
| `UNSUPPORTED_MANIFEST` / `INVALID_RESPONSE` | Check schema, deployment version and supported route/mode                 |

## Verification limits

- Hash checks do not establish signatures, real model provenance, payment, evaluator authenticity or a true diagnosis.
- [Handoff and independent replay](../../hackathon/submission/RESCUE_HANDOFF.md) explain a separate clean-copy evaluator check.
- Reproduction starts from recorded actions; it does not assume a model makes the same decisions again.
- Never add operator bearer tokens, private keys or administration/payment capabilities to this public entry point.
- Unit tests inject fetch into real API handlers; report that separately from real HTTP verification.

```sh
pnpm exec vitest run scripts/lib/rescue-practice-preflight.test.ts
```
