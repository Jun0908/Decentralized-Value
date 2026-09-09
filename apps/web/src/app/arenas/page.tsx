import type { Metadata } from "next";
import { ArenaCard } from "@/components/arena-card";
import { arenaRegistry } from "@/lib/arenas";

export const metadata: Metadata = {
  title: "Arenas | Value Decentralization",
  description: "Explore reproducible multi-objective competitions on the Frontier Protocol.",
};

export default function ArenasPage() {
  return (
    <main className="page-shell catalog-page">
      <header className="catalog-heading">
        <p className="eyebrow">03 arenas · One open protocol</p>
        <h1>Choose the value you want to improve.</h1>
        <p>
          Enter a problem, submit a solution, and see which tradeoffs expand the frontier. Start
          with 72-Hour Disaster Response for the complete strategy, replay, awards, and Sepolia
          reward experience.
        </p>
      </header>
      <ol className="arena-catalog-flow" aria-label="How arenas work">
        <li>
          <span>01</span>
          <strong>Choose a problem</strong>
          <small>Logistics, Ethereum, or energy</small>
        </li>
        <li>
          <span>02</span>
          <strong>Build and submit</strong>
          <small>One public rule set per arena</small>
        </li>
        <li>
          <span>03</span>
          <strong>Expand the frontier</strong>
          <small>Keep every valuable tradeoff visible</small>
        </li>
      </ol>
      <section className="arena-catalog" aria-label="Available arenas">
        {arenaRegistry.map((arena, index) => (
          <ArenaCard arena={arena} index={index} key={arena.slug} />
        ))}
      </section>
      <aside className="catalog-expansion-note">
        <span>One protocol, more values</span>
        <div>
          <h2>Finance is not the only value worth coordinating.</h2>
          <p>
            New arenas can define different goals without compressing them into one score. The same
            protocol can reward cheaper, cleaner, safer, or more resilient solutions together.
          </p>
        </div>
      </aside>
    </main>
  );
}
