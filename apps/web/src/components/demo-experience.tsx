"use client";

import Link from "next/link";
import { useState } from "react";

type DemoArtifact = {
  artifactHash: string;
  name: string;
  correctness: boolean;
  gasPerOrder: string;
  parallelThroughput: string;
  frontier: boolean;
};

type EvaluationResponse = {
  jobId: string;
  state: string;
  frontier: boolean | null;
  error: string | { message?: string } | null;
};

const artifactMessages: Record<string, { label: string; summary: string }> = {
  PackedBook: {
    label: "Lowest cost",
    summary:
      "PackedBook moves the frontier on cost. It is the cheapest valid solution, so faster alternatives do not replace it.",
  },
  FrontierBook: {
    label: "Best balance",
    summary:
      "FrontierBook moves the frontier by balancing cost and capacity. It handles four times the parallel work for only a small gas increase.",
  },
  ShardedBook: {
    label: "Highest capacity",
    summary:
      "ShardedBook moves the frontier on capacity. It costs more, but no valid alternative handles as much parallel work.",
  },
  BadBook: {
    label: "Fails correctness",
    summary:
      "BadBook is rejected before ranking. Its low gas cannot compensate for failing the shared correctness rules.",
  },
};

function messageFor(name: string) {
  return (
    artifactMessages[name] ?? {
      label: "Sample solution",
      summary: "This solution was evaluated against the shared benchmark rules.",
    }
  );
}

export function DemoExperience({
  artifacts,
  initialArtifact,
}: {
  artifacts: readonly DemoArtifact[];
  initialArtifact: string;
}) {
  const [selectedId, setSelectedId] = useState(initialArtifact);
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected =
    artifacts.find((artifact) => artifact.artifactHash === selectedId) ?? artifacts[0]!;

  async function evaluate() {
    setPending(true);
    setError(null);
    setEvaluation(null);

    try {
      const response = await fetch("/v1/evaluations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": `public-demo-${selected.artifactHash}`,
        },
        body: JSON.stringify({ artifactId: selected.artifactHash }),
      });
      const data = (await response.json()) as EvaluationResponse;
      if (!response.ok) {
        const message = typeof data.error === "string" ? data.error : data.error?.message;
        throw new Error(message || "Evaluation could not be completed.");
      }
      setEvaluation(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Evaluation could not be completed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="demo-experience">
      <ol className="demo-steps" aria-label="Demo progress">
        <li className="active">
          <span>1</span> Choose
        </li>
        <li className={pending || evaluation ? "active" : ""}>
          <span>2</span> Evaluate
        </li>
        <li className={evaluation ? "active" : ""}>
          <span>3</span> Understand
        </li>
      </ol>

      <section className="demo-panel" aria-labelledby="choose-heading">
        <div className="demo-panel-heading">
          <div>
            <p className="eyebrow">Step 1</p>
            <h2 id="choose-heading">Choose a sample solution</h2>
          </div>
          <p>
            Each solution makes a different tradeoff between execution cost and parallel capacity.
          </p>
        </div>
        <div className="artifact-picker" role="radiogroup" aria-label="Sample solutions">
          {artifacts.map((artifact) => {
            const message = messageFor(artifact.name);
            return (
              <label
                className={`artifact-option ${selectedId === artifact.artifactHash ? "selected" : ""}`}
                key={artifact.artifactHash}
              >
                <input
                  checked={selectedId === artifact.artifactHash}
                  name="artifact"
                  onChange={() => {
                    setSelectedId(artifact.artifactHash);
                    setEvaluation(null);
                    setError(null);
                  }}
                  type="radio"
                  value={artifact.artifactHash}
                />
                <span className="option-label">{message.label}</span>
                <strong>{artifact.name}</strong>
                <span>{Number(artifact.gasPerOrder).toLocaleString()} gas</span>
                <span>{artifact.parallelThroughput} parallel ops/s</span>
              </label>
            );
          })}
        </div>
        <div className="demo-action-row">
          <button disabled={pending} onClick={evaluate} type="button">
            {pending ? "Evaluating…" : `Evaluate ${selected.name}`}
          </button>
          <span>No wallet, test tokens, or hardware required.</span>
        </div>
      </section>

      <section className={`demo-result ${evaluation ? "revealed" : ""}`} aria-live="polite">
        {error ? (
          <div>
            <p className="eyebrow status-bad">Evaluation unavailable</p>
            <h2>Please try again.</h2>
            <p>{error}</p>
          </div>
        ) : evaluation ? (
          <>
            <div>
              <p className="eyebrow">Step 3 · Result</p>
              <h2>
                {selected.frontier
                  ? "This solution moves the frontier."
                  : "This solution is rejected."}
              </h2>
              <p className="result-summary">{messageFor(selected.name).summary}</p>
              <div className="actions">
                <Link className="primary-action" href={`/artifact/${selected.artifactHash}`}>
                  View the evidence
                </Link>
                <Link className="secondary-action" href="/arena">
                  Compare all results
                </Link>
              </div>
            </div>
            <dl className="result-metrics">
              <div>
                <dt>Correctness</dt>
                <dd>{selected.correctness ? "Pass" : "Fail"}</dd>
              </div>
              <div>
                <dt>Gas / order</dt>
                <dd>{Number(selected.gasPerOrder).toLocaleString()}</dd>
              </div>
              <div>
                <dt>Parallel capacity</dt>
                <dd>{selected.parallelThroughput}</dd>
              </div>
              <div>
                <dt>Evaluation</dt>
                <dd>{evaluation.state === "simulated" ? "Public demo" : evaluation.state}</dd>
              </div>
            </dl>
          </>
        ) : (
          <div className="result-placeholder">
            <p className="eyebrow">Your result appears here</p>
            <h2>Evaluate the selected solution to see why it belongs—or does not.</h2>
          </div>
        )}
      </section>
    </div>
  );
}
