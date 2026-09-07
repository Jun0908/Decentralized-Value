import {
  allocateContributionRewards,
  computeOutcomeFrontier,
  dominatesOutcome,
  hashChallengeManifest,
  parseChallengeManifest,
  computeContributionEvidence,
  type ContributionEvidence,
  type OutcomeMetric,
  type OutcomePoint,
} from "@frontier/shared";
import { keccak256, stringToHex, type Hex } from "viem";

export type SupplyVendor = {
  id: string;
  name: string;
  unitCost: number;
  capacity: number;
  routeId: string;
  routeName: string;
};

export type FailureScenario = {
  id: string;
  name: string;
  disabledVendorIds: readonly string[];
  disabledRouteIds: readonly string[];
};

export type SupplyAllocation = Record<string, number>;

export type SupplyStrategy = {
  id: string;
  name: string;
  description: string;
  allocation: SupplyAllocation;
};

export type SupplyContextId = "public-normal-operations" | "public-port-constrained";

type SupplyScenarioData = {
  arenaId: string;
  name: string;
  dataVersion: string;
  currency: string;
  targetKits: number;
  vendors: readonly SupplyVendor[];
  failures: readonly FailureScenario[];
  strategies: readonly SupplyStrategy[];
};

export type FailureOutcome = {
  scenarioId: string;
  scenarioName: string;
  deliveredKits: number;
  lostKits: number;
  affectedVendorIds: string[];
};

export type SupplyPoint = {
  id: string;
  name: string;
  totalProcurementCost: number;
  worstCaseDeliveredKits: number;
};

export type SupplyEvaluation = {
  schemaVersion: "1";
  arenaId: string;
  dataVersion: string;
  contextId: SupplyContextId;
  contextHash: Hex;
  manifestHash: Hex;
  resultHash: Hex;
  allocation: SupplyAllocation;
  totalAllocatedKits: number;
  totalProcurementCost: number;
  worstCaseDeliveredKits: number;
  correctness: boolean;
  constraintFailures: string[];
  failureOutcomes: FailureOutcome[];
  pareto: {
    frontier: boolean;
    dominatedBy: SupplyPoint[];
    improvesOver: SupplyPoint[];
  };
  contribution: ContributionEvidence;
};

export type SupplyAgentReplayEntry = {
  id: "agent-a" | "agent-b" | "agent-c";
  name: string;
  approach: string;
  allocation: SupplyAllocation;
  totalProcurementCost: number;
  worstCaseDeliveredKits: number;
  correctness: boolean;
  frontier: boolean;
  dominatedBy: string[];
  contribution: ContributionEvidence;
  rewardCredits: number;
  resultHash: Hex;
};

export type SupplyAgentSubmission = Pick<
  SupplyAgentReplayEntry,
  "id" | "name" | "approach" | "allocation"
> & { wallet: string };

export type SupplyAgentReplay = {
  schemaVersion: "1";
  arenaId: string;
  contextId: SupplyContextId;
  contextHash: Hex;
  evaluator: "emergency-supply-v1";
  poolCredits: number;
  entries: SupplyAgentReplayEntry[];
  participantFrontier: string[];
  replayHash: Hex;
};

export const emergencySupplyMetrics = [
  {
    key: "totalProcurementCost",
    name: "Procurement cost",
    direction: "MINIMIZE",
    unit: "USD",
    lowerBound: 35_000,
    upperBound: 78_000,
  },
  {
    key: "worstCaseDeliveredKits",
    name: "Worst-case delivery",
    direction: "MAXIMIZE",
    unit: "kits",
    lowerBound: 0,
    upperBound: 1_000,
  },
] as const satisfies readonly OutcomeMetric[];

export const emergencySupplyDemoAllocation: SupplyAllocation = {
  "harbor-aid": 300,
  northstar: 150,
  "inland-works": 300,
  "local-grid": 150,
  airbridge: 100,
};

