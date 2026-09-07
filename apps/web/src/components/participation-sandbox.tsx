"use client";

import { useState } from "react";

type Submission = {
  submissionId: string;
  revision: number;
  correctness: boolean;
  sourceHash: string;
  inputHash: string;
  evaluationResultHash: string;
  evaluation: Record<string, unknown>;
};

type InjectedEthereum = {
  request(args: { method: string }): Promise<unknown>;
};

export function ParticipationSandbox({
  challengeId,
  challengeName,
  defaultArtifactInput,
}: {
  challengeId: string;
  challengeName: string;
  defaultArtifactInput: unknown;
}) {
  const [wallet, setWallet] = useState("0x1111111111111111111111111111111111111111");
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [sourceMethod, setSourceMethod] = useState<"INLINE" | "UPLOAD" | "GITHUB">("INLINE");
  const [source, setSource] = useState("// Explain or implement your approach here.\n");
  const [repositoryUrl, setRepositoryUrl] = useState("https://github.com/example/frontier-entry");
  const [sourceCommit, setSourceCommit] = useState("0".repeat(40));
  const [artifactInput, setArtifactInput] = useState(JSON.stringify(defaultArtifactInput, null, 2));
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [finalEntry, setFinalEntry] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connectBrowserWallet() {
    const ethereum = (window as typeof window & { ethereum?: InjectedEthereum }).ethereum;
    if (!ethereum) {
      setError("No injected browser wallet was found. You can still enter a public address.");
      return;
    }
    try {
      const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
      if (accounts[0]) setWallet(accounts[0]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wallet connection was rejected");
    }
  }

  async function register() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/v2/sandbox/participants/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId, wallet }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Registration failed");
      setParticipantId(payload.participant.participantId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Registration failed");
    } finally {
      setPending(false);
    }
  }

  async function submit() {
    if (!participantId) return;
    setPending(true);
    setError(null);
    try {
      const sourceBundle =
        sourceMethod === "GITHUB"
          ? { method: "GITHUB", visibility: "PUBLIC", repositoryUrl, sourceCommit }
          : {
              method: sourceMethod,
              visibility: "PUBLIC",
              filename: sourceMethod === "UPLOAD" ? "uploaded-entry.ts" : "entry.ts",
              content: source,
            };
      const response = await fetch("/v2/sandbox/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          participantId,
          challengeId,
          source: sourceBundle,
          artifactInput: JSON.parse(artifactInput),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Submission failed");
      setSubmissions((current) => [...current, payload.submission]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Submission failed");
    } finally {
      setPending(false);
    }
  }

  async function selectFinal(submissionId: string) {
    if (!participantId) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/v2/sandbox/final-entry", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ participantId, submissionId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Final entry selection failed");
      setFinalEntry(payload.finalEntry.submissionId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Final entry selection failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="participation-sandbox">
      <section className="sandbox-warning">
        <p className="eyebrow">Ephemeral competition sandbox</p>
        <h2>Test the submission flow without pretending it is the final tournament.</h2>
        <p>
          Wallet ownership is not signed, World ID personhood is not configured, and records reset
          when the server restarts. Measurements and hashes are real; identity and settlement are
          not.
        </p>
      </section>

      <section className="sandbox-step">
        <div>
          <span>01</span>
          <h2>Register a wallet</h2>
        </div>
        <label>
          Public wallet address
          <input value={wallet} onChange={(event) => setWallet(event.target.value)} />
        </label>
        <div className="actions">
          <button
            className="secondary-action"
            onClick={() => void connectBrowserWallet()}
            type="button"
          >
            Use browser wallet
          </button>
          <button disabled={pending} onClick={() => void register()} type="button">
            Register for sandbox
          </button>
        </div>
        {participantId ? <code className="sandbox-id">Participant {participantId}</code> : null}
      </section>

      <section className="sandbox-step">
        <div>
          <span>02</span>
          <h2>Submit another revision</h2>
        </div>
        <label>
          Source adapter
          <select
            value={sourceMethod}
            onChange={(event) => setSourceMethod(event.target.value as typeof sourceMethod)}
          >
            <option value="INLINE">Inline</option>
            <option value="UPLOAD">File upload content</option>
            <option value="GITHUB">Public GitHub commit</option>
          </select>
        </label>
        {sourceMethod === "GITHUB" ? (
          <div className="sandbox-fields">
            <label>
              Repository URL
              <input
                value={repositoryUrl}
                onChange={(event) => setRepositoryUrl(event.target.value)}
              />
            </label>
            <label>
              40-character commit SHA
              <input
                value={sourceCommit}
                onChange={(event) => setSourceCommit(event.target.value)}
              />
            </label>
          </div>
        ) : (
          <label>
            Public source
            <textarea rows={8} value={source} onChange={(event) => setSource(event.target.value)} />
          </label>
        )}
        <label>
          Artifact input JSON
          <textarea
            rows={12}
            value={artifactInput}
            onChange={(event) => setArtifactInput(event.target.value)}
          />
        </label>
        <button disabled={!participantId || pending} onClick={() => void submit()} type="button">
          Measure and save revision
        </button>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}

      <section className="sandbox-step">
        <div>
          <span>03</span>
          <h2>Select one Final Entry</h2>
        </div>
        {submissions.length === 0 ? (
          <p>No revisions submitted in this browser session.</p>
        ) : (
          <div className="submission-history">
            {submissions.map((submission) => (
              <article key={submission.submissionId}>
                <div>
                  <span>Revision {submission.revision}</span>
                  <strong className={submission.correctness ? "status-good" : "status-bad"}>
                    {submission.correctness ? "Correct" : "Invalid"}
                  </strong>
                </div>
                <code>{submission.evaluationResultHash}</code>
                <button
                  className={
                    finalEntry === submission.submissionId ? "selected-final" : "secondary-action"
                  }
                  disabled={pending}
                  onClick={() => void selectFinal(submission.submissionId)}
                  type="button"
                >
                  {finalEntry === submission.submissionId
                    ? "Selected Final Entry"
                    : "Choose as Final Entry"}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <aside className="honesty-note">
        <strong>{challengeName} · final evaluation unavailable</strong>
        <p>
          A hidden final workload commitment, freeze authority, threshold Runner attestations, and
          funded Sepolia pool are required before this can settle rewards.
        </p>
      </aside>
    </div>
  );
}
