import { notFound } from "next/navigation";
import { arena, getArtifact, shortHash } from "@/lib/data";

export default async function ArtifactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const artifact = getArtifact(id);
  if (!artifact) notFound();
  return (
    <main className="page-shell detail-page">
      <header className="page-heading">
        <p className="eyebrow">Artifact / {shortHash(artifact.artifactHash)}</p>
        <h1>{artifact.name}</h1>
        <span className={`large-status ${artifact.frontier ? "status-good" : "status-bad"}`}>
          {artifact.frontier ? "Pareto frontier" : "Ineligible"}
        </span>
      </header>
      <section className="metric-grid">
        <article>
          <p>Correctness</p>
          <strong>{artifact.correctness ? "PASS" : "FAIL"}</strong>
          <small>constraint {shortHash(artifact.constraintResultHash)}</small>
        </article>
        <article>
          <p>Gas / order</p>
          <strong>{Number(artifact.gasPerOrder).toLocaleString()}</strong>
          <small>minimize</small>
        </article>
        <article>
          <p>Parallel throughput</p>
          <strong>{artifact.parallelThroughput}</strong>
          <small>maximize · normalized ops/s</small>
        </article>
      </section>
      <section className="evidence-grid">
        <div>
          <p className="eyebrow">Reproducibility</p>
          <dl>
            <div>
              <dt>Version</dt>
              <dd>{arena.artifactType}</dd>
            </div>
            <div>
              <dt>Source commit</dt>
              <dd className="hash">{arena.sourceCommit}</dd>
            </div>
            <div>
              <dt>Artifact hash</dt>
              <dd className="hash">{artifact.artifactHash}</dd>
            </div>
            <div>
              <dt>Compiler</dt>
              <dd>solc 0.8.30</dd>
            </div>
          </dl>
        </div>
        <div>
          <p className="eyebrow">Attestation</p>
          <dl>
            <div>
              <dt>Runner ENS</dt>
              <dd>Not attested</dd>
            </div>
            <div>
              <dt>Signature</dt>
              <dd>Not available</dd>
            </div>
            <div>
              <dt>Sepolia tx</dt>
              <dd>Not available</dd>
            </div>
          </dl>
          <p className="muted">
            No placeholder identifiers are shown. These fields populate only after a verified runner
            submission.
          </p>
        </div>
      </section>
    </main>
  );
}
