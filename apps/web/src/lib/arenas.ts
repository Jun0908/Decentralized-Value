type ArenaLifecycle =
  | {
      status: "Practice" | "Demo competition";
      participation: "Open practice" | "Open demo round";
      deadline: "No deadline";
      reward: "No practice reward" | "10,000 FDT demo credits";
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
  evidenceLabel?: string;
  actionLabel: string;
} & ArenaLifecycle;

export const arenaRegistry = [
  {
    slug: "emergency-supply",
    challengeId: "disaster-response-v2",
    kind: "supply",
    name: "72-Hour Disaster Response",
    category: "Humanitarian logistics",
    status: "Demo competition",
    funding: { state: "none" },
    headline: "Routes will fail. Keep every region supplied for 72 hours.",
    summary:
      "Build a response strategy, survive committed disaster scenarios, and earn support for efficiency, resilience, fairness, or frontier contribution.",
    audience: "Operations researchers, developers, and logistics problem-solvers",
    evidenceLevel: 0,
    metrics: [
      { name: "72-hour cost", direction: "Minimize", unit: "USD" },
      { name: "Worst-case delivery", direction: "Maximize", unit: "kits" },
      { name: "Worst-region coverage", direction: "Maximize", unit: "%" },
    ],
    participation: "Open demo round",
    deadline: "No deadline",
    reward: "10,000 FDT demo credits",
    actionLabel: "Build a response",
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
  {
    slug: "secret-gate",
    challengeId: "secret-gate-v1",
    kind: "secret-gate",
    name: "Secret Gate",
    category: "Ethereum privacy",
    status: "Practice",
    funding: { state: "none" },
    headline: "Prove membership. Keep the identity secret on your device.",
    summary:
      "Generate a real Semaphore proof in the browser, verify one-use access off-chain, and inspect the latency and memory cost without combining them into one score.",
    audience: "Privacy, identity, wallet, and client-side proving developers",
    evidenceLevel: 0,
    evidenceLabel: "Real ZK · controlled observational benchmark",
    metrics: [
      { name: "P95 proof latency", direction: "Minimize", unit: "ms" },
      { name: "Peak incremental memory", direction: "Minimize", unit: "MiB" },
    ],
    participation: "Open practice",
    deadline: "No deadline",
    reward: "No practice reward",
    actionLabel: "Prove and enter",
  },
  {
    slug: "microgrid-dispatch",
    challengeId: "microgrid-dispatch-v1",
    kind: "microgrid",
    name: "Community Microgrid Dispatch",
    category: "Energy resilience",
    status: "Practice",
    funding: { state: "none" },
    headline: "Keep power available without hiding cost or carbon.",
    summary:
      "Dispatch 100 MWh across four sources and compare cost, single-source outage coverage, and lifecycle carbon.",
    audience: "Energy planners, climate builders, and optimization engineers",
    evidenceLevel: 0,
    metrics: [
      { name: "Energy cost", direction: "Minimize", unit: "USD" },
      { name: "Worst-case energy", direction: "Maximize", unit: "MWh" },
      { name: "Lifecycle carbon", direction: "Minimize", unit: "kgCO₂e" },
    ],
    participation: "Open practice",
    deadline: "No deadline",
    reward: "No practice reward",
    actionLabel: "Build a dispatch",
  },
] as const satisfies readonly ArenaDefinition[];

export function getArena(slug: string): ArenaDefinition | undefined {
  return arenaRegistry.find((arena) => arena.slug === slug);
}
