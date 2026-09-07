# Frontend information architecture

The public product is organized around Value Decentralization rather than integrations or a single demo.

## Primary journey

1. `/` explains why one weighted score centralizes value judgment.
2. `/arenas` lists every available competition from the shared Arena Registry.
3. `/arenas/[slug]` explains the two axes and common Build → Measure → Expand process before rendering the arena-specific workbench.
4. Practice results expose correctness, measurements, Pareto status, and reproducibility evidence.

The primary navigation contains only Arenas, How it works, and About. The technical order-book prototype, API specification, and Sponsor Debug remain reachable by direct URL for development but are not part of the user journey.

## Arena Registry

`apps/web/src/lib/arenas.ts` is the source of display metadata for the catalog and common detail shell. Each entry declares:

- Stable slug and evaluator kind
- Name, category, headline, and user-facing summary
- Status and intended audience
- Two metrics with direction and unit
- Participation, deadline, and reward state
- Primary action label

The homepage and `/arenas` iterate this registry. Adding an entry automatically adds its catalog card and static route parameter. A genuinely new evaluator kind also needs its workbench renderer in `/arenas/[slug]/page.tsx`; it does not require a new catalog layout or navigation item.

## Status language

The current arenas are labeled `Practice`. This means the measurements are real but the tournament layer is incomplete. UI text must not imply live rewards, participant counts, deadlines, World ID registration, or final settlement until those systems are configured.

Future statuses should distinguish Practice, Open, Final evaluation, Settled, and Coming soon.

## Legacy routes

- `/demo` and `/emergency-supply` redirect to `/arenas/emergency-supply`.
- `/calldata-compression` redirects to `/arenas/calldata-compression`.
- `/arena`, `/artifact/*`, `/runners`, `/sponsor-debug`, and `/openapi.yaml` are development or legacy surfaces and are excluded from primary navigation.
