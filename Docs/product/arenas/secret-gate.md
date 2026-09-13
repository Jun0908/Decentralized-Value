# Secret Gate

**Status:** Working locally as a real Semaphore V4 practice gate. The optimization competition remains at a `PIVOT` decision after the first controlled feasibility run.

Secret Gate demonstrates anonymous membership without sending the browser identity secret to the server. It uses a synthetic cohort and proves only membership in that cohort. It does not prove personhood, a legal identity, or production authorization.

## Gate flow

1. The browser creates a disposable Semaphore identity.
2. Only the identity commitment is sent to the enrollment endpoint.
3. The server creates a 30-minute, eight-member synthetic group snapshot containing seven fixed cover commitments and the participant commitment.
4. A Web Worker generates a real Semaphore proof using checked-in depth-3 artifacts.
5. The API verifies the proof, trusted root, fixed message, fixed scope, and unused nullifier.
6. Redis atomically reserves the nullifier in production. Local development uses an explicitly labeled memory adapter.
7. The response returns an offchain verification receipt. It is not an Ethereum transaction.

The fixed public signals are derived from:

```text
message = hash("FRONTIER_SECRET_GATE_ENTER_V1")
scope   = hash("frontier:secret-gate:public-demo-gate:2026-09-demo-1")
```

## API

```text
GET  /v1/secret-gate
POST /v1/secret-gate/enroll
POST /v1/secret-gate/enter
```

Enrollment accepts one decimal Semaphore identity commitment. Entry accepts the fixed gate ID, epoch, and a Semaphore proof. A successful entry receives `off-chain-verified`; a second entry using the same identity and scope receives `NULLIFIER_ALREADY_USED`.

Production writes fail closed when durable Redis is unavailable.

## Pinned proof artifacts

| Artifact | Version | SHA-256 |
| --- | --- | --- |
| `semaphore-3.wasm` | Semaphore artifacts 4.13.0 | `48e15502f710be0a623d573d472edeeaf918fd5eee0b2ca9b407c4e4f20d12f2` |
| `semaphore-3.zkey` | Semaphore artifacts 4.13.0 | `c36653c42784df35a01f3d93415af9ad8292a540f8deb134a6a34a01752a89d3` |

The JavaScript identity, group, and proof packages are pinned to 4.14.3. The proof package currently selects the 4.13.0 Semaphore artifact set, so the artifact version is committed separately from the package version.

## Correctness gates

- The identity secret remains in the browser and its proof Worker.
- The group contains eight commitments and has Merkle depth 3.
- The submitted root must match an unexpired server-created snapshot.
- The proof message and scope must match the Gate policy.
- The official Semaphore verifier must accept the proof.
- One `(gateId, epoch, nullifier)` can succeed only once.
- Invalid schema fields fail closed.
- Missing production Redis fails closed.

## Personal-device practice

The page can run four real proofs with bounded concurrency, artifact-loading, and Worker-lifecycle settings. Each setting has a plain-language explanation and a structural diagram showing immediately available proof slots versus queued requests. The diagram predicts neither latency nor memory and does not create simulated competition outcomes.

The four proof cards show queued, proving, verified or failed state. The observed timer begins before optional eager artifact prefetch; nearest-rank p95 over four batch-completion observations is the last completion. The recorded result retains the settings actually used even after the controls change. The incomplete browser JS-heap estimate is explicitly not full Worker/WASM memory or OS process-tree RSS; unsupported browsers show unavailable. Cancellation and a two-minute per-proof Worker timeout do not create a completed result.

These values are personal observations. They never enter an official leaderboard, Pareto frontier, Value Pool allocation, or settlement calculation.

The Semaphore high-level API does not expose a safe engine-thread setting, so the field is fixed to `sdk-default` rather than presenting a non-functional competition knob.

## Interactive walkthrough — 2026-09-12

The UI now separates four stages: private browser identity, public synthetic group, real locally verified proof, and the one-use Gate. The server-side verification and storage rules are unchanged. After successful entry, **Resend same proof** submits the exact retained entry again, without generating another proof. Only HTTP 409 with `NULLIFIER_ALREADY_USED` and `gateOpen: false` is shown as confirmed duplicate protection; expired-root or storage errors are not.

The expanded public Evidence view contains commitment, snapshot, proof entry, receipt, duplicate-attempt status and the personal benchmark's raw observations. It never contains the identity secret. Device persistence remains opt-in and is labeled unencrypted demo-only browser storage; the saved copy can be removed independently from the active in-memory identity. Local-memory receipt storage is explicitly labeled as resettable by server restart.

This is not a production anonymity claim: the enrollment server receives the commitment and creates an individualized synthetic group root. No personhood, participant uniqueness, unlinkability against that server, or real-world access authorization is established. All 16 bounded execution settings are enumerable; this UI work does not establish a nontrivial AI competition or reopen the tournament.

The Japanese implementation and acceptance plan is [`../Plan-SecretGate.md`](../../development/plans/Plan-SecretGate.md). The real-proof package test explicitly loads the checked-in WASM and zkey from the web public directory instead of downloading remote proof artifacts.

## Feasibility result

The checked-in feasibility runner starts a clean controlled Chrome process for every trial, generates four real proofs, verifies all of them, and samples RSS across the Chrome process tree from the operating system.

The initial eight-trial result is stored at [`../../benchmarks/secret-gate/results/latest.json`](../../../benchmarks/secret-gate/results/latest.json). All 32 proofs passed verification, but repeated latency and memory observations were not stable enough to establish a settlement-quality multi-point frontier. The decision is therefore `PIVOT`, not `GO`.

No official Value Pools are active. Instant Privacy, Accessible Privacy, and Frontier Expansion remain proposed rules only until a larger controlled experiment establishes stable outcomes.

## Evidence boundary

Static configuration hashes remain deterministic. Timing and memory are empirical observations. An evidence hash commits the exact raw trial data and aggregation result, but a later rerun is not expected to produce the same raw values or result hash.

This is Evidence Level 0: a synthetic controlled benchmark, not proof of real-world mobile privacy performance.

## Deferred

- official competition and Value Pool allocation;
- scheduled hidden-final workload;
- participant uniqueness;
- multi-runner attestation;
- Sepolia Semaphore group and Gate transaction;
- onchain nullifier state;
- production access-control claims;
- arbitrary participant code or custom circuits.
