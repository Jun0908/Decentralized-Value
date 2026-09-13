"use client";

import {
  baselineProofExecutionStrategy,
  deriveSemaphoreSignal,
  proofExecutionStrategySchema,
  type ProofExecutionStrategy,
  type SecretGateEntry,
  type SecretGateGroupSnapshot,
} from "@frontier/secret-gate";
import {
  FingerPrintIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  LockClosedIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";
import type {
  SecretGateWorkerRequest,
  SecretGateWorkerResponse,
} from "@/workers/secret-gate-proof-worker";
import {
  describeSecretGateExecution,
  secretGateNearestRankP95,
} from "./secret-gate-execution-plan";
import styles from "./secret-gate-workbench.module.css";
import { FirstMission } from "./first-mission";

type Scenario = ReturnType<typeof import("@frontier/secret-gate").publicSecretGateScenario>;
type Receipt = {
  receiptHash: string;
  proofHash: string;
  nullifier: string;
  root: string;
  state: "off-chain-verified";
  verifiedAt: string;
};
type Observation = {
  index: number;
  completionMs: number;
  provingMs: number;
  proofVerified: boolean;
};
type Benchmark = {
  strategy: ProofExecutionStrategy;
  observations: Observation[];
  p95LatencyMs: number;
  peakIncrementalMemoryMb: number | null;
  memoryMethod: string;
  memoryBaselineBytes: number | null;
  memorySamplesBytes: number[];
};
type Phase =
  "idle" | "identity" | "enrolled" | "proving" | "verifying" | "entered" | "duplicate-rejected";
type ProofState = "queued" | "proving" | "verified" | "failed";
const savedIdentityKey = "frontier:secret-gate:identity:v1";
const shortHash = (value: string) => `${value.slice(0, 10)}…${value.slice(-8)}`;

function createProofWorker() {
  return new Worker(new URL("../workers/secret-gate-proof-worker.ts", import.meta.url), {
    type: "module",
  });
}

function runWorker(worker: Worker, request: SecretGateWorkerRequest, signal: AbortSignal) {
  return new Promise<SecretGateWorkerResponse>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      worker.terminate();
      reject(
        new Error(
          "The local proof exceeded two minutes. No new Gate acceptance has been confirmed.",
        ),
      );
    }, 120_000);
    const cleanup = () => {
      clearTimeout(timeout);
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      signal.removeEventListener("abort", onAbort);
    };
    const onMessage = (event: MessageEvent<SecretGateWorkerResponse>) => {
      if (event.data.requestId !== request.requestId) return;
      cleanup();
      resolve(event.data);
    };
    const onError = () => {
      cleanup();
      reject(new Error("The proof Worker failed. Try again or use another browser."));
    };
    const onAbort = () => {
      cleanup();
      worker.terminate();
      reject(new DOMException("Cancelled", "AbortError"));
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    signal.addEventListener("abort", onAbort, { once: true });
    try {
      worker.postMessage(request);
    } catch {
      onError();
    }
  });
}

// JS heap is an incomplete browser estimate: it is NOT Worker/WASM/OS process-tree RSS.
function readMemory() {
  const bytes = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
    ?.usedJSHeapSize;
  return typeof bytes === "number" && Number.isFinite(bytes) && bytes >= 0 ? bytes : null;
}

