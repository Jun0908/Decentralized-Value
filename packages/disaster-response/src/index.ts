import {
  computeContributionEvidence,
  computeOutcomeFrontier,
  dominatesOutcome,
  hashChallengeManifest,
  parseChallengeManifest,
  type ContributionEvidence,
  type OutcomeMetric,
  type OutcomePoint,
} from "@frontier/shared";
import { keccak256, stringToHex, type Hex } from "viem";

export const disasterResponseChallengeId = "disaster-response-v2" as const;
export const disasterResponsePoolCredits = 10_000;

export type SupplierId = "harbor-aid" | "northstar" | "inland-works" | "local-grid" | "airbridge";
export type RegionPolicy = "deadline-first" | "highest-need" | "equalize-coverage";

export type DisasterResponseStrategy = {
  schemaVersion: "2";
  name: string;
  primarySupplierOrder: SupplierId[];
  emergencySupplierOrder: SupplierId[];
  regionPolicy: RegionPolicy;
  reserveKits: number;
  emergencyBudgetUsd: number;
};

export type DisasterSupplier = {
  id: SupplierId;
  name: string;
  unitCost: number;
  capacity: number;
  routeId: string;
  routeName: string;
  leadHours: number;
};

export type DisasterRegion = {
  id: string;
  name: string;
  demand: number;
  deadlineHour: number;
};

export type DisasterEvent = {
  hour: number;
  label: string;
  disabledSupplierIds: SupplierId[];
  disabledRouteIds: string[];
};

export type DisasterScenario = {
  id: string;
  name: string;
  summary: string;
  events: DisasterEvent[];
  demandMultipliers?: Record<string, number>;
};

export type RegionOutcome = {
  regionId: string;
  regionName: string;
  demand: number;
  delivered: number;
  coveragePpm: number;
};

export type ResponseTimelineEvent = {
  hour: number;
  kind: "DISRUPTION" | "REROUTE" | "DELIVERY";
  message: string;
};

export type ReplayShipment = {
  supplierId: SupplierId;
  supplierName: string;
  routeId: string;
  routeName: string;
  phase: "PRIMARY" | "RESERVE" | "RECOVERY";
  kits: number;
  costUsd: number;
  orderedAtHour: number;
  arrivalHour: number;
  status: "SURVIVED" | "LOST";
  lostAtHour: number | null;
};

export type ReplayDelivery = {
  hour: number;
  supplierId: SupplierId;
  supplierName: string;
  routeId: string;
  routeName: string;
  phase: ReplayShipment["phase"];
  regionId: string;
  regionName: string;
  kits: number;
};

export type DisasterReplayTrace = {
  initialBudgetUsd: number;
  emergencyBudgetUsd: number;
  initialSpentUsd: number;
  initialBudgetRemainingUsd: number;
  recoverySpentUsd: number;
  recoveryBudgetRemainingUsd: number;
  disruptions: DisasterEvent[];
  shipments: ReplayShipment[];
  deliveries: ReplayDelivery[];
};

export type DisasterScenarioOutcome = {
  scenarioId: string;
  scenarioName: string;
  scenarioSummary: string;
  totalCostUsd: number;
  deliveredKits: number;
  fairnessPpm: number;
  lostKits: number;
  regionOutcomes: RegionOutcome[];
  timeline: ResponseTimelineEvent[];
  replayTrace: DisasterReplayTrace;
};

export type DisasterResponsePoint = {
  id: string;
  name: string;
  totalProcurementCost: number;
  worstCaseDeliveredKits: number;
  regionalFairnessPpm: number;
};

export type DisasterResponseEvaluation = {
  schemaVersion: "2";
  arenaId: typeof disasterResponseChallengeId;
  dataVersion: string;
  evaluatorVersion: "disaster-response-evaluator-v2";
  contextHash: Hex;
  finalScenarioCommitment: Hex;
  manifestHash: Hex;
  resultHash: Hex;
  strategy: DisasterResponseStrategy;
  correctness: boolean;
  constraintFailures: string[];
  totalProcurementCost: number;
  worstCaseDeliveredKits: number;
  regionalFairnessPpm: number;
  scenarioOutcomes: DisasterScenarioOutcome[];
  worstScenarioId: string;
  pareto: {
    frontier: boolean;
    dominatedBy: DisasterResponsePoint[];
    improvesOver: DisasterResponsePoint[];
  };
  contribution: ContributionEvidence;
};

