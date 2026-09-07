import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArenaPageShell } from "@/components/arena-page-shell";
import { CalldataCompressionDemo } from "@/components/calldata-compression-demo";
import { SupplyAllocationDemo } from "@/components/supply-allocation-demo";
import { arenaRegistry, getArena } from "@/lib/arenas";

export const dynamicParams = false;

export function generateStaticParams() {
  return arenaRegistry.map((arena) => ({ slug: arena.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const arena = getArena(slug);
  if (!arena) return {};
  return { title: `${arena.name} | Value Decentralization`, description: arena.summary };
}

export default async function ArenaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const arena = getArena(slug);
  if (!arena) notFound();

  if (arena.kind === "supply") {
    const { publicEmergencySupplyScenario } = await import("@frontier/emergency-supply");
    return (
      <ArenaPageShell arena={arena}>
        <SupplyAllocationDemo scenario={publicEmergencySupplyScenario()} />
      </ArenaPageShell>
    );
  }

  const { publicCalldataCompressionScenario } = await import("@frontier/calldata-compression");
  return (
    <ArenaPageShell arena={arena}>
      <CalldataCompressionDemo scenario={await publicCalldataCompressionScenario()} />
    </ArenaPageShell>
  );
}
