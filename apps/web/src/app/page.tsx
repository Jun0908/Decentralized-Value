import Link from "next/link";
import { ArenaCard } from "@/components/arena-card";
import { arenaRegistry } from "@/lib/arenas";

export default function HomePage() {
  return (
    <main className="page-shell platform-home">
      <section className="value-hero">
        <p className="eyebrow">Value Decentralization</p>
        <h1>
          One score should not <span>decide everything.</span>
        </h1>
        <p className="lede">
          Build a solution, measure every meaningful tradeoff under shared rules, and keep every
          result that expands what is possible.
        </p>
        <p className="market-positioning">
          Prediction markets pay for discovering what is true. Frontier markets pay for expanding
          what is possible.
        </p>
        <div className="actions">
          <Link className="primary-action" href="/arenas">
            Explore arenas
          </Link>
          <Link className="secondary-action" href="/#how-it-works">
            How it works
          </Link>
          <Link className="secondary-action" href="/glossary">
            Learn the language
          </Link>
        </div>
        <dl className="value-proof-strip">
          <div>
            <dt>Correctness</dt>
            <dd>One shared gate</dd>
          </div>
          <div>
            <dt>Measurement</dt>
            <dd>Multiple real axes</dd>
          </div>
          <div>
            <dt>Outcome</dt>
            <dd>More than one winner</dd>
          </div>
        </dl>
      </section>

      <section className="value-definition" id="about" aria-labelledby="value-definition-heading">
        <div>
          <p className="eyebrow">What is Value Decentralization?</p>
          <h2 id="value-definition-heading">Move judgment out of a single number.</h2>
        </div>
        <div className="definition-copy">
          <p>
            Most competitions combine cost, speed, safety, and quality into one weighted score.
            Whoever chose those weights quietly chose the winner.
          </p>
          <p>
            Frontier Protocol verifies correctness first, measures each value independently, and
            keeps every non-dominated solution on the Pareto frontier. A cheaper answer and a more
            resilient answer can both deserve support.
          </p>
        </div>
      </section>

      <section className="featured-arenas" aria-labelledby="featured-arenas-heading">
        <header className="section-heading-row">
          <div>
            <p className="eyebrow">Practice arenas</p>
            <h2 id="featured-arenas-heading">Different problems. The same fair structure.</h2>
          </div>
          <Link href="/arenas">View all arenas →</Link>
        </header>
        <div className="arena-catalog compact">
          {arenaRegistry.map((arena, index) => (
            <ArenaCard arena={arena} index={index} key={arena.slug} />
          ))}
        </div>
      </section>

      <section className="platform-process" id="how-it-works" aria-labelledby="process-heading">
        <header>
          <p className="eyebrow">How it works</p>
          <h2 id="process-heading">Build. Measure. Expand.</h2>
          <p>
            Each arena changes the problem and metrics—not the promise that everyone receives the
            same opportunity and evaluation rules.
          </p>
        </header>
        <ol>
          <li>
            <span>01</span>
            <div>
              <h3>Build a valid solution</h3>
              <p>Read the public inputs, constraints, and submission interface.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Measure every axis</h3>
              <p>The shared evaluator checks correctness and produces reproducible evidence.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Expand the frontier</h3>
              <p>Your solution remains when no other valid result beats it on every axis.</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="fairness-section" aria-labelledby="fairness-heading">
        <div>
          <p className="eyebrow">Why the result can be trusted</p>
          <h2 id="fairness-heading">The rules are fixed before the result.</h2>
        </div>
        <div className="fairness-grid">
          <article>
            <span>Public context</span>
            <p>Inputs, constraints, metric directions, and environment versions are declared.</p>
          </article>
          <article>
            <span>Hard correctness</span>
            <p>
              An invalid solution cannot buy its way onto the frontier with an attractive score.
            </p>
          </article>
          <article>
            <span>Reproducible evidence</span>
            <p>
              Each practice run returns detailed measurements and deterministic context and result
              hashes.
            </p>
          </article>
          <article>
            <span>No hidden weighting</span>
            <p>
              Independent axes stay independent. Users see the actual tradeoff instead of a mystery
              score.
            </p>
          </article>
        </div>
      </section>

      <section className="platform-status">
        <div>
          <p className="eyebrow">Platform status</p>
          <h2>Two practice arenas today. More frontiers next.</h2>
        </div>
        <p>
          Live practice measurement is available now. Participant identity, source-code isolation,
          final-day workloads, and token rewards are the next tournament layer—not simulated claims.
        </p>
        <Link className="primary-action" href="/arenas">
          Choose an arena
        </Link>
      </section>
    </main>
  );
}