export const disasterSuppliers = [
  {
    id: "harbor-aid",
    name: "Harbor Aid",
    unitCost: 34,
    capacity: 520,
    routeId: "east-port",
    routeName: "East Port",
    leadHours: 18,
  },
  {
    id: "northstar",
    name: "Northstar Relief",
    unitCost: 42,
    capacity: 480,
    routeId: "east-port",
    routeName: "East Port",
    leadHours: 20,
  },
  {
    id: "inland-works",
    name: "Inland Works",
    unitCost: 52,
    capacity: 400,
    routeId: "west-rail",
    routeName: "West Rail",
    leadHours: 16,
  },
  {
    id: "local-grid",
    name: "Local Grid",
    unitCost: 64,
    capacity: 320,
    routeId: "local-road",
    routeName: "Local Roads",
    leadHours: 10,
  },
  {
    id: "airbridge",
    name: "Airbridge",
    unitCost: 82,
    capacity: 260,
    routeId: "air-corridor",
    routeName: "Air Corridor",
    leadHours: 6,
  },
] as const satisfies readonly DisasterSupplier[];

export const disasterRegions = [
  { id: "coast", name: "Coastal Shelter", demand: 280, deadlineHour: 24 },
  { id: "river", name: "River District", demand: 260, deadlineHour: 36 },
  { id: "highland", name: "Highland Clinic", demand: 220, deadlineHour: 48 },
  { id: "south", name: "South Community", demand: 240, deadlineHour: 72 },
] as const satisfies readonly DisasterRegion[];

export const publicTrainingScenarios = [
  {
    id: "training-clear",
    name: "Clear network",
    summary: "All four delivery corridors remain available.",
    events: [],
  },
  {
    id: "training-port",
    name: "East Port shutdown",
    summary: "Storm surge closes the shared low-cost port at hour 12.",
    events: [
      {
        hour: 12,
        label: "Storm surge closes East Port",
        disabledSupplierIds: [],
        disabledRouteIds: ["east-port"],
      },
    ],
  },
  {
    id: "training-rail",
    name: "West Rail landslide",
    summary: "A landslide blocks the rail corridor at hour 8.",
    events: [
      {
        hour: 8,
        label: "Landslide blocks West Rail",
        disabledSupplierIds: [],
        disabledRouteIds: ["west-rail"],
      },
    ],
  },
] as const satisfies readonly DisasterScenario[];

const finalScenarios = [
  {
    id: "final-cyclone",
    name: "Cyclone landfall",
    summary: "East Port closes before its shipments arrive.",
    events: [
      {
        hour: 10,
        label: "Cyclone closes East Port",
        disabledSupplierIds: [],
        disabledRouteIds: ["east-port"],
      },
    ],
  },
  {
    id: "final-contamination",
    name: "Supplier contamination",
    summary: "The largest low-cost supplier is removed at dispatch.",
    events: [
      {
        hour: 0,
        label: "Harbor Aid stock recalled",
        disabledSupplierIds: ["harbor-aid"],
        disabledRouteIds: [],
      },
    ],
  },
  {
    id: "final-aftershock",
    name: "Aftershock cascade",
    summary: "Rail and local roads fail together as regional demand rises.",
    events: [
      {
        hour: 7,
        label: "Aftershock blocks West Rail and Local Roads",
        disabledSupplierIds: [],
        disabledRouteIds: ["west-rail", "local-road"],
      },
    ],
    demandMultipliers: { coast: 1.15, highland: 1.1 },
  },
  {
    id: "final-air-grounded",
    name: "Air corridor grounded",
    summary: "Heavy weather grounds emergency flights at hour 4.",
    events: [
      {
        hour: 4,
        label: "Air corridor grounded",
        disabledSupplierIds: [],
        disabledRouteIds: ["air-corridor"],
      },
    ],
  },
] as const satisfies readonly DisasterScenario[];

const allSupplierIds = disasterSuppliers.map(({ id }) => id);

