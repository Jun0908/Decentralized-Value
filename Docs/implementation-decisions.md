# Implementation Decisions

This log records decisions that affect the Frontier Protocol architecture. Sponsor APIs and beta contracts can change, so each integration decision includes a verification date and primary source.

## D-001 — pnpm workspace with explicit service boundaries

- **Status:** Accepted
- **Date:** 2026-09-05
- **Decision:** Use one pnpm monorepo with separate web, API, runner, shared schema, SDK, ENS adapter, Ledger adapter, contracts, artifacts, benchmarks, Bazantic, and OpenAPI areas.
- **Reason:** The protocol core remains testable without sponsor adapters, while the production demo can require those adapters on its critical path.

## D-002 — Runtime and package baseline

- **Status:** Accepted
- **Date:** 2026-09-05
- **Decision:** Require Node.js 22+, pnpm 11.24.0, Next.js 16.3.4, React 19.2.8, TypeScript 6.0.3, ESLint 9.39.5, Prettier 3.9.6, Vitest 5.0.0, and Zod 4.5.4.
- **Reason:** Next.js 16.3.4 requires Node.js 20.9 or later. TypeScript 7.0.2 is published, but the current TypeScript ESLint parser range is below 6.1; TypeScript 6.0.3 is the newest compatible stable release verified for this workspace. ESLint 10 is accepted by `eslint-config-next` itself but not yet by all bundled React/import/accessibility plugins, so ESLint 9 avoids peer-resolution drift.
- **Sources:** [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), package registry metadata checked on 2026-09-05.

## D-003 — Next.js App Router and Node.js runtime