export const emergencySupplyAgentAllocations = [
  {
    id: "agent-a",
    name: "Agent A",
    approach: "Cheapest agent submission",
    wallet: "0x1111111111111111111111111111111111111111",
    allocation: {
      "harbor-aid": 450,
      northstar: 300,
      "inland-works": 250,
      "local-grid": 0,
      airbridge: 0,
    },
  },
  {
    id: "agent-b",
    name: "Agent B",
    approach: "Resilience-first submission",
    wallet: "0x2222222222222222222222222222222222222222",
    allocation: {
      "harbor-aid": 200,
      northstar: 100,
      "inland-works": 250,
      "local-grid": 250,
      airbridge: 200,
    },
  },
  {
    id: "agent-c",
    name: "Agent C",
    approach: "Higher cost with weaker resilience",
    wallet: "0x3333333333333333333333333333333333333333",
    allocation: {
      "harbor-aid": 200,
      northstar: 250,
      "inland-works": 0,
      "local-grid": 300,
      airbridge: 250,
    },
  },
] as const satisfies readonly SupplyAgentSubmission[];

export const emergencySupplyScenario = {
  arenaId: "emergency-supply-v1",
  name: "Emergency Supply Allocation Frontier",
  dataVersion: "supply-network-2026-09-v1",
  currency: "USD",
  targetKits: 1_000,
  vendors: [
    {
      id: "harbor-aid",
      name: "Harbor Aid",
      unitCost: 35,
      capacity: 500,
      routeId: "seaport-east",
      routeName: "East seaport",
    },
    {
      id: "northstar",
      name: "Northstar Relief",
      unitCost: 42,
      capacity: 550,
      routeId: "seaport-east",
      routeName: "East seaport",
    },
    {
      id: "inland-works",
      name: "Inland Works",
      unitCost: 52,
      capacity: 450,
      routeId: "rail-west",
      routeName: "West rail",
    },
    {
      id: "local-grid",
      name: "Local Grid",
      unitCost: 65,
      capacity: 300,
      routeId: "local-road",
      routeName: "Local roads",
    },
    {
      id: "airbridge",
      name: "Airbridge",
      unitCost: 78,
      capacity: 250,
      routeId: "air-corridor",
      routeName: "Air corridor",
    },
  ] satisfies readonly SupplyVendor[],
  failures: [
    {
      id: "vendor-harbor-aid",
      name: "Harbor Aid supplier outage",
      disabledVendorIds: ["harbor-aid"],
      disabledRouteIds: [],
    },
    {
      id: "vendor-northstar",
      name: "Northstar supplier outage",
      disabledVendorIds: ["northstar"],
      disabledRouteIds: [],
    },
    {
      id: "vendor-inland-works",
      name: "Inland Works supplier outage",
      disabledVendorIds: ["inland-works"],
      disabledRouteIds: [],
    },
    {
      id: "vendor-local-grid",
      name: "Local Grid supplier outage",
      disabledVendorIds: ["local-grid"],
      disabledRouteIds: [],
    },
    {
      id: "vendor-airbridge",
      name: "Airbridge supplier outage",
      disabledVendorIds: ["airbridge"],
      disabledRouteIds: [],
    },
    {
      id: "route-seaport-east",
      name: "East seaport closure",
      disabledVendorIds: [],
      disabledRouteIds: ["seaport-east"],
    },
    {
      id: "route-rail-west",
      name: "West rail closure",
      disabledVendorIds: [],
      disabledRouteIds: ["rail-west"],
    },
    {
      id: "route-local-road",
      name: "Local road network closure",
      disabledVendorIds: [],
      disabledRouteIds: ["local-road"],
    },
    {
      id: "route-air-corridor",
      name: "Air corridor closure",
      disabledVendorIds: [],
      disabledRouteIds: ["air-corridor"],
    },
  ] satisfies readonly FailureScenario[],
  strategies: [
    {
      id: "cheapest-first",
      name: "Cheapest first",
      description: "Lowest purchase cost, but both suppliers depend on one seaport.",
      allocation: {
        "harbor-aid": 500,
        northstar: 500,
        "inland-works": 0,
        "local-grid": 0,
        airbridge: 0,
      },
    },
    {
      id: "balanced",
      name: "Balanced baseline",
      description: "Adds rail and local delivery while retaining the two low-cost suppliers.",
      allocation: {
        "harbor-aid": 250,
        northstar: 250,
        "inland-works": 250,
        "local-grid": 250,
        airbridge: 0,
      },
    },
    {
      id: "route-diverse",
      name: "Route diverse",
      description: "Spreads the order evenly over four independent delivery routes.",
      allocation: {
        "harbor-aid": 250,
        northstar: 0,
        "inland-works": 250,
        "local-grid": 250,
        airbridge: 250,
      },
    },
  ] satisfies readonly SupplyStrategy[],
} as const;

