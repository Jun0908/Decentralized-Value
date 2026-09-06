# Prize and submission checklist

| Area | Repository evidence | Live evidence still required |
| --- | --- | --- |
| ENSv2 | fail-closed adapter/tests; namespace and EAC plan | names, records, permission/delegation transactions |
| Bazantic | OpenAPI, MCP map, paid boundary, Recipe, A/B rubric | service/gateway/Recipe IDs and completed experiment traces |
| Sepolia | deploy script, Foundry integration tests | verified addresses and attestation/frontier transaction |
| Privy | provider, embedded/existing wallet UI boundary | app ID and live login evidence |
| Demo | seed/check/recovery/runbook; production UI and same-origin public API | public deployment URL and 90–120 second recording |

Never submit placeholder identifiers. Add successful live outputs only to `artifacts/evidence/*.json`, rerun `pnpm security:scan`, and confirm the files contain no credentials.
