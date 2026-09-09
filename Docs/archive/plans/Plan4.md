# Frontier Protocol Plan 4 — Finalist Readiness

> Historical plan. Its page structure and copy describe a point-in-time design and are not current UI requirements.

**Last updated:** 2026-09-07

**Scope:** Judge review of the public Top page, arena catalog, and Emergency Supply measurement flow.

## Objective

Plan 4 focused the project on one understandable, end-to-end demonstration rather than adding more arenas. The target story was:

```text
Understand the protocol on the Top page
  -> change an Emergency Supply allocation
  -> measure nine failure cases
  -> compare the frontier before and after
  -> calculate contribution
  -> demonstrate a Sepolia reward
  -> verify the transaction in an explorer
```

The review found a strong thesis and evaluation engine, but the initial experience did not quickly explain:

1. who publishes a challenge;
2. what a builder submits;
3. what is measured fairly;
4. why expanding the frontier earns support;
5. why Ethereum is useful.

## Strengths identified

- A clear rejection of one hidden weighted score
- An understandable cost-versus-resilience example
- Real API evaluation of user input
- Visible context, constraints, evidence level, and result hash
- Before/after hypervolume and exclusive contribution
- Calldata and Microgrid examples proving reuse across domains and metric counts
- A consistent visual system

## Main UX risks at the time

- The Top page led with philosophy before showing the product in action.
- The strongest frontier-expansion moment was buried after several interactions.
- The input form appeared too far below the arena introduction.
- Ethereum looked optional because no complete onchain evidence path was visible.
- Three equally prominent arenas weakened the primary story.

## Recommended golden path

Emergency Supply became the primary walkthrough, while Calldata and Microgrid demonstrated extensibility.

The first screen was expected to answer:

- **Product:** a competition protocol for multiple independent objectives
- **Sponsor:** publishes the problem, constraints, metrics, and reward pool
- **Builder or Agent:** submits a solution
- **Protocol:** measures under one context and calculates frontier contribution
- **Ethereum:** commits evidence and supports verifiable reward distribution

The arena flow emphasized a short mission, the two independent metrics, editable allocation inputs, immediate evaluation, the worst failure, the frontier change, and a reproducible request.

## Ethereum proof requirement

The plan required one complete and honest Sepolia path:

1. fund a demo reward pool;
2. commit an allocation;
3. distribute or expose a claim fallback;
4. show the pool, token, transaction, event, and recipient balance;
5. label it as a demonstration rather than production settlement.

Contract safeguards included one commitment per challenge, a pool-balance ceiling, duplicate-payment prevention, and a claim path for recipients skipped by batch distribution.

This Sepolia demonstration was later completed. Durable production tournament storage, participant uniqueness, and scheduled final settlement were not completed by Plan 4.

## Four-minute demo structure

1. Explain the problem with one weighted score.
2. Show the Emergency Supply cost/resilience tension.
3. change an allocation and evaluate all failure cases.
4. Show frontier expansion and contribution.
5. Verify the Sepolia reward evidence.
6. Briefly show Calldata and three-axis Microgrid extensibility.
7. Close with why Ethereum protects the result and reward boundary.

The demo was intended to stay product-led, with at most three supporting slides.

## Milestones and outcome

| Milestone | Historical result |
| --- | --- |
| First ten seconds: clearer hero, evidence preview, direct CTA | Implemented at the time; later Top-page revisions superseded the exact layout |
| Sixty-second Emergency Supply demo | Implemented |
| Sepolia contract and evidence path | Implemented as a demonstration |
| Submission package, architecture, and public documentation | Implemented |
| Durable production tournament, World ID, and scheduled final round | Deferred |

Additional arenas, mainnet tokens, 3D charts, mandatory ENS, Ledger hardware, detailed sponsor dashboards, and decorative animation were intentionally outside the critical path.
