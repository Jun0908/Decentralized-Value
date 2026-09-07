import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Glossary | Value Decentralization",
  description: "The shared language behind Frontier Markets, explained simply.",
};

const terms = [
  [
    "Value Tension",
    "Two or more good things that cannot all be maximized at once—for example, paying less while surviving more delivery failures.",
  ],
  ["Hard Constraint", "A rule every entry must pass before its performance is compared."],
  ["Artifact", "The thing a participant builds and submits: a plan, algorithm, rule, or codec."],
  [
    "Context",
    "The exact data, environment, versions, and assumptions under which an Artifact is measured.",
  ],
  [
    "Outcome Vector",
    "The list of independently measured results. It keeps cost, resilience, gas, and other values separate.",
  ],
  [
    "Pareto Frontier",
    "All valid results for which no other result is at least as good on every metric and better on one.",
  ],
  [
    "Frontier Contribution",
    "The extra useful outcome area that would disappear if one Artifact were removed.",
  ],
  [
    "Evidence Level",
    "How close the evidence is to real operation, from L0 simulation to L4 continuously audited deployment.",
  ],
] as const;

export default function GlossaryPage() {
  return (
    <main className="page-shell glossary-page">
      <header className="catalog-heading">
        <p className="eyebrow">Shared language</p>
        <h1>A frontier, without the jargon.</h1>
        <p>
          These words let very different fields compare progress without pretending one score can
          represent every kind of value.
        </p>
      </header>
      <dl className="glossary-grid">
        {terms.map(([term, meaning], index) => (
          <div key={term}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <dt>{term}</dt>
            <dd>{meaning}</dd>
          </div>
        ))}
      </dl>
      <section className="glossary-cta">
        <p className="eyebrow">See the language become measurable</p>
        <h2>Choose a practice arena and expand its frontier.</h2>
        <Link className="primary-action" href="/arenas">
          Explore arenas
        </Link>
      </section>
    </main>
  );
}