const portConstrainedScenario = {
  ...emergencySupplyScenario,
  dataVersion: "supply-network-2026-09-port-constrained-v1",
  vendors: emergencySupplyScenario.vendors.map((vendor) =>
    vendor.id === "harbor-aid"
      ? { ...vendor, unitCost: 44, capacity: 350 }
      : vendor.id === "northstar"
        ? { ...vendor, unitCost: 49, capacity: 450 }
        : vendor,
  ),
  strategies: [
    {
      id: "port-cheapest",
      name: "Port capacity first",
      description: "Uses all constrained seaport capacity, then fills from rail.",
      allocation: {
        "harbor-aid": 350,
        northstar: 450,
        "inland-works": 200,
        "local-grid": 0,
        airbridge: 0,
      },
    },
    {
      id: "port-balanced",
      name: "Port-constrained balance",
      description: "Splits the order evenly while seaport suppliers have less capacity.",
      allocation: {
        "harbor-aid": 200,
        northstar: 200,
        "inland-works": 200,
        "local-grid": 200,
        airbridge: 200,
      },
    },
    {
      id: "route-diverse",
      name: "Route diverse",
      description: "Spreads the order evenly over four independent delivery routes.",
      allocation: {
        "harbor-aid": 250,
        northstar: 0,
        "inland-works": 250,
        "local-grid": 250,
        airbridge: 250,
      },
    },
  ],
} as const satisfies SupplyScenarioData;

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashScenario(scenario: SupplyScenarioData) {
  return keccak256(
    stringToHex(
      canonicalJson({
        arenaId: scenario.arenaId,
        dataVersion: scenario.dataVersion,
        targetKits: scenario.targetKits,
        vendors: scenario.vendors,
        failures: scenario.failures,
      }),
    ),
  );
}

export const emergencySupplyContextHash = hashScenario(emergencySupplyScenario);
const portConstrainedContextHash = hashScenario(portConstrainedScenario);

export const emergencySupplyContexts = [
  {
    id: "public-normal-operations",
    name: "Normal operations",
    description:
      "Published supplier prices and capacities under every single supplier or route failure.",
    evidenceLevel: 0,
    scenario: emergencySupplyScenario,
    contextHash: emergencySupplyContextHash,
  },
  {
    id: "public-port-constrained",
    name: "Port-constrained operations",
    description:
      "Higher seaport prices and lower seaport capacity, with the same exhaustive failure rules.",
    evidenceLevel: 0,
    scenario: portConstrainedScenario,
    contextHash: portConstrainedContextHash,
  },
] as const;

