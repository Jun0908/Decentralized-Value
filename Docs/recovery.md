# Demo failure recovery

| Failure | Visible symptom | Recovery |
| --- | --- | --- |
| Sepolia RPC | `demo:check` reports RPC blocked | switch to the backup Sepolia RPC; rerun strict check |
| Contract code absent | address code check fails | use recorded verified deployment; do not redeploy during the demo |
| ENS resolution | runner list unavailable | verify parent/manifest records and CCIP-read capable RPC; retain fail-closed state |
| Runner timeout | job becomes `failed` after retries | restart hosted runner, confirm HTTPS health and ENS endpoint, resubmit with same idempotency key |
| Ledger device | signing stops/pends | unlock device, open Ethereum app, confirm genuine-check and derivation path |
| Key Ring | runner stops before submission | restore OS-keychain `WALLET_PASS` injection and verify key name; never bypass in production |
| Bazantic | gateway unreachable/402 flow fails | read `endpointUrl` again from `baz gateway list --json`; use `baz curl` for paid call |
| Web | deployment unavailable | run local production build on port 3100 and use the retained benchmark fixture |

The safe fallback is always the checked-in reproducible benchmark. It demonstrates frontier math but must be described as local evidence, not a live sponsor integration.
