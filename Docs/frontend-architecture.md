# Frontend information architecture

The public product is organized around Value Decentralization rather than integrations or a single demo.

## Primary journey

1. `/` explains why one weighted score centralizes value judgment.
2. `/arenas` lists every available competition from the shared Arena Registry.
3. `/arenas/[slug]` explains each independent metric and the common Build → Measure → Expand process before rendering the arena-specific workbench.
4. Practice results expose correctness, measurements, Pareto status, and reproducibility evidence.
5. `/participate/[id]` provides an explicitly ephemeral submission sandbox with revision history and one selected final entry.

The primary navigation contains only Arenas, How it works, and About. The technical order-book prototype, API specification, and Sponsor Debug remain reachable by direct URL for development but are not part of the user journey.

## Arena Registry

`apps/web/src/lib/arenas.ts` is the source of display metadata for the catalog and common detail shell. Each entry declares:

- Stable slug, challenge ID, and evaluator kind
- Name, category, headline, and user-facing summary
- Status and intended audience
- A variable-length metric list with direction and unit
- Participation, deadline, and reward state
- Primary action label

The homepage and `/arenas` iterate this registry. `apps/web/src/lib/arena-adapters.tsx` maps evaluator kinds to a workbench and Manifest loader; unknown kinds fail closed with an `Unsupported evaluator` state. Adding an entry automatically adds its catalog card and static route parameter. A genuinely new problem shape adds an adapter without changing the common catalog, challenge detail, or route shell.

Microgrid Dispatch exercises the generic path with three metrics. Its chart lets users project any two axes, while Pareto membership and contribution still use all three axes.

## Trust boundaries

- Practice evaluation is deterministic and produces context-bound hashes.
- Contexts and Evidence Levels cannot be merged into the same comparison set.
- Reward figures in Practice are previews, not transfers.
- Submission sandbox state is in memory, wallet ownership is not signed, and World ID returns an unavailable response until configured.
- A Sepolia demo token and reward-pool contract exist locally, but the UI must not claim funding or payment without deployed addresses and transaction evidence.

## Status language

The current arenas are labeled `Practice`. This means the measurements are real but the tournament layer is incomplete. UI text must not imply live rewards, participant counts, deadlines, World ID registration, or final settlement until those systems are configured.

Future statuses should distinguish Practice, Open, Final evaluation, Settled, and Coming soon.

## Legacy routes

- `/demo` and `/emergency-supply` redirect to `/arenas/emergency-supply`.
- `/calldata-compression` redirects to `/arenas/calldata-compression`.
- `/arena`, `/artifact/*`, `/runners`, `/sponsor-debug`, and `/openapi.yaml` are development or legacy surfaces and are excluded from primary navigation.
