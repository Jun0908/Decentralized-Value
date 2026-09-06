import Link from "next/link";
import { notFound } from "next/navigation";
import { FrontierChart } from "@/components/frontier-chart";
import { arena, shortHash } from "@/lib/data";

const artifactLabels: Record<string, string> = {
  PackedBook: "Lowest cost",
  FrontierBook: "Best balance",
  ShardedBook: "Highest capacity",
  BadBook: "Fails correctness",
};

export default async function ArenaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id !== arena.id) notFound();

  return (
    <main className="page-shell detail-page">
      <header className="page-heading">
        <p className="eyebrow">Sample benchmark / comparison results</p>
        <h1>{arena.name}</h1>
        <p>
          Four solutions were tested under the same rules. Three remain because each offers a useful
          advantage that the others do not.
        </p>
        <div className="actions">
          <Link className="primary-action" href="/demo">
            Evaluate a sample
          </Link>
          <span className="proof">
            Measured {new Date(arena.measuredAt).toLocaleDateString("en-US", { timeZone: "UTC" })} ·
            commit {shortHash(arena.sourceCommit)}
          </span>
        </div>
      </header>

      <section className="result-takeaway" aria-label="Result summary">
        <strong>The answer is not one winner.</strong>
        <p>
          PackedBook leads on cost, FrontierBook balances both dimensions, and ShardedBook leads on
          parallel capacity. BadBook is excluded because it fails correctness.
        </p>
      </section>

      <section className="arena-layout">
        <div>
          <FrontierChart />
          <p className="mobile-chart-hint">Swipe horizontally to inspect the full chart.</p>
        </div>
        <aside className="constraint-card">
          <p className="eyebrow">Evaluation rules</p>
          <h2>Shared rules before ranking.</h2>
          <dl>
            {arena.axes.map((axis) => (
              <div key={axis.name}>
                <dt>{axis.name}</dt>
                <dd>
                  {axis.direction} · {axis.unit}
                </dd>
              </div>
            ))}
          </dl>
          <h3>Must pass</h3>
          <ul>
            {arena.hardConstraints.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="hash">
            contextHash
            <br />
            {arena.contextHash}
          </p>
        </aside>
      </section>

      <section>
        <div className="section-title">
          <div>
            <p className="eyebrow">Measured solutions</p>
            <h2>Frontier set</h2>
          </div>
          <span className="legend">
            <i /> worth keeping
          </span>
        </div>
        <div className="artifact-table" role="table" aria-label="Evaluated solutions">
          <div className="table-row table-head" role="row">
            <span>Name</span>
            <span>Correct</span>
            <span>Gas/order</span>
            <span>Capacity</span>
            <span>Status</span>
          </div>
          {arena.artifacts.map((artifact) => (
            <Link
              className="table-row"
              role="row"
              href={`/artifact/${artifact.artifactHash}`}
              key={artifact.artifactHash}
            >
              <strong>{artifact.name}</strong>
              <span>{artifact.correctness ? "Pass" : "Fail"}</span>
              <span>{Number(artifact.gasPerOrder).toLocaleString()}</span>
              <span>{artifact.parallelThroughput}</span>
              <span className={artifact.frontier ? "status-good" : "status-bad"}>
                {artifact.frontier ? "Frontier" : "Ineligible"}
              </span>
            </Link>
          ))}
        </div>
        <div className="mobile-artifact-list">
          {arena.artifacts.map((artifact) => (
            <Link href={`/artifact/${artifact.artifactHash}`} key={artifact.artifactHash}>
              <div>
                <span className="option-label">{artifactLabels[artifact.name]}</span>
                <strong>{artifact.name}</strong>
              </div>
              <dl>
                <div>
                  <dt>Correct</dt>
                  <dd>{artifact.correctness ? "Pass" : "Fail"}</dd>
                </div>
                <div>
                  <dt>Gas / order</dt>
                  <dd>{Number(artifact.gasPerOrder).toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Capacity</dt>
                  <dd>{artifact.parallelThroughput}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd className={artifact.frontier ? "status-good" : "status-bad"}>
                    {artifact.frontier ? "Frontier" : "Ineligible"}
                  </dd>
                </div>
              </dl>
              <span className="card-link">View evidence</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="notice">
        <span className="signal live" />
        <div>
          <strong>Reproducible sample data</strong>
          <p>
            These values come from checked-in Foundry output with five repetitions. Interactive
            evaluations are labeled as public demo results; no wallet or hardware is required.
          </p>
        </div>
      </section>
    </main>
  );
}
