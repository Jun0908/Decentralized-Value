import { publicEmergencySupplyScenario } from "@frontier/emergency-supply";
import type { Metadata } from "next";
import { SupplyAllocationDemo } from "@/components/supply-allocation-demo";

export const metadata: Metadata = {
  title: "Emergency Supply Allocation | Frontier Protocol",
  description:
    "Allocate emergency kits, measure total procurement cost and worst-case delivery, and compare the result on a Pareto frontier.",
};

export default function EmergencySupplyPage() {
  const scenario = publicEmergencySupplyScenario();

  return (
    <main className="page-shell detail-page supply-page">
      <header className="page-heading supply-heading">
        <p className="eyebrow">Live deterministic arena · No wallet required for practice</p>
        <h1>Spend less. Keep aid moving when one link fails.</h1>
        <p>
          You have 1,000 emergency kits to source. Set the supplier allocation yourself; the API
          calculates cost, tests every single supplier and route failure, and compares your plan
          with the current frontier.
        </p>
      </header>
      <SupplyAllocationDemo scenario={scenario} />
    </main>
  );
}
