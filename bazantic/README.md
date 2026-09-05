# Bazantic Integration

Frontier Protocol is ready to register as a Bazantic API service after the versioned OpenAPI document is publicly reachable over HTTPS. Registration remains intentionally unclaimed until dashboard credentials and a deployment URL exist.

Important operating constraints confirmed on 2026-09-05:

- Read the generated `endpointUrl` from `baz gateway list --json`; do not construct it.
- Use MCP `tools/list` for free discovery.
- A normal MCP client cannot settle a paid `tools/call`; use `baz curl` for paid calls.
- The CLI can create a draft gateway, while credentials, delivery settings, method prices, and activation require the dashboard.
- Preserve identical prompt, model, settings, and API access for the required raw-vs-Recipe comparison.

See [implementation decisions](../Docs/implementation-decisions.md) for sources and prize eligibility notes.

## Registration runbook

1. Deploy `openapi/frontier-v1.yaml` at a public HTTPS URL.
2. Run `baz api register --spec <PUBLIC_OPENAPI_URL>` and retain the returned service ID.
3. Configure only `POST /v1/evaluations` as paid in the dashboard; keep discovery reads free.
4. Activate the gateway, then obtain its exact `endpointUrl` with `baz gateway list --json`.
5. Test reads through MCP and the paid evaluation through `baz curl`.

The tool mapping is in `mcp-tools.json`; the repeatable agent guidance is in `recipe.md`.
