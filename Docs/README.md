# Frontier Protocol documentation

`Docs/` contains the current product and engineering truth. Judge-facing orientation stays in the repository-root `README.md`; coding-agent rules stay in the repository-root `AGENTS.md`.

## Current documents

| Document | Purpose |
| --- | --- |
| [PRODUCT.md](PRODUCT.md) | Product thesis, competition model, roles, and arena portfolio |
| [STATUS.md](STATUS.md) | What is implemented, partial, or not implemented |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Runtime design, evidence chain, and trust boundaries |
| [DEMO.md](DEMO.md) | Judge demo, verification checklist, and safe fallbacks |
| [INTEGRATIONS.md](INTEGRATIONS.md) | Vercel, Sepolia, Bazantic, ENS, Privy, and Ledger status |
| [arenas/emergency-supply.md](arenas/emergency-supply.md) | Emergency Supply measurement specification |
| [arenas/calldata-compression.md](arenas/calldata-compression.md) | Calldata Compression measurement specification |
| [deployments/sepolia-reward-demo.json](deployments/sepolia-reward-demo.json) | Machine-readable Sepolia reward evidence |
| [reference/Value_Decentralization_Whitepaper_JP.pdf](reference/Value_Decentralization_Whitepaper_JP.pdf) | Original Japanese concept paper |

## Authority rule

Current documents above take precedence over `archive/`. Archived files preserve the design history and may contain obsolete routes, sponsor assumptions, incomplete plans, or statements that have since become true or false.

Do not add another numbered plan or standalone review to the active Docs root. Update the appropriate current document, put temporary notes in the ignored `tmp/` directory, and move completed historical material into `archive/`.
