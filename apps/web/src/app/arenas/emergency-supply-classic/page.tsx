import type { Metadata } from "next";
import { publicEmergencySupplyScenario } from "@frontier/emergency-supply";
import { ArenaPageShell } from "@/components/arena-page-shell";
import { EmergencySupplyCompetition } from "@/components/emergency-supply-competition";
import type { ArenaDefinition } from "@/lib/arenas";

export const metadata: Metadata = {
  title: "Emergency Supply Classic | Value Decentralization",
  description: "Preserved Plan 5 allocation demo and fallback route.",
};

const classicArena = {
  slug: "emergency-supply-classic",
  challengeId: "emergency-supply-v1",
  kind: "classic-supply",
  name: "Emergency Supply Classic",
  category: "Fallback demo",
  status: "Demo competition",
  funding: { state: "none" },
  headline: "The original allocation demo remains available.",
  summary: "Allocate 1,000 kits across five suppliers and evaluate nine published failures.",
  audience: "Demo operators",
  evidenceLevel: 0,
  metrics: [
    { name: "Procurement cost", direction: "Minimize", unit: "USD" },
    { name: "Worst-case delivery", direction: "Maximize", unit: "kits" },
  ],
  participation: "Open demo round",
  deadline: "No deadline",
  reward: "10,000 FDT demo credits",
  actionLabel: "Open classic demo",
} as const satisfies ArenaDefinition;

export default function EmergencySupplyClassicPage() {
  return (
    <ArenaPageShell arena={classicArena}>
      <aside className="classic-demo-note">
        <strong>Fallback demo</strong>
        <p>This Plan 5 version is preserved while the Strategy v2 arena is validated.</p>
      </aside>
      <EmergencySupplyCompetition initialScenario={publicEmergencySupplyScenario()} />
    </ArenaPageShell>
  );
}
