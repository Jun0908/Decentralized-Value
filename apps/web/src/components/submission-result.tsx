"use client";

import { ArrowDownTrayIcon, ArrowPathIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { DisasterReplayStage } from "@/components/disaster-replay-stage";
import { useFrontierAccount } from "@/components/wallet-panel";
import { metricOrigins } from "@/lib/disaster-response-insights";
import {
  resolveSavedSubmission,
  savedSubmissionAccess,
  type ResultState,
  type Submission,
} from "@/lib/saved-submission";
import styles from "./submission-result.module.css";

function Frame({ children }: { children: ReactNode }) {
  return (
    <main className={styles.page}>
      <nav className={styles.navigation} aria-label="Submission navigation">
        <Link href="/arenas/emergency-supply">
          <ArrowLeftIcon aria-hidden="true" /> Disaster Response
        </Link>
        <Link href="/docs/cli">CLI guide</Link>
      </nav>
      {children}
    </main>
  );
}

export function SubmissionResult({ id, arena }: { id: string; arena: string | string[] }) {
  const account = useFrontierAccount();
  const access = savedSubmissionAccess(arena, account);
  if (access === "unsupported-arena") {
    return (
      <Frame>
        <h1>Saved result unavailable</h1>
        <p>
          Saved submission pages support Disaster Response. Rescue Room is Practice only; inspect
          its local Runs with the CLI.
        </p>
      </Frame>
    );
  }
  if (access === "unconfigured") {
    return (
      <Frame>
        <h1>Sign-in unavailable</h1>
        <p>
          Account authentication is not configured on this server. Your saved submission cannot be
          retrieved here until sign-in is available.
        </p>
      </Frame>
    );
  }
  if (access === "restoring") {
    return (
      <Frame>
        <h1>Saved submission</h1>
        <p role="status">Restoring your account session...</p>
      </Frame>
    );
  }
  if (access === "sign-in") {
    return (
      <Frame>
        <h1>Sign in to view your submission</h1>
        <p>
          Use the same account that saved this revision. Submission results are only retrieved from
          your authenticated history.
        </p>
        <button type="button" onClick={account.login}>
          Sign in
        </button>
      </Frame>
    );
  }
  // Unmount private results immediately when the route or visible account changes.
  return <AccountResult key={`${id}:${account.label}:${account.wallet}`} id={id} />;
}

function AccountResult({ id }: { id: string }) {
  const { authHeaders, login } = useFrontierAccount();
  const [attempt, setAttempt] = useState(0);
  const [response, setResponse] = useState<{
    authorization: typeof authHeaders;
    attempt: number;
    result: ResultState;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const finish = (result: ResultState) => {
      if (active) setResponse({ authorization: authHeaders, attempt, result });
    };
    const timeout = window.setTimeout(() => {
      finish({ kind: "error" });
      active = false;
      controller.abort();
    }, 20_000);
    async function load() {
      try {
        const headers = await authHeaders();
        if (!active) return;
        const result = await fetch("/v1/challenges/disaster-response/submissions/mine", {
          method: "GET",
          headers,
          cache: "no-store",
          signal: controller.signal,
        });
        if (result.status === 401 || result.status === 403) return finish({ kind: "unauthorized" });
        if (result.status === 503) return finish({ kind: "unavailable" });
        if (!result.ok) return finish({ kind: "error" });
        finish(resolveSavedSubmission(await result.json(), id));
      } catch {
        if (active) finish({ kind: "error" });
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void load();
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [id, authHeaders, attempt]);

  const state =
    response?.authorization === authHeaders && response.attempt === attempt
      ? response.result
      : null;
  const retry = (
    <button
      className={styles.action}
      type="button"
      onClick={() => setAttempt((value) => value + 1)}
    >
      <ArrowPathIcon aria-hidden="true" /> Retry
    </button>
  );
  if (!state)
    return (
      <Frame>
        <h1>Saved submission</h1>
        <p role="status">Loading your saved revision...</p>
      </Frame>
    );
  if (state.kind === "loaded")
    return (
      <SavedResult submission={state.submission} selectedAt={state.selectedAt} refresh={retry} />
    );
  if (state.kind === "unauthorized")
    return (
      <Frame>
        <h1>Session needs attention</h1>
        <p role="alert">
          The server could not authorize this account. Sign in again with the account that saved the
          revision, then retry.
        </p>
        <div className={styles.actions}>
          <button type="button" onClick={login}>
            Sign in
          </button>
          {retry}
        </div>
      </Frame>
    );
  if (state.kind === "not-joined")
    return (
      <Frame>
        <h1>No saved revisions for this account</h1>
        <p>
          This account has not joined Disaster Response. Switch to the account used by the CLI, or
          return to the arena to participate.
        </p>
        {retry}
      </Frame>
    );
  if (state.kind === "missing")
    return (
      <Frame>
        <h1>Submission not found in your account</h1>
        <p>
          This ID is not in your saved history. Check the ID with{" "}
          <code>frontier submissions list</code>, or switch to the account that submitted it. Local
          Practice Run IDs cannot be opened here.
        </p>
        {retry}
      </Frame>
    );
  return (
    <Frame>
      <h1>
        {state.kind === "unavailable"
          ? "Submission service unavailable"
          : "Could not load this submission"}
      </h1>
      <p role="alert">
        {state.kind === "unavailable"
          ? "The server cannot currently provide authenticated submission history. Try again when its account and storage services are available."
          : "The request failed or returned incomplete data. Your saved status is unknown; retry the read before creating another submission."}
      </p>
      {retry}
    </Frame>
  );
}

function SavedResult({
  submission,
  selectedAt,
  refresh,
}: {
  submission: Submission;
  selectedAt: string | null;
  refresh: ReactNode;
}) {
  const router = useRouter();
  const [scenarioId, setScenarioId] = useState(submission.evaluation.worstScenarioId);
  const [downloadError, setDownloadError] = useState(false);
  const evaluation = submission.evaluation;
  const outcome =
    evaluation.scenarioOutcomes.find((item) => item.scenarioId === scenarioId) ??
    evaluation.scenarioOutcomes[0];
  const origins = evaluation.scenarioOutcomes.length ? metricOrigins(evaluation) : [];
  const canReplay = outcome?.replayTrace && outcome.regionOutcomes?.length > 0;
  function download() {
    try {
      const blob = new Blob([`${JSON.stringify(submission.artifact.strategy, null, 2)}\n`], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `disaster-response-revision-${submission.revision}.json`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloadError(false);
    } catch {
      setDownloadError(true);
    }
  }
  return (
    <Frame>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Disaster Response / saved revision {submission.revision}</p>
        <h1>{submission.artifact.strategy.name}</h1>
        <div className={styles.badges}>
          <span>Saved</span>
          <span>Measured public evaluation</span>
          <span>{evaluation.correctness ? "Correctness passed" : "Correctness failed"}</span>
          <span>{selectedAt ? "Selected Final Entry" : "Not selected as Final Entry"}</span>
        </div>
        <p>
          Stored evaluation and Strategy from this revision. Viewing the result does not change the
          Final Entry. Selection is not proof of a deadline lock, onchain commitment, or payment.
        </p>
        <div className={styles.actions}>
          <button className={styles.action} type="button" onClick={download}>
            <ArrowDownTrayIcon aria-hidden="true" /> Download Strategy
          </button>
          {refresh}
        </div>
        {downloadError ? (
          <p role="alert">
            Download failed. The saved Strategy is available in the JSON section below.
          </p>
        ) : null}
      </header>
      <section className={styles.section} aria-labelledby="saved-outcomes">
        <h2 id="saved-outcomes">Three independent outcomes</h2>
        {!evaluation.correctness ? (
          <div className={styles.failure} role="alert">
            <strong>
              This revision failed correctness and is not an eligible Pareto candidate.
            </strong>
            <ul>
              {evaluation.constraintFailures.map((failure, index) => (
                <li key={index}>{failure}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className={styles.metrics}>
          {origins.map((origin) => (
            <div key={origin.key}>
              <h3>{origin.label}</h3>
              <strong>
                {origin.key === "cost"
                  ? `$${origin.value.toLocaleString("en-US")} USD`
                  : origin.key === "delivery"
                    ? `${origin.value.toLocaleString("en-US")} kits`
                    : `${(origin.value / 10_000).toFixed(1)}%`}
              </strong>
              <span>{origin.key === "cost" ? "Lower is better" : "Higher is better"}</span>
              <p>{origin.explanation}</p>
              <small>Set by: {origin.scenarioName}</small>
            </div>
          ))}
        </div>
        <p>
          These metrics describe the public disaster model. Compare only results with the same
          evaluator, dataset, constraints, metric definitions, context, and evidence conditions.
        </p>
      </section>
      <section className={styles.section} aria-labelledby="saved-replay">
        <div className={styles.sectionHeading}>
          <h2 id="saved-replay">Saved replay</h2>
          <label className={styles.scenario}>
            Scenario
            <select
              value={outcome?.scenarioId ?? ""}
              onChange={(event) => setScenarioId(event.target.value)}
              disabled={!evaluation.scenarioOutcomes.length}
            >
              {evaluation.scenarioOutcomes.map((item) => (
                <option key={item.scenarioId} value={item.scenarioId}>
                  {item.scenarioName}
                </option>
              ))}
            </select>
          </label>
        </div>
        {canReplay ? (
          <div className={styles.replay}>
            <DisasterReplayStage
              key={`${evaluation.resultHash}:${outcome.scenarioId}`}
              evaluation={evaluation}
              outcome={outcome}
              previousEvaluation={null}
              onImprove={() => router.push("/arenas/emergency-supply#build")}
            />
          </div>
        ) : (
          <p>Replay evidence is unavailable for this saved evaluation.</p>
        )}
      </section>
      <section className={styles.section} aria-labelledby="saved-evidence">
        <h2 id="saved-evidence">Revision & evidence</h2>
        <dl className={styles.evidence}>
          {[
            ["Submission ID", submission.submissionId],
            ["Revision", String(submission.revision)],
            ["Submitted at", submission.submittedAt],
            ["Source method", submission.sourceMethod],
            ["Final Entry", selectedAt ? `Selected at ${selectedAt}` : "Not selected"],
            ["Evaluator", evaluation.evaluatorVersion],
            ["Data version", evaluation.dataVersion],
            ["Input hash", submission.inputHash],
            ["Source hash", submission.sourceHash],
            ["Context hash", evaluation.contextHash],
            ["Manifest hash", evaluation.manifestHash],
            ["Result hash", evaluation.resultHash],
            ["Final scenario commitment hash", evaluation.finalScenarioCommitment],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {submission.agentEvidence ? (
          <p>
            Agent: {submission.agentEvidence.name} / {submission.agentEvidence.version}. Objective:{" "}
            {submission.agentEvidence.objective}
          </p>
        ) : null}
        <p>
          Hashes identify evaluation evidence; they do not establish that this revision was
          committed or paid onchain. Practice credits are not tokens.
        </p>
        <details className={styles.json}>
          <summary>Saved Strategy JSON</summary>
          <pre tabIndex={0}>
            <code>{JSON.stringify(submission.artifact.strategy, null, 2)}</code>
          </pre>
        </details>
        <details className={styles.json}>
          <summary>Stored evaluation JSON</summary>
          <pre tabIndex={0}>
            <code>{JSON.stringify(evaluation, null, 2)}</code>
          </pre>
        </details>
      </section>
    </Frame>
  );
}
