// Browser-safe, independent of the classic evaluator and its shared/server entry points.
import { keccak256, stringToHex, type Hex } from "viem";

export const microgridDayVersion = "microgrid-day-practice-v1" as const;
export type MicrogridPolicy = {
  version: "microgrid-policy-v1";
  reservePercent: number;
  dischargePrice: number;
  chargeBelowPrice: number;
  maxGridMwh: number;
};
export type MicrogridPeriod = {
  id: string;
  time: string;
  weather: string;
  demandMwh: number;
  solarMwh: number;
  windMwh: number;
  gridPrice: number;
  gridCarbonKgPerMwh: number;
  gridOnline: boolean;
};

const periods: readonly MicrogridPeriod[] = [
  {
    id: "night",
    time: "00:00",
    weather: "Cool night · steady wind",
    demandMwh: 6,
    solarMwh: 0,
    windMwh: 4,
    gridPrice: 45,
    gridCarbonKgPerMwh: 460,
    gridOnline: true,
  },
  {
    id: "dawn",
    time: "04:00",
    weather: "Cloudy dawn · light wind",
    demandMwh: 9,
    solarMwh: 2,
    windMwh: 3,
    gridPrice: 55,
    gridCarbonKgPerMwh: 400,
    gridOnline: true,
  },
  {
    id: "morning",
    time: "08:00",
    weather: "Clear sky · fresh breeze",
    demandMwh: 12,
    solarMwh: 14,
    windMwh: 5,
    gridPrice: 75,
    gridCarbonKgPerMwh: 320,
    gridOnline: true,
  },
  {
    id: "noon",
    time: "12:00",
    weather: "Sunny afternoon",
    demandMwh: 14,
    solarMwh: 16,
    windMwh: 4,
    gridPrice: 100,
    gridCarbonKgPerMwh: 300,
    gridOnline: true,
  },
  {
    id: "evening",
    time: "16:00",
    weather: "Storm front · grid outage",
    demandMwh: 18,
    solarMwh: 2,
    windMwh: 3,
    gridPrice: 180,
    gridCarbonKgPerMwh: 500,
    gridOnline: false,
  },
  {
    id: "late",
    time: "20:00",
    weather: "Nightfall · grid restored",
    demandMwh: 11,
    solarMwh: 0,
    windMwh: 4,
    gridPrice: 110,
    gridCarbonKgPerMwh: 480,
    gridOnline: true,
  },
];

export const microgridDayScenarios = [
  {
    id: "storm-day",
    name: "Storm at the evening peak",
    description: "A four-hour grid outage arrives as solar falls and demand peaks.",
    periods,
  },
  {
    id: "clear-day",
    name: "Clear day, grid available",
    description: "The same public demand and price profile with the evening grid available.",
    periods: periods.map((period) =>
      period.id === "evening"
        ? { ...period, gridOnline: true, weather: "Cloudy evening · grid online" }
        : { ...period },
    ),
  },
] as const;
export type MicrogridDayScenarioId = (typeof microgridDayScenarios)[number]["id"];

export const microgridDayRules = {
  periodHours: 4,
  energyUnit: "integer-kWh",
  batteryCapacityMwh: 20,
  initialSocMwh: 6,
  maxChargeInputMwhPerPeriod: 8,
  maxDischargeOutputMwhPerPeriod: 8,
  chargeEfficiencyPercent: 90,
  dischargeEfficiencyPercent: 90,
  solarCostPerMwh: 20,
  windCostPerMwh: 25,
  initialBatteryCostPerMwh: 50,
  initialBatteryCarbonKgPerMwh: 350,
  endSocCredit: 0,
  dispatch:
    "Renewables serve load first; surplus charges storage; battery serves shortage when grid is offline, price reaches threshold, or grid cap cannot serve load. Online reserve is released during outages. Grid serves remaining load then charges storage below the charge threshold. No simultaneous charge/discharge or export.",
  rounding:
    "Charge stored kWh rounds down; charge input to fit capacity rounds down; discharge withdrawal kWh rounds up. Conversion/rounding losses remain in the energy balance. Costs and carbon round to 0.001 at each period.",
  constraints:
    "Strict policy keys/version; integer reserve 0..100, discharge price 0..250, charge price 0..120, grid cap 0..20 MWh per period. Charge threshold must be below discharge threshold. Valid physical dispatch is required; unmet demand remains an independent outcome.",
} as const;

