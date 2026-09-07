# Bazantic integration

The source of truth is `openapi/frontier-v1.yaml`. Read/discovery tools are free. Only `evaluateArtifact` is paid/gated through Bazantic 402/MPP. The operation map is `bazantic/mcp-tools.json`, the agent instructions are `bazantic/recipe.md`, and the controlled comparison rubric is under `bazantic/experiments`.

Deployment sequence:

1. Deploy `apps/web` to Vercel. The same public origin serves the UI, `/v1/*` API, and `/openapi.yaml`.
2. Register the public spec with `@bazantic/cli` and retain the returned service ID.
3. Configure delivery credentials and evaluation pricing in the dashboard.
4. Activate the gateway and read the exact `endpointUrl` from `baz gateway list --json`; never construct it.
5. Confirm free discovery through MCP. Use `baz curl` for the paid evaluation because ordinary MCP tool calls do not settle it.
6. Run experiment A (raw tools) and B (identical settings plus Recipe), then score the committed rubric.

The public deployment uses explicit `simulated` evaluation results until optional Sepolia settlement is connected. A simulated response never includes a fabricated signature or transaction. Service, gateway, Recipe, and A/B identifiers remain unavailable until Bazantic registration is completed; this repository does not claim those external tasks as complete.