export const defaultDisasterResponseStrategy: DisasterResponseStrategy = {
  schemaVersion: "2",
  name: "Adaptive regional mesh",
  primarySupplierOrder: ["harbor-aid", "inland-works", "northstar", "local-grid", "airbridge"],
  emergencySupplierOrder: ["airbridge", "local-grid", "northstar", "inland-works", "harbor-aid"],
  regionPolicy: "equalize-coverage",
  reserveKits: 220,
  emergencyBudgetUsd: 18_000,
};

export const benchmarkStrategies = [
  {
    id: "benchmark-budget",
    name: "Budget Sprint",
    approach: "Buys from the cheapest corridor and keeps a small recovery budget.",
    strategy: {
      schemaVersion: "2",
      name: "Budget Sprint",
      primarySupplierOrder: ["harbor-aid", "northstar", "inland-works", "local-grid", "airbridge"],
      emergencySupplierOrder: [
        "inland-works",
        "local-grid",
        "airbridge",
        "northstar",
        "harbor-aid",
      ],
      regionPolicy: "deadline-first",
      reserveKits: 40,
      emergencyBudgetUsd: 7_000,
    },
  },
  {
    id: "benchmark-resilience",
    name: "Resilience Mesh",
    approach: "Maximizes worst-case throughput, accepting higher cost and uneven coverage.",
    strategy: {
      schemaVersion: "2",
      name: "Resilience Mesh",
      primarySupplierOrder: ["inland-works", "airbridge", "harbor-aid", "northstar", "local-grid"],
      emergencySupplierOrder: [
        "northstar",
        "local-grid",
        "harbor-aid",
        "airbridge",
        "inland-works",
      ],
      regionPolicy: "deadline-first",
      reserveKits: 25,
      emergencyBudgetUsd: 20_000,
    },
  },
  {
    id: "benchmark-fairness",
    name: "Fair Reach",
    approach: "Raises the worst-served region, accepting a small throughput trade-off.",
    strategy: {
      schemaVersion: "2",
      name: "Fair Reach",
      primarySupplierOrder: ["airbridge", "inland-works", "harbor-aid", "local-grid", "northstar"],
      emergencySupplierOrder: [
        "harbor-aid",
        "northstar",
        "inland-works",
        "local-grid",
        "airbridge",
      ],
      regionPolicy: "equalize-coverage",
      reserveKits: 180,
      emergencyBudgetUsd: 18_000,
    },
  },
] as const satisfies readonly {
  id: string;
  name: string;
  approach: string;
  strategy: DisasterResponseStrategy;
}[];

export const disasterResponseMetrics = [
  {
    key: "totalProcurementCost",
    name: "72-hour cost exposure",
    direction: "MINIMIZE",
    unit: "USD",
    lowerBound: 30_000,
    upperBound: 100_000,
  },
  {
    key: "worstCaseDeliveredKits",
    name: "Worst-case delivery",
    direction: "MAXIMIZE",
    unit: "kits",
    lowerBound: 0,
    upperBound: 1_000,
  },
  {
    key: "regionalFairnessPpm",
    name: "Worst-region coverage",
    direction: "MAXIMIZE",
    unit: "ppm",
    lowerBound: 0,
    upperBound: 1_000_000,
  },
] as const satisfies readonly OutcomeMetric[];

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

function canonicalResultJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalResultJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== "replayTrace")
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalResultJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

const finalScenarioCommitment = keccak256(stringToHex(canonicalJson(finalScenarios)));
const dataVersion = "disaster-network-2026-09-v2";
export const disasterResponseContextHash = keccak256(
  stringToHex(
    canonicalJson({
      arenaId: disasterResponseChallengeId,
      dataVersion,
      suppliers: disasterSuppliers,
      regions: disasterRegions,
      trainingScenarios: publicTrainingScenarios,
      finalScenarioCommitment,
      metrics: disasterResponseMetrics,
    }),
  ),
);

