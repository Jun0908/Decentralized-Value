# Frontier Protocol documentation

This directory contains the current product and engineering reference. Start with [`STATUS.md`](STATUS.md), then open only the document needed for the change.

## Active documents

| Document | Use it for |
| --- | --- |
| [STATUS.md](STATUS.md) | Current capabilities, gaps, and next boundary |
| [PRODUCT.md](PRODUCT.md) | Product model, terminology, and competition rules |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Runtime structure, evidence chain, and trust boundaries |
| [DEMO.md](DEMO.md) | Public walkthrough, safe claims, and recovery |
| [INTEGRATIONS.md](INTEGRATIONS.md) | Vercel, Sepolia, Privy, Redis, Bazantic, and ENS |
| [arenas/](arenas/) | Arena-specific inputs, constraints, metrics, and evaluation rules |
| [deployments/](deployments/) | Machine-readable deployment evidence |
| [reference/Value_Decentralization_Whitepaper_JP.pdf](reference/Value_Decentralization_Whitepaper_JP.pdf) | Original Japanese concept paper |

The repository-root [`README.md`](../README.md) is the public project entry point. The repository-root [`AGENTS.md`](../AGENTS.md) is the short working guide for coding agents. The OpenAPI contract lives at [`openapi/frontier-v1.yaml`](../openapi/frontier-v1.yaml).

## Where updates belong

- Product behavior or vocabulary: `PRODUCT.md`
- Proven implementation state: `STATUS.md`
- System or trust-boundary change: `ARCHITECTURE.md`
- Demo flow or public claim: `DEMO.md` and, when relevant, the root `README.md`
- External-service state: `INTEGRATIONS.md`
- Evaluator rules: the matching file under `arenas/` plus tests

There is no active numbered plan. Completed plans and point-in-time reviews live under [`archive/`](archive/). Temporary notes belong in the ignored `tmp/` directory.
