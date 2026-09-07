type ArenaLifecycle =
  | {
      status: "Practice";
      participation: "Open practice";
      deadline: "No deadline";
      reward: "No practice reward";
      funding: { state: "none" };
    }
  | {
      status: "Open" | "Final evaluation" | "Settled";
      participation: string;
      deadline: string;
      reward: string;
      funding: { state: "funded"; chainId: number; poolAddress: `0x${string}` };
    };

export type ArenaDefinition = {
  slug: string;
  challengeId: string;
  kind: string;
  name: string;
  category: string;
  headline: string;
  summary: string;
  audience: string;
  metrics: readonly { name: string; direction: "Minimize" | "Maximize"; unit: string }[];
  evidenceLevel: 0 | 1 | 2 | 3 | 4;
  actionLabel: string;
} & ArenaLifecycle;

export const arenaRegistry = [
  {
    slug: "emergency-supply",
    challengeId: "emergency-supply-v1",
    kind: "supply",
    name: "Emergency Supply Allocation",
    category: "Humanitarian logistics",
    status: "Practice",
    funding: { state: "none" },
    headline: "Spend less. Keep aid moving when one link fails.",
    summary:
      "Allocate 1,000 emergency kits across suppliers, then survive every published supplier and route failure.",
    audience: "Operations researchers, developers, and logistics problem-solvers",
    evidenceLevel: 0,
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
    challengeId: "calldata-compression-v1",
    kind: "calldata",
    name: "Ethereum Calldata Compression",
    category: "Ethereum infrastructure",
    status: "Practice",
    funding: { state: "none" },
    headline: "Send fewer bytes without making them too expensive to unpack.",
    summary:
      "Encode the same transfer batches, execute Solidity decoder bytecode, and preserve both gas tradeoffs.",
    audience: "Solidity, rollup, smart-account, and protocol developers",
    evidenceLevel: 0,
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
