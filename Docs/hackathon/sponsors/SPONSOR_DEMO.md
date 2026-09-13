# Sponsor demonstration: recorded execution, evidence and source

Updated 2026-09-13. Three separate integrations are demonstrated; they are not one completed tournament workflow.

## Open the evidence page

Public: <https://web-rho-seven-d6te7t3f0y.vercel.app/sponsors/demo>. Local: <http://localhost:3000/sponsors/demo>.

The English page has three chapters, transaction links and three evidence downloads. Public desktop/mobile display and byte-equivalent JSON downloads were checked on September 13. It displays recorded execution; opening it does not start inference, transfers or a CRE run. GitHub publication and Web availability were checked separately. [Verification scope](../../evidence/verification/PUBLIC_VERIFICATION_2026-09-13.md).

| Sponsor   | Executed evidence                                                                                                                    | Do not claim                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| ENSv2     | Existing name → API discovery → public Practice verification; single-key authorization/update/revocation; seven Sepolia transactions | An independent market or service-purchase payment through ENS       |
| Chainlink | Official regular/confidential CRE local simulation; private pack → salted receipt → reveal → independent replay agreement            | Live TEE attestation, production Final or onchain commitment        |
| Bazantic  | A real external OpenAI agent used MCP for a manifest and two evaluations; SDK/evaluator checks passed                                | Hosted Recipe execution, Recipe A/B benefit or improved AI outcomes |

The separate real-AI delivery/Sepolia payment demonstration is on `/rescue-room/submission`. Recording either page does not execute those transactions again.

## Rechecking commands

Run at the repository root. The first command reads the current chain/API; the second independently checks saved evidence without network, inference or payment. The CRE commands create new local simulation evidence; they are not necessary just to view the existing page.

```powershell
# ENS state/API: no private key or new transfer
pnpm exec tsx scripts/verify-ens-rescue.ts

# Offline saved-evidence verification
pnpm exec vitest run scripts/lib/sponsor-demo-evidence.test.ts

# New official private-pack simulation and explicit reveal; no AI or transfer
pnpm exec tsx scripts/verify-cre-private-pack.ts --simulate --reveal

# Official CRE compatibility against the public fixture
pnpm exec tsx scripts/verify-cre-rescue.ts --simulate
pnpm exec tsx scripts/verify-cre-rescue.ts --simulate --confidential
```

CRE requires the configured CLI login, Bun, SDK dependencies and Sepolia RPC. Those worked for the recorded run; this does not certify a new machine. Temporary secret-input files are removed afterward. Do not record unrevealed inputs.

Do not rerun `demo-ens-rescue.ts --execute` for footage. It is designed to stop on existing records/journals; use the read-only verifier. The delegate previously received 0.001 Sepolia ETH for gas. Keys and remaining balances are operator-local; permission was revoked. The post-revoke rejection is an `eth_call` check, not an additional failed transaction.

The Bazantic AI demonstration reached its six-attempt cap. Do not automatically retry. The conservative total reservation was $0.60, not a billed amount. The successful sixth attempt had four responses and 9,358 input / 1,492 output tokens. The preceding five failed/uncertain attempts remain in the local journal, not counted as successful performance samples. Further hosted execution/publication and gateway payment configuration require their own checks.

## Representative GitHub links for sponsors

- ENS: [Rescue service discovery](https://github.com/Jun0908/Decentralized-Value/blob/main/packages/ens-adapter/src/rescue.ts). Actual authorization/transaction orchestration: [demo script](../../../scripts/demo-ens-rescue.ts).
- Chainlink: [official confidential private-pack handler](https://github.com/Jun0908/Decentralized-Value/blob/main/workflows/chainlink-cre/rescue-envelope/secret-pack/main.ts).
- Bazantic: [external AI → Bazantic MCP implementation](https://github.com/Jun0908/Decentralized-Value/blob/main/apps/api/src/bazantic-rescue-agent.ts).

Evidence: [ENS](../../evidence/deployments/ensv2-rescue-demo.json), [CRE](../../evidence/deployments/chainlink-cre-private-pack.json), [Bazantic](../../evidence/deployments/bazantic-rescue-agent-demo.json). Private keys, API keys, signed raw transactions and private journals are not public evidence or recording material.
