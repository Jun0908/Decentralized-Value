# Sponsor integration evidence

Start with the [public sponsor demonstration](https://web-rho-seven-d6te7t3f0y.vercel.app/sponsors/demo) and [implementation/evidence guide](SPONSOR_DEMO.md). It shows saved executions, not fresh transactions or inference on page load.

| Sponsor       | Representative implementation                                                                | Execution evidence                                                                    | Boundary                                                                         |
| ------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| ENSv2         | [Rescue discovery](../../../packages/ens-adapter/src/rescue.ts)                              | [Seven-transaction record](../../evidence/deployments/ensv2-rescue-demo.json)         | Single-key Rescue discovery/authority, not a complete independent service market |
| Chainlink CRE | [Private-pack handler](../../../workflows/chainlink-cre/rescue-envelope/secret-pack/main.ts) | [Private pack and replay](../../evidence/deployments/chainlink-cre-private-pack.json) | Official local confidential simulation, not live TEE/network Final               |
| Bazantic      | [External AI MCP client](../../../apps/api/src/bazantic-rescue-agent.ts)                     | [Real AI MCP run](../../evidence/deployments/bazantic-rescue-agent-demo.json)         | Candidate tied; hosted Recipe remains unexecuted/unpublished                     |

Further detail: [CRE](chainlink-cre.md), [Bazantic](BAZANTIC_RESCUE_LIVE.md), [external-agent Practice API](agent-api.md), [owner confirmation gates](../submission/HACKATHON_SUBMISSION.md).

Prize eligibility depends on the owner's selected category and current event requirements; these records do not award or certify eligibility. Owner-operation reminders and recording notes are local-only. Technical connection results and the development trail remain in the public [development records](../../development/history/work-notes/README.md).
