import Link from "next/link";
import { arena, shortHash } from "@/lib/data";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">Live arena · Emergency supply allocation</p>
        <h1>
          Spend less. <span>Keep aid moving when one link fails.</span>
        </h1>
        <p className="lede">
          Allocate 1,000 emergency kits across five suppliers. The API calculates the real cost,
          breaks every supplier and route one at a time, and shows whether your plan expands the
          Pareto frontier.
        </p>
        <div className="actions">
          <Link className="primary-action" href="/emergency-supply">
            Build an allocation
          </Link>
          <Link className="secondary-action" href={`/arena/${arena.id}`}>
            View the EVM sample
          </Link>
        </div>
      </section>

      <section className="outcome-section" aria-labelledby="outcome-heading">
        <p className="eyebrow">A decision anyone can inspect</p>
        <h2 id="outcome-heading">Your numbers go in. Every failure gets tested.</h2>
        <div className="outcome-grid">
          <article>
            <p className="outcome-label">01 · Allocate</p>
            <h3>Choose suppliers</h3>
            <p>Set the exact kit count for each supplier within its published capacity.</p>
          </article>
          <article>
            <p className="outcome-label">02 · Break links</p>
            <h3>Test nine failures</h3>
            <p>Supplier outages and shared route closures are enumerated, not guessed.</p>
          </article>
          <article>
            <p className="outcome-label">03 · Compare</p>
            <h3>Keep tradeoffs</h3>
            <p>Low-cost and high-resilience plans can both remain on the frontier.</p>
          </article>
        </div>
      </section>

      <section className="section-grid" id="how-it-works">
        <div>
          <p className="eyebrow">How it works</p>
          <h2>Correct first. Competitive second.</h2>
          <p className="section-copy">
            A plan must allocate exactly 1,000 whole kits without exceeding supply limits. Valid
            plans are measured on total procurement cost and the number delivered in their worst
            single failure. No weighted score hides the tradeoff.
          </p>
          <dl className="stats">
            <div>
              <dt>Suppliers</dt>
              <dd>5</dd>
            </div>
            <div>
              <dt>Failure cases</dt>
              <dd>9</dd>
            </div>
            <div>
              <dt>Hidden weights</dt>
              <dd>0</dd>
            </div>
          </dl>
        </div>
        <aside className="constraint-card">
          <p className="eyebrow">Two independent axes</p>
          <h2>There may be more than one answer worth keeping.</h2>
          <dl>
            <div>
              <dt>Total procurement cost</dt>
              <dd>Minimize · USD</dd>
            </div>
            <div>
              <dt>Worst-case delivered</dt>
              <dd>Maximize · kits</dd>
            </div>
          </dl>
          <p className="chart-summary">
            A cheaper plan may be fragile. A resilient plan may cost more. Frontier preserves both
            until another plan beats one on both axes.
          </p>
        </aside>
      </section>

      <section className="principles">
        <article>
          <span>01</span>
          <h3>Enter numbers</h3>
          <p>Allocate the real target across the published suppliers.</p>
        </article>
        <article>
          <span>02</span>
          <h3>Run the API</h3>
          <p>Recalculate cost and enumerate every single failure.</p>
        </article>
        <article>
          <span>03</span>
          <h3>Inspect evidence</h3>
          <p>See the worst case, every scenario, and the deterministic result hash.</p>
        </article>
      </section>

      <section className="final-cta">
        <p className="eyebrow">The live vertical slice</p>
        <h2>What would you optimize?</h2>
        <div className="actions">
          <Link className="primary-action" href="/emergency-supply">
            Open the supply arena
          </Link>
          <span className="proof">EVM sample context {shortHash(arena.contextHash)}</span>
        </div>
      </section>
    </main>
  );
}