export const disasterResponseManifest = parseChallengeManifest({
  schemaVersion: "2",
  id: disasterResponseChallengeId,
  slug: "emergency-supply",
  name: "72-Hour Disaster Response",
  lifecycle: "PRACTICE",
  sponsor: {
    name: "Frontier Protocol demo round",
    wallet: null,
    statement: "A deterministic instant final for demonstrating committed evaluation and rewards.",
  },
  valueTension: "Spend less, survive disruption, and keep every region supplied.",
  artifactType: "disaster-response-strategy-v2",
  hardConstraints: [
    "Use every published supplier exactly once in each priority list",
    "Reserve 0 to 300 kits across independent corridors",
    "Keep emergency spending at or below 25,000 USD",
  ],
  metrics: disasterResponseMetrics,
  contexts: [
    {
      id: "public-training",
      version: dataVersion,
      name: "Public training scenarios",
      description: "Network, demand, and three published disruption scenarios.",
      datasetHash: disasterResponseContextHash,
      constraintHash: keccak256(stringToHex("disaster-response-strategy-v2-constraints")),
      metricsHash: keccak256(stringToHex(canonicalJson(disasterResponseMetrics))),
      evidenceLevel: 0,
    },
  ],
  activeContextId: "public-training",
  workload: { publicHash: disasterResponseContextHash, finalCommitment: finalScenarioCommitment },
  submission: {
    methods: ["INLINE"],
    sourceVisibility: "PUBLIC",
    opensAt: null,
    closesAt: null,
    maxRevisions: 20,
  },
  reviewEndsAt: null,
  reward: { kind: "PREVIEW", poolCredits: disasterResponsePoolCredits },
});

export const disasterResponseManifestHash = hashChallengeManifest(disasterResponseManifest);

function normalizeStrategy(input: DisasterResponseStrategy) {
  const failures: string[] = [];
  const validateOrder = (label: string, order: SupplierId[]) => {
    if (
      order.length !== allSupplierIds.length ||
      new Set(order).size !== allSupplierIds.length ||
      order.some((id) => !allSupplierIds.includes(id))
    ) {
      failures.push(`${label} must contain every supplier exactly once`);
    }
  };
  validateOrder("Primary supplier order", input.primarySupplierOrder);
  validateOrder("Emergency supplier order", input.emergencySupplierOrder);
  if (!Number.isSafeInteger(input.reserveKits) || input.reserveKits < 0 || input.reserveKits > 300)
    failures.push("Reserve kits must be a whole number from 0 to 300");
  if (
    !Number.isSafeInteger(input.emergencyBudgetUsd) ||
    input.emergencyBudgetUsd < 0 ||
    input.emergencyBudgetUsd > 25_000
  )
    failures.push("Emergency budget must be a whole USD amount from 0 to 25,000");
  if (!["deadline-first", "highest-need", "equalize-coverage"].includes(input.regionPolicy))
    failures.push("Unknown regional dispatch policy");
  if (!input.name.trim() || input.name.length > 80)
    failures.push("Strategy name must contain 1 to 80 characters");
  return { strategy: input, failures };
}

type Purchase = {
  supplierId: SupplierId;
  kits: number;
  cost: number;
  orderedAtHour: number;
  arrivalHour: number;
  phase: "PRIMARY" | "RESERVE" | "RECOVERY";
};

function buy(
  order: readonly SupplierId[],
  target: number,
  usedCapacity: Map<SupplierId, number>,
  budget: number,
  placedAt: number,
  phase: Purchase["phase"],
  disabledSuppliers: Set<SupplierId> = new Set(),
  disabledRoutes: Set<string> = new Set(),
) {
  const purchases: Purchase[] = [];
  let remaining = target;
  let remainingBudget = budget;
  for (const supplierId of order) {
    if (remaining <= 0) break;
    const supplier = disasterSuppliers.find(({ id }) => id === supplierId);
    if (!supplier || disabledSuppliers.has(supplierId) || disabledRoutes.has(supplier.routeId))
      continue;
    const available = supplier.capacity - (usedCapacity.get(supplierId) ?? 0);
    const affordable = Math.floor(remainingBudget / supplier.unitCost);
    const kits = Math.max(0, Math.min(remaining, available, affordable));
    if (kits === 0) continue;
    const cost = kits * supplier.unitCost;
    purchases.push({
      supplierId,
      kits,
      cost,
      orderedAtHour: placedAt,
      arrivalHour: placedAt + supplier.leadHours,
      phase,
    });
    usedCapacity.set(supplierId, (usedCapacity.get(supplierId) ?? 0) + kits);
    remaining -= kits;
    remainingBudget -= cost;
  }
  return { purchases, spent: budget - remainingBudget, unfilled: remaining };
}

