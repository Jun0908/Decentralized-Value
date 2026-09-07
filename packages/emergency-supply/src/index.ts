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
  contextHash: Hex;
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
};

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

const contextDocument = {
  arenaId: emergencySupplyScenario.arenaId,
  dataVersion: emergencySupplyScenario.dataVersion,
  targetKits: emergencySupplyScenario.targetKits,
  vendors: emergencySupplyScenario.vendors,
  failures: emergencySupplyScenario.failures,
};

export const emergencySupplyContextHash = keccak256(stringToHex(canonicalJson(contextDocument)));

function normalizeAllocation(input: SupplyAllocation): {
  allocation: SupplyAllocation;
  failures: string[];
} {
  const failures: string[] = [];
  const knownIds = new Set(emergencySupplyScenario.vendors.map((vendor) => vendor.id));
  const allocation: SupplyAllocation = {};

  for (const suppliedId of Object.keys(input)) {
    if (!knownIds.has(suppliedId)) failures.push(`Unknown vendor: ${suppliedId}`);
  }

  for (const vendor of emergencySupplyScenario.vendors) {
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
  if (total !== emergencySupplyScenario.targetKits) {
    failures.push(`Allocate exactly ${emergencySupplyScenario.targetKits} kits; received ${total}`);
  }
  return { allocation, failures };
}

function measure(allocation: SupplyAllocation) {
  const totalAllocatedKits = Object.values(allocation).reduce((sum, amount) => sum + amount, 0);
  const totalProcurementCost = emergencySupplyScenario.vendors.reduce(
    (sum, vendor) => sum + (allocation[vendor.id] ?? 0) * vendor.unitCost,
    0,
  );
  const failureOutcomes = emergencySupplyScenario.failures.map((scenario): FailureOutcome => {
    const affectedVendorIds = emergencySupplyScenario.vendors
      .filter(
        (vendor) =>
          (scenario.disabledVendorIds as readonly string[]).includes(vendor.id) ||
          (scenario.disabledRouteIds as readonly string[]).includes(vendor.routeId),
      )
      .map((vendor) => vendor.id);
    const lostKits = affectedVendorIds.reduce(
      (sum, vendorId) => sum + (allocation[vendorId] ?? 0),
      0,
    );
    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
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

function strategyPoint(strategy: SupplyStrategy): SupplyPoint {
  const result = measure(strategy.allocation);
  return {
    id: strategy.id,
    name: strategy.name,
    totalProcurementCost: result.totalProcurementCost,
    worstCaseDeliveredKits: result.worstCaseDeliveredKits,
  };
}

export const emergencySupplyBaselinePoints = emergencySupplyScenario.strategies.map(strategyPoint);

export function dominatesSupply(left: SupplyPoint, right: SupplyPoint): boolean {
  const noWorse =
    left.totalProcurementCost <= right.totalProcurementCost &&
    left.worstCaseDeliveredKits >= right.worstCaseDeliveredKits;
  const strictlyBetter =
    left.totalProcurementCost < right.totalProcurementCost ||
    left.worstCaseDeliveredKits > right.worstCaseDeliveredKits;
  return noWorse && strictlyBetter;
}

export function evaluateSupplyAllocation(input: SupplyAllocation): SupplyEvaluation {
  const normalized = normalizeAllocation(input);
  const metrics = measure(normalized.allocation);
  const candidate: SupplyPoint = {
    id: "candidate",
    name: "Your allocation",
    totalProcurementCost: metrics.totalProcurementCost,
    worstCaseDeliveredKits: metrics.worstCaseDeliveredKits,
  };
  const correctness = normalized.failures.length === 0;
  const dominatedBy = correctness
    ? emergencySupplyBaselinePoints.filter((point) => dominatesSupply(point, candidate))
    : [];
  const improvesOver = correctness
    ? emergencySupplyBaselinePoints.filter((point) => dominatesSupply(candidate, point))
    : [];
  const resultWithoutHash = {
    schemaVersion: "1" as const,
    arenaId: emergencySupplyScenario.arenaId,
    dataVersion: emergencySupplyScenario.dataVersion,
    contextHash: emergencySupplyContextHash,
    allocation: normalized.allocation,
    ...metrics,
    correctness,
    constraintFailures: normalized.failures,
    pareto: {
      frontier: correctness && dominatedBy.length === 0,
      dominatedBy,
      improvesOver,
    },
  };
  return {
    ...resultWithoutHash,
    resultHash: keccak256(stringToHex(canonicalJson(resultWithoutHash))),
  };
}

export function publicEmergencySupplyScenario() {
  return {
    arenaId: emergencySupplyScenario.arenaId,
    name: emergencySupplyScenario.name,
    dataVersion: emergencySupplyScenario.dataVersion,
    currency: emergencySupplyScenario.currency,
    targetKits: emergencySupplyScenario.targetKits,
    contextHash: emergencySupplyContextHash,
    axes: [
      { key: "totalProcurementCost", direction: "MINIMIZE", unit: "USD" },
      { key: "worstCaseDeliveredKits", direction: "MAXIMIZE", unit: "kits" },
    ],
    vendors: emergencySupplyScenario.vendors,
    failures: emergencySupplyScenario.failures.map(({ id, name }) => ({ id, name })),
    strategies: emergencySupplyScenario.strategies,
    baselinePoints: emergencySupplyBaselinePoints,
    settlement: {
      state: "not-configured",
      network: "sepolia",
      rewardToken: null,
    },
  } as const;
}
