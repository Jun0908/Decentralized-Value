import Link from "next/link";
import { FrontierChart } from "@/components/frontier-chart";
import { arena, shortHash } from "@/lib/data";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">ETHOnline 2026 · Verifiable coordination</p>
        <h1>Progress has more than one direction.</h1>
        <p className="lede">
          Frontier Protocol rewards artifacts that expand a reproducible Pareto frontier—without
          hiding tradeoffs inside one arbitrary score.
        </p>
        <div className="actions">
          <Link className="primary-action" href={`/arena/${arena.id}`}>
            Explore the live benchmark
          </Link>
          <span className="proof">context {shortHash(arena.contextHash)}</span>
        </div>
      </section>
      <section className="section-grid">
        <div>
          <p className="eyebrow">Current arena</p>
          <h2>{arena.name}</h2>
          <p className="section-copy">
            Four Solidity orderbooks compete on execution cost and parallel capacity. Correctness is
            a hard gate, never a soft penalty.
          </p>
          <dl className="stats">
            <div>
              <dt>Artifacts</dt>
              <dd>{arena.artifacts.length}</dd>
            </div>
            <div>
              <dt>Frontier</dt>
              <dd>{arena.artifacts.filter((item) => item.frontier).length}</dd>
            </div>
            <div>
              <dt>Runs each</dt>
              <dd>{arena.repetitions}</dd>
            </div>
          </dl>
        </div>
        <FrontierChart />
      </section>
      <section className="principles">
        <article>
          <span>01</span>
          <h3>Constrain</h3>
          <p>Invalid artifacts never reach the frontier.</p>
        </article>
        <article>
          <span>02</span>
          <h3>Measure</h3>
          <p>Immutable contexts make outcomes replayable.</p>
        </article>
        <article>
          <span>03</span>
          <h3>Attest</h3>
          <p>Ledger-backed runners bind evidence to ENS identities.</p>
        </article>
      </section>
    </main>
  );
}