export const emergencySupplyManifest = parseChallengeManifest({
  schemaVersion: "2",
  id: emergencySupplyScenario.arenaId,
  slug: "emergency-supply",
  name: emergencySupplyScenario.name,
  lifecycle: "PRACTICE",
  sponsor: {
    name: "Frontier Protocol practice",
    wallet: null,
    statement: "Demonstrating transparent funding rules without claiming a funded sponsor.",
  },
  valueTension: "Lower procurement cost versus delivery resilience after any single failure.",
  artifactType: "supply-allocation-v1",
  hardConstraints: [
    "Allocate exactly 1,000 whole kits",
    "Do not exceed published vendor capacity",
    "Use only published vendors and routes",
  ],
  metrics: emergencySupplyMetrics,
  contexts: [
    {
      id: "public-normal-operations",
      version: emergencySupplyScenario.dataVersion,
      name: "Public normal operations",
      description: "Published supplier, price, capacity, route, and single-failure data.",
      datasetHash: emergencySupplyContextHash,
      constraintHash: keccak256(
        stringToHex(
          canonicalJson({
            targetKits: emergencySupplyScenario.targetKits,
            rules: ["integer", "non-negative", "capacity", "known-vendor"],
          }),
        ),
      ),
      metricsHash: keccak256(stringToHex(canonicalJson(emergencySupplyMetrics))),
      evidenceLevel: 0,
    },
    {
      id: "public-port-constrained",
      version: portConstrainedScenario.dataVersion,
      name: "Port-constrained operations",
      description: "Higher seaport prices and lower seaport capacity under the same failure model.",
      datasetHash: portConstrainedContextHash,
      constraintHash: keccak256(
        stringToHex(
          canonicalJson({
            targetKits: portConstrainedScenario.targetKits,
            rules: ["integer", "non-negative", "capacity", "known-vendor"],
          }),
        ),
      ),
      metricsHash: keccak256(stringToHex(canonicalJson(emergencySupplyMetrics))),
      evidenceLevel: 0,
    },
  ],
  activeContextId: "public-normal-operations",
  workload: { publicHash: emergencySupplyContextHash, finalCommitment: null },
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

export const emergencySupplyManifestHash = hashChallengeManifest(emergencySupplyManifest);

function normalizeAllocation(
  input: SupplyAllocation,
  scenario: SupplyScenarioData,
): {
  allocation: SupplyAllocation;
  failures: string[];
} {
  const failures: string[] = [];
  const knownIds = new Set(scenario.vendors.map((vendor) => vendor.id));
  const allocation: SupplyAllocation = {};

  for (const suppliedId of Object.keys(input)) {
    if (!knownIds.has(suppliedId)) failures.push(`Unknown vendor: ${suppliedId}`);
  }

  for (const vendor of scenario.vendors) {
    const amount = input[vendor.id];
    if (amount === undefined) {
      failures.push(`Missing allocation for ${vendor.name}`);
      allocation[vendor.id] = 0;
      continue;
    }
    if (!Number.isSafeInteger(amount) || amount < 0) {
      failures.push(`${vendor.name} allocation must be a non-negative integer`);
      allocation[vendor.id] = 0;
      continue;
    }
    allocation[vendor.id] = amount;
    if (amount > vendor.capacity) {
      failures.push(`${vendor.name} exceeds its ${vendor.capacity}-kit capacity`);
    }
  }

  const total = Object.values(allocation).reduce((sum, amount) => sum + amount, 0);
  if (total !== scenario.targetKits) {
    failures.push(`Allocate exactly ${scenario.targetKits} kits; received ${total}`);
  }
  return { allocation, failures };
}

function measure(allocation: SupplyAllocation, scenario: SupplyScenarioData) {
  const totalAllocatedKits = Object.values(allocation).reduce((sum, amount) => sum + amount, 0);
  const totalProcurementCost = scenario.vendors.reduce(
    (sum, vendor) => sum + (allocation[vendor.id] ?? 0) * vendor.unitCost,
    0,
  );
  const failureOutcomes = scenario.failures.map((failure): FailureOutcome => {
    const affectedVendorIds = scenario.vendors
      .filter(
        (vendor) =>
          failure.disabledVendorIds.includes(vendor.id) ||
          failure.disabledRouteIds.includes(vendor.routeId),
      )
      .map((vendor) => vendor.id);
    const lostKits = affectedVendorIds.reduce(
      (sum, vendorId) => sum + (allocation[vendorId] ?? 0),
      0,
    );
    return {
      scenarioId: failure.id,
      scenarioName: failure.name,
      deliveredKits: totalAllocatedKits - lostKits,
      lostKits,
      affectedVendorIds,
    };
  });
  return {
    totalAllocatedKits,
    totalProcurementCost,
    failureOutcomes,
    worstCaseDeliveredKits: Math.min(...failureOutcomes.map((outcome) => outcome.deliveredKits)),
  };
}

function strategyPoint(strategy: SupplyStrategy, scenario: SupplyScenarioData): SupplyPoint {
  const result = measure(strategy.allocation, scenario);
  return {
    id: strategy.id,
    name: strategy.name,
    totalProcurementCost: result.totalProcurementCost,
    worstCaseDeliveredKits: result.worstCaseDeliveredKits,
  };
}

export const emergencySupplyBaselinePoints = emergencySupplyScenario.strategies.map((strategy) =>
  strategyPoint(strategy, emergencySupplyScenario),
);

function supplyContext(contextId: string) {
  const context = emergencySupplyContexts.find(({ id }) => id === contextId);
  if (!context) throw new Error(`Unknown emergency supply context: ${contextId}`);
  return context;
}

function outcomePoint(point: SupplyPoint, baseline: boolean): OutcomePoint {
  return {
    id: point.id,
    name: point.name,
    correctness: true,
    baseline,
    values: {
      totalProcurementCost: point.totalProcurementCost,
      worstCaseDeliveredKits: point.worstCaseDeliveredKits,
    },
  };
}

export function dominatesSupply(left: SupplyPoint, right: SupplyPoint): boolean {
  const noWorse =
    left.totalProcurementCost <= right.totalProcurementCost &&
    left.worstCaseDeliveredKits >= right.worstCaseDeliveredKits;
  const strictlyBetter =
    left.totalProcurementCost < right.totalProcurementCost ||
    left.worstCaseDeliveredKits > right.worstCaseDeliveredKits;
  return noWorse && strictlyBetter;
}

export function evaluateSupplyAllocation(
  input: SupplyAllocation,
  contextId: SupplyContextId = "public-normal-operations",
): SupplyEvaluation {
  const context = supplyContext(contextId);
  const baselinePoints = context.scenario.strategies.map((strategy) =>
    strategyPoint(strategy, context.scenario),
  );
  const normalized = normalizeAllocation(input, context.scenario);
  const metrics = measure(normalized.allocation, context.scenario);
  const candidate: SupplyPoint = {
    id: "candidate",
    name: "Your allocation",
    totalProcurementCost: metrics.totalProcurementCost,
    worstCaseDeliveredKits: metrics.worstCaseDeliveredKits,
  };
  const correctness = normalized.failures.length === 0;
  const dominatedBy = correctness
    ? baselinePoints.filter((point) => dominatesSupply(point, candidate))
    : [];
  const improvesOver = correctness
    ? baselinePoints.filter((point) => dominatesSupply(candidate, point))
    : [];
  const contribution = computeContributionEvidence(
    baselinePoints.map((point) => outcomePoint(point, true)),
    { ...outcomePoint(candidate, false), correctness },
    emergencySupplyMetrics,
  );
  const resultWithoutHash = {
    schemaVersion: "1" as const,
    arenaId: emergencySupplyScenario.arenaId,
    dataVersion: context.scenario.dataVersion,
    contextId,
    contextHash: context.contextHash,
    manifestHash: emergencySupplyManifestHash,
    allocation: normalized.allocation,
    ...metrics,
    correctness,
    constraintFailures: normalized.failures,
    pareto: {
      frontier: correctness && dominatedBy.length === 0,
      dominatedBy,
      improvesOver,
    },
    contribution,
  };
  return {
    ...resultWithoutHash,
    resultHash: keccak256(stringToHex(canonicalJson(resultWithoutHash))),
  };
}

/**
 * Replays three agent submissions through the same public evaluator. Frontier
 * membership and rewards are calculated from the complete set, so reversing
 * submission order cannot change the outcome.
 */
export function replayEmergencySupplyAgents(
  submissions: readonly SupplyAgentSubmission[] = emergencySupplyAgentAllocations,
): SupplyAgentReplay {
  const baselineOutcomes = emergencySupplyBaselinePoints.map((point) => outcomePoint(point, true));
  const measured = [...submissions]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((agent) => ({
      ...agent,
      evaluation: evaluateSupplyAllocation({ ...agent.allocation }),
    }));
  const agentOutcomes = measured.map(({ id, name, evaluation }) =>
    outcomePoint(
      {
        id,
        name,
        totalProcurementCost: evaluation.totalProcurementCost,
        worstCaseDeliveredKits: evaluation.worstCaseDeliveredKits,
      },
      false,
    ),
  );
  const complete = [...baselineOutcomes, ...agentOutcomes];
  const frontierIds = new Set(
    computeOutcomeFrontier(complete, emergencySupplyMetrics).map(({ id }) => id),
  );
  const contributionById = new Map(
    agentOutcomes.map((candidate) => [
      candidate.id,
      computeContributionEvidence(
        complete.filter(({ id }) => id !== candidate.id),
        candidate,
        emergencySupplyMetrics,
      ),
    ]),
  );
  const rewards = new Map(
    allocateContributionRewards(
      10_000n,
      measured.map(({ id, wallet, evaluation }) => ({
        participantId: id,
        wallet,
        correctness: evaluation.correctness,
        baseline: false,
        exclusiveContributionPpm: contributionById.get(id)!.exclusiveContributionPpm,
        reproducibilityFactorPpm: 1_000_000,
        evidenceFactorPpm: 1_000_000,
      })),
    ).map(({ participantId, amount }) => [participantId, Number(amount)]),
  );
  const entries = measured.map(({ id, name, approach, allocation, evaluation }) => {
    const point = agentOutcomes.find((candidate) => candidate.id === id)!;
    return {
      id,
      name,
      approach,
      allocation: { ...allocation },
      totalProcurementCost: evaluation.totalProcurementCost,
      worstCaseDeliveredKits: evaluation.worstCaseDeliveredKits,
      correctness: evaluation.correctness,
      frontier: frontierIds.has(id),
      dominatedBy: complete
        .filter(
          (candidate) =>
            candidate.id !== id && dominatesOutcome(candidate, point, emergencySupplyMetrics),
        )
        .map(({ name: candidateName }) => candidateName),
      contribution: contributionById.get(id)!,
      rewardCredits: rewards.get(id) ?? 0,
      resultHash: evaluation.resultHash,
    } satisfies SupplyAgentReplayEntry;
  });
  const replayWithoutHash = {
    schemaVersion: "1" as const,
    arenaId: emergencySupplyScenario.arenaId,
    contextId: "public-normal-operations" as const,
    contextHash: emergencySupplyContextHash,
    evaluator: "emergency-supply-v1" as const,
    poolCredits: 10_000,
    entries,
    participantFrontier: entries.filter(({ frontier }) => frontier).map(({ id }) => id),
  };
  return {
    ...replayWithoutHash,
    replayHash: keccak256(stringToHex(canonicalJson(replayWithoutHash))),
  };
}

export function publicEmergencySupplyScenario(
  contextId: SupplyContextId = "public-normal-operations",
) {
  const context = supplyContext(contextId);
  const baselinePoints = context.scenario.strategies.map((strategy) =>
    strategyPoint(strategy, context.scenario),
  );
  return {
    arenaId: context.scenario.arenaId,
    name: context.scenario.name,
    dataVersion: context.scenario.dataVersion,
    currency: context.scenario.currency,
    targetKits: context.scenario.targetKits,
    contextId,
    contextName: context.name,
    contextDescription: context.description,
    contextHash: context.contextHash,
    evidenceLevel: context.evidenceLevel,
    manifest: emergencySupplyManifest,
    manifestHash: emergencySupplyManifestHash,
    axes: emergencySupplyMetrics,
    vendors: context.scenario.vendors,
    failures: context.scenario.failures.map(({ id, name }) => ({ id, name })),
    strategies: context.scenario.strategies,
    baselinePoints,
    contexts: emergencySupplyContexts.map(
      ({ id, name, description, contextHash, evidenceLevel }) => ({
        id,
        name,
        description,
        contextHash,
        evidenceLevel,
      }),
    ),
    settlement: {
      state: "not-configured",
      network: "sepolia",
      rewardToken: null,
    },
  } as const;
}
