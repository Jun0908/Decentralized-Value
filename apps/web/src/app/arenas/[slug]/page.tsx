import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArenaPageShell } from "@/components/arena-page-shell";
import { getArenaAdapter } from "@/lib/arena-adapters";
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

  const adapter = getArenaAdapter(arena.kind);
  if (!adapter) {
    return (
      <ArenaPageShell arena={arena}>
        <section className="unsupported-adapter">
          <p className="eyebrow">Unsupported evaluator</p>
          <h2>This Arena&apos;s evaluator adapter is not installed.</h2>
          <p>The catalog remains safe, but no result will be fabricated.</p>
        </section>
      </ArenaPageShell>
    );
  }
  return <ArenaPageShell arena={arena}>{await adapter.renderWorkbench()}</ArenaPageShell>;
}
