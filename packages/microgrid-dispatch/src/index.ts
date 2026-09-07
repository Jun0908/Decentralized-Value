import {
  canonicalProtocolJson,
  computeContributionEvidence,
  computeOutcomeFrontier,
  hashChallengeManifest,
  parseChallengeManifest,
  type ContributionEvidence,
  type OutcomeMetric,
  type OutcomePoint,
} from "@frontier/shared";
import { keccak256, stringToHex, type Hex } from "viem";

export type DispatchAllocation = Record<string, number>;

export type DispatchPoint = {
  id: string;
  name: string;
  totalCost: number;
  worstCaseEnergy: number;
  carbonGrams: number;
};

export type DispatchEvaluation = {
  schemaVersion: "1";
  arenaId: string;
  contextId: "public-day-ahead";
  contextHash: Hex;
  manifestHash: Hex;
  resultHash: Hex;
  allocation: DispatchAllocation;
  correctness: boolean;
  constraintFailures: string[];
  totalCost: number;
  worstCaseEnergy: number;
  carbonGrams: number;
  pareto: { frontier: boolean; dominatedBy: DispatchPoint[]; improvesOver: DispatchPoint[] };
  contribution: ContributionEvidence;
};

export const microgridMetrics = [
  {
    key: "totalCost",
    name: "Energy cost",
    direction: "MINIMIZE",
    unit: "USD",
    lowerBound: 3_000,
    upperBound: 8_000,
  },
  {
    key: "worstCaseEnergy",
    name: "Worst-case energy",
    direction: "MAXIMIZE",
    unit: "MWh",
    lowerBound: 0,
    upperBound: 100,
  },
  {
    key: "carbonGrams",
    name: "Lifecycle carbon",
    direction: "MINIMIZE",
    unit: "kgCO₂e",
    lowerBound: 0,
    upperBound: 45_000,
  },
] as const satisfies readonly OutcomeMetric[];

export const microgridScenario = {
  arenaId: "microgrid-dispatch-v1",
  name: "Community Microgrid Dispatch Frontier",
  dataVersion: "day-ahead-grid-2026-09-v1",
  targetEnergy: 100,
  sources: [
    { id: "solar", name: "Solar", unitCost: 30, capacity: 40, carbonPerMwh: 20 },
    { id: "wind", name: "Community wind", unitCost: 45, capacity: 45, carbonPerMwh: 15 },
    { id: "grid", name: "Regional grid", unitCost: 55, capacity: 70, carbonPerMwh: 450 },
    { id: "battery", name: "Battery reserve", unitCost: 80, capacity: 35, carbonPerMwh: 40 },
  ],
  strategies: [
    {
      id: "lowest-cost",
      name: "Lowest cost",
      allocation: { solar: 40, wind: 45, grid: 15, battery: 0 },
    },
    {
      id: "even-reserve",
      name: "Even reserve",
      allocation: { solar: 25, wind: 25, grid: 25, battery: 25 },
    },
    {
      id: "low-carbon",
      name: "Low carbon",
      allocation: { solar: 40, wind: 45, grid: 0, battery: 15 },
    },
  ],
} as const;

export const microgridContextHash = keccak256(
  stringToHex(canonicalProtocolJson(microgridScenario)),
);

export const microgridManifest = parseChallengeManifest({
  schemaVersion: "2",
  id: microgridScenario.arenaId,
  slug: "microgrid-dispatch",
  name: microgridScenario.name,
  lifecycle: "PRACTICE",
  sponsor: {
    name: "Frontier Protocol practice",
    wallet: null,
    statement: "A three-axis adapter demonstration without a funded sponsor claim.",
  },
  valueTension: "Lower energy cost, higher outage coverage, and lower lifecycle carbon.",
  artifactType: "microgrid-dispatch-v1",
  hardConstraints: [
    "Allocate exactly 100 whole MWh",
    "Do not exceed source capacity",
    "Use only published energy sources",
  ],
  metrics: microgridMetrics,
  contexts: [
    {
      id: "public-day-ahead",
      version: microgridScenario.dataVersion,
      name: "Public day-ahead mix",
      description: "Published cost, capacity, carbon, and one-source outage data.",
      datasetHash: microgridContextHash,
      constraintHash: keccak256(stringToHex("exact-100-integer-capacity-v1")),
      metricsHash: keccak256(stringToHex(canonicalProtocolJson(microgridMetrics))),
      evidenceLevel: 0,
    },
  ],
  activeContextId: "public-day-ahead",
  workload: { publicHash: microgridContextHash, finalCommitment: null },
  submission: {
    methods: ["INLINE"],
    sourceVisibility: "PUBLIC",
    opensAt: null,
    closesAt: null,
    maxRevisions: 20,
  },
  reviewEndsAt: null,
  reward: { kind: "PREVIEW", poolCredits: 10_000 },
});

export const microgridManifestHash = hashChallengeManifest(microgridManifest);

