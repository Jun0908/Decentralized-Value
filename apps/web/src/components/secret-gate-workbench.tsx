"use client";

import {
  baselineProofExecutionStrategy,
  deriveSemaphoreSignal,
  proofExecutionStrategySchema,
  type ProofExecutionStrategy,
  type SecretGateGroupSnapshot,
} from "@frontier/secret-gate";
import { useRef, useState } from "react";
import type {
  SecretGateWorkerRequest,
  SecretGateWorkerResponse,
} from "@/workers/secret-gate-proof-worker";

type PublicSecretGateScenario = ReturnType<
  typeof import("@frontier/secret-gate").publicSecretGateScenario
>;

type GateReceipt = {
  receiptHash: string;
  proofHash: string;
  nullifier: string;
  root: string;
  state: "off-chain-verified";
  verifiedAt: string;
};

type PersonalBenchmark = {
  p95LatencyMs: number;
  proofCount: number;
  peakIncrementalMemoryMb: number | null;
  memoryMethod: string;
  proofVerified: boolean;
};

type BrowserMemoryPerformance = Performance & {
  memory?: { usedJSHeapSize: number };
  measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }>;
};

function shortHash(value: string) {
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

function p95(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
}

function createProofWorker() {
  return new Worker(new URL("../workers/secret-gate-proof-worker.ts", import.meta.url), {
    type: "module",
  });
}

function runWorker(worker: Worker, request: SecretGateWorkerRequest) {
  return new Promise<SecretGateWorkerResponse>((resolve) => {
    const cleanup = () => {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
    };
    const onMessage = (event: MessageEvent<SecretGateWorkerResponse>) => {
      if (event.data.requestId !== request.requestId) return;
      cleanup();
      resolve(event.data);
    };
    const onError = (event: ErrorEvent) => {
      cleanup();
      resolve({ requestId: request.requestId, ok: false, error: event.message });
    };
    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    worker.postMessage(request);
  });
}

async function readMemory(): Promise<{ bytes: number | null; method: string }> {
  const browserPerformance = performance as BrowserMemoryPerformance;
  if (crossOriginIsolated && browserPerformance.measureUserAgentSpecificMemory) {
    try {
      const measured = await browserPerformance.measureUserAgentSpecificMemory();
      return { bytes: measured.bytes, method: "measureUserAgentSpecificMemory" };
    } catch {
      // Continue to the Chromium-only fallback.
    }
  }
  if (browserPerformance.memory) {
    return { bytes: browserPerformance.memory.usedJSHeapSize, method: "usedJSHeapSize estimate" };
  }
  return { bytes: null, method: "unavailable on this browser" };
}

export function SecretGateWorkbench({ scenario }: { scenario: PublicSecretGateScenario }) {
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [commitment, setCommitment] = useState<string | null>(null);
  const [persistIdentity, setPersistIdentity] = useState(false);
  const [snapshot, setSnapshot] = useState<SecretGateGroupSnapshot | null>(null);
  const [receipt, setReceipt] = useState<GateReceipt | null>(null);
  const [strategy, setStrategy] = useState<ProofExecutionStrategy>(baselineProofExecutionStrategy);
  const [benchmark, setBenchmark] = useState<PersonalBenchmark | null>(null);
  const [status, setStatus] = useState("Create a disposable identity to begin.");
  const [operation, setOperation] = useState<"enroll" | "gate" | "benchmark" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeWorker = useRef<Worker | null>(null);
  const pending = operation !== null;

  async function createIdentity() {
    setError(null);
    const { Identity } = await import("@semaphore-protocol/identity");
    const identity = new Identity();
    const exported = identity.export();
    setPrivateKey(exported);
    setCommitment(identity.commitment.toString());
    setSnapshot(null);
    setReceipt(null);
    setBenchmark(null);
    if (persistIdentity) localStorage.setItem("frontier:secret-gate:identity:v1", exported);
    setStatus("Identity created locally. Only its commitment will be enrolled.");
  }

  async function restoreIdentity() {
    setError(null);
    const exported = localStorage.getItem("frontier:secret-gate:identity:v1");
    if (!exported) {
      setError("No saved Secret Gate identity was found on this device.");
      return;
    }
    const { Identity } = await import("@semaphore-protocol/identity");
    const identity = Identity.import(exported);
    setPrivateKey(exported);
    setCommitment(identity.commitment.toString());
    setSnapshot(null);
    setReceipt(null);
    setBenchmark(null);
    setStatus("Saved identity restored on this device.");
  }

  async function enroll() {
    if (!commitment) return;
    setOperation("enroll");
    setError(null);
    setStatus("Creating a synthetic eight-member group snapshot…");
    try {
      const response = await fetch("/v1/secret-gate/enroll", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ commitment }),
      });
      const payload = (await response.json()) as {
        snapshot?: SecretGateGroupSnapshot;
        error?: { message?: string };
      };
      if (!response.ok || !payload.snapshot) {
        throw new Error(payload.error?.message ?? "Enrollment failed");
      }
      setSnapshot(payload.snapshot);
      setStatus("Membership snapshot ready. The identity secret is still in this browser.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Enrollment failed");
      setStatus("Enrollment did not complete.");
    } finally {
      setOperation(null);
    }
  }

  async function proveAndEnter() {
    if (!privateKey || !snapshot) return;
    setOperation("gate");
    setError(null);
    setStatus("Generating a real Semaphore proof in a Web Worker…");
    const worker = createProofWorker();
    activeWorker.current = worker;
    try {
      const result = await runWorker(worker, {
        requestId: crypto.randomUUID(),
        privateKey,
        members: snapshot.members,
        message: snapshot.message,
        scope: snapshot.scope,
        treeDepth: snapshot.treeDepth,
        artifactUrls: snapshot.artifactUrls,
      });
      if (!result.ok) throw new Error(result.error);
      if (!result.proofVerified) throw new Error("The generated proof failed local verification");
      setStatus("Proof generated locally. Verifying the Gate policy off-chain…");
      const response = await fetch("/v1/secret-gate/enter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          gateId: snapshot.gateId,
          epoch: snapshot.epoch,
          proof: result.proof,
        }),
      });
      const payload = (await response.json()) as {
        gateOpen?: boolean;
        receipt?: GateReceipt;
        error?: { message?: string };
      };
      if (!response.ok || !payload.gateOpen || !payload.receipt) {
        throw new Error(payload.error?.message ?? "Gate verification failed");
      }
      setReceipt(payload.receipt);
      setStatus(`Gate opened. Browser proof time: ${Math.round(result.provingMs)} ms.`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Proof generation failed";
      setError(message);
      setStatus(
        message.includes("already entered")
          ? "Second entry rejected. The original Gate receipt remains valid."
          : "The Gate remains closed.",
      );
    } finally {
      worker.terminate();
      activeWorker.current = null;
      setOperation(null);
    }
  }

  function cancelProof() {
    activeWorker.current?.terminate();
    activeWorker.current = null;
    setOperation(null);
    setStatus("Proof generation cancelled. The Gate remains closed.");
  }

  async function runPersonalBenchmark() {
    if (!privateKey || !snapshot) return;
    const parsed = proofExecutionStrategySchema.parse(strategy);
    setOperation("benchmark");
    setError(null);
    setBenchmark(null);
    setStatus("Running four real proofs on this device…");
    const allWorkers = new Set<Worker>();
    let sampling = true;
    activeWorker.current = null;
    try {
      const baselineMemory = await readMemory();
      let peakBytes = baselineMemory.bytes;
      let memoryMethod = baselineMemory.method;
      const sampleMemory = async () => {
        while (sampling) {
          const sample = await readMemory();
          memoryMethod = sample.method;
          if (sample.bytes !== null) peakBytes = Math.max(peakBytes ?? sample.bytes, sample.bytes);
          await new Promise((resolve) => window.setTimeout(resolve, 150));
        }
      };
      const samplingPromise = sampleMemory();
      if (parsed.artifactLoad === "eager") {
        await Promise.all(
          Object.values(snapshot.artifactUrls).map(async (url) => {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Semaphore artifact could not be loaded");
            await response.arrayBuffer();
          }),
        );
      }

      const count = 4;
      const startedAt = performance.now();
      let nextIndex = 0;
      const latencies = new Array<number>(count);
      let allVerified = true;
      const reusableWorkers =
        parsed.workerLifecycle === "reuse"
          ? Array.from({ length: Math.min(parsed.maxParallelProofs, count) }, () => {
              const worker = createProofWorker();
              allWorkers.add(worker);
              return worker;
            })
          : [];

      const runQueue = async (slot: number) => {
        while (nextIndex < count) {
          const index = nextIndex++;
          const worker = reusableWorkers[slot] ?? createProofWorker();
          allWorkers.add(worker);
          activeWorker.current = worker;
          const result = await runWorker(worker, {
            requestId: `personal-${index}`,
            privateKey,
            members: snapshot.members,
            message: snapshot.message,
            scope: deriveSemaphoreSignal(`frontier:secret-gate:personal:${index}`),
            treeDepth: snapshot.treeDepth,
            artifactUrls: snapshot.artifactUrls,
          });
          latencies[index] = performance.now() - startedAt;
          allVerified = allVerified && result.ok && result.proofVerified;
          if (!result.ok) throw new Error(result.error);
          if (parsed.workerLifecycle === "per-request") {
            worker.terminate();
            allWorkers.delete(worker);
          }
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(parsed.maxParallelProofs, count) }, (_, slot) =>
          runQueue(slot),
        ),
      );
      sampling = false;
      await samplingPromise;
      const increment =
        baselineMemory.bytes !== null && peakBytes !== null
          ? Math.max(0, peakBytes - baselineMemory.bytes) / 1024 / 1024
          : null;
      setBenchmark({
        p95LatencyMs: Math.round(p95(latencies)),
        proofCount: count,
        peakIncrementalMemoryMb: increment === null ? null : Math.round(increment * 10) / 10,
        memoryMethod,
        proofVerified: allVerified,
      });
      setStatus("Personal-device practice complete. It is not an official leaderboard result.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Personal benchmark failed");
      setStatus("Personal-device practice did not complete.");
    } finally {
      sampling = false;
      for (const worker of allWorkers) worker.terminate();
      activeWorker.current = null;
      setOperation(null);
    }
  }

  return (
    <div className="secret-gate-workbench">
      <section className="secret-gate-intro" aria-labelledby="secret-gate-heading">
        <div>
          <p className="eyebrow">Real Semaphore V4 · off-chain verification</p>
          <h2 id="secret-gate-heading">Prove membership. Reveal no identity secret.</h2>
          <p>
            Create a disposable identity in this browser, join a synthetic eight-member cohort, and
            generate a real zero-knowledge proof in a Web Worker.
          </p>
        </div>
        <div className="secret-gate-boundary">
          <span>Private</span>
          <strong>Identity secret</strong>
          <span aria-hidden="true">→</span>
          <span>Public</span>
          <strong>Commitment + proof</strong>
        </div>
      </section>

      <section className="secret-gate-flow" aria-label="Secret Gate steps">
        <article className={privateKey ? "complete" : "active"}>
          <span>01</span>
          <h3>Create identity</h3>
          <p>The secret is created locally and is not sent to the server.</p>
          <label className="secret-gate-check">
            <input
              checked={persistIdentity}
              onChange={(event) => setPersistIdentity(event.target.checked)}
              type="checkbox"
            />
            Save this demo identity on this device
          </label>
          <div className="secret-gate-actions">
            <button disabled={pending} onClick={() => void createIdentity()} type="button">
              Create disposable identity
            </button>
            <button disabled={pending} onClick={() => void restoreIdentity()} type="button">
              Restore saved identity
            </button>
          </div>
          {commitment ? <code>{shortHash(commitment)}</code> : null}
        </article>

        <article className={snapshot ? "complete" : privateKey ? "active" : ""}>
          <span>02</span>
          <h3>Join the demo group</h3>
          <p>Only the public commitment is enrolled. The snapshot expires after 30 minutes.</p>
          <button disabled={!commitment || pending} onClick={() => void enroll()} type="button">
            Create membership snapshot
          </button>
          {snapshot ? (
            <dl>
              <div>
                <dt>Members</dt>
                <dd>{snapshot.members.length}</dd>
              </div>
              <div>
                <dt>Root</dt>
                <dd>{shortHash(snapshot.root)}</dd>
              </div>
            </dl>
          ) : null}
        </article>

        <article className={receipt ? "complete" : snapshot ? "active" : ""}>
          <span>03</span>
          <h3>Prove and enter</h3>
          <p>The API verifies membership, Gate scope, trusted root, and unused nullifier.</p>
          <div className="secret-gate-actions">
            <button
              className="primary-action"
              disabled={!snapshot || pending}
              onClick={() => void proveAndEnter()}
              type="button"
            >
              {operation === "gate" ? "Generating proof…" : "Prove and enter"}
            </button>
            {operation === "gate" ? (
              <button onClick={cancelProof} type="button">
                Cancel
              </button>
            ) : null}
          </div>
        </article>
      </section>

      <p className="secret-gate-status" aria-live="polite">
        {status}
      </p>
      {error ? <p className="error-banner">{error}</p> : null}

      {receipt ? (
        <section className="secret-gate-receipt" aria-live="polite">
          <div>
            <p className="eyebrow">Gate open</p>
            <h2>Anonymous membership verified.</h2>
            <p>This receipt proves an off-chain Gate check. It is not an Ethereum transaction.</p>
          </div>
          <dl>
            <div>
              <dt>State</dt>
              <dd>{receipt.state}</dd>
            </div>
            <div>
              <dt>Proof hash</dt>
              <dd>{shortHash(receipt.proofHash)}</dd>
            </div>
            <div>
              <dt>Nullifier</dt>
              <dd>{shortHash(receipt.nullifier)}</dd>
            </div>
            <div>
              <dt>Receipt hash</dt>
              <dd>{shortHash(receipt.receiptHash)}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      <section className="secret-gate-practice" aria-labelledby="proof-practice-heading">
        <div>
          <p className="eyebrow">Personal-device practice</p>
          <h2 id="proof-practice-heading">Measure four real proofs on this browser.</h2>
          <p>
            This helps inspect the strategy, but it never enters the controlled leaderboard. The
            Semaphore SDK manages internal proving threads, so that unsafe fake control is not a
            competition parameter.
          </p>
        </div>
        <div className="secret-gate-strategy">
          <label>
            Maximum parallel proofs
            <select
              disabled={pending}
              onChange={(event) =>
                setStrategy((current) => ({
                  ...current,
                  maxParallelProofs: Number(event.target.value),
                }))
              }
              value={strategy.maxParallelProofs}
            >
              {[1, 2, 3, 4].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Artifact loading
            <select
              disabled={pending}
              onChange={(event) =>
                setStrategy((current) => ({
                  ...current,
                  artifactLoad: event.target.value as ProofExecutionStrategy["artifactLoad"],
                }))
              }
              value={strategy.artifactLoad}
            >
              <option value="on-demand">On demand</option>
              <option value="eager">Eager</option>
            </select>
          </label>
          <label>
            Worker lifecycle
            <select
              disabled={pending}
              onChange={(event) =>
                setStrategy((current) => ({
                  ...current,
                  workerLifecycle: event.target.value as ProofExecutionStrategy["workerLifecycle"],
                }))
              }
              value={strategy.workerLifecycle}
            >
              <option value="reuse">Reuse</option>
              <option value="per-request">One per request</option>
            </select>
          </label>
          <button
            disabled={!snapshot || pending}
            onClick={() => void runPersonalBenchmark()}
            type="button"
          >
            Run personal benchmark
          </button>
        </div>
        {benchmark ? (
          <div className="secret-gate-benchmark-result" data-testid="secret-gate-benchmark-result">
            <article>
              <span>P95 completion</span>
              <strong data-testid="secret-gate-p95">{benchmark.p95LatencyMs} ms</strong>
            </article>
            <article>
              <span>Peak memory estimate</span>
              <strong data-testid="secret-gate-personal-memory">
                {benchmark.peakIncrementalMemoryMb === null
                  ? "Unavailable"
                  : `${benchmark.peakIncrementalMemoryMb} MiB`}
              </strong>
            </article>
            <article>
              <span>Proof correctness</span>
              <strong>{benchmark.proofVerified ? "4 / 4 valid" : "Failed"}</strong>
            </article>
            <p>
              Personal observation · {benchmark.memoryMethod} · context{" "}
              {shortHash(scenario.contextHash)}
            </p>
          </div>
        ) : null}
      </section>

      <aside className="secret-gate-limits">
        <strong>What this proves</strong>
        <p>
          Membership in one synthetic eight-member demo cohort, once for this Gate scope. It does
          not prove a real identity, personhood, or production authorization. Verification is
          off-chain until a real Sepolia transaction is added.
        </p>
      </aside>
    </div>
  );
}
