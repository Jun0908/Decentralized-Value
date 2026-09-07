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
        <p className="eyebrow">Open problems · Multiple kinds of value</p>
        <h1>Choose a frontier to expand.</h1>
        <p>
          Every arena defines its own inputs and measurements, but follows the same rule: pass the
          shared correctness gate, then compete on two independent axes.
        </p>
      </header>
      <section className="arena-catalog" aria-label="Available arenas">
        {arenaRegistry.map((arena, index) => (
          <ArenaCard arena={arena} index={index} key={arena.slug} />
        ))}
      </section>
      <aside className="catalog-expansion-note">
        <span>02 arenas now</span>
        <div>
          <h2>Designed for the next problem, too.</h2>
          <p>
            Arena pages are generated from one registry. New domains, metrics, deadlines, and
            rewards can be added without redesigning the platform.
          </p>
        </div>
      </aside>
    </main>
  );
}
