import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ParticipationSandbox } from "@/components/participation-sandbox";
import { challengeIds, getChallengeManifest } from "@/lib/challenges";

export const dynamicParams = false;

export function generateStaticParams() {
  return challengeIds.map((id) => ({ id }));
}

export const metadata: Metadata = {
  title: "Participation sandbox | Value Decentralization",
};

const defaults: Record<string, unknown> = {
  "emergency-supply-v1": {
    allocations: {
      "harbor-aid": 300,
      northstar: 150,
      "inland-works": 300,
      "local-grid": 150,
      airbridge: 100,
    },
    contextId: "public-normal-operations",
  },
  "calldata-compression-v1": {
    codecId: "packed",
    contextId: "public-transfer-mix",
  },
  "microgrid-dispatch-v1": {
    allocations: { solar: 25, wind: 25, grid: 25, battery: 25 },
  },
};

export default async function ParticipatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const challenge = await getChallengeManifest(id);
  const defaultArtifactInput = defaults[id];
  if (!challenge || !defaultArtifactInput) notFound();
  return (
    <main className="page-shell participate-page">
      <header className="catalog-heading">
        <p className="eyebrow">{challenge.manifest.name}</p>
        <h1>Improve, resubmit, then choose one.</h1>
        <p>
          Every revision uses the same evaluator. Only the selected entry would reach a final
          workload in a funded tournament.
        </p>
      </header>
      <ParticipationSandbox
        challengeId={id}
        challengeName={challenge.manifest.name}
        defaultArtifactInput={defaultArtifactInput}
      />
    </main>
  );
}
