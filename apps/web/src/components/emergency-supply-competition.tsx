"use client";

import { emergencySupplyDemoAllocation, type SupplyAllocation } from "@frontier/emergency-supply";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFrontierAccount } from "@/components/wallet-panel";

type Scenario = {
  targetKits: number;
  contextHash: string;
  dataVersion: string;
  vendors: readonly {
    id: string;
    name: string;
    unitCost: number;
    capacity: number;
    routeName: string;
  }[];
  failures: readonly { id: string; name: string }[];
};

type Challenge = {
  state: string;
  rewardPool: string;
  participantCount: number;
  submissionCount: number;
  maxRevisions: number;
  storage: string;
  authentication: string;
  settlement: string;
  scenario: Scenario;
};

type Evaluation = {
  correctness: boolean;
  constraintFailures: string[];
  totalProcurementCost: number;
  worstCaseDeliveredKits: number;
  resultHash: string;
  failureOutcomes: { scenarioName: string; deliveredKits: number }[];
};

type Submission = {
  submissionId: string;
  revision: number;
  sourceMethod: "VISUAL" | "JSON" | "UPLOAD";
  inputHash: string;
  evaluation: Evaluation;
  submittedAt: string;
};

type Participant = {
  participantId: string;
  displayName: string;
  wallet: string;
};

type Leaderboard = {
  participantCount: number;
  submissionCount: number;
  poolCredits: number;
  entries: {
    id: string;
    name: string;
    kind: "SEED" | "PARTICIPANT";
    revision: number | null;
    totalProcurementCost: number;
    worstCaseDeliveredKits: number;
    correctness: boolean;
    frontier: boolean;
    dominatedBy: string[];
    contributionPpm: number;
    rewardPreview: number;
  }[];
};

type FinalEntry = { submissionId: string; selectedAt: string };
type Reward = {
  amount: string;
  status: "PREVIEW" | "SENDING" | "PAID" | "FAILED";
  transactionHash: string | null;
  recipient: string;
  error: string | null;
};

