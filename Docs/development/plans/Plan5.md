# Frontier Protocol Plan 5 — Emergency Supply Competition

> Historical plan. The Classic Emergency Supply implementation remains available, but current product requirements live in `Docs/STATUS.md` and `Docs/product/arenas/emergency-supply.md`.

**Last updated:** 2026-09-08

**Status:** Demo competition path implemented; Google OAuth activation and production-tournament infrastructure remained separate.

## Objective

Plan 5 turned Emergency Supply from a one-off evaluator into an account-based competition experience:

```text
Sign in
  -> receive or connect a wallet
  -> read the challenge rules
  -> download the Starter Kit
  -> create and submit an allocation
  -> measure correctness and two independent outcomes
  -> compare the entry with the frontier
  -> select one Final Entry
  -> receive a Sepolia demo reward
  -> verify the transaction
```

The goal was for one visitor to see their own account, submissions, measurements, selected entry, and reward in one continuous flow.

## Competition experience

### Lobby and rules

The competition surface presented:

- challenge mission and lifecycle;
- demo reward information;
- participant and submission activity;
- procurement cost and worst-case delivery as independent metrics;
- rules, data, evaluation method, and frontier leaderboard;
- a clear join action.

Correctness required exactly 1,000 non-negative integer kits across known suppliers without exceeding capacity. Every valid allocation was evaluated against five supplier failures and four route failures. Correctness failures were excluded before Pareto comparison.

### Starter Kit and submission

The Starter Kit contained the challenge manifest, supplier data, failure scenarios, a sample submission, and instructions. The common submission shape was:

```json
{
  "allocations": {
    "harbor-aid": 300,
    "northstar": 150,
    "inland-works": 300,
    "local-grid": 150,
    "airbridge": 100
  }
}
```

The visual editor, JSON editor, and file upload all normalized to the same schema. Each accepted submission received an ID, revision, input hash, source hash, evaluation, and durable history. Repository and commit metadata remained optional provenance.

### Evaluation and frontier

The UI exposed only states supported by real execution:

```text
uploaded
  -> validating
  -> correctness passed or failed
  -> nine failure cases measured
  -> frontier calculated
  -> result recorded
```

Results included correctness, both metrics, all failure outcomes, context/input/result hashes, Pareto status, domination reason, exclusive contribution, and estimated demo reward.

The leaderboard showed seed strategies and participant revisions on the same frontier. It avoided a single overall ranking and allowed comparison between earlier and later revisions.

### Final Entry

- A participant could select only their own valid revision.
- The selection could change while the demo round remained open.
- The current selection was clearly visible and persisted.
- Demo finalization was kept distinct from a scheduled production deadline.

## Account and storage boundary

Privy supported email, wallet, and embedded-wallet flows. Google login still depended on dashboard activation. The backend verified identity tokens and kept browser-wallet discovery separate from authenticated state.

The production adapter stored participants, wallets, submissions, evaluations, Final Entries, idempotency records, and reward receipts in Redis. Process memory remained a local-development and test fallback.

## API shape

Public endpoints returned challenge rules, data, leaderboard, and Starter Kit material. Authenticated endpoints handled joining, participant state, submissions, revision history, Final Entry selection, and reward status. Authentication and ownership checks prevented one participant from reading or changing another participant's private state.

## Sepolia demo reward

The implementation added a dedicated, finite demo pool and a limited relayer that owned the pool but had no token-mint authority. The settlement adapter:

1. generated a participant-specific allocation and evidence root;
2. verified chain, pool ownership, balance, and reward cap;
3. committed and distributed once;
4. waited for confirmation;
5. persisted the receipt;
6. displayed the transaction, event, and balance evidence.

The UI labeled this as a Sepolia demonstration reward, not a production tournament payout or monetary-value token.

## Milestone result

| Area | Result |
| --- | --- |
| Email/wallet authentication and embedded wallet | Implemented |
| Join and durable participant state | Implemented |
| Starter Kit, editors, upload, revisions, and evaluation | Implemented |
| Frontier leaderboard, explanations, and Final Entry | Implemented |
| Participant-addressed Sepolia demo reward | Implemented |
| Desktop/mobile flow and failure recovery | Implemented |
| Google OAuth project activation | External configuration remained |
| Scheduled production deadline, uniqueness, and hidden final | Deferred |

## Verification targets

Tests covered authentication boundaries, submission validation, deterministic hashes, idempotency, revision limits, order-independent frontier results, context separation, allocation-root agreement, pool limits, duplicate settlement, transaction confirmation, and public evidence consistency.

## Deferred extensions

- isolated Python or TypeScript strategy execution;
- hidden-final datasets;
- scheduled deadlines and automatic entry locking;
- participant uniqueness such as World ID;
- sponsor-authored challenge publication;
- multi-runner attestation and disputes;
- promotion of the other practice arenas into full competitions.

Plan 6 later preserved this implementation as the Classic fallback while introducing the Strategy v2 disaster-response experience.