function measure(allocation: DispatchAllocation) {
  const total = Object.values(allocation).reduce((sum, amount) => sum + amount, 0);
  const totalCost = microgridScenario.sources.reduce(
    (sum, source) => sum + (allocation[source.id] ?? 0) * source.unitCost,
    0,
  );
  const carbonGrams = microgridScenario.sources.reduce(
    (sum, source) => sum + (allocation[source.id] ?? 0) * source.carbonPerMwh,
    0,
  );
  const worstCaseEnergy = Math.min(
    ...microgridScenario.sources.map((source) => total - (allocation[source.id] ?? 0)),
  );
  return { total, totalCost, worstCaseEnergy, carbonGrams };
}

function validate(input: DispatchAllocation) {
  const failures: string[] = [];
  const known = new Set<string>(microgridScenario.sources.map(({ id }) => id));
  const allocation: DispatchAllocation = {};
  for (const id of Object.keys(input)) if (!known.has(id)) failures.push(`Unknown source: ${id}`);
  for (const source of microgridScenario.sources) {
    const value = input[source.id];
    if (value === undefined || !Number.isSafeInteger(value) || value < 0) {
      failures.push(`${source.name} must be a non-negative whole MWh value`);
      allocation[source.id] = 0;
    } else {
      allocation[source.id] = value;
      if (value > source.capacity) failures.push(`${source.name} exceeds capacity`);
    }
  }
  const total = Object.values(allocation).reduce((sum, amount) => sum + amount, 0);
  if (total !== microgridScenario.targetEnergy) {
    failures.push(`Allocate exactly ${microgridScenario.targetEnergy} MWh; received ${total}`);
  }
  return { allocation, failures };
}

function dispatchPoint(id: string, name: string, allocation: DispatchAllocation): DispatchPoint {
  const outcome = measure(allocation);
  return { id, name, ...outcome };
}

function genericPoint(point: DispatchPoint, correctness = true, baseline = true): OutcomePoint {
  return {
    id: point.id,
    name: point.name,
    correctness,
    baseline,
    values: {
      totalCost: point.totalCost,
      worstCaseEnergy: point.worstCaseEnergy,
      carbonGrams: point.carbonGrams,
    },
  };
}

export const microgridBaselinePoints = microgridScenario.strategies.map((strategy) =>
  dispatchPoint(strategy.id, strategy.name, strategy.allocation),
);

export function evaluateMicrogridDispatch(input: DispatchAllocation): DispatchEvaluation {
  const normalized = validate(input);
  const candidate = dispatchPoint("candidate", "Your dispatch", normalized.allocation);
  const all = [
    ...microgridBaselinePoints.map((point) => genericPoint(point)),
    genericPoint(candidate, normalized.failures.length === 0, false),
  ];
  const frontierIds = new Set(computeOutcomeFrontier(all, microgridMetrics).map(({ id }) => id));
  const baselineFrontier = computeOutcomeFrontier(
    microgridBaselinePoints.map((point) => genericPoint(point)),
    microgridMetrics,
  );
  const dominates = (left: DispatchPoint, right: DispatchPoint) => {
    const leftGeneric = genericPoint(left);
    const rightGeneric = genericPoint(right);
    return (
      computeOutcomeFrontier([leftGeneric, rightGeneric], microgridMetrics).length === 1 &&
      computeOutcomeFrontier([leftGeneric, rightGeneric], microgridMetrics)[0]!.id === left.id
    );
  };
  const resultWithoutHash = {
    schemaVersion: "1" as const,
    arenaId: microgridScenario.arenaId,
    contextId: "public-day-ahead" as const,
    contextHash: microgridContextHash,
    manifestHash: microgridManifestHash,
    allocation: normalized.allocation,
    correctness: normalized.failures.length === 0,
    constraintFailures: normalized.failures,
    totalCost: candidate.totalCost,
    worstCaseEnergy: candidate.worstCaseEnergy,
    carbonGrams: candidate.carbonGrams,
    pareto: {
      frontier: frontierIds.has(candidate.id),
      dominatedBy: microgridBaselinePoints.filter((point) => dominates(point, candidate)),
      improvesOver: microgridBaselinePoints.filter((point) => dominates(candidate, point)),
    },
    contribution: computeContributionEvidence(
      baselineFrontier,
      genericPoint(candidate, normalized.failures.length === 0, false),
      microgridMetrics,
    ),
  };
  return {
    ...resultWithoutHash,
    resultHash: keccak256(stringToHex(canonicalProtocolJson(resultWithoutHash))),
  };
}

export function publicMicrogridScenario() {
  return {
    ...microgridScenario,
    contextId: "public-day-ahead" as const,
    contextHash: microgridContextHash,
    evidenceLevel: 0 as const,
    manifest: microgridManifest,
    manifestHash: microgridManifestHash,
    axes: microgridMetrics,
    baselinePoints: microgridBaselinePoints,
  };
}