function dispatch(
  purchases: Purchase[],
  strategy: DisasterResponseStrategy,
  scenario: DisasterScenario,
) {
  const regions = disasterRegions.map((region) => ({
    ...region,
    demand: Math.round(region.demand * (scenario.demandMultipliers?.[region.id] ?? 1)),
    delivered: 0,
  }));
  const timeline: ResponseTimelineEvent[] = [];
  const deliveries: ReplayDelivery[] = [];
  for (const event of scenario.events)
    timeline.push({ hour: event.hour, kind: "DISRUPTION", message: event.label });

  let deliveredKits = 0;
  const nextRegion = (arrivalHour: number) => {
    const eligible = regions.filter(
      (region) => region.delivered < region.demand && arrivalHour <= region.deadlineHour,
    );
    if (eligible.length === 0) return null;
    return [...eligible].sort((left, right) => {
      if (strategy.regionPolicy === "deadline-first")
        return left.deadlineHour - right.deadlineHour || left.id.localeCompare(right.id);
      if (strategy.regionPolicy === "highest-need")
        return (
          right.demand - right.delivered - (left.demand - left.delivered) ||
          left.id.localeCompare(right.id)
        );
      const leftCoverage = left.delivered / left.demand;
      const rightCoverage = right.delivered / right.demand;
      return leftCoverage - rightCoverage || left.deadlineHour - right.deadlineHour;
    })[0]!;
  };

  for (const purchase of [...purchases].sort(
    (left, right) =>
      left.arrivalHour - right.arrivalHour || left.supplierId.localeCompare(right.supplierId),
  )) {
    const supplier = disasterSuppliers.find(({ id }) => id === purchase.supplierId)!;
    let remaining = purchase.kits;
    while (remaining > 0) {
      const region = nextRegion(purchase.arrivalHour);
      if (!region) break;
      const kits = Math.min(remaining, region.demand - region.delivered);
      region.delivered += kits;
      deliveredKits += kits;
      remaining -= kits;
      deliveries.push({
        hour: purchase.arrivalHour,
        supplierId: purchase.supplierId,
        supplierName: supplier.name,
        routeId: supplier.routeId,
        routeName: supplier.routeName,
        phase: purchase.phase,
        regionId: region.id,
        regionName: region.name,
        kits,
      });
    }
    if (purchase.phase === "RECOVERY" && purchase.kits > 0) {
      timeline.push({
        hour: purchase.arrivalHour,
        kind: "REROUTE",
        message: `${purchase.kits} kits rerouted through ${supplier.routeName}`,
      });
    }
  }

  const regionOutcomes = regions.map((region) => ({
    regionId: region.id,
    regionName: region.name,
    demand: region.demand,
    delivered: region.delivered,
    coveragePpm: Math.floor((region.delivered * 1_000_000) / region.demand),
  }));
  const fairnessPpm = Math.min(...regionOutcomes.map(({ coveragePpm }) => coveragePpm));
  timeline.push({
    hour: 72,
    kind: "DELIVERY",
    message: `${deliveredKits} kits arrived before regional deadlines`,
  });
  return { deliveredKits, regionOutcomes, fairnessPpm, timeline, deliveries };
}

