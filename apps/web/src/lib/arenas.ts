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
    slug: "rescue-room",
    challengeId: "rescue-room-v0",
    kind: "rescue-room",
    name: "Rescue Room",
    category: "AI incident response",
    status: "Practice",
    funding: { state: "none" },
    headline: "The protocol is failing. Decide what information is worth buying.",
    summary:
      "Run an Incident Commander through hidden Ethereum protocol incidents, hire specialist Service Agents with a limited budget, and preserve safety, availability, and treasury value separately.",
    audience: "AI agent, protocol security, operations, and Web3 builders",
    evidenceLevel: 0,
    evidenceLabel: "Deterministic simulated incident response",
    metrics: [
      { name: "Total user loss", direction: "Minimize", unit: "USD" },
      { name: "Protocol demand served", direction: "Maximize", unit: "%" },
      { name: "Response spend", direction: "Minimize", unit: "Rescue Credits" },
    ],
    participation: "Open practice",
    deadline: "No deadline",
    reward: "No practice reward",
    actionLabel: "Enter the Incident Room",
  },
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
  {
    slug: "ocean-commons",
    challengeId: "ocean-commons-v1",
    kind: "ocean",
    name: "Ocean Commons",
    category: "Multi-agent negotiation",
    status: "Practice",
    funding: { state: "none" },
    headline: "The sea is dark. What you leave, someone else may take.",
    summary:
      "Five boats share one fishery and cannot see it. Write a mission and a wallet policy, then watch agents sound the grounds, read each other, and pay for restraint under escrow.",
    audience: "AI agent, multi-agent systems, mechanism design, and Web3 builders",
    evidenceLevel: 0,
    evidenceLabel: "Deterministic simulated fishery",
    metrics: [
      { name: "Crew livelihood", direction: "Maximize", unit: "DemoUSD" },
      { name: "Restraint efficacy", direction: "Maximize", unit: "%" },
      { name: "Cooperation efficacy", direction: "Maximize", unit: "%" },
    ],
    participation: "Open practice",
    deadline: "No deadline",
    reward: "No practice reward",
    actionLabel: "Put to sea",
  },
] as const satisfies readonly ArenaDefinition[];

export function getArena(slug: string): ArenaDefinition | undefined {
  return arenaRegistry.find((arena) => arena.slug === slug);
}
