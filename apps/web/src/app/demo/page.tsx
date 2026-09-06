import { DemoExperience } from "@/components/demo-experience";
import { arena } from "@/lib/data";

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ artifact?: string }>;
}) {
  const { artifact } = await searchParams;
  const fallback = arena.artifacts.find((item) => item.name === "FrontierBook")!;
  const initialArtifact = arena.artifacts.some((item) => item.artifactHash === artifact)
    ? artifact!
    : fallback.artifactHash;

  return (
    <main className="page-shell detail-page demo-page">
      <header className="page-heading demo-heading">
        <p className="eyebrow">Interactive public demo</p>
        <h1>Find out what deserves a place on the frontier.</h1>
        <p>
          Pick an orderbook, run the evaluation, and see how Frontier keeps meaningful tradeoffs
          visible. This uses reproducible sample benchmark data and never asks for payment.
        </p>
      </header>
      <DemoExperience artifacts={arena.artifacts} initialArtifact={initialArtifact} />
    </main>
  );
}