function simulateScenario(strategy: DisasterResponseStrategy, scenario: DisasterScenario) {
  const usedCapacity = new Map<SupplierId, number>();
  const initialBudget = 72_000 - strategy.emergencyBudgetUsd;
  const primary = buy(
    strategy.primarySupplierOrder,
    1_000 - strategy.reserveKits,
    usedCapacity,
    initialBudget,
    0,
    "PRIMARY",
  );
  const reserve = buy(
    strategy.emergencySupplierOrder,
    strategy.reserveKits,
    usedCapacity,
    initialBudget - primary.spent,
    0,
    "RESERVE",
  );
  const initial = [...primary.purchases, ...reserve.purchases];
  const disabledSuppliers = new Set(
    scenario.events.flatMap(({ disabledSupplierIds }) => disabledSupplierIds),
  );
  const disabledRoutes = new Set(
    scenario.events.flatMap(({ disabledRouteIds }) => disabledRouteIds),
  );
  const firstEventHour = Math.min(...scenario.events.map(({ hour }) => hour), 72);
  const surviving = initial.filter((purchase) => {
    const supplier = disasterSuppliers.find(({ id }) => id === purchase.supplierId)!;
    const affected =
      disabledSuppliers.has(purchase.supplierId) || disabledRoutes.has(supplier.routeId);
    return !affected || purchase.arrivalHour < firstEventHour;
  });
  const lostKits =
    initial.reduce((sum, { kits }) => sum + kits, 0) -
    surviving.reduce((sum, { kits }) => sum + kits, 0);
  const recovery = buy(
    strategy.emergencySupplierOrder,
    Math.max(0, 1_000 - surviving.reduce((sum, { kits }) => sum + kits, 0)),
    usedCapacity,
    strategy.emergencyBudgetUsd,
    firstEventHour,
    "RECOVERY",
    disabledSuppliers,
    disabledRoutes,
  );
  const dispatched = dispatch([...surviving, ...recovery.purchases], strategy, scenario);
  const survivingSet = new Set(surviving);
  const replayShipment = (purchase: Purchase): ReplayShipment => {
    const supplier = disasterSuppliers.find(({ id }) => id === purchase.supplierId)!;
    const lost = purchase.phase !== "RECOVERY" && !survivingSet.has(purchase);
    return {
      supplierId: purchase.supplierId,
      supplierName: supplier.name,
      routeId: supplier.routeId,
      routeName: supplier.routeName,
      phase: purchase.phase,
      kits: purchase.kits,
      costUsd: purchase.cost,
      orderedAtHour: purchase.orderedAtHour,
      arrivalHour: purchase.arrivalHour,
      status: lost ? "LOST" : "SURVIVED",
      lostAtHour: lost ? firstEventHour : null,
    };
  };
  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    scenarioSummary: scenario.summary,
    totalCostUsd: initial.reduce((sum, { cost }) => sum + cost, 0) + recovery.spent,
    deliveredKits: dispatched.deliveredKits,
    fairnessPpm: dispatched.fairnessPpm,
    lostKits,
    regionOutcomes: dispatched.regionOutcomes,
    timeline: dispatched.timeline,
    replayTrace: {
      initialBudgetUsd: initialBudget,
      emergencyBudgetUsd: strategy.emergencyBudgetUsd,
      initialSpentUsd: initial.reduce((sum, { cost }) => sum + cost, 0),
      initialBudgetRemainingUsd: initialBudget - initial.reduce((sum, { cost }) => sum + cost, 0),
      recoverySpentUsd: recovery.spent,
      recoveryBudgetRemainingUsd: strategy.emergencyBudgetUsd - recovery.spent,
      disruptions: scenario.events.map((event) => ({
        ...event,
        disabledSupplierIds: [...event.disabledSupplierIds],
        disabledRouteIds: [...event.disabledRouteIds],
      })),
      shipments: [...initial, ...recovery.purchases].map(replayShipment),
      deliveries: dispatched.deliveries,
    },
  } satisfies DisasterScenarioOutcome;
}

function measureStrategy(strategy: DisasterResponseStrategy) {
  const scenarioOutcomes = [...publicTrainingScenarios, ...finalScenarios].map((scenario) =>
    simulateScenario(strategy, scenario),
  );
  const worst = [...scenarioOutcomes].sort(
    (left, right) =>
      left.deliveredKits - right.deliveredKits ||
      left.fairnessPpm - right.fairnessPpm ||
      right.totalCostUsd - left.totalCostUsd,
  )[0]!;
  return {
    totalProcurementCost: Math.max(...scenarioOutcomes.map(({ totalCostUsd }) => totalCostUsd)),
    worstCaseDeliveredKits: worst.deliveredKits,
    regionalFairnessPpm: Math.min(...scenarioOutcomes.map(({ fairnessPpm }) => fairnessPpm)),
    scenarioOutcomes,
    worstScenarioId: worst.scenarioId,
  };
}

function asOutcome(
  point: DisasterResponsePoint,
  baseline: boolean,
  correctness = true,
): OutcomePoint {
  return {
    id: point.id,
    name: point.name,
    baseline,
    correctness,
    values: {
      totalProcurementCost: point.totalProcurementCost,
      worstCaseDeliveredKits: point.worstCaseDeliveredKits,
      regionalFairnessPpm: point.regionalFairnessPpm,
    },
  };
}