export const microgridDayMetrics = [
  { key: "costUsd", name: "Energy cost", direction: "MINIMIZE", unit: "USD" },
  { key: "unservedMwh", name: "Unserved energy", direction: "MINIMIZE", unit: "MWh" },
  { key: "carbonKg", name: "Operational carbon", direction: "MINIMIZE", unit: "kgCO₂" },
] as const;

export const microgridDayPresets: readonly {
  id: string;
  name: string;
  description: string;
  policy: MicrogridPolicy;
}[] = [
  {
    id: "balanced",
    name: "Hold a reserve",
    description: "Keep half the battery for shortages; release it during an outage.",
    policy: {
      version: "microgrid-policy-v1",
      reservePercent: 50,
      dischargePrice: 100,
      chargeBelowPrice: 0,
      maxGridMwh: 12,
    },
  },
  {
    id: "price",
    name: "Shift cheap energy",
    description: "Buy extra at low prices and discharge at the evening peak; imports add carbon.",
    policy: {
      version: "microgrid-policy-v1",
      reservePercent: 10,
      dischargePrice: 90,
      chargeBelowPrice: 55,
      maxGridMwh: 12,
    },
  },
  {
    id: "renewable",
    name: "Limit grid imports",
    description: "Use stored renewables first, with a tight grid cap; shortage can rise.",
    policy: {
      version: "microgrid-policy-v1",
      reservePercent: 0,
      dischargePrice: 30,
      chargeBelowPrice: 0,
      maxGridMwh: 2,
    },
  },
];

export type MicrogridDayStep = {
  period: MicrogridPeriod;
  socStartMwh: number;
  socEndMwh: number;
  renewableToLoadMwh: number;
  renewableToBatteryMwh: number;
  gridToLoadMwh: number;
  gridToBatteryMwh: number;
  batteryToLoadMwh: number;
  batteryWithdrawalMwh: number;
  batteryStoredMwh: number;
  curtailedMwh: number;
  lossMwh: number;
  servedMwh: number;
  unservedMwh: number;
  costUsd: number;
  carbonKg: number;
  reasons: string[];
};
export type MicrogridDayResult = {
  simulatorVersion: typeof microgridDayVersion;
  state: "simulated";
  scenarioId: MicrogridDayScenarioId;
  contextHash: Hex;
  policyHash: Hex;
  policy: MicrogridPolicy;
  steps: MicrogridDayStep[];
  totals: { costUsd: number; unservedMwh: number; carbonKg: number; endSocMwh: number };
  resultHash: Hex;
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  if (typeof value === "number" && !Number.isFinite(value))
    throw new Error("Non-finite evidence value");
  const json = JSON.stringify(value);
  if (json === undefined) throw new Error("Non-JSON evidence value");
  return json;
}
const hash = (value: unknown) => keccak256(stringToHex(canonical(value)));
const round = (value: number) => Math.round(value * 1000) / 1000;

export function parseMicrogridPolicy(input: unknown): MicrogridPolicy {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("A policy object is required.");
  const candidate = input as Record<string, unknown>;
  const ranges = {
    reservePercent: 100,
    dischargePrice: 250,
    chargeBelowPrice: 120,
    maxGridMwh: 20,
  };
  if (candidate.version !== "microgrid-policy-v1") throw new Error("Unsupported policy version.");
  if (Object.keys(candidate).some((key) => key !== "version" && !Object.hasOwn(ranges, key)))
    throw new Error("Unknown policy setting.");
  for (const [key, maximum] of Object.entries(ranges)) {
    if (
      !Object.hasOwn(candidate, key) ||
      typeof candidate[key] !== "number" ||
      !Number.isSafeInteger(candidate[key]) ||
      candidate[key] < 0 ||
      candidate[key] > maximum
    )
      throw new Error(`${key} must be a whole number from 0 to ${maximum}.`);
  }
  if ((candidate.chargeBelowPrice as number) >= (candidate.dischargePrice as number))
    throw new Error("Charge price must be lower than discharge price.");
  return {
    version: "microgrid-policy-v1",
    reservePercent: candidate.reservePercent as number,
    dischargePrice: candidate.dischargePrice as number,
    chargeBelowPrice: candidate.chargeBelowPrice as number,
    maxGridMwh: candidate.maxGridMwh as number,
  };
}