- **Status:** Accepted
- **Date:** 2026-09-05
- **Decision:** Use the App Router, Server Components by default, the Node.js runtime by default, explicit ESLint CLI commands, and `next/font` for optimized font loading.
- **Reason:** The API and runner need ordinary Node.js capabilities. Edge runtime is not required. Next.js 16 no longer runs lint automatically during `next build`, so CI must run lint separately.
- **Source:** [Next.js installation and linting](https://nextjs.org/docs/app/getting-started/installation).

## D-004 — ENSv2 Sepolia is authoritative for runner identity

- **Status:** Accepted
- **Date:** 2026-09-05
- **Decision:** Resolve names through an ENSv2-ready chain-aware client on Sepolia. Use hierarchical registries, Permissioned Resolvers, and Enhanced Access Control for runner discovery and delegated record permissions. Do not pin the Universal Resolver implementation address in application configuration.
- **Reason:** ENSv2 uses a hierarchical registry rather than one flat registry. Permissioned Registry roles are reversible and scoped through EAC. The Universal Resolver proxy is the stable client entry point, while beta implementations can change.
- **Current Sepolia references:** Root Registry `0x8115186e8f2e0b0281e86ab91f0f48ba90364354`, ETH Registry `0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2`, Universal Resolver proxy `0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe`, Permissioned Resolver implementation `0x9eae5c2730a7dd16bdd1dee6421a1b91e3b0365e`.
- **Volatility:** ENS explicitly marks ENSv2 contracts and interfaces as beta and subject to change. Re-check deployments immediately before integration and deployment.
- **Sources:** [ENSv2 overview](https://docs.ens.domains/ensv2/overview/), [deployments](https://docs.ens.domains/learn/deployments/), [Permissioned Registry](https://docs.ens.domains/ensv2/permissioned-registry/), [Permissioned Resolver](https://docs.ens.domains/ensv2/permissioned-resolver/), [Enhanced Access Control](https://docs.ens.domains/ensv2/enhanced-access-control/), [app developer guide](https://docs.ens.domains/ensv2/tutorial-app-developers/).

## D-005 — ENSv2 prize target and evidence

- **Status:** Accepted
- **Date:** 2026-09-05
- **Decision:** Target **Best Use of ENSv2**. The demo must prove live Sepolia resolution, a real hierarchy, at least one delegated permission mutation, and a runtime failure when the required ENS authorization is absent.
- **Reason:** The official track requires ENSv2 on Sepolia, a central rather than cosmetic integration, no hard-coded values, open-source code, and a functional recorded or live demo.
- **Source:** [ETHOnline 2026 prizes](https://ethglobal.com/events/ethonline2026/prizes).

## D-006 — Bazantic provider workflow and prize eligibility

- **Status:** Accepted with external account step pending
- **Date:** 2026-09-05
- **Decision:** Use `@bazantic/cli` 0.8.0 and Bazantic's generated gateway/MCP surface. Register a draft from a public HTTPS OpenAPI document, then complete credentials, pricing, and activation in the dashboard. Never construct a gateway URL or payment header; read `endpointUrl` from `baz gateway list --json` and use `baz curl` to settle paid calls.
- **Reason:** Bazantic's provider workflow generates the payment and MCP layers. MCP is suitable for discovery, but an ordinary MCP client does not settle paid calls.
- **Eligibility:** This repository's first commit is dated 2026-09-05, after ETHOnline 2026 began, so treat it as a start-fresh entry. The continuity-only **Help an Agent Use Your Hackathon Project** prize is not the primary target. Target **Agentify a new API**, and ensure the final Recipe uses the newly added Frontier service together with a second meaningful service as required by the official qualification text.
- **External step:** `baz login`, account attribution, dashboard activation, and any grant approval require the user/browser and will be performed in Phase 5.
- **Sources:** [Bazantic public agent guide](https://bazantic.com/skill), [Bazantic resource index](https://bazantic.com/llms.txt), [ETHOnline 2026 prizes](https://ethglobal.com/events/ethonline2026/prizes).

## D-007 — Ledger Key Ring does not sign attestations

- **Status:** Accepted; Phase 4 design gate remains
- **Date:** 2026-09-05
- **Decision:** Do not describe `wallet-cli ring` as an attestation signer. Ledger Key Ring encrypts and decrypts secrets using keys tied to a Ledger device; the Ledger DMK Ethereum Signer performs personal-message and EIP-712 signing.
- **Planned split:** Use DMK EIP-712 signing for the outcome attestation and use `wallet-cli ring` for a scoped credential needed by the hosted runner. The precise scoped capability must be chosen before Phase 4 so Key Ring use is load-bearing rather than decorative.
- **Rejected design:** Encrypting a reusable EVM private key with Key Ring and decrypting it into the runner process does not support the claim that the signing key never enters the runner, so it is not the default design.
- **Constraint:** DMK signing requires a connected Ledger and explicit device interaction. A fully autonomous hosted attestation signer cannot be claimed from the currently documented `wallet-cli ring` surface alone.
- **Prize requirement:** The start-fresh Ledger track specifically highlights a VPS/CI/hosted-agent Key Ring use case and requires the Ledger Agent Stack, particularly `wallet-cli ring`. Every submission must also include tooling/DX feedback.
- **Sources:** [Ledger ETHOnline track](https://developers.ledger.com/ethonline), [Ledger Wallet CLI](https://developers.ledger.com/docs/ai-tools/ledger-cli), [Ledger AI tools overview](https://developers.ledger.com/docs/ai-tools/overview), [Ethereum Signer Kit](https://developers.ledger.com/docs/device-interaction/dmk-ts/references/signers/eth).

## D-008 — Privy remains a UX dependency, not a prize target

- **Status:** Accepted
- **Date:** 2026-09-05
- **Decision:** Plan for `@privy-io/react-auth` 3.40.0 with viem 2.56.3 and wagmi 3.7.7, but add them only when Phase 6 implements authentication and wallet UX.
- **Reason:** Deferring unused runtime packages keeps Phase 0 small. The product brief assigns Privy to human onboarding and transaction UX rather than the protocol trust model.
- **Sources:** [Privy quickstart](https://docs.privy.io/basics/get-started/quickstart), [wagmi getting started](https://wagmi.sh/react/getting-started), [viem documentation](https://viem.sh/docs/getting-started), package registry metadata checked on 2026-09-05.

## D-009 — Environment validation without secret output

- **Status:** Accepted
- **Date:** 2026-09-05
- **Decision:** Validate environment names and formats with Zod. Empty optional integration fields are permitted before their implementation phase. Validation output reports only the source filename and never values.
- **Reason:** A clean checkout must pass Phase 0 checks without real credentials, while later phases can tighten feature-specific requirements at adapter boundaries.

## D-010 — No Vercel project or database provisioning in Phase 0

- **Status:** Accepted
- **Date:** 2026-09-05
- **Decision:** Do not link a Vercel project, provision a database, pull remote environment variables, or run migrations in Phase 0.
- **Reason:** No shared managed resource is required for the current foundation, and those operations would create external state before a project/storage decision exists. Linking and provisioning will be handled when deployment architecture is selected.

## D-011 — Versioned hybrid benchmark boundary

- **Status:** Accepted
- **Date:** 2026-09-05
- **Decision:** Measure `gasPerOrder` in Foundry's EVM and compute `parallelThroughput` with a deterministic, versioned storage-contention scheduler. Preserve both metrics and correctness evidence in one generated record.
- **Reason:** Ordinary EVM execution provides real gas accounting but does not expose the target parallel scheduler. Naming the simulated boundary and hashing the workload/context prevents a normalized contention score from being misrepresented as observed production-chain throughput.
- **Details:** See [benchmark methodology](benchmark-methodology.md).

## D-012 — Phase 2 identity adapter and deployment boundary

- **Status:** Accepted; Sepolia deployment pending credentials
- **Date:** 2026-09-05
- **Decision:** Keep `BenchmarkAttestation` dependent on `IRunnerIdentityAdapter`. Use an owner-managed allow-list implementation for local Phase 2 integration tests; implement the live ENSv2 adapter against the same interface in Phase 3.
- **Reason:** Signature, replay, expiry, registry, and settlement behavior can be fully tested now without hard-coding ENS data into protocol contracts. The live adapter remains load-bearing because attestations fail closed when the configured adapter denies the runner.
- **Deployment gate:** `packages/contracts/script/Deploy.s.sol` is ready, but live Sepolia mutation requires `SEPOLIA_RPC_URL`, a funded `DEPLOYER_PRIVATE_KEY`/approved signing flow, and an explorer API key for verification. None were present on 2026-09-05.
