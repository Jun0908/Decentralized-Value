# Rescue Room: operator execution and payment runbook

Historical execution: started 2026-09-11 from `0df4122`; pilot verified September 12 Japan time. This English edition separates that execution record from later continuation work. [Current status](../../STATUS.md) · [Original record](../history/docs-cleanup-2026-09-13/README.md).

## Demonstrated sequence

1. A real Commander chooses a service from public observations and its budget.
2. The simulator validates the action and fixes Order, Action, Manifest and Context hashes.
3. A durable job and payment reservation are stored.
4. A separate AI invocation returns a structured, source-referencing deliverable.
5. Binding, format and source references are checked; execution evidence is saved.
6. Sepolia escrow locks funds, records delivery and pays the provider; transactions, events and balances are checked.
7. A separate undelivered order verifies timeout refund.
8. Reopening/retrying the saved job returns its recorded result without additional inference or payment.

The actual pilot selected **Pulse Monitor**. Escrow paid **5 rUSD-DEMO** to the provider, whose balance at the payment block was 5. A separate intentionally undelivered order refunded **5 rUSD-DEMO** after its deadline; the Commander's balance at that block was 95. The refund did not reverse the successful order.

[Public evidence JSON](../../evidence/deployments/sepolia-rescue-service-demo.json) contains publishable observations, deliverable, hashes, transactions and balances. The public [operations page](https://web-rho-seven-d6te7t3f0y.vercel.app/rescue-room/operations) is a timestamped historical snapshot, not a continuously refreshed balance display.

Evidence generation reconstructs the workflow from recorded model output and checks runtime-bound receipt/acceptance hashes, escrow events, ERC20 transfers and balances. It neither reproduces a new model response nor establishes diagnostic truth.

## Scope and authorization of the historical run

The owner authorized parallel implementation, reuse of the existing OpenAI key, an aggregate **$5 AI ceiling** and **1 Sepolia ETH ceiling**. These were limits, not spending targets or indefinite authorization for future runs. Separate role wallets and a test token were used. Mainnet, external publication and Git Push were outside that original batch.

Only the integration operator performed paid/network execution to avoid duplicated work or split budget tracking. Private keys remained in ignored local storage. Concurrent Ocean work, worktrees and existing contract/funding settings were preserved.

The original work split payment executor/store/chain adapter, specialist runtime and durable jobs into separate worktrees, with integration owning the HTTP/CLI workflow, tests and documentation. Detailed historical ownership is retained in the source archive rather than being a current requirement to recreate those worktrees.

## Recorded usage

Read-only reconciliation timestamp: 2026-09-11 15:39 UTC. Gas totals cover 19 successful transactions.

| Item                      |          Recorded result | Interpretation                                                                                    |
| ------------------------- | -----------------------: | ------------------------------------------------------------------------------------------------- |
| Real AI calls             |                        2 | One Commander and one specialist; refund test did not call AI                                     |
| Input / output tokens     |              1,567 / 166 | Recorded runtime usage                                                                            |
| Estimated AI charge       |               $0.0005126 | Historical estimate using $0.20/M input and $1.20/M output, not an invoice or current price quote |
| Sepolia gas               | 0.003328678461839099 ETH | Deployments, administration, role funding, payment and refund                                     |
| ETH moved to role wallets |                0.009 ETH | Three transfers of 0.003; not all consumed as gas                                                 |
| Authorized ceilings       |       $5 / 1 Sepolia ETH | Maximums, not targets; no mainnet use                                                             |

The model budget conservatively reserves $0.50 per call for at most ten calls; failed/uncertain calls retain reservations. ETH maximum-fee reservations separate deployment/funding (0.75) from executor (0.25). Do not treat these conservative reservations as actual charges.

## Operator interface

Loopback-only bearer-authenticated HTTP: `127.0.0.1:4318`. The separate `RescueOperatorClient` and `pnpm rescue:jobs` do not expand public `/v1/*`, OpenAPI or ordinary CLI authorization scopes.

```powershell
# Status/records only: no inference or transfer
pnpm rescue:operator status
pnpm rescue:operator:server
pnpm rescue:jobs list
pnpm rescue:jobs get --job <job-id>

# RPC reads reverify evidence and regenerate public JSON
pnpm rescue:evidence:verify
```

The default server has **execution disabled**, so a job `run` returns 503. The CLI privately reads the locally generated bearer; it is not a command-line argument or printed value. Creating a job does not execute it.

Only for a separately approved paid run, and without starting a duplicate server:

```powershell
pnpm rescue:operator:server --execute-approved-sepolia
pnpm rescue:jobs create --file <request.json>
pnpm rescue:jobs run --job <job-id>
```

Request shape:

```json
{
  "idempotencyKey": "unique-request",
  "request": {
    "schemaVersion": "rescue-service-workflow-request-v0",
    "episodeId": "public-episode-id",
    "playbook": {}
  }
}
```

The empty Playbook above is a shape placeholder, not a runnable strategy; supply a valid existing normalized Playbook. Existing validation still applies.

Querying the original run with `pnpm rescue:operator run --execute-approved-sepolia` returns its saved result. `refund-test --execute-approved-sepolia` also reuses recorded refund evidence. A new explicit job is not permission to replace an uncertain job with a new idempotency key.

## Storage and recovery

- `secrets/rescue-operator-wallets.json`: role private keys.
- `secrets/rescue-operator-http.json`: local bearer.
- `.frontier/rescue-operator/`: durable jobs, budget reservations, signed-transaction journals and private evidence.
- All are Git-ignored. This pilot uses local files, not an encrypted vault/KMS. Appropriate Windows access controls and secure backups remain necessary.
- **Do not delete state to reset budgets or copy a running directory to another host for simultaneous execution.** Budget and duplicate prevention depend on recorded history.
- Locks are not automatically reclaimed by age. Investigate the old process, receipts/nonces and model status first. `needs-reconciliation` is not automatic retry authorization.
- Check/rebroadcast the same signed transaction using the same hash; do not replace unresolved nonces under another label. Contracts reject late release after the refund deadline.

The store is **single-host durable storage**, not a multi-host/serverless production database. Its owner binding, input hash/idempotency, exclusive claim, worker fencing and bounded events do not justify blind retries of unknown side effects.

## What the pilot does not prove

- Deliverable format/binding/source checks do not prove the diagnosis correct.
- This original service is an interpretation sidecar; it does not replace simulator receipts or original game outcomes.
- Separate role AI calls/wallets are operator-controlled, not independent third-party providers.
- Transaction submission, confirmed escrow lock, provider payment and refund are distinct states.
- Practice `simulated` / `game-credits` remains separate from real test-token transfers.
- The pilot alone does not complete hidden Final, fair tournament operation, Pool rewards, sponsor integration or production databases.

A **later separately versioned continuation** fed the purchased analysis into three Commander decisions. It did not overwrite this pilot or pay again. Its AI response was dominated by Never Pause; see [submission scope](../../hackathon/submission/HACKATHON_SUBMISSION.md). Fully autonomous multi-purchase recovery and a controlled information-value study remain incomplete.

## Verification recorded for the pilot

- TypeScript: **619 passed / 11 skipped**; opt-in Redis cases were not run.
- Solidity: **49 passed**, including eight parallel Ocean tests and 13 Rescue tests; Foundry 1.8.1 used locally.
- Workspace typecheck, Web production build, tooling build, generated contract checks, isolated SDK/CLI package installation and five existing CLI workflows passed.
- Local Anvil deployment/resume passed; second deployment added no transaction. Rerunning the saved Sepolia job added no transaction/model call.
- Real operator HTTP: unauthenticated 401, forwarded-host 403, default execution-disabled 503, private execution-token omission in public DTOs.
- Operations UI at 1440/390 px: navigation/details, no horizontal overflow or console errors. `pnpm verify:rescue:operator-ui` does not call paid routes.
- Scoped ESLint/Prettier and diff checks passed. Full CI was not claimed: pre-existing Solidity formatting differences were not swept into this batch.

Those are dated pilot checks, not a new validation run for this documentation edit. The original batch did not Push, publish npm packages or deploy the Web application; the evidence pages were subsequently made public and verified separately.

## Remaining implementation

1. Full multi-turn purchase/diagnose/patch/verify/resume workflows, with explicit acceptance/evaluation contexts.
2. Independently participating AI users/providers, persistence/authentication, price/quality/delivery contracts.
3. Unknown multiple Final Episodes, commitment, entry lock, fixed comparable context and anti-shortcut feasibility tests.
4. Independent Value Pool allocations on the same Final evidence and real Rescue reward settlement.
5. Multi-host production jobs/storage, secret vault, operational monitoring and remaining sponsor gates.
