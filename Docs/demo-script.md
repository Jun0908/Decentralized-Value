# Four-minute finalist demo

The demo is product-first. Keep slides to at most three and spend most of the time in the public application. Do not wait for an external service during the recording.

## 0:00–0:20 — The problem

Open the Top page.

> Most competitions add cost, safety, and quality into one weighted score. Whoever chooses those weights quietly chooses the winner. Frontier keeps each value independent.

Point to the Hero preview: procurement cost is minimized, worst-case delivery is maximized, and the same real fixture shows `46.22% → 47.10% (+0.88%)`.

## 0:20–0:50 — Who does what

Show the four-role strip.

- Sponsor publishes the problem, constraints, axes, context, and reward pool.
- A builder or AI agent submits a solution.
- The evaluator checks correctness and measures every axis under the same rules.
- Ethereum commits the result and distributes contribution-based rewards.

## 0:50–1:40 — Measure a real allocation

Jump to **Run the 60-second live demo**. Change one of the five supplier allocations while keeping the total at 1,000, then press **Evaluate allocation**.

Show, in order:

1. Correctness pass.
2. Total procurement cost and worst-case delivery.
3. Before/After hypervolume and exclusive contribution.
4. All nine supplier/route failure outcomes.
5. Context hash and result hash.
6. **Reproduce this result**, which copies the exact curl request.

Explain that the API recalculates these values from the entered numbers; the UI is not selecting a precomputed Artifact ID.

## 1:40–2:25 — Agent A/B/C replay

Press **Run Agent A / B / C**.

- Agent A is the cheapest participant result.
- Agent B costs more but preserves far more deliveries after a failure.
- Agent C costs more than B and delivers less, so B dominates it.
- A and B remain on the final participant frontier and divide 10,000 practice credits by exclusive contribution. C receives zero.

Point to the replay hash and state that the final calculation uses the complete set, so submission order cannot change the result.

## 2:25–3:10 — Why Ethereum

Show the Ethereum settlement panel and `/architecture`.

If verified Sepolia evidence is configured, open the Explorer transaction and show the reward pool, demo token, block, `AllocationCommitted`, and `RewardPaid` events. Show the recipient balance change.

If it is not configured, say exactly:

> The deterministic competition and tested reward contract are complete. This deployment has no funded Sepolia transaction configured, so the product correctly says Not deployed instead of faking Paid.

Optionally connect a browser wallet and sign the challenge manifest. Explain that this signature proves intent but is not a token approval, tournament entry, or payout.

## 3:10–3:40 — It is a protocol, not one dashboard

Show **More frontiers**:

- Ethereum Calldata Compression minimizes calldata gas and decoder execution gas using compiled Solidity in a local Cancun EVM.
- Community Microgrid Dispatch measures cost, worst-case energy, and lifecycle carbon as three independent axes.

## 3:40–4:00 — Close

Return to the Top statement.

> Frontier does not predict one future or crown one hidden-weight winner. It gives humans and agents the same measurable problem, preserves different useful tradeoffs, and rewards whoever expands what is possible.

## Recording checklist

- Run `pnpm demo:seed`, `pnpm demo:check`, `pnpm typecheck`, `pnpm test:ts`, and the production web build.
- Confirm the initial Emergency Supply allocation is valid.
- Confirm clipboard access for the curl button.
- Confirm the Agent replay reaches A + B and gives C zero credits.
- Confirm mobile and desktop layouts.
- Never say `funded`, `paid`, or `live on Sepolia` without a public Explorer transaction.