export function SecretGateWorkbench({ scenario }: { scenario: Scenario }) {
  const [identity, setIdentity] = useState<{ secret: string; commitment: string } | null>(null);
  const [persistIdentity, setPersistIdentity] = useState(false);
  const [snapshot, setSnapshot] = useState<SecretGateGroupSnapshot | null>(null);
  const [entry, setEntry] = useState<SecretGateEntry | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [storage, setStorage] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ status: number; code: string } | null>(null);
  const [strategy, setStrategy] = useState<ProofExecutionStrategy>(baselineProofExecutionStrategy);
  const [benchmark, setBenchmark] = useState<Benchmark | null>(null);
  const [proofStates, setProofStates] = useState<ProofState[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [operation, setOperation] = useState<string | null>(null);
  const [status, setStatus] = useState(
    "Start with a disposable identity. No wallet, payment or AI inference is needed.",
  );
  const [error, setError] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const workers = useRef(new Set<Worker>());
  const pending = operation !== null;
  const plan = describeSecretGateExecution(strategy);
  useEffect(
    () => () => {
      active.current?.abort();
      for (const worker of workers.current) worker.terminate();
    },
    [],
  );

  async function perform(name: string, action: (signal: AbortSignal) => Promise<void>) {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setOperation(name);
    setError(null);
    try {
      await action(controller.signal);
    } catch (cause) {
      if (name === "gate")
        setPhase((current) =>
          current === "proving" || current === "verifying" ? "enrolled" : current,
        );
      if (controller.signal.aborted)
        setStatus("Local proof work cancelled. No new Gate acceptance has been confirmed.");
      else {
        setError(cause instanceof Error ? cause.message : "The operation failed.");
        setStatus("The operation did not complete. Existing receipts are not erased.");
      }
    } finally {
      for (const worker of workers.current) worker.terminate();
      workers.current.clear();
      active.current = null;
      setOperation(null);
    }
  }

  function resetIdentity(secret: string, commitment: string) {
    setIdentity({ secret, commitment });
    setSnapshot(null);
    setEntry(null);
    setReceipt(null);
    setStorage(null);
    setDuplicate(null);
    setBenchmark(null);
    setProofStates([]);
    setPhase("identity");
  }

  function createIdentity(restore = false) {
    void perform("identity", async () => {
      const { Identity } = await import("@semaphore-protocol/identity");
      if (restore) {
        try {
          const saved = localStorage.getItem(savedIdentityKey);
          if (!saved) throw new Error();
          const restored = Identity.import(saved);
          resetIdentity(saved, restored.commitment.toString());
        } catch {
          throw new Error(
            "No readable saved demo identity. Create a new one, or allow local storage in this browser.",
          );
        }
      } else {
        const created = new Identity();
        const exported = created.export();
        resetIdentity(exported, created.commitment.toString());
        if (persistIdentity) {
          try {
            localStorage.setItem(savedIdentityKey, exported);
          } catch {
            throw new Error(
              "Identity created in memory, but device storage is unavailable. It has not been saved.",
            );
          }
        }
      }
      setStatus(
        "Identity ready in this browser. Next, send only its public commitment to join the group.",
      );
    });
  }

  function enroll() {
    if (!identity) return;
    void perform("enroll", async (signal) => {
      setStatus(
        "Sending the public commitment. Creating a 30-minute, eight-member group snapshot…",
      );
      const response = await fetch("/v1/secret-gate/enroll", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ commitment: identity.commitment }),
        signal,
      });
      const payload = (await response.json()) as { snapshot?: SecretGateGroupSnapshot };
      if (!response.ok || !payload.snapshot)
        throw new Error(
          "Enrollment failed. The Gate storage may be unavailable; no proof has been accepted.",
        );
      setSnapshot(payload.snapshot);
      setEntry(null);
      setReceipt(null);
      setDuplicate(null);
      setPhase("enrolled");
      setStatus(
        "Group ready: your public commitment plus seven fixed cover commitments. Next, generate a real proof.",
      );
    });
  }

  async function submitEntry(submitted: SecretGateEntry, isDuplicate: boolean) {
    const response = await fetch("/v1/secret-gate/enter", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(submitted),
    });
    const payload = (await response.json()) as {
      gateOpen?: boolean;
      receipt?: Receipt;
      storage?: string;
      error?: { code?: string };
    };
    if (isDuplicate) {
      const rejected =
        response.status === 409 &&
        payload.error?.code === "NULLIFIER_ALREADY_USED" &&
        payload.gateOpen === false;
      setDuplicate({
        status: response.status,
        code: rejected ? "NULLIFIER_ALREADY_USED" : "DUPLICATE_CHECK_NOT_CONFIRMED",
      });
      if (!rejected)
        throw new Error(
          "Expected duplicate-use rejection was not confirmed. An expired snapshot or unavailable storage is not evidence of duplicate protection.",
        );
      setPhase("duplicate-rejected");
      setStatus(
        "Same proof rejected: this nullifier has already been used. Your original receipt remains valid.",
      );
      return;
    }
    if (!response.ok || !payload.gateOpen || payload.receipt?.state !== "off-chain-verified") {
      throw new Error(
        payload.error?.code === "NULLIFIER_ALREADY_USED"
          ? "This identity already used this Gate scope. A new snapshot does not reset its nullifier."
          : "Gate acceptance not confirmed. The snapshot may have expired or storage may be unavailable. A transport failure can leave the server outcome unknown.",
      );
    }
    setReceipt(payload.receipt);
    setStorage(payload.storage ?? "unspecified");
    setPhase("entered");
    setStatus(
      "Membership verified off-chain. Now resend this exact proof to test the one-use rule.",
    );
  }

  function proveAndEnter() {
    if (!identity || !snapshot) return;
    void perform("gate", async (signal) => {
      setPhase("proving");
      setStatus(
        "Your browser Worker is generating a real Semaphore proof. The secret stays on this device.",
      );
      const worker = createProofWorker();
      workers.current.add(worker);
      try {
        const result = await runWorker(
          worker,
          {
            requestId: crypto.randomUUID(),
            privateKey: identity.secret,
            members: snapshot.members,
            message: snapshot.message,
            scope: snapshot.scope,
            treeDepth: snapshot.treeDepth,
            artifactUrls: snapshot.artifactUrls,
          },
          signal,
        );
        if (!result.ok || !result.proofVerified)
          throw new Error(
            "Local proof generation or verification failed. Nothing was submitted to the Gate.",
          );
        signal.throwIfAborted();
        const submitted = { gateId: snapshot.gateId, epoch: snapshot.epoch, proof: result.proof };
        setEntry(submitted);
        setPhase("verifying");
        setStatus(
          "Proof valid locally. The API is checking its root, scope, message and unused nullifier…",
        );
        // Once submitted, do not present cancellation as an undo of a server-side nullifier reservation.
        await submitEntry(submitted, false);
      } finally {
        worker.terminate();
        workers.current.delete(worker);
      }
    });
  }

  function runPersonalBenchmark() {
    if (!identity || !snapshot) return;
    void perform("benchmark", async (signal) => {
      const chosen = proofExecutionStrategySchema.parse(strategy);
      setBenchmark(null);
      setProofStates(["queued", "queued", "queued", "queued"]);
      setStatus(
        "Four real local proofs. Separate practice scopes: this does not enter the Gate or spend money.",
      );
      const baseline = readMemory();
      const samples: number[] = baseline === null ? [] : [baseline];
      const startedAt = performance.now();
      const timer = window.setInterval(() => {
        const value = readMemory();
        if (value !== null && samples.length < 4000) samples.push(value);
      }, 150);
      try {
        if (chosen.artifactLoad === "eager")
          await Promise.all(
            Object.values(snapshot.artifactUrls).map(async (url) => {
              const response = await fetch(url, { signal });
              if (!response.ok) throw new Error("Proof artifact loading failed.");
              await response.arrayBuffer();
            }),
          );
        let nextIndex = 0;
        const observations: Observation[] = [];
        const update = (index: number, state: ProofState) =>
          setProofStates((current) => current.map((item, i) => (i === index ? state : item)));
        const queue = async () => {
          let reusable: Worker | null = null;
          while (nextIndex < 4) {
            signal.throwIfAborted();
            const index = nextIndex++;
            const worker: Worker = reusable ?? createProofWorker();
            workers.current.add(worker);
            if (chosen.workerLifecycle === "reuse") reusable = worker;
            update(index, "proving");
            try {
              const result = await runWorker(
                worker,
                {
                  requestId: `personal-${index}`,
                  privateKey: identity.secret,
                  members: snapshot.members,
                  message: snapshot.message,
                  scope: deriveSemaphoreSignal(`frontier:secret-gate:personal:${index}`),
                  treeDepth: snapshot.treeDepth,
                  artifactUrls: snapshot.artifactUrls,
                },
                signal,
              );
              if (!result.ok || !result.proofVerified)
                throw new Error(
                  "A practice proof failed local verification. No complete benchmark result was recorded.",
                );
              observations.push({
                index: index + 1,
                completionMs: Math.round(performance.now() - startedAt),
                provingMs: Math.round(result.provingMs),
                proofVerified: true,
              });
              update(index, "verified");
            } catch (cause) {
              update(index, "failed");
              throw cause;
            } finally {
              if (chosen.workerLifecycle === "per-request") {
                worker.terminate();
                workers.current.delete(worker);
              }
            }
          }
        };
        // Wait for every slot to settle so failed batches cannot update a later run.
        const runs = await Promise.allSettled(
          Array.from({ length: chosen.maxParallelProofs }, queue),
        );
        const failure = runs.find((run) => run.status === "rejected");
        if (failure?.status === "rejected") throw failure.reason;
        signal.throwIfAborted();
        const lastMemory = readMemory();
        if (lastMemory !== null) samples.push(lastMemory);
        setBenchmark({
          strategy: chosen,
          observations: observations.sort((a, b) => a.index - b.index),
          p95LatencyMs: secretGateNearestRankP95(observations.map((item) => item.completionMs)),
          peakIncrementalMemoryMb:
            baseline === null || !samples.length
              ? null
              : Math.round((Math.max(0, Math.max(...samples) - baseline) / 1024 / 1024) * 10) / 10,
          memoryMethod:
            baseline === null
              ? "Unavailable in this browser"
              : "Main-page JS heap estimate; excludes full Worker/WASM/process memory",
          memoryBaselineBytes: baseline,
          memorySamplesBytes: samples,
        });
        setStatus(
          "All four proofs verified locally. These are personal observations, not comparable competition results.",
        );
      } finally {
        window.clearInterval(timer);
      }
    });
  }

  const stageIndex =
    phase === "idle"
      ? 0
      : phase === "identity"
        ? 1
        : phase === "enrolled" || phase === "proving"
          ? 2
          : 3;
  const stageCards = [
    {
      name: "Private identity",
      detail: identity ? "Created on your device" : "Only your browser knows the secret",
      icon: FingerPrintIcon,
    },
    {
      name: "Public group",
      detail: snapshot ? "8 commitments · depth 3" : "Send a commitment, not the secret",
      icon: UserGroupIcon,
    },
    {
      name: "Membership proof",
      detail: entry
        ? "Real proof generated and locally checked"
        : phase === "proving"
          ? "Real cryptography running…"
          : "Prove you belong without sending the secret",
      icon: ShieldCheckIcon,
    },
    {
      name: "One-use Gate",
      detail:
        duplicate?.code === "NULLIFIER_ALREADY_USED"
          ? "Same proof rejected on second use"
          : receipt
            ? "Accepted · off-chain receipt"
            : "Root + message + scope + nullifier checked",
      icon: receipt ? CheckCircleIcon : LockClosedIcon,
    },
  ];
  const evidence = {
    schemaVersion: "secret-gate-walkthrough-evidence-v1",
    contextHash: scenario.contextHash,
    commitment: identity?.commitment ?? null,
    snapshot,
    entry,
    receipt,
    duplicate,
    storage,
    benchmark,
    limitation:
      "Off-chain synthetic-cohort demo. No identity secret, transaction, reward, official ranking or production anonymity claim.",
  };

  return (
    <div className={styles.workbench} data-testid="secret-gate-walkthrough">
      <FirstMission
        title="Open the gate. Then try the exact same proof twice."
        error={error}
        busy={operation ? "Working: " + status : null}
        description="Follow four real actions. Your private identity stays on this device; only its public commitment and proof leave the browser."
        steps={[
          {
            title: "Create an identity",
            description:
              "Make a disposable identity for this experiment. No wallet or personal details are needed.",
            done: identity !== null,
            action: "Create demo identity",
            onAction: () => createIdentity(),
            disabled: operation !== null || identity !== null,
          },
          {
            title: "Join the public group",
            description: "Register only the public commitment and retrieve a membership snapshot.",
            done: snapshot !== null,
            action: "Register membership",
            onAction: enroll,
            disabled: operation !== null || identity === null || snapshot !== null,
          },
          {
            title: "Prove membership",
            description:
              "Your browser creates a proof. The server checks it before opening the gate. The first download can take a little time.",
            done: receipt !== null,
            action: "Make proof and enter",
            onAction: proveAndEnter,
            disabled: operation !== null || snapshot === null || receipt !== null,
          },
          {
            title: "Try reusing that proof",
            description:
              "Resend the retained proof. Success here means the gate refuses the second use, not that it opens again.",
            done: duplicate?.code === "NULLIFIER_ALREADY_USED",
            action: "Test the same proof again",
            onAction: () => {
              if (entry) void perform("duplicate", () => submitEntry(entry, true));
            },
            disabled: operation !== null || entry === null || receipt === null,
          },
        ]}
        result={
          duplicate?.code === "NULLIFIER_ALREADY_USED" && receipt ? (
            <p>
              First entry verified. Second use rejected with{" "}
              <strong>409 · NULLIFIER_ALREADY_USED</strong>. Your original receipt is preserved.
              This proves the one-use behavior in this session, not benchmark stability or a
              completed tournament.
            </p>
          ) : null
        }
      />
      <header className={styles.intro}>
        <p className={styles.kicker}>REAL SEMAPHORE V4 · INTERACTIVE PROOF LAB</p>
        <h2>
          One secret. One proof.
          <br />
          One way through.
        </h2>
        <p>
          Can you prove you belong without sending your identity secret? Build a real proof in your
          browser, open the Gate, then try using it twice.
        </p>
        <div className={styles.notice}>
          <strong>Practice open. Competition closed.</strong> No wallet, AI inference or payment.
          Latency / memory competition remains PIVOT.
        </div>
      </header>

      <section
        className={styles.theatre}
        aria-label="Live proof journey"
        data-testid="secret-gate-stages"
        data-phase={phase}
      >
        {stageCards.map(({ name, detail, icon: Icon }, index) => (
          <article
            key={name}
            data-state={
              index < stageIndex || (index === 3 && receipt)
                ? "complete"
                : index === stageIndex
                  ? "current"
                  : "waiting"
            }
          >
            <div className={styles.stageTop}>
              <span>0{index + 1}</span>
              <span>
                {index < stageIndex || (index === 3 && receipt)
                  ? "Complete"
                  : index === stageIndex
                    ? "Current step"
                    : "Waiting"}
              </span>
            </div>
            <Icon aria-hidden="true" className={styles.icon} />
            <h3>{name}</h3>
            <p>{detail}</p>
          </article>
        ))}
      </section>
      <p className={styles.boundary}>
        PRIVATE DEVICE: identity secret + proof Worker <span aria-hidden="true">→</span> SHARED:
        commitment, group root and proof. The enrollment server knows your commitment and this
        synthetic group; this is not a production anonymity system.
      </p>

      <section className={styles.controls} aria-label="Operate the real Gate">
        <article>
          <h3>1. Create your identity</h3>
          <p>
            A disposable local secret, not a wallet or a human identity. It is never printed in the
            Evidence below.
          </p>
          <label className={styles.check}>
            <input
              type="checkbox"
              disabled={pending}
              checked={persistIdentity}
              onChange={(event) => setPersistIdentity(event.target.checked)}
            />
            Save newly created demo identity on this device
          </label>
          <p className={styles.small}>
            Off by default. Saved identity is unencrypted browser storage. Do not use a valuable or
            production identity.
          </p>
          <div className={styles.actions}>
            <button
              disabled={pending}
              onClick={() => createIdentity()}
              type="button"
              data-testid="secret-gate-create"
            >
              Create disposable identity
            </button>
            <button disabled={pending} onClick={() => createIdentity(true)} type="button">
              Restore saved identity
            </button>
            <button
              disabled={pending}
              onClick={() => {
                try {
                  localStorage.removeItem(savedIdentityKey);
                  setPersistIdentity(false);
                  setStatus(
                    "Saved copy removed. The current in-memory identity remains until you leave or replace it.",
                  );
                } catch {
                  setError("Browser storage could not be accessed.");
                }
              }}
              type="button"
            >
              Remove saved copy
            </button>
          </div>
        </article>
        <article>
          <h3>2. Enroll a public commitment</h3>
          <p>
            Join seven fixed cover commitments. The server builds a root that expires after 30
            minutes. Group size and scope are fixed safety rules, not editable strategy knobs.
          </p>
          <button
            disabled={!identity || pending}
            onClick={enroll}
            type="button"
            data-testid="secret-gate-enroll"
          >
            Create membership snapshot
          </button>
          {snapshot ? (
            <p className={styles.small}>
              8 members · root {shortHash(snapshot.root)}
              <br />
              Expires: {snapshot.expiresAt}
            </p>
          ) : (
            <p className={styles.small}>Requires step 1.</p>
          )}
        </article>
        <article>
          <h3>3. Prove, enter, challenge the rule</h3>
          <p>
            The browser generates a real proof. The API verifies it and reserves the nullifier: a
            scope-specific marker that prevents reuse.
          </p>
          <div className={styles.actions}>
            <button
              className={styles.primary}
              disabled={!snapshot || pending || !!receipt}
              onClick={proveAndEnter}
              type="button"
              data-testid="secret-gate-enter"
            >
              {operation === "gate" ? "Working on your proof…" : "Prove and enter"}
            </button>
            <button
              disabled={!entry || !receipt || pending}
              onClick={() => {
                if (entry) void perform("duplicate", () => submitEntry(entry, true));
              }}
              type="button"
              data-testid="secret-gate-duplicate"
            >
              Resend same proof
            </button>
            {operation === "gate" && phase === "proving" ? (
              <button onClick={() => active.current?.abort()} type="button">
                Cancel local proof
              </button>
            ) : null}
          </div>
        </article>
      </section>
      <p className={styles.status} role="status" data-testid="secret-gate-status">
        {status}
      </p>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {receipt ? (
        <section className={styles.receipt} data-testid="secret-gate-receipt">
          <CheckCircleIcon aria-hidden="true" className={styles.icon} />
          <div>
            <h3>Gate opened. Membership verified.</h3>
            <p>
              Off-chain receipt ·{" "}
              {storage === "local-memory"
                ? "Local memory storage; a server restart can reset one-use protection."
                : storage === "durable-redis"
                  ? "Durable Redis storage."
                  : "Storage mode unspecified."}{" "}
              Not an Ethereum transaction.
            </p>
            <code>{receipt.receiptHash}</code>
          </div>
        </section>
      ) : null}
      {duplicate ? (
        <p className={styles.notice} data-testid="secret-gate-duplicate-result">
          HTTP {duplicate.status} · {duplicate.code}
          {duplicate.code === "NULLIFIER_ALREADY_USED"
            ? " — the same proof did not open the Gate twice."
            : " — do not treat this as successful duplicate protection."}
        </p>
      ) : null}

      <section className={styles.lab} aria-labelledby="proof-practice-heading">
        <p className={styles.kicker}>EDIT EXECUTION, NOT CRYPTOGRAPHY</p>
        <h2 id="proof-practice-heading">How should four proofs share your device?</h2>
        <p>
          These settings change the local four-proof experiment only, not the single Gate entry
          above. More parallel work is not guaranteed to be faster or use less memory.
        </p>
        <div className={styles.settings}>
          <label>
            Parallel proof slots
            <select
              disabled={pending}
              value={strategy.maxParallelProofs}
              onChange={(event) =>
                setStrategy((current) => ({
                  ...current,
                  maxParallelProofs: Number(event.target.value),
                }))
              }
              aria-describedby="secret-parallel-help"
            >
              {[1, 2, 3, 4].map((value) => (
                <option key={value} value={value}>
                  {value} at a time
                </option>
              ))}
            </select>
            <span id="secret-parallel-help">
              1 queues the remaining proofs; 4 starts all together. More Workers can contend for CPU
              and memory.
            </span>
          </label>
          <label>
            Proof-file loading
            <select
              disabled={pending}
              value={strategy.artifactLoad}
              onChange={(event) =>
                setStrategy((current) => ({
                  ...current,
                  artifactLoad: event.target.value as ProofExecutionStrategy["artifactLoad"],
                }))
              }
              aria-describedby="secret-loading-help"
            >
              <option value="on-demand">When first needed</option>
              <option value="eager">Prefetch before dispatch</option>
            </select>
            <span id="secret-loading-help">{plan.artifactExplanation}</span>
          </label>
          <label>
            Worker lifetime
            <select
              disabled={pending}
              value={strategy.workerLifecycle}
              onChange={(event) =>
                setStrategy((current) => ({
                  ...current,
                  workerLifecycle: event.target.value as ProofExecutionStrategy["workerLifecycle"],
                }))
              }
              aria-describedby="secret-worker-help"
            >
              <option value="reuse">Reuse within this batch</option>
              <option value="per-request">Fresh for each proof</option>
            </select>
            <span id="secret-worker-help">{plan.workerExplanation}</span>
          </label>
        </div>
        <div className={styles.queue} data-testid="secret-gate-execution-plan">
          <div>
            <strong>Ready together: {plan.concurrentSlots}</strong>
            <div className={styles.tokens}>
              {plan.initialProofs.map((id) => (
                <span key={id}>Proof {id}</span>
              ))}
            </div>
          </div>
          <div>
            <strong>Waiting for a free slot: {plan.queuedProofs.length}</strong>
            <div className={styles.tokens}>
              {plan.queuedProofs.length ? (
                plan.queuedProofs.map((id) => <span key={id}>Proof {id}</span>)
              ) : (
                <span>None</span>
              )}
            </div>
          </div>
          <p>
            {plan.workerCreations} Worker creations across 4 proofs. This is an allocation diagram,
            not a time or memory forecast. Internal engine threads stay SDK-managed.
          </p>
        </div>
        <div className={styles.actions}>
          <button
            className={styles.primary}
            disabled={!snapshot || pending}
            onClick={runPersonalBenchmark}
            type="button"
            data-testid="secret-gate-benchmark"
          >
            Run four real proofs
          </button>
          {operation === "benchmark" ? (
            <button onClick={() => active.current?.abort()} type="button">
              Cancel batch
            </button>
          ) : null}
          <span>
            {!snapshot
              ? "Create a membership snapshot first."
              : "No Gate submission · no payment · no ranking"}
          </span>
        </div>
        {proofStates.length ? (
          <div
            className={styles.progress}
            aria-label="Real proof progress"
            data-testid="secret-gate-proof-progress"
          >
            {proofStates.map((state, index) => (
              <div key={index} data-state={state}>
                <strong>Proof {index + 1}</strong>
                <span>{state}</span>
              </div>
            ))}
          </div>
        ) : null}
        {benchmark ? (
          <div data-testid="secret-gate-benchmark-result">
            <div className={styles.results}>
              <article>
                <span>P95 batch completion</span>
                <strong data-testid="secret-gate-p95">{benchmark.p95LatencyMs} ms</strong>
                <p>
                  With 4 observations, nearest-rank p95 is the last completion. Includes eager
                  prefetch and waiting.
                </p>
              </article>
              <article>
                <span>Incremental JS heap estimate</span>
                <strong data-testid="secret-gate-personal-memory">
                  {benchmark.peakIncrementalMemoryMb === null
                    ? "Unavailable"
                    : `${benchmark.peakIncrementalMemoryMb} MiB`}
                </strong>
                <p>{benchmark.memoryMethod}. Not OS RSS or total proof memory.</p>
              </article>
              <article>
                <span>Local proof checks</span>
                <strong>4 / 4 verified</strong>
                <p>
                  Real Semaphore verifier. Separate practice scopes do not consume the Gate
                  nullifier.
                </p>
              </article>
            </div>
            <p className={styles.small}>
              Recorded settings: {benchmark.strategy.maxParallelProofs} parallel ·{" "}
              {benchmark.strategy.artifactLoad} · {benchmark.strategy.workerLifecycle}. Changing the
              controls does not change these recorded observations.
            </p>
          </div>
        ) : null}
      </section>

      <details className={styles.evidence} data-testid="secret-gate-evidence">
        <summary>Inspect public evidence — no identity secret</summary>
        <p>
          Public proof, snapshot, receipt and raw browser observations. Hashes identify evidence;
          browser timings do not become reproducible by hashing them.
        </p>
        <pre>{JSON.stringify(evidence, null, 2)}</pre>
      </details>
      <aside className={styles.feasibility} data-testid="secret-gate-feasibility">
        <p className={styles.kicker}>FEASIBILITY DECISION · PIVOT</p>
        <h3>Correct proofs. Not yet a stable competition.</h3>
        <p>
          The 2026-09-09 controlled run verified all 32 proofs across 4 strategies × 2 trials. But
          maximum variation was 0.595 for latency and 0.331 for memory, above the predeclared CV
          limit of 0.15.
        </p>
        <p>
          A small 16-setting space is easy to enumerate. We have not established a nontrivial AI
          strategy contest or a stable latency–memory frontier. No weighted score, official winner,
          Value Pool or reward is active.
        </p>
        <p>
          Evidence in the repository: <code>benchmarks/secret-gate/results/latest.json</code>. A
          future GO requires a new controlled feasibility result, not a redesigned screen.
        </p>
      </aside>
    </div>
  );
}
