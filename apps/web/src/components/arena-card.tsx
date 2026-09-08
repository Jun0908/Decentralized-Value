import Link from "next/link";
import type { ArenaDefinition } from "@/lib/arenas";

export function ArenaCard({ arena, index }: { arena: ArenaDefinition; index: number }) {
  return (
    <article className="platform-arena-card">
      <header>
        <span className="arena-number">{String(index + 1).padStart(2, "0")}</span>
        <span className="arena-status">{arena.status}</span>
      </header>
      <p className="arena-category">{arena.category}</p>
      <p className="evidence-level">Evidence L{arena.evidenceLevel} · Deterministic evaluator</p>
      <h3>{arena.name}</h3>
      <p className="arena-card-summary">{arena.summary}</p>
      <dl className="arena-card-metrics">
        {arena.metrics.map((metric) => (
          <div key={metric.name}>
            <dt>{metric.name}</dt>
            <dd>
              {metric.direction} · {metric.unit}
            </dd>
          </div>
        ))}
      </dl>
      <dl className="arena-card-meta">
        <div>
          <dt>Access</dt>
          <dd>{arena.participation}</dd>
        </div>
        <div>
          <dt>Deadline</dt>
          <dd>{arena.deadline}</dd>
        </div>
        <div>
          <dt>Reward</dt>
          <dd>{arena.reward}</dd>
        </div>
      </dl>
      <Link className="arena-card-action" href={`/arenas/${arena.slug}`}>
        {arena.actionLabel} <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}
