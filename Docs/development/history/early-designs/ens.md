# ENSv2 integration

The target network is the ENSv2 Sepolia beta. Set `ENS_PARENT_NAME` only after securing an available parent name. The intended hierarchy is:

```text
<parent>.eth
├── arenas
├── challenges
├── runners
│   └── <runner>
└── agents
```

`runners.<parent>` carries `frontier.runners`, a JSON array of full runner names. Each runner requires an EVM address plus these text records:

| Record | Required value |
| --- | --- |
| `frontier.role` | `runner` |
| `frontier.capabilities` | comma-separated capability IDs |
| `url` | public HTTPS job endpoint |
| `frontier.version` | deployed runner version |
| `frontier.status` | `active` |

The runtime uses viem's ENS methods and does not pin a Universal Resolver address. It resolves records on every discovery/authorization request so permissioned record changes affect behavior immediately.

Recommended EAC roles are: sponsor owns the arena root; context author may mutate challenge metadata; runner may mutate only its own address/endpoint/version/status; maintainer may pause a runner and rotate operational endpoints but cannot sign attestations. Preserve the subname creation, resolver/EAC configuration, delegated mutation, and post-mutation resolution transaction hashes under `artifacts/evidence/ens.json`.

No live name or permission transaction is recorded yet because the required Sepolia account and parent name are not configured.
