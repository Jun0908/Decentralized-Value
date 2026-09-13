# Chainlink CRE: Rescue evaluator compatibility and private-pack evidence

Latest recorded success: 2026-09-12, after 09:33 UTC. **Official regular/confidential local simulations passed and matched the complete Node Envelope and existing hashes. A fresh private pack passed secret-input execution, receipt comparison, explicit reveal and replay.**

[Public evidence](../../evidence/deployments/chainlink-cre-private-pack.json) · [Recording/source guide](SPONSOR_DEMO.md).

This is **local simulation**, not live TEE attestation, network deployment, onchain commitment or a completed Final. Earlier authentication failures are preserved in the [original record](../../development/history/docs-cleanup-2026-09-13/README.md); they do not describe the later successful state.

## Implementation and compatibility work

- Official Windows CRE CLI **1.33.0** installed under ignored `.frontier/tools/cre-1.33.0/`, release SHA-256 checked; no system PATH changes.
- Separate workflow package pins SDK **1.20.1**, with Bun **1.2.21**. Its setup did not change root dependency versions or run automatic installation scripts.
- The actual Rescue Doctrine evaluator and Evaluation Envelope are bundled, not replaced with a mock evaluator.
- Both official `handler` and `handlerInTee` paths exist.
- Success required Sepolia RPC configuration, SDK direct compilation for Windows paths containing spaces, a short relative WASM path, lazy initialization of 280 Episode calculations, moving protobuf-incompatible nulls into the JSON boundary, and V8/QuickJS ASCII-key collation agreement.
- Existing public-fixture Node hashes were preserved. ASCII compatibility does not promise universal Unicode ordering across every runtime.

The [compatibility status](../../../workflows/chainlink-cre/evidence/compatibility-status.json) identifies versions and measurement state. Per-run generated reports are ignored. Typechecking or a Node fixture alone is not official WASM/QuickJS execution.

## Reproduce compatibility

Repository dependencies and the recorded CLI environment must be available. Do not treat this as an automatic new-account or deployment workflow.

```powershell
# Generate/evaluate the public fixture in Node, not an official CRE run
pnpm exec tsx scripts/verify-cre-rescue.ts

# Separate workflow package
Push-Location workflows/chainlink-cre/rescue-envelope
bun install --frozen-lockfile --ignore-scripts
bun run typecheck
Pop-Location

# Official local simulation, regular and confidential handlers
pnpm exec tsx scripts/verify-cre-rescue.ts --simulate
pnpm exec tsx scripts/verify-cre-rescue.ts --simulate --confidential

# Fresh private pack, official simulation, explicit reveal
pnpm exec tsx scripts/verify-cre-private-pack.ts --simulate --reveal
```

The scripts do not use `--broadcast` or submit contract writes. Dedicated input files avoid handing the repository's private root environment to the workflow. Existing CLI login/configuration is distinct from deploy or confidential-network access. Temporary secret-input files are removed afterward; record no private input before explicit reveal. Do not bypass checks with `--skip-type-checks` or unlimited runtime limits.

## Workflow and success criteria

| Path                                     | Input                                                          | Checked execution                                                    |
| ---------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------- |
| Trigger 0 / `handler`                    | Public Doctrine/Episode in config                              | Actual Rescue evaluator, Envelope and full Node comparison           |
| Trigger 1 / `handlerInTee` compatibility | Same public fixture through `getSecret(RESCUE_PUBLIC_FIXTURE)` | Same calculation through the official confidential API               |
| Separate private-pack handler            | Fresh pack through secret input                                | Salted receipt, independent receipt match and explicit-reveal replay |

The public compatibility fixture is deliberately **not secret**; using a secret API does not turn published data into hidden Final material.

Success means CLI exit 0 **and** a recognized result object with expected handler kind, bundle hash and complete Envelope agreement. Unknown output or partial execution is not passed. `evaluatorBundleHash` identifies the evaluator JavaScript module, not the entire workflow WASM, a TEE identity or a DON signature. Existing inner flags such as `executionMode: local` and `creVerified: false` remain honest; the outer record reports official local simulation separately.

