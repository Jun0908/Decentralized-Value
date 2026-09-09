import type {
  DisasterResponseEvaluation,
  DisasterResponseStrategy,
  SupplierId,
} from "@frontier/disaster-response";

export type StrategyChange = {
  key: string;
  label: string;
  before: string;
  after: string;
  effect: string;
};

export type MetricOrigin = {
  key: "cost" | "delivery" | "fairness";
  label: string;
  value: number;
  scenarioName: string;
  explanation: string;
};

const policyLabels: Record<DisasterResponseStrategy["regionPolicy"], string> = {
  "deadline-first": "Urgent first",
  "highest-need": "Largest need",
  "equalize-coverage": "Fair coverage",
};

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value.toLocaleString("en-US")}`;
}

function supplierName(
  supplierId: SupplierId,
  supplierNames: Readonly<Partial<Record<SupplierId, string>>>,
) {
  return supplierNames[supplierId] ?? supplierId;
}

export function describeStrategyChanges(
  previous: DisasterResponseStrategy | null,
  current: DisasterResponseStrategy,
  supplierNames: Readonly<Partial<Record<SupplierId, string>>>,
): StrategyChange[] {
  if (!previous) return [];
  const changes: StrategyChange[] = [];

  if (previous.emergencyBudgetUsd !== current.emergencyBudgetUsd) {
    const delta = current.emergencyBudgetUsd - previous.emergencyBudgetUsd;
    changes.push({
      key: "emergency-budget",
      label: "Emergency budget",
      before: `$${previous.emergencyBudgetUsd.toLocaleString("en-US")}`,
      after: `$${current.emergencyBudgetUsd.toLocaleString("en-US")}`,
      effect:
        delta > 0
          ? `${signed(delta)} USD moved from initial buying into the recovery vault.`
          : `${signed(-delta)} USD moved from the recovery vault back into initial buying.`,
    });
  }

  if (previous.reserveKits !== current.reserveKits) {
    const delta = current.reserveKits - previous.reserveKits;
    changes.push({
      key: "reserve-kits",
      label: "Backup inventory",
      before: `${previous.reserveKits} kits`,
      after: `${current.reserveKits} kits`,
      effect:
        delta > 0
          ? `${signed(delta)} more kits now follow the backup supplier order before disruption.`
          : `${signed(-delta)} kits moved back to the primary supplier order.`,
    });
  }

  if (previous.regionPolicy !== current.regionPolicy) {
    changes.push({
      key: "region-policy",
      label: "Regional dispatch",
      before: policyLabels[previous.regionPolicy],
      after: policyLabels[current.regionPolicy],
      effect: "Every arriving shipment now chooses its next region with a different public rule.",
    });
  }

  if (previous.primarySupplierOrder.join(":") !== current.primarySupplierOrder.join(":")) {
    changes.push({
      key: "primary-order",
      label: "Primary buying order",
      before: supplierName(previous.primarySupplierOrder[0]!, supplierNames),
      after: supplierName(current.primarySupplierOrder[0]!, supplierNames),
      effect:
        "Initial purchasing now tries a different price, capacity, route, and lead-time order.",
    });
  }

  if (previous.emergencySupplierOrder.join(":") !== current.emergencySupplierOrder.join(":")) {
    changes.push({
      key: "recovery-order",
      label: "Backup & recovery priority",
      before: supplierName(previous.emergencySupplierOrder[0]!, supplierNames),
      after: supplierName(current.emergencySupplierOrder[0]!, supplierNames),
      effect: "Reserve and recovery purchases now try a different surviving supplier first.",
    });
  }

  return changes;
}

export function metricOrigins(evaluation: DisasterResponseEvaluation): MetricOrigin[] {
  const highestCost = [...evaluation.scenarioOutcomes].sort(
    (left, right) =>
      right.totalCostUsd - left.totalCostUsd || left.scenarioId.localeCompare(right.scenarioId),
  )[0]!;
  const lowestDelivery = [...evaluation.scenarioOutcomes].sort(
    (left, right) =>
      left.deliveredKits - right.deliveredKits || left.scenarioId.localeCompare(right.scenarioId),
  )[0]!;
  const lowestFairness = [...evaluation.scenarioOutcomes].sort(
    (left, right) =>
      left.fairnessPpm - right.fairnessPpm || left.scenarioId.localeCompare(right.scenarioId),
  )[0]!;

  return [
    {
      key: "cost",
      label: "Cost exposure",
      value: highestCost.totalCostUsd,
      scenarioName: highestCost.scenarioName,
      explanation: "The most expensive of all seven scenarios sets this result.",
    },
    {
      key: "delivery",
      label: "Worst delivery",
      value: lowestDelivery.deliveredKits,
      scenarioName: lowestDelivery.scenarioName,
      explanation: "The fewest kits delivered before regional deadlines sets this result.",
    },
    {
      key: "fairness",
      label: "Worst region",
      value: lowestFairness.fairnessPpm,
      scenarioName: lowestFairness.scenarioName,
      explanation: "The lowest regional coverage observed anywhere sets this result.",
    },
  ];
}

export function worstScenarioReasons(evaluation: DisasterResponseEvaluation) {
  const outcome =
    evaluation.scenarioOutcomes.find(
      ({ scenarioId }) => scenarioId === evaluation.worstScenarioId,
    ) ?? evaluation.scenarioOutcomes[0]!;
  const recoveredKits = outcome.replayTrace.shipments
    .filter(({ phase, status }) => phase === "RECOVERY" && status === "SURVIVED")
    .reduce((sum, { kits }) => sum + kits, 0);
  const weakestRegion = [...outcome.regionOutcomes].sort(
    (left, right) =>
      left.coveragePpm - right.coveragePpm || left.regionId.localeCompare(right.regionId),
  )[0]!;

  return {
    scenarioName: outcome.scenarioName,
    reasons: [
      outcome.lostKits > 0
        ? `${outcome.lostKits.toLocaleString("en-US")} kits were lost after the published disruption.`
        : "No purchased kits were lost in this scenario.",
      recoveredKits > 0
        ? `${recoveredKits.toLocaleString("en-US")} replacement kits were bought for $${outcome.replayTrace.recoverySpentUsd.toLocaleString("en-US")}.`
        : "The recovery order delivered no replacement kits before the deadlines.",
      `${weakestRegion.regionName} finished lowest at ${(weakestRegion.coveragePpm / 10_000).toFixed(1)}% coverage.`,
    ],
  };
}

export function nextTradeoffMoves(evaluation: DisasterResponseEvaluation) {
  const moves: string[] = [];
  if (evaluation.regionalFairnessPpm < 800_000) {
    moves.push(
      "Try Fair coverage or more route-diverse reserve stock. This may raise cost or reduce total throughput.",
    );
  }
  if (evaluation.worstCaseDeliveredKits < 900) {
    moves.push(
      "Try preserving more recovery budget or prioritizing a fast independent route. This may increase cost.",
    );
  }
  moves.push(
    "Try moving a cheaper supplier earlier to lower cost. Check whether concentrating purchases makes one failure worse.",
  );
  return moves.slice(0, 3);
}
