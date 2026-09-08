import type { Metadata } from "next";
import { getEvidenceLevelDefinition } from "@frontier/shared";
import Link from "next/link";
import { notFound } from "next/navigation";
import { challengeIds, getChallengeManifest } from "@/lib/challenges";

export const dynamicParams = false;

export function generateStaticParams() {
  return challengeIds.map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const challenge = await getChallengeManifest(id);
  return challenge
    ? { title: `${challenge.manifest.name} terms | Value Decentralization` }
    : { title: "Challenge not found | Value Decentralization" };
}

export default async function ChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const challenge = await getChallengeManifest(id);
  if (!challenge) notFound();
  const { manifest, manifestHash } = challenge;
  const context = manifest.contexts.find(
    ({ id: contextId }) => contextId === manifest.activeContextId,
  )!;
  const evidence = getEvidenceLevelDefinition(context.evidenceLevel);
  const nextEvidence =
    context.evidenceLevel < 4
      ? getEvidenceLevelDefinition((context.evidenceLevel + 1) as 1 | 2 | 3 | 4)
      : null;

  return (
    <main className="page-shell challenge-page">
      <header className="challenge-heading">
        <div>
          <Link className="back-link" href={`/arenas/${manifest.slug}`}>
            ← Back to workbench
          </Link>
          <p className="eyebrow">Challenge manifest v{manifest.schemaVersion}</p>
          <h1>{manifest.name}</h1>
          <p>{manifest.valueTension}</p>
        </div>
        <div className="manifest-state">
          <span>{manifest.lifecycle}</span>
          <strong>Not funded</strong>
          <small>Practice terms only</small>
        </div>
      </header>

      <section className="challenge-summary-grid">
        <article>
          <p className="eyebrow">Sponsor</p>
          <h2>{manifest.sponsor.name}</h2>
          <p>{manifest.sponsor.statement}</p>
          <small>No sponsor wallet is claimed.</small>
        </article>
        <article>
          <p className="eyebrow">Active context</p>
          <h2>{context.name}</h2>
          <p>{context.description}</p>
          <span className="evidence-level">
            Evidence L{context.evidenceLevel} · {evidence.name}
          </span>
          {nextEvidence ? (
            <small>
              To reach L{nextEvidence.level}: {nextEvidence.requiredEvidence.join(" · ")}
            </small>
          ) : null}
        </article>
        <article>
          <p className="eyebrow">Reward</p>
          <h2>
            {manifest.reward.kind === "PREVIEW"
              ? `${manifest.reward.poolCredits.toLocaleString()} preview credits`
              : manifest.reward.amount}
          </h2>
          <p>No token or payout transaction exists for this practice challenge.</p>
        </article>
      </section>

      <section className="manifest-section">
        <div>
          <p className="eyebrow">Outcome vector</p>
          <h2>Independent values, fixed before evaluation.</h2>
        </div>
        <div className="manifest-metrics">
          {manifest.metrics.map((metric) => (
            <article key={metric.key}>
              <span>{metric.direction}</span>
              <h3>{metric.name}</h3>
              <p>
                {metric.lowerBound.toLocaleString()}–{metric.upperBound.toLocaleString()}{" "}
                {metric.unit}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="manifest-section">
        <div>
          <p className="eyebrow">Hard constraints</p>
          <h2>Performance counts only after these pass.</h2>
        </div>
        <ol className="manifest-rules">
          {manifest.hardConstraints.map((constraint) => (
            <li key={constraint}>{constraint}</li>
          ))}
        </ol>
      </section>

      <section className="lifecycle-section">
        <p className="eyebrow">Protocol lifecycle</p>
        <ol>
          {[
            ["Challenge", "Manifest fixed", "complete"],
            ["Artifact", "Practice input", "complete"],
            ["Evaluation", "Deterministic API", "complete"],
            ["Attestation", "Runner signatures", "pending"],
            ["Frontier", "Contribution measured", "complete"],
            ["Settlement", "No funded pool", "pending"],
          ].map(([name, detail, state], index) => (
            <li className={state} key={name}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{name}</strong>
              <small>{detail}</small>
            </li>
          ))}
        </ol>
      </section>

      <section className="manifest-evidence">
        <p className="eyebrow">Immutable identity</p>
        <dl>
          <div>
            <dt>Manifest hash</dt>
            <dd>{manifestHash}</dd>
          </div>
          <div>
            <dt>Dataset hash</dt>
            <dd>{context.datasetHash}</dd>
          </div>
          <div>
            <dt>Constraint hash</dt>
            <dd>{context.constraintHash}</dd>
          </div>
          <div>
            <dt>Metric settings hash</dt>
            <dd>{context.metricsHash}</dd>
          </div>
        </dl>
      </section>
      <section className="challenge-sponsor-cta">
        <div>
          <p className="eyebrow">For challenge sponsors</p>
          <h2>Preview a new set of immutable terms.</h2>
        </div>
        <Link className="secondary-action" href="/sponsor">
          Open draft console
        </Link>
        <Link
          className="primary-action"
          href={
            manifest.id === "emergency-supply-v1"
              ? "/arenas/emergency-supply#build"
              : `/participate/${manifest.id}`
          }
        >
          {manifest.id === "emergency-supply-v1" ? "Enter competition" : "Try submission sandbox"}
        </Link>
      </section>
    </main>
  );
}