function errorMessage(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object" &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }
  return fallback;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

export function EmergencySupplyCompetition({ initialScenario }: { initialScenario: Scenario }) {
  const account = useFrontierAccount();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [finalEntry, setFinalEntry] = useState<FinalEntry | null>(null);
  const [reward, setReward] = useState<Reward | null>(null);
  const [allocations, setAllocations] = useState<SupplyAllocation>({
    ...emergencySupplyDemoAllocation,
  });
  const [jsonDraft, setJsonDraft] = useState(
    JSON.stringify({ allocations: emergencySupplyDemoAllocation }, null, 2),
  );
  const [sourceMethod, setSourceMethod] = useState<"VISUAL" | "JSON" | "UPLOAD">("VISUAL");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [sourceCommit, setSourceCommit] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scenario = challenge?.scenario ?? initialScenario;
  const total = useMemo(
    () => Object.values(allocations).reduce((sum, amount) => sum + amount, 0),
    [allocations],
  );

  const loadPublic = useCallback(async () => {
    const [challengeResponse, leaderboardResponse] = await Promise.all([
      fetch("/v1/challenges/emergency-supply", { cache: "no-store" }),
      fetch("/v1/challenges/emergency-supply/leaderboard", { cache: "no-store" }),
    ]);
    if (challengeResponse.ok) setChallenge((await challengeResponse.json()) as Challenge);
    if (leaderboardResponse.ok) setLeaderboard((await leaderboardResponse.json()) as Leaderboard);
  }, []);

  const loadMine = useCallback(async () => {
    if (!account.authenticated) {
      setParticipant(null);
      setSubmissions([]);
      setFinalEntry(null);
      setReward(null);
      return;
    }
    try {
      const auth = await account.authHeaders();
      const [entriesResponse, rewardResponse] = await Promise.all([
        fetch("/v1/challenges/emergency-supply/submissions/mine", {
          cache: "no-store",
          headers: auth,
        }),
        fetch("/v1/challenges/emergency-supply/reward/mine", {
          cache: "no-store",
          headers: auth,
        }),
      ]);
      const entriesPayload = await entriesResponse.json();
      if (!entriesResponse.ok) {
        throw new Error(
          errorMessage(entriesPayload, "Your competition record could not be loaded"),
        );
      }
      setParticipant(entriesPayload.participant);
      setSubmissions(entriesPayload.submissions);
      setFinalEntry(entriesPayload.finalEntry);
      if (rewardResponse.ok) setReward((await rewardResponse.json()).reward);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Your competition record could not be loaded",
      );
    }
  }, [account]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPublic(), 0);
    return () => window.clearTimeout(timer);
  }, [loadPublic]);

  useEffect(() => {
    if (!account.ready) return;
    const timer = window.setTimeout(() => void loadMine(), 0);
    return () => window.clearTimeout(timer);
  }, [account.ready, account.authenticated, loadMine]);

  function updateAllocation(vendorId: string, raw: string) {
    const value = Number(raw);
    const next = {
      ...allocations,
      [vendorId]: Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0,
    };
    setAllocations(next);
    setJsonDraft(JSON.stringify({ allocations: next }, null, 2));
  }

  function applyJson(raw: string) {
    setJsonDraft(raw);
    try {
      const parsed = JSON.parse(raw) as { allocations?: SupplyAllocation };
      if (parsed.allocations && typeof parsed.allocations === "object") {
        setAllocations(parsed.allocations);
        setError(null);
      }
    } catch {
      // Keep the editor responsive and report malformed JSON only on submit.
    }
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setSourceMethod("UPLOAD");
    applyJson(await file.text());
  }

  async function mutate(path: string, method: "POST" | "PUT", body?: unknown) {
    const auth = await account.authHeaders();
    const init: RequestInit = {
      method,
      headers: {
        ...auth,
        "content-type": "application/json",
        "idempotency-key": crypto.randomUUID(),
      },
    };
    if (body !== undefined) init.body = JSON.stringify(body);
    const response = await fetch(path, init);
    const payload = await response.json();
    if (!response.ok) throw new Error(errorMessage(payload, "Competition action failed"));
    return payload;
  }

  async function join() {
    if (!account.authenticated) {
      account.login();
      return;
    }
    setPending("join");
    setError(null);
    try {
      const payload = await mutate("/v1/challenges/emergency-supply/join", "POST");
      setParticipant(payload.participant);
      await loadPublic();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not join the challenge");
    } finally {
      setPending(null);
    }
  }

  async function submit() {
    setPending("submit");
    setError(null);
    try {
      const parsed = JSON.parse(jsonDraft) as { allocations?: SupplyAllocation };
      if (!parsed.allocations)
        throw new Error("submission.json must contain an allocations object");
      const payload = await mutate("/v1/challenges/emergency-supply/submissions", "POST", {
        allocations: parsed.allocations,
        sourceMethod,
        repositoryUrl: repositoryUrl || null,
        sourceCommit: sourceCommit || null,
      });
      setSubmissions((current) => [...current, payload.submission]);
      await loadPublic();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Submission failed");
    } finally {
      setPending(null);
    }
  }

  async function chooseFinal(submissionId: string) {
    setPending(submissionId);
    setError(null);
    try {
      const payload = await mutate("/v1/challenges/emergency-supply/final-entry", "PUT", {
        submissionId,
      });
      setFinalEntry(payload.finalEntry);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Final Entry could not be saved");
    } finally {
      setPending(null);
    }
  }

  async function settle() {
    setPending("settle");
    setError(null);
    try {
      const payload = await mutate("/v1/challenges/emergency-supply/demo-settlement", "POST");
      setReward(payload.reward);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Demo reward could not be sent");
    } finally {
      setPending(null);
    }
  }

  const latest = submissions.at(-1) ?? null;
  const myBoardEntry = latest
    ? leaderboard?.entries.find(({ id }) => id === latest.submissionId)
    : null;

  return (
    <div className="competition-shell">
      <section className="competition-scoreboard">
        <div>
          <span>ROUND</span>
          <strong>OPEN DEMO</strong>
        </div>
        <div>
          <span>REWARD POOL</span>
          <strong>{challenge?.rewardPool ?? "10,000 FDT demo credits"}</strong>
        </div>
        <div>
          <span>BUILDERS</span>
          <strong>{leaderboard?.participantCount ?? challenge?.participantCount ?? 0}</strong>
        </div>
        <div>
          <span>SUBMISSIONS</span>
          <strong>{leaderboard?.submissionCount ?? challenge?.submissionCount ?? 0}</strong>
        </div>
        <div>
          <span>YOUR STATUS</span>
          <strong>{finalEntry ? "FINAL READY" : participant ? "BUILDING" : "NOT JOINED"}</strong>
        </div>
      </section>

      <nav className="competition-nav" aria-label="Emergency Supply sections">
        <a href="#rules">Rules</a>
        <a href="#build">Build & submit</a>
        <a href="#results">My revisions</a>
        <a href="#leaderboard">Leaderboard</a>
      </nav>

      <section className="competition-rules" id="rules">
        <div>
          <p className="eyebrow">01 · Understand the challenge</p>
          <h2>Keep 1,000 aid kits moving when any one link fails.</h2>
          <p>
            Decide how many kits to buy from five suppliers. Your plan is tested against every
            supplier outage and every route closure. A valid entry must total exactly 1,000 kits and
            stay inside all capacities.
          </p>
          <div className="actions">
            <button
              disabled={pending === "join" || Boolean(participant)}
              onClick={() => void join()}
            >
              {participant
                ? "Challenge joined"
                : account.authenticated
                  ? "Join challenge"
                  : "Sign in to join"}
            </button>
            <a
              className="secondary-action"
              download
              href="/v1/challenges/emergency-supply/starter-kit"
            >
              Download Starter Kit (.zip)
            </a>
          </div>
        </div>
        <div className="rule-cards">
          <article>
            <span>HARD GATE</span>
            <strong>Exactly 1,000 whole kits</strong>
            <small>No capacity violations</small>
          </article>
          <article>
            <span>MINIMIZE</span>
            <strong>Procurement cost</strong>
            <small>Cheaper is better</small>
          </article>
          <article>
            <span>MAXIMIZE</span>
            <strong>Worst-case delivery</strong>
            <small>9 failures are exhausted</small>
          </article>
        </div>
      </section>

      <section className="competition-build" id="build">
        <header>
          <div>
            <p className="eyebrow">02 · Build a solution</p>
            <h2>Create submission.json, not just a button click.</h2>
          </div>
          <div
            className={
              total === scenario.targetKits ? "allocation-total valid" : "allocation-total invalid"
            }
          >
            <span>Allocated</span>
            <strong>
              {total.toLocaleString()} / {scenario.targetKits.toLocaleString()}
            </strong>
          </div>
        </header>

        <div className="submission-mode-tabs" role="tablist" aria-label="Submission editor">
          {(["VISUAL", "JSON", "UPLOAD"] as const).map((mode) => (
            <button
              aria-selected={sourceMethod === mode}
              className={sourceMethod === mode ? "active" : "secondary-action"}
              key={mode}
              onClick={() => setSourceMethod(mode)}
              role="tab"
              type="button"
            >
              {mode === "VISUAL"
                ? "Visual builder"
                : mode === "JSON"
                  ? "JSON editor"
                  : "Upload file"}
            </button>
          ))}
        </div>

        {sourceMethod === "VISUAL" ? (
          <div className="competition-vendors">
            {scenario.vendors.map((vendor) => (
              <label key={vendor.id}>
                <span>
                  <strong>{vendor.name}</strong>
                  <small>{vendor.routeName}</small>
                </span>
                <span>{money(vendor.unitCost)} / kit</span>
                <input
                  max={vendor.capacity}
                  min={0}
                  onChange={(event) => updateAllocation(vendor.id, event.target.value)}
                  type="number"
                  value={allocations[vendor.id] ?? 0}
                />
                <small>Capacity {vendor.capacity}</small>
              </label>
            ))}
          </div>
        ) : sourceMethod === "JSON" ? (
          <label className="json-submission-editor">
            submission.json
            <textarea
              onChange={(event) => applyJson(event.target.value)}
              rows={18}
              value={jsonDraft}
            />
          </label>
        ) : (
          <label className="file-drop">
            <strong>Upload submission.json</strong>
            <span>The same schema is used by the visual and JSON editors.</span>
            <input
              accept="application/json,.json"
              onChange={(event) => void upload(event.target.files?.[0])}
              type="file"
            />
          </label>
        )}

        <details className="github-provenance">
          <summary>Optional: attach a public GitHub commit</summary>
          <div>
            <label>
              Repository URL
              <input
                onChange={(event) => setRepositoryUrl(event.target.value)}
                placeholder="https://github.com/you/project"
                value={repositoryUrl}
              />
            </label>
            <label>
              40-character commit SHA
              <input
                onChange={(event) => setSourceCommit(event.target.value.toLowerCase())}
                value={sourceCommit}
              />
            </label>
          </div>
        </details>

        <div className="submit-bar">
          <div>
            <strong>
              Revision {submissions.length + 1} of {challenge?.maxRevisions ?? 20}
            </strong>
            <span>Each submission is hashed, evaluated, and saved.</span>
          </div>
          <button
            disabled={!participant || pending === "submit"}
            onClick={() => void submit()}
            type="button"
          >
            {pending === "submit" ? "Evaluating 9 failures…" : "Submit for evaluation"}
          </button>
        </div>
      </section>

      {error ? (
        <p className="error-banner" role="alert">
          {error}
        </p>
      ) : null}

      <section className="competition-results" id="results">
        <div className="section-title">
          <div>
            <p className="eyebrow">03 · Improve and select</p>
            <h2>Your revision history</h2>
          </div>
          <span>
            {submissions.length} / {challenge?.maxRevisions ?? 20} used
          </span>
        </div>
        {submissions.length === 0 ? (
          <div className="empty-state">
            <div>
              <strong>No submissions yet.</strong>
              <p>Join, edit submission.json, and run the real evaluator.</p>
            </div>
          </div>
        ) : (
          <div className="competition-revisions">
            {[...submissions].reverse().map((submission) => (
              <article key={submission.submissionId}>
                <header>
                  <div>
                    <span>REVISION {submission.revision}</span>
                    <strong>{submission.sourceMethod}</strong>
                  </div>
                  <b className={submission.evaluation.correctness ? "status-good" : "status-bad"}>
                    {submission.evaluation.correctness ? "CORRECT" : "INVALID"}
                  </b>
                </header>
                {submission.evaluation.correctness ? (
                  <dl>
                    <div>
                      <dt>Cost</dt>
                      <dd>{money(submission.evaluation.totalProcurementCost)}</dd>
                    </div>
                    <div>
                      <dt>Worst delivery</dt>
                      <dd>{submission.evaluation.worstCaseDeliveredKits} kits</dd>
                    </div>
                    <div>
                      <dt>Frontier</dt>
                      <dd>
                        {leaderboard?.entries.find(({ id }) => id === submission.submissionId)
                          ?.frontier
                          ? "Yes"
                          : "No"}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p>{submission.evaluation.constraintFailures.join(" · ")}</p>
                )}
                <code>{submission.evaluation.resultHash}</code>
                <button
                  className={
                    finalEntry?.submissionId === submission.submissionId
                      ? "selected-final"
                      : "secondary-action"
                  }
                  disabled={
                    !submission.evaluation.correctness || pending === submission.submissionId
                  }
                  onClick={() => void chooseFinal(submission.submissionId)}
                  type="button"
                >
                  {finalEntry?.submissionId === submission.submissionId
                    ? "Selected Final Entry"
                    : "Choose as Final Entry"}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="competition-leaderboard" id="leaderboard">
        <div className="section-title">
          <div>
            <p className="eyebrow">04 · Frontier leaderboard</p>
            <h2>Different tradeoffs can win.</h2>
          </div>
          <span>Upper resilience · lower cost</span>
        </div>
        <div className="leaderboard-table">
          <div className="leaderboard-row leaderboard-head">
            <span>Entry</span>
            <span>Cost</span>
            <span>Worst delivery</span>
            <span>Contribution</span>
            <span>Reward preview</span>
          </div>
          {leaderboard?.entries.map((entry) => (
            <div
              className={`leaderboard-row ${entry.frontier ? "on-frontier" : "dominated"}`}
              key={entry.id}
            >
              <span>
                <strong>{entry.name}</strong>
                <small>{entry.kind === "SEED" ? "Seed agent" : `Revision ${entry.revision}`}</small>
              </span>
              <span>{money(entry.totalProcurementCost)}</span>
              <span>{entry.worstCaseDeliveredKits} kits</span>
              <span>{(entry.contributionPpm / 10_000).toFixed(2)}%</span>
              <span>
                {entry.kind === "PARTICIPANT"
                  ? `${entry.rewardPreview.toLocaleString()} FDT`
                  : "Not eligible"}
              </span>
            </div>
          )) ?? <p>Loading leaderboard…</p>}
        </div>
      </section>

      <section className="competition-settlement">
        <div>
          <p className="eyebrow">05 · Demo settlement</p>
          <h2>Your selected frontier entry earns the reward.</h2>
          <p>
            The preview comes from exclusive Pareto-frontier contribution. A payout is only marked
            paid after a Sepolia transaction confirms for your authenticated account wallet.
          </p>
        </div>
        <div className="reward-console">
          <span>YOUR CURRENT PREVIEW</span>
          <strong>{(myBoardEntry?.rewardPreview ?? 0).toLocaleString()} FDT</strong>
          <small>Demo token · no monetary-value claim</small>
          {reward?.status === "PAID" && reward.transactionHash ? (
            <a
              href={`https://sepolia.etherscan.io/tx/${reward.transactionHash}`}
              rel="noreferrer"
              target="_blank"
            >
              RewardPaid confirmed →
            </a>
          ) : (
            <button
              disabled={!finalEntry || pending === "settle" || !myBoardEntry?.rewardPreview}
              onClick={() => void settle()}
              type="button"
            >
              {pending === "settle" ? "Confirming on Sepolia…" : "Send demo reward"}
            </button>
          )}
          <small>
            {challenge?.settlement === "sepolia-ready"
              ? "Sepolia relayer ready"
              : "Sepolia payout configuration pending"}
          </small>
        </div>
      </section>

      <aside className="competition-trust-note">
        <strong>What is real now</strong>
        <p>
          The allocation, 9 failure outcomes, hashes, revisions, frontier, and final selection are
          computed from submitted data. Storage and Privy verification status are exposed by the
          API; missing production credentials fail closed.
        </p>
      </aside>
    </div>
  );
}