export function microgridDayContext(scenarioId: MicrogridDayScenarioId) {
  const scenario = microgridDayScenarios.find(({ id }) => id === scenarioId);
  if (!scenario) throw new Error("Unknown public day.");
  const context = {
    simulatorVersion: microgridDayVersion,
    scenario,
    rules: microgridDayRules,
    metrics: microgridDayMetrics,
  };
  return { ...context, contextHash: hash(context) };
}

export function simulateMicrogridDay(
  input: unknown,
  scenarioId: MicrogridDayScenarioId = "storm-day",
): MicrogridDayResult {
  const policy = parseMicrogridPolicy(input);
  const context = microgridDayContext(scenarioId);
  const rules = microgridDayRules;
  const capacity = rules.batteryCapacityMwh * 1000;
  const reserve = (capacity * policy.reservePercent) / 100;
  const chargeEfficiency = rules.chargeEfficiencyPercent;
  const dischargeEfficiency = rules.dischargeEfficiencyPercent;
  let soc = rules.initialSocMwh * 1000;
  const steps = context.scenario.periods.map((period): MicrogridDayStep => {
    const start = soc;
    const demand = period.demandMwh * 1000;
    const renewable = (period.solarMwh + period.windMwh) * 1000;
    const renewableLoad = Math.min(demand, renewable);
    const renewableCharge = Math.min(
      renewable - renewableLoad,
      rules.maxChargeInputMwhPerPeriod * 1000,
      Math.floor(((capacity - soc) * 100) / chargeEfficiency),
    );
    const renewableStored = Math.floor((renewableCharge * chargeEfficiency) / 100);
    soc += renewableStored;
    let shortage = demand - renewableLoad;
    const gridLimit = period.gridOnline ? policy.maxGridMwh * 1000 : 0;
    const reasons: string[] = [];
    const batteryAllowed =
      !period.gridOnline || period.gridPrice >= policy.dischargePrice || shortage > gridLimit;
    const availableSoc = Math.max(0, soc - (period.gridOnline ? reserve : 0));
    const batteryLoad =
      batteryAllowed && renewableCharge === 0
        ? Math.min(
            shortage,
            rules.maxDischargeOutputMwhPerPeriod * 1000,
            Math.floor((availableSoc * dischargeEfficiency) / 100),
          )
        : 0;
    const withdrawn = Math.ceil((batteryLoad * 100) / dischargeEfficiency);
    soc -= withdrawn;
    shortage -= batteryLoad;
    const gridLoad = Math.min(shortage, gridLimit);
    shortage -= gridLoad;
    const gridCharge =
      period.gridOnline && batteryLoad === 0 && period.gridPrice <= policy.chargeBelowPrice
        ? Math.min(
            gridLimit - gridLoad,
            rules.maxChargeInputMwhPerPeriod * 1000 - renewableCharge,
            Math.floor(((capacity - soc) * 100) / chargeEfficiency),
          )
        : 0;
    const gridStored = Math.floor((gridCharge * chargeEfficiency) / 100);
    soc += gridStored;
    if (renewableLoad > 0) reasons.push("Renewables serve demand first.");
    if (renewableCharge > 0) reasons.push("Surplus renewables charge the battery.");
    if (!period.gridOnline)
      reasons.push("The grid is offline; the normal battery reserve is released.");
    if (batteryLoad > 0)
      reasons.push(
        !period.gridOnline
          ? "Battery supports the outage, limited to 8 MWh output per period."
          : period.gridPrice >= policy.dischargePrice
            ? "Grid price reaches the discharge threshold."
            : "Battery helps because demand exceeds the grid import cap.",
      );
    if (gridCharge > 0)
      reasons.push(
        "Grid price meets the cheap-charge rule; remaining import capacity charges storage.",
      );
    if (period.gridOnline && shortage > 0 && soc <= reserve)
      reasons.push("The online reserve prevents further battery discharge.");
    if (shortage > 0)
      reasons.push("Remaining demand is unserved; it is counted separately from cost and carbon.");
    return {
      period: { ...period },
      socStartMwh: start / 1000,
      socEndMwh: soc / 1000,
      renewableToLoadMwh: renewableLoad / 1000,
      renewableToBatteryMwh: renewableCharge / 1000,
      gridToLoadMwh: gridLoad / 1000,
      gridToBatteryMwh: gridCharge / 1000,
      batteryToLoadMwh: batteryLoad / 1000,
      batteryWithdrawalMwh: withdrawn / 1000,
      batteryStoredMwh: (renewableStored + gridStored) / 1000,
      curtailedMwh: (renewable - renewableLoad - renewableCharge) / 1000,
      lossMwh:
        (renewableCharge + gridCharge - renewableStored - gridStored + withdrawn - batteryLoad) /
        1000,
      servedMwh: (demand - shortage) / 1000,
      unservedMwh: shortage / 1000,
      costUsd: round(
        ((gridLoad + gridCharge) / 1000) * period.gridPrice +
          period.solarMwh * rules.solarCostPerMwh +
          period.windMwh * rules.windCostPerMwh,
      ),
      carbonKg: round(((gridLoad + gridCharge) / 1000) * period.gridCarbonKgPerMwh),
      reasons,
    };
  });
  const result = {
    simulatorVersion: microgridDayVersion,
    state: "simulated" as const,
    scenarioId,
    contextHash: context.contextHash,
    policyHash: hash(policy),
    policy,
    steps,
    totals: {
      costUsd: round(
        steps.reduce(
          (total, step) => total + step.costUsd,
          rules.initialSocMwh * rules.initialBatteryCostPerMwh,
        ),
      ),
      unservedMwh: round(steps.reduce((total, step) => total + step.unservedMwh, 0)),
      carbonKg: round(
        steps.reduce(
          (total, step) => total + step.carbonKg,
          rules.initialSocMwh * rules.initialBatteryCarbonKgPerMwh,
        ),
      ),
      endSocMwh: soc / 1000,
    },
  };
  return { ...result, resultHash: hash(result) };
}

