import { publicCalldataCompressionScenario } from "@frontier/calldata-compression";
import type { Metadata } from "next";
import { CalldataCompressionDemo } from "@/components/calldata-compression-demo";

export const metadata: Metadata = {
  title: "Ethereum Calldata Compression | Frontier Protocol",
  description:
    "Compare exact EIP-2028 calldata gas and real Cancun EVM decoder execution gas without hiding the tradeoff.",
};

export default async function CalldataCompressionPage() {
  const scenario = await publicCalldataCompressionScenario();

  return (
    <main className="page-shell detail-page calldata-page">
      <header className="page-heading supply-heading">
        <p className="eyebrow">Live deterministic EVM arena · No wallet required for practice</p>
        <h1>Compress Ethereum data without making it too expensive to unpack.</h1>
        <p>
          Smaller calldata saves gas, but clever compression can cost more gas to decode. Measure
          both axes against the same batches, compiler, and Cancun EVM rules.
        </p>
      </header>
      <CalldataCompressionDemo scenario={scenario} />
    </main>
  );
}
