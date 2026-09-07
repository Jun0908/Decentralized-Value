import Link from "next/link";
import type { ReactNode } from "react";
import type { ArenaDefinition } from "@/lib/arenas";

export function ArenaPageShell({
  arena,
  children,
}: {
  arena: ArenaDefinition;
  children: ReactNode;
}) {
  return (
    <main className="page-shell detail-page platform-arena-page">
      <header className="platform-arena-hero">
        <div className="arena-breadcrumb">
          <Link href="/arenas">Arenas</Link>
          <span aria-hidden="true">/</span>
          <span>{arena.category}</span>
        </div>
        <div className="platform-arena-heading">
          <div>
            <div className="arena-labels">
              <span className="arena-status">{arena.status}</span>
              <span className="evidence-level">
                Evidence L{arena.evidenceLevel} · Synthetic simulation
              </span>
            </div>
            <h1>{arena.headline}</h1>
            <p>{arena.summary}</p>
          </div>
          <aside>
            <p className="eyebrow">Two independent axes</p>
            <dl>
              {arena.metrics.map((metric) => (
                <div key={metric.name}>
                  <dt>{metric.name}</dt>
                  <dd>
                    {metric.direction} · {metric.unit}
                  </dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
        <ol className="arena-steps" aria-label="Challenge lifecycle">
          <li>
            <span>01</span>
            <div>
              <strong>Build</strong>
              <small>Create a valid solution.</small>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>Measure</strong>
              <small>Run the shared evaluator.</small>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>Expand</strong>
              <small>Measure contribution.</small>
            </div>
          </li>
          <li className="pending">
            <span>04</span>
            <div>
              <strong>Attest</strong>
              <small>Runner evidence pending.</small>
            </div>
          </li>
          <li className="pending">
            <span>05</span>
            <div>
              <strong>Settle</strong>
              <small>No funded pool.</small>
            </div>
          </li>
        </ol>
        <Link className="challenge-terms-link" href={`/challenges/${arena.challengeId}`}>
          View immutable challenge terms →
        </Link>
      </header>
      {children}
    </main>
  );
}
