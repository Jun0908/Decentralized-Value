export type ArenaDefinition = {
  slug: "emergency-supply" | "calldata-compression";
  kind: "supply" | "calldata";
  name: string;
  category: string;
  status: "Practice";
  headline: string;
  summary: string;
  audience: string;
  metrics: readonly [
    { name: string; direction: "Minimize" | "Maximize"; unit: string },
    { name: string; direction: "Minimize" | "Maximize"; unit: string },
  ];
  participation: string;
  deadline: string;
  reward: string;
  actionLabel: string;
};

export const arenaRegistry = [
  {
    slug: "emergency-supply",
    kind: "supply",
    name: "Emergency Supply Allocation",
    category: "Humanitarian logistics",
    status: "Practice",
    headline: "Spend less. Keep aid moving when one link fails.",
    summary:
      "Allocate 1,000 emergency kits across suppliers, then survive every published supplier and route failure.",
    audience: "Operations researchers, developers, and logistics problem-solvers",
    metrics: [
      { name: "Procurement cost", direction: "Minimize", unit: "USD" },
      { name: "Worst-case delivery", direction: "Maximize", unit: "kits" },
    ],
    participation: "Open practice",
    deadline: "No deadline",
    reward: "No practice reward",
    actionLabel: "Build an allocation",
  },
  {
    slug: "calldata-compression",
    kind: "calldata",
    name: "Ethereum Calldata Compression",
    category: "Ethereum infrastructure",
    status: "Practice",
    headline: "Send fewer bytes without making them too expensive to unpack.",
    summary:
      "Encode the same transfer batches, execute Solidity decoder bytecode, and preserve both gas tradeoffs.",
    audience: "Solidity, rollup, smart-account, and protocol developers",
    metrics: [
      { name: "Calldata gas", direction: "Minimize", unit: "gas" },
      { name: "Decoder execution", direction: "Minimize", unit: "gas" },
    ],
    participation: "Open practice",
    deadline: "No deadline",
    reward: "No practice reward",
    actionLabel: "Measure a codec",
  },
] as const satisfies readonly ArenaDefinition[];

export function getArena(slug: string): ArenaDefinition | undefined {
  return arenaRegistry.find((arena) => arena.slug === slug);
}