## Private-pack commitment and replay

- [Pure pack functions](../../../scripts/lib/rescue-secret-pack.ts): at most eight Episodes; commit, validate, evaluate, explicit reveal and reevaluate.
- [Tests](../../../scripts/lib/rescue-secret-pack.test.ts): tampered pack/order/salt/context/artifact/generator/metrics/catalog/result and secret/public boundaries.
- [Local verifier](../../../scripts/verify-cre-secret-pack.ts): generates three fresh Episodes and salt, reveals in memory and compares the actually hashed browser-target JavaScript bundle executing in Node V8.

The domain-separated commitment includes a **fresh 256-bit salt**, generator version, ordered seeds and complete generated Episode parameters, fixed strategy artifact, evaluator version/code hash, three independent metric definitions/directions/bounds, service catalog, time/action/budget limits and aggregation version. Matching only a seed is insufficient.

Evaluation directly uses `evaluateRescuePolicy`; game/aggregation logic and legacy Context/Result hashes are not duplicated or changed. The initial supported artifacts are eight existing fixed strategies, such as `simple-adaptive`, excluding truth-reading `oracle` and `seeded-random`. External AI artifact/prompt/model execution is not connected to this private-pack path.

| Stage                   | Public information                                                   | Not public yet                                                    |
| ----------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Commit                  | Salted pack commitment                                               | Salt, seeds, full pack, artifact/context contents                 |
| Evaluated before reveal | Pack/evaluation salted commitments and non-production boundary flags | Outcomes, unsalted Context/Result/Episode hashes, full parameters |
| Explicit reveal         | Pack, salt and results for independent recalculation                 | The revealed pack is no longer secret                             |

Small scenario spaces can be brute-forced from unsalted hashes or inferred from outcomes, so prereveal receipts omit them. Errors use fixed reason codes rather than raw input/assertion/parse details.

The local verifier uses Node `crypto.randomBytes(32)` for salt/seeds. Pure functions can validate only salt format; callers must supply fresh entropy and never reuse test salts. New runs normally produce different commitments. Same pack/salt/artifact/runtime determinism is separately tested.

```powershell
pnpm exec vitest run scripts/lib/rescue-secret-pack.test.ts
pnpm exec tsx scripts/verify-cre-secret-pack.ts
```

The original local verifier keeps inputs/reveal in memory and emits only public receipts, bundle hash and check flags. This preparation is distinct from the later official private-input simulation, which generated the committed public evidence after explicit reveal.

## Remaining trust and tournament boundaries

The stateless functions do not enforce public commitment time, first publication, simultaneous entry acceptance, freeze or reveal deadlines. Compare against a receipt retained **before** reveal; do not trust a replacement supplied alongside the revealed pack.

The operator host can read the pack. Host-supplied `runtime.codeHash` is not self-authenticating proof of actual execution. Secret access controls, unknown-Final generator validity, immutable entry freeze, multi-participant context fairness, live TEE evidence, Receiver/Forwarder/DON authorization, onchain commitments and reward settlement remain separate work.

The later official local simulation resolves the original CLI/WASM/QuickJS execution gate, but does not resolve these production boundaries. A dedicated `/sponsors/chainlink-cre` route is not claimed; the public demonstration is a chapter on `/sponsors/demo`.

## References used for the recorded integration

- [Windows installation/checksums](https://docs.chain.link/cre/getting-started/cli-installation/windows)
- [Pinned CLI release 1.33.0](https://github.com/smartcontractkit/cre-cli/releases/tag/v1.33.0)
- [Workflow simulation](https://docs.chain.link/cre/guides/operations/simulating-workflows)
- [Confidential TypeScript workflow](https://docs.chain.link/cre/guides/workflow/using-confidential-workflows/making-workflow-confidential-ts)
- [Confidential SDK reference](https://docs.chain.link/cre/reference/sdk/confidential-workflows-client-ts)
- [Javy/QuickJS runtime](https://docs.chain.link/cre/concepts/typescript-wasm-runtime)

These describe sources used alongside the installed SDK 1.20.1 definitions; this editorial update is not a fresh provider-access or prize-eligibility audit.
