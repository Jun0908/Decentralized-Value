const foundations = [
  "Independent value axes",
  "Hard constraints",
  "Reproducible evaluation",
  "Signed attestations",
  "Pareto frontiers",
] as const;

export default function HomePage() {
  return (
    <main>
      <p className="eyebrow">ETHOnline 2026 · Technical Frontier MVP</p>
      <h1>Frontier Protocol</h1>
      <p className="lede">
        Reward artifacts that expand what is simultaneously possible—not a single weighted score.
      </p>
      <section aria-labelledby="foundation-title">
        <h2 id="foundation-title">Protocol foundations</h2>
        <ul>
          {foundations.map((foundation) => (
            <li key={foundation}>{foundation}</li>
          ))}
        </ul>
      </section>
      <p className="status">Phase 0 foundation ready. The first arena begins in Phase 1.</p>
    </main>
  );
}
