# Evaluate an artifact against a Value Frontier

Use this recipe when deciding whether an artifact advances a Frontier Protocol arena.

1. Call `get_arena`. State both axes, their directions and units, every hard constraint, and the immutable `contextHash`.
2. Call `get_artifact`. Verify its challenge and artifact hash; do not substitute a similarly named artifact.
3. Call `get_frontier`. Explain dominance: an eligible point is dominated only when another point is no worse on every axis and strictly better on at least one.
4. Call `list_runners`. Select only an `active` ENS identity advertising the challenge capability. Never invent an endpoint or signer when discovery is unavailable.
5. With user-authorized payment, invoke the paid `evaluate_artifact` operation using a stable idempotency key. Poll `get_evaluation` until `attested` or `failed`.
6. In the final answer distinguish measured facts from pending state. Include correctness, both outcome values, runner ENS name, `resultHash`, signature verification, Sepolia transaction, and frontier membership when present.

Never treat a weighted scalar score as the frontier. Never describe queued work as completed. If ENS, Ledger, Bazantic, or Sepolia is unavailable, report that exact boundary and the recovery action.
