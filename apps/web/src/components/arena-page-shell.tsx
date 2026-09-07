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
            <span className="arena-status">{arena.status}</span>
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
        <ol className="arena-steps" aria-label="Arena process">
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
              <small>Improve the Pareto frontier.</small>
            </div>
          </li>
        </ol>
      </header>
      {children}
    </main>
  );
}
