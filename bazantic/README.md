# Bazantic Integration

Frontier Protocol will be registered as a Bazantic API service after the versioned OpenAPI document is publicly reachable over HTTPS.

Important operating constraints confirmed on 2026-09-05:

- Read the generated `endpointUrl` from `baz gateway list --json`; do not construct it.
- Use MCP `tools/list` for free discovery.
- A normal MCP client cannot settle a paid `tools/call`; use `baz curl` for paid calls.
- The CLI can create a draft gateway, while credentials, delivery settings, method prices, and activation require the dashboard.
- Preserve identical prompt, model, settings, and API access for the required raw-vs-Recipe comparison.

See [implementation decisions](../Docs/implementation-decisions.md) for sources and prize eligibility notes.