export const disasterResponseBaselinePoints: DisasterResponsePoint[] = benchmarkStrategies.map(
  ({ id, name, strategy }) => ({ id, name, ...measureStrategy(strategy) }),
);

export function evaluateDisasterResponseStrategy(
  input: DisasterResponseStrategy,
): DisasterResponseEvaluation {
  const normalized = normalizeStrategy(input);
  const measured = measureStrategy(input);
  const candidate: DisasterResponsePoint = { id: "candidate", name: input.name, ...measured };
  const correctness = normalized.failures.length === 0;
  const dominatedBy = correctness
    ? disasterResponseBaselinePoints.filter((point) =>
        dominatesOutcome(
          asOutcome(point, true),
          asOutcome(candidate, false),
          disasterResponseMetrics,
        ),
      )
    : [];
  const improvesOver = correctness
    ? disasterResponseBaselinePoints.filter((point) =>
        dominatesOutcome(
          asOutcome(candidate, false),
          asOutcome(point, true),
          disasterResponseMetrics,
        ),
      )
    : [];
  const contribution = computeContributionEvidence(
    disasterResponseBaselinePoints.map((point) => asOutcome(point, true)),
    asOutcome(candidate, false, correctness),
    disasterResponseMetrics,
  );
  const resultWithoutHash = {
    schemaVersion: "2" as const,
    arenaId: disasterResponseChallengeId,
    dataVersion,
    evaluatorVersion: "disaster-response-evaluator-v2" as const,
    contextHash: disasterResponseContextHash,
    finalScenarioCommitment,
    manifestHash: disasterResponseManifestHash,
    strategy: input,
    correctness,
    constraintFailures: normalized.failures,
    ...measured,
    pareto: {
      frontier: correctness && dominatedBy.length === 0,
      dominatedBy,
      improvesOver,
    },
    contribution,
  };
  return {
    ...resultWithoutHash,
    resultHash: keccak256(stringToHex(canonicalResultJson(resultWithoutHash))),
  };
}

export function publicDisasterResponseScenario() {
  return {
    challengeId: disasterResponseChallengeId,
    name: "72-Hour Disaster Response",
    dataVersion,
    durationHours: 72,
    maxBudgetUsd: 72_000,
    suppliers: disasterSuppliers,
    regions: disasterRegions,
    trainingScenarios: publicTrainingScenarios,
    metrics: disasterResponseMetrics,
    benchmarks: benchmarkStrategies.map(({ id, name, approach }) => ({ id, name, approach })),
    defaultStrategy: defaultDisasterResponseStrategy,
    contextHash: disasterResponseContextHash,
    finalScenarioCommitment,
    manifest: disasterResponseManifest,
    manifestHash: disasterResponseManifestHash,
    finalScenarioCount: finalScenarios.length,
    disclosure:
      "This demo reveals committed final scenarios immediately after submission; a scheduled tournament would reveal them only after the deadline.",
  } as const;
}

export function computeDisasterResponseFrontier(
  entries: readonly {
    id: string;
    name: string;
    baseline: boolean;
    evaluation: DisasterResponseEvaluation;
  }[],
) {
  const points = entries.map(({ id, name, baseline, evaluation }) =>
    asOutcome(
      {
        id,
        name,
        totalProcurementCost: evaluation.totalProcurementCost,
        worstCaseDeliveredKits: evaluation.worstCaseDeliveredKits,
        regionalFairnessPpm: evaluation.regionalFairnessPpm,
      },
      baseline,
      evaluation.correctness,
    ),
  );
  const frontierIds = new Set(
    computeOutcomeFrontier(points, disasterResponseMetrics).map(({ id }) => id),
  );
  return entries.map((entry) => ({
    ...entry,
    frontier: frontierIds.has(entry.id),
    dominatedBy: points
      .filter(
        (other) =>
          other.id !== entry.id &&
          dominatesOutcome(
            other,
            points.find(({ id }) => id === entry.id)!,
            disasterResponseMetrics,
          ),
      )
      .map(({ name }) => name),
    contribution: computeContributionEvidence(
      points.filter(({ id }) => id !== entry.id),
      points.find(({ id }) => id === entry.id)!,
      disasterResponseMetrics,
    ),
  }));
}