export function verifyMicrogridReplay(input: unknown): boolean {
  try {
    if (!input || typeof input !== "object") return false;
    const replay = input as MicrogridDayResult;
    return canonical(simulateMicrogridDay(replay.policy, replay.scenarioId)) === canonical(input);
  } catch {
    return false;
  }
}

export function compareMicrogridDays(candidate: MicrogridDayResult, reference: MicrogridDayResult) {
  if (!verifyMicrogridReplay(candidate) || !verifyMicrogridReplay(reference))
    throw new Error("Comparison requires verified replay results.");
  if (
    candidate.contextHash !== reference.contextHash ||
    candidate.simulatorVersion !== reference.simulatorVersion
  )
    throw new Error("Only results with the same simulator and context can be compared.");
  const deltas = {
    costUsd: round(candidate.totals.costUsd - reference.totals.costUsd),
    unservedMwh: round(candidate.totals.unservedMwh - reference.totals.unservedMwh),
    carbonKg: round(candidate.totals.carbonKg - reference.totals.carbonKg),
  };
  const values = Object.values(deltas);
  const relation = values.every((value) => value === 0)
    ? "equal"
    : values.every((value) => value <= 0)
      ? "dominates"
      : values.every((value) => value >= 0)
        ? "dominated"
        : "tradeoff";
  return { deltas, relation } as const;
}

export function microgridDayFrontier(
  entries: readonly { id: string; result: MicrogridDayResult }[],
): string[] {
  if (new Set(entries.map(({ id }) => id)).size !== entries.length)
    throw new Error("Comparison IDs must be unique.");
  const first = entries[0];
  if (first) entries.forEach(({ result }) => compareMicrogridDays(result, first.result));
  return entries
    .filter(
      (entry) =>
        !entries.some(
          (other) =>
            other.id !== entry.id &&
            compareMicrogridDays(other.result, entry.result).relation === "dominates",
        ),
    )
    .map(({ id }) => id)
    .sort();
}
