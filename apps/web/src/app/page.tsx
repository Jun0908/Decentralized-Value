import Link from "next/link";
import { FrontierChart } from "@/components/frontier-chart";
import { arena, shortHash } from "@/lib/data";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">A better way to choose what deserves support</p>
        <h1>
          Stop choosing one winner. <span>Find every solution that moves the frontier.</span>
        </h1>
        <p className="lede">
          Compare solutions across cost and performance without crushing their tradeoffs into one
          score. Run a sample evaluation in under a minute—no wallet or setup required.
        </p>
        <div className="actions">
          <Link className="primary-action" href="/demo">
            Run the demo
          </Link>
          <Link className="secondary-action" href={`/arena/${arena.id}`}>
            See current results
          </Link>
        </div>
      </section>

      <section className="outcome-section" aria-labelledby="outcome-heading">
        <p className="eyebrow">The useful answer</p>
        <h2 id="outcome-heading">Three different strengths. Three solutions worth keeping.</h2>
        <div className="outcome-grid">
          <article>
            <p className="outcome-label">Lowest cost</p>
            <h3>PackedBook</h3>
            <p>Uses the least gas per order while still passing every correctness check.</p>
          </article>
          <article>
            <p className="outcome-label">Best balance</p>
            <h3>FrontierBook</h3>
            <p>Trades a little more gas for four times the parallel capacity.</p>
          </article>
          <article>
            <p className="outcome-label">Highest capacity</p>
            <h3>ShardedBook</h3>
            <p>Costs more to execute, but handles the most work in parallel.</p>
          </article>
        </div>
      </section>

      <section className="section-grid" id="how-it-works">
        <div>
          <p className="eyebrow">How it works</p>
          <h2>Pass the rules. Then earn a place on the frontier.</h2>
          <p className="section-copy">
            This sample compares four Solidity orderbooks. Incorrect entries are rejected first.
            Every remaining entry is kept if no other solution beats it on both cost and capacity.
          </p>
          <dl className="stats">
            <div>
              <dt>Solutions</dt>
              <dd>{arena.artifacts.length}</dd>
            </div>
            <div>
              <dt>Worth keeping</dt>
              <dd>{arena.artifacts.filter((item) => item.frontier).length}</dd>
            </div>
            <div>
              <dt>Runs each</dt>
              <dd>{arena.repetitions}</dd>
            </div>
          </dl>
        </div>
        <div>
          <FrontierChart />
          <p className="chart-summary">
            The green points are not tied. Each leads on a different tradeoff, so all three remain
            visible instead of being forced into a single ranking.
          </p>
        </div>
      </section>

      <section className="principles">
        <article>
          <span>01</span>
          <h3>Choose</h3>
          <p>Select a sample solution to evaluate.</p>
        </article>
        <article>
          <span>02</span>
          <h3>Evaluate</h3>
          <p>Check correctness, cost, and capacity together.</p>
        </article>
        <article>
          <span>03</span>
          <h3>Understand</h3>
          <p>See exactly why it joins the frontier or gets rejected.</p>
        </article>
      </section>

      <section className="final-cta">
        <p className="eyebrow">Try it yourself</p>
        <h2>Which solution moves the frontier?</h2>
        <div className="actions">
          <Link className="primary-action" href="/demo">
            Evaluate a sample
          </Link>
          <span className="proof">context {shortHash(arena.contextHash)}</span>
        </div>
      </section>
    </main>
  );
}
