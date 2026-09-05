import Link from "next/link";
import { notFound } from "next/navigation";
import { FrontierChart } from "@/components/frontier-chart";
import { LiveRefresh } from "@/components/live-refresh";
import { arena, shortHash } from "@/lib/data";

export default async function ArenaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id !== arena.id) notFound();
  return (
    <main className="page-shell detail-page">
      <header className="page-heading">
        <p className="eyebrow">Arena / active benchmark</p>
        <h1>{arena.name}</h1>
        <p>
          Measured {new Date(arena.measuredAt).toLocaleString("en-US", { timeZone: "UTC" })} UTC ·
          commit {shortHash(arena.sourceCommit)}
        </p>
        <LiveRefresh />
      </header>
      <section className="arena-layout">
        <FrontierChart />
        <aside className="constraint-card">
          <p className="eyebrow">Evaluation contract</p>
          <h2>Two axes. Zero shortcuts.</h2>
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
          <h3>Hard constraints</h3>
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
            <p className="eyebrow">Measured artifacts</p>
            <h2>Frontier set</h2>
          </div>
          <span className="legend">
            <i /> non-dominated
          </span>
        </div>
        <div className="artifact-table" role="table" aria-label="Evaluated artifacts">
          <div className="table-row table-head" role="row">
            <span>Name</span>
            <span>Correct</span>
            <span>Gas/order</span>
            <span>Throughput</span>
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
      </section>
      <section className="notice">
        <span className="signal" />
        <div>
          <strong>Awaiting live attestations</strong>
          <p>
            The benchmark values are real local Foundry output. Ledger signatures and Sepolia
            transactions remain visibly unavailable until the external setup passes.
          </p>
        </div>
      </section>
    </main>
  );
}
