import { createRng, rngInt, stable } from "./rng";
import type { Boat, RoundWeather, Zone } from "./types";

/**
 * A scenario fixes everything the world needs before any agent acts: the
 * zones, the fleet, the price model, and the complete weather sequence. Once
 * committed, `initial state + weather sequence + agent actions` fully
 * determines the outcome.
 */
export type OceanScenario = {
  arenaId: "ocean-commons-v1";
  scenarioId: string;
  seed: string;
  rounds: number;
  zones: Zone[];
  boats: Boat[];
  weather: RoundWeather[];
  price: PriceModel;
  /** Fish moving out of the reserve into fished zones each round. */
  spilloverRate: number;
  /** Charged per unit of effort applied inside a reserve. */
  reserveFinePerEffort: number;
  /** Fuel and crew cost per unit of effort. */
  effortCostPerUnit: number;
  /** Cost to repair a broken boat, and how long it stays out of action. */
  repairCost: number;
  repairRounds: number;
};

export type PriceModel = {
  basePrice: number;
  /** Reference landings that define a "normal" market. */
  referenceCatch: number;
  /** How hard the price falls as total landings rise. */
  elasticity: number;
  floorPrice: number;
};

/**
 * The base world.
 *
 * The two fished grounds regrow slowly on their own: left to themselves they
 * cannot support the fleet. What actually feeds them is the spillover out of
 * the nursery, so the reserve is the engine of the whole system.
 *
 * The reserve is also, deliberately, the most tempting water in the map — the
 * richest yield, a mild fine, close to port. A boat that raids it profits
 * immediately and quietly destroys everyone's replenishment, including its
 * own. Without that temptation there would be nothing to negotiate about.
 */
export const baseZones: readonly Zone[] = [
  {
    id: "coastal",
    name: "Coastal shelf",
    carryingCapacity: 420,
    growthRate: 0.220,
    collapseThreshold: 0.25,
    initialStock: 380,
    travelCost: 4,
    catchEfficiency: 1.2,
    stormExposure: 0.45,
    reserve: false,
  },
  {
    id: "offshore",
    name: "Offshore bank",
    carryingCapacity: 900,
    growthRate: 0.160,
    collapseThreshold: 0.25,
    initialStock: 820,
    travelCost: 15,
    catchEfficiency: 1.7,
    stormExposure: 0.95,
    reserve: false,
  },
  {
    id: "nursery",
    name: "Nursery reserve",
    carryingCapacity: 520,
    growthRate: 0.5,
    collapseThreshold: 0.3,
    initialStock: 500,
    travelCost: 8,
    catchEfficiency: 2,
    stormExposure: 0.2,
    reserve: true,
  },
] as const;

/**
 * Five boats with deliberately unequal balance sheets. Two small boats exist
 * so that "the fleet survived" and "I survived" can diverge.
 *
 * The hulls carry roughly twice the capacity the sea can support, and that
 * ratio is the single most important number in the whole design. At half this
 * size nothing was ever scarce: grounds recovered between visits, restraint
 * protected nothing, and knowing exactly who you were fishing against was
 * worth under 3%. Doubling it drops coastal stock to 0.56 of capacity at its
 * worst and raises the value of reading your rivals to 16%. Every other
 * problem found in Phase 0 — no depletion, a dead resilience axis, a fleet
 * that moved as one school — traced back to this ratio.
 */
export const baseBoats: readonly Boat[] = [
  {
    id: "kaiyo",
    name: "Kaiyo",
    startingCash: 500,
    effortCapacity: 36,
    upkeepPerRound: 12,
    stormLimit: 0.72,
    smallFleet: false,
  },
  {
    id: "hokuto",
    name: "Hokuto",
    startingCash: 520,
    effortCapacity: 44,
    upkeepPerRound: 16,
    stormLimit: 0.85,
    smallFleet: false,
  },
  {
    id: "isana",
    name: "Isana",
    startingCash: 480,
    effortCapacity: 36,
    upkeepPerRound: 12,
    stormLimit: 0.72,
    smallFleet: false,
  },
  {
    id: "nagi",
    name: "Nagi",
    startingCash: 300,
    effortCapacity: 24,
    upkeepPerRound: 8,
    stormLimit: 0.34,
    smallFleet: true,
  },
  {
    id: "shiosai",
    name: "Shiosai",
    startingCash: 250,
    effortCapacity: 20,
    upkeepPerRound: 7,
    stormLimit: 0.28,
    smallFleet: true,
  },
] as const;

export const basePriceModel: PriceModel = {
  basePrice: 6,
  referenceCatch: 90,
  elasticity: 0.4,
  floorPrice: 1.8,
};

/**
 * Weather is drawn once, up front, from the seed. Drawing it during the match
 * would make the transition function impure and break replay.
 */
export function generateWeather(seed: string, rounds: number, boatIds: readonly string[]): RoundWeather[] {
  const rng = createRng(`${seed}:weather`);
  const weather: RoundWeather[] = [];
  for (let round = 1; round <= rounds; round += 1) {
    // Most rounds are calm; roughly one in six turns into a real storm.
    const roll = rng();
    const stormSeverity = roll > 0.83 ? stable(0.55 + rng() * 0.45) : stable(roll * 0.35);
    const breakdowns: string[] = [];
    for (const boatId of boatIds) {
      // Storms make mechanical failure markedly more likely.
      const risk = 0.04 + stormSeverity * 0.14;
      if (rng() < risk) breakdowns.push(boatId);
    }
    weather.push({
      round,
      stormSeverity,
      breakdowns,
      priceShock: stable(0.85 + rng() * 0.3),
    });
  }
  return weather;
}

export type ScenarioOptions = {
  rounds?: number;
  /** Randomises zone and fleet parameters so practice cannot memorise one map. */
  vary?: boolean;
};

export function generateScenario(seed: string, options: ScenarioOptions = {}): OceanScenario {
  const rounds = options.rounds ?? 12;
  const rng = createRng(`${seed}:world`);

  const zones: Zone[] = baseZones.map((zone) => {
    if (!options.vary) return { ...zone };
    const stockScale = 0.8 + rng() * 0.4;
    const growthScale = 0.85 + rng() * 0.3;
    return {
      ...zone,
      initialStock: Math.round(zone.initialStock * stockScale),
      carryingCapacity: Math.round(zone.carryingCapacity * stockScale),
      growthRate: stable(zone.growthRate * growthScale),
      travelCost: Math.round(zone.travelCost * (0.8 + rng() * 0.5)),
    };
  });

  const boats: Boat[] = baseBoats.map((boat) => {
    if (!options.vary) return { ...boat };
    return {
      ...boat,
      startingCash: Math.round(boat.startingCash * (0.85 + rng() * 0.3)),
      effortCapacity: Math.max(4, boat.effortCapacity + rngInt(rng, -2, 2)),
    };
  });

  const price: PriceModel = options.vary
    ? {
        ...basePriceModel,
        basePrice: stable(basePriceModel.basePrice * (0.85 + rng() * 0.35)),
        elasticity: stable(basePriceModel.elasticity * (0.8 + rng() * 0.5)),
      }
    : { ...basePriceModel };

  return {
    arenaId: "ocean-commons-v1",
    scenarioId: `ocean-${seed}`,
    seed,
    rounds,
    zones,
    boats,
    weather: generateWeather(seed, rounds, boats.map((boat) => boat.id)),
    price,
    spilloverRate: 0.05,
    reserveFinePerEffort: 3,
    effortCostPerUnit: 1.6,
    repairCost: 70,
    repairRounds: 1,
  };
}
