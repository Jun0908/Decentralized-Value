# Environment Configuration

Updated: 2026-09-13. This guide describes the current repository's configuration consumers, not proof of service availability.

## Blank is not the same as unused

An empty assignment can mean a feature is optional, required but not configured, or retained for an older workflow. The example file deliberately leaves credentials empty.

- `.env`: private local values, ignored by Git. Existing values were preserved during this cleanup.
- `.env.example`: tracked documentation/template with safe defaults and empty credentials. It must never contain a real key.
- Vercel environment variables: a separate production/preview configuration. A local key does not configure the published app. Environment changes apply to new deployments. [Vercel documentation](https://vercel.com/docs/environment-variables).

Do not copy the example over an existing local file. Do not fill every blank to make a general diagnostic appear successful. Setting a value does not authorize a paid operation.

## What to configure

| Feature                               | Variables                                                                      | Meaning of blank / missing                                                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Deterministic practice                | Local runtime defaults; no AI credential                                       | Public scripted practice can run without an AI key                                                                                              |
| Real Rescue Commander / Ocean mission | `OPENAI_API_KEY`                                                               | No default real-model backend; required for these AI paths                                                                                      |
| Optional AI transport/model override  | `OPENAI_BASE_URL`, `OPENAI_MODEL`                                              | Leave commented to retain defaults; Ocean reads the model override, Rescue's controlled model is fixed in code                                  |
| Account UI and verification           | `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_VERIFICATION_KEY`                           | Login display and server verification are distinct; protected identity flow needs both                                                          |
| Durable Web storage                   | `KV_REST_API_URL`, `KV_REST_API_TOKEN`                                         | Production protected/one-time-use paths need durable storage; development memory is not production persistence                                  |
| Redis aliases                         | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`                           | Alternatives to the corresponding KV settings; use a matching pair from one resource                                                            |
| CLI browser approval                  | `FRONTIER_CLI_ORIGIN`                                                          | Development has a loopback default; outside development an exact trusted Web origin is needed                                                   |
| Sepolia operator/deployment           | `SEPOLIA_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, `DEPLOYER_ADDRESS`                  | Required by the relevant operator/check paths, not ordinary practice; the address is used by balance checks/Ocean settlement scripts            |
| ENS runner discovery                  | `ENS_PARENT_NAME` plus RPC                                                     | Optional runner directory; a configured name does not itself establish admitted runners                                                         |
| Participant reward relayer            | `PLAN5_SETTLEMENT_ENABLED`, relayer key, pool/token addresses, reward cap, RPC | Default is disabled; only a complete, validated setup enables actual reward transactions                                                        |
| Reward evidence display               | The ten `NEXT_PUBLIC_*` reward/transaction fields in the example               | Display unavailable evidence rather than inventing a transaction; these do not perform payments                                                 |
| Bazantic metadata                     | `BAZANTIC_GATEWAY_URL`, `BAZANTIC_SERVICE_ID`, `BAZANTIC_RECIPE_ID`            | Gateway URL is used by the sponsor debug page; the legacy all-services check asks for the IDs. Missing recipe ID does not by itself disable MCP |

All `NEXT_PUBLIC_*` values can reach the browser. Never put an API key, signing key, Redis token, or other server credential under that prefix.

The reward relayer must use a dedicated limited key, not the broad deployer key. Public practice credits, recorded Rescue service payments, and participant reward transactions use different boundaries.

## Legacy and reserved settings

| Variable                                                                        | Current reference                                                             | Cleanup decision                                                                                     |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `RUNNER_PUBLIC_URL`                                                             | Legacy `scripts/demo-check.ts` and schema                                     | Keep optional; it is not the main Web/API origin                                                     |
| `CHALLENGE_REGISTRY_ADDRESS`                                                    | Legacy demo seed/check and schema                                             | Keep optional for that deployment                                                                    |
| `ARTIFACT_REGISTRY_ADDRESS`, `ATTESTATION_ADDRESS`, `PARETO_SETTLEMENT_ADDRESS` | Legacy deployment check and schema                                            | Leave blank unless the matching old contracts are verified; do not insert unrelated Rescue addresses |
| `NEXT_PUBLIC_DEPLOYMENT_URL`                                                    | Legacy demo health check and schema                                           | Optional diagnostic URL, not Next.js routing configuration                                           |
| `ETHERSCAN_API_KEY`                                                             | Schema/security-scan references; no current authored runtime consumer located | Retain private value; empty placeholder in template                                                  |
| `LEDGER_SIGNING_MODE`, `ALLOW_INSECURE_LOCAL_SIGNER`                            | Ledger adapter's signing-mode guard                                           | Optional separate workflow; a blank mode does not enable signing                                     |
| `LEDGER_DERIVATION_PATH`, `LEDGER_RING_FILE`, `LEDGER_RING_KEY`                 | Schema; no direct runtime consumer located                                    | Preserve existing local values; document as commented reserved settings                              |
| `NEXT_PUBLIC_FRONTIER_API_URL`                                                  | No current application consumer located in the inspected source               | Keep the existing local assignment for compatibility; do not add an active template setting          |

“No consumer located” is scoped to the inspected repository source; external tooling can have its own configuration. No existing local assignment was deleted on that basis.

The older `demo:check` covers optional systems together and can perform network reads. Its missing-field report is not the minimum configuration list for Rescue/Ocean or for browsing the site.

## Empty strings need care

Many optional schema fields convert an empty string to absence. Not every runtime uses that schema to read variables.

For example, Ocean selects `options.model ?? process.env.OPENAI_MODEL ?? "gpt-5"`. An active `OPENAI_MODEL=` supplies an empty string instead of the default. This is why optional overrides are commented out in the template rather than supplied as active empty assignments.

Deployment/relayer scripts accept a 64-digit hexadecimal private key with or without `0x`. The shared format checker now accepts the same two spellings and normalizes only its parsed result. It does not rewrite the local file or verify account ownership, scalar validity, network funds, or transaction permission.

## Local loading is entrypoint-specific

- The standalone API server reads root `.env` and `.env.local`, with local overrides taking precedence and existing process variables retained.
- The Web's root bridge in `apps/web/next.config.ts` copies only `OPENAI_API_KEY` and `OPENAI_BASE_URL` from the root files when the corresponding process value is absent. It does not load every root setting into the Web runtime.
- Therefore a root `OPENAI_MODEL`, Privy, Redis, or relayer value must not be assumed to reach the Web automatically. Supply the intended process/app environment for that runtime.
- Operator scripts have their own dotenv loading rules. Check the specific script before starting it; this cleanup does not standardize every loader.
- Vercel production uses its deployed server configuration. Do not upload the local deployer credentials merely to make the Web work.

## Safe checks

```bash
pnpm env:check
pnpm env:check --example
```

The default check now reads root `.env`, then `.env.local`, with defined process variables taking precedence. It checks the template only if neither local file exists. Explicit empty overrides stay empty.

`--example` checks only the template, independent of private local files and process credentials. It is suitable for a clean-clone/template check.

Both commands validate documented formats offline and report only sources, failing field names, and AI-key presence. They never print credential values, invoke a model, contact a service, enable a relayer, or verify production configuration. A pass means formats passed, not that every optional feature is configured or operational.

## Cleanup verification

Recorded checks: 18 focused tests passed; shared-package typecheck, changed-file ESLint, formatting, both environment-check modes, and diff validation passed. All 25 existing local assignments retained the same parsed keys and values. The local file remains Git-ignored. No live service check or deployment was performed.

- Local key/value preservation is checked by comparing a before/after fingerprint without displaying values.
- Template defaults remain nonspending; optional credentials remain empty.
- Tests cover local/template selection, precedence, explicit blanks, no process mutation, missing files, template secret prevention, and key/URL formats.
- Production AI configuration and duration remain tracked in [production readiness](PRODUCTION_READINESS_2026-09-13.md); this cleanup does not resolve those deployment tasks.
