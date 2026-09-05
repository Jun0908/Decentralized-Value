import benchmark from "../../../../benchmarks/evm-orderbook/results/latest.json";
import { keccak256, stringToHex } from "viem";

export const arena = {
  id: keccak256(stringToHex(`frontier:${benchmark.contextHash}`)),
  name: "EVM Orderbook Frontier",
  artifactType: "evm-orderbook-v1",
  contextHash: benchmark.contextHash,
  sourceCommit: benchmark.sourceCommit,
  measuredAt: benchmark.measuredAt,
  repetitions: benchmark.repetitions,
  axes: [
    { name: "Gas / order", direction: "minimize", unit: "gas" },
    { name: "Parallel throughput", direction: "maximize", unit: "normalized ops/s" },
  ],
  hardConstraints: [
    "All reference orderbook operations return the expected state",
    "Deployed bytecode hash matches the submitted artifact",
  ],
  artifacts: benchmark.artifacts,
} as const;

export function getArtifact(id: string) {
  return arena.artifacts.find((artifact) => artifact.artifactHash === id);
}

export function shortHash(value: string) {
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}
