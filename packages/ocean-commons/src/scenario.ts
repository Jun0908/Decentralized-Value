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
  /** The true length. Never shown to an agent unless the window pins it. */
  rounds: number;
  /**
   * What agents are told about the end. A pinned scenario sets both bounds to
   * the same number, so a fixture or a criteria run stays fully knowable.
   */
  seasonWindow: { min: number; max: number };
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
  /** Fuel burned per unit of effort, drawn from the season budget. */
  fuelPerEffort: number;
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
    travelFuel: 6,
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
    travelFuel: 22,
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
    travelFuel: 11,
    catchEfficiency: 2,
    stormExposure: 0.2,
    reserve: true,
  },
] as const;

/**
 * Five boats with deliberately unequal balance sheets. Two small boats exist
 * so that "the fleet survived" and "I survived" can diverge.
 *
 * `effortCapacity` is what a hull can work in one round; `fuelBudget` is what
 * it can work all season. The second is the one that binds, and that is the
 * whole point. When the only limit was per-round capacity, each round stood
 * alone and "go as hard as you can" answered every one of them — which is why
 * all three axes came out monotone in effort and a grid sweep beat a language
 * model (Plan 10 §50). A budget spent across a season of unknown length has an
 * interior optimum by construction.
 *
 * Roughly four rounds at full effort, against a season of seven to ten. Nobody
 * can fish every round flat out, so every entrant must decide which rounds
 * matter — before knowing how many there will be.
 */
export const baseBoats: readonly Boat[] = [
  {
    id: "kaiyo",
    name: "Kaiyo",
    startingCash: 500,
    effortCapacity: 108,
    fuelBudget: 430,
    upkeepPerRound: 12,
    stormLimit: 0.72,
    smallFleet: false,
  },
  {
    id: "hokuto",
    name: "Hokuto",
    startingCash: 520,
    effortCapacity: 132,
    fuelBudget: 520,
    upkeepPerRound: 16,
    stormLimit: 0.85,
    smallFleet: false,
  },
  {
    id: "isana",
    name: "Isana",
    startingCash: 480,
    effortCapacity: 108,
    fuelBudget: 430,
    upkeepPerRound: 12,
    stormLimit: 0.72,
    smallFleet: false,
  },
  {
    id: "nagi",
    name: "Nagi",
    startingCash: 300,
    effortCapacity: 72,
    fuelBudget: 300,
    upkeepPerRound: 8,
    stormLimit: 0.34,
    smallFleet: true,
  },
  {
    id: "shiosai",
    name: "Shiosai",
    startingCash: 250,
    effortCapacity: 60,
    fuelBudget: 250,
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
 *
 * Somewhere in the middle of every season sits a run of consecutive gales — a
 * storm season. Independent per-round draws gave a fleet that drifted between
 * grounds with nothing ever at stake.
 *
 * A gale is pitched hard enough to shut the offshore bank for every hull in the
 * fleet, not just the small ones: at 0.9 severity against 0.95 exposure the
 * product clears even the sturdiest boat's limit. That leaves the sheltered
 * inshore ground and the reserve, so the whole fleet arrives in the same water
 * at the same time — and the reserve becomes most tempting exactly when the
 * pressure on everything else is highest. That is when the commons binds and a
 * contract is worth signing. The run's position and length come from the seed,
 * so it replays like everything else.
 */
export function generateWeather(seed: string, rounds: number, boatIds: readonly string[]): RoundWeather[] {
  const rng = createRng(`${seed}:weather`);
  const galeLength = rounds >= 8 ? rngInt(rng, 2, 3) : 2;
  const galeStart = rngInt(rng, Math.max(2, Math.floor(rounds * 0.3)), Math.max(3, rounds - galeLength - 1));

  const weather: RoundWeather[] = [];
  for (let round = 1; round <= rounds; round += 1) {
    const inGale = round >= galeStart && round < galeStart + galeLength;
    // Most rounds are calm; roughly one in six turns into a real storm.
    const roll = rng();
    const stormSeverity = inGale
      ? stable(0.9 + rng() * 0.1)
      : roll > 0.83
        ? stable(0.55 + rng() * 0.45)
        : stable(roll * 0.35);
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
  /**
   * Exact season length. Omit it and the length is drawn from the seed inside
   * `SEASON_WINDOW` — see `generateScenario`.
   */
  rounds?: number;
  /** Randomises zone and fleet parameters so practice cannot memorise one map. */
  vary?: boolean;
};

/**
 * How long a season can run when its length is not pinned.
 *
 * A boat that knows the season ends this round has no reason to leave anything
 * in the water, and a counterparty holding an almost-empty escrow has no reason
 * to keep its word. Both were observed in live matches: the last round was a
 * free-for-all every time. Agents are told the window, never the draw, so the
 * end has to be played around rather than played to.
 */
export const SEASON_WINDOW = { min: 7, max: 10 } as const;

export function generateScenario(seed: string, options: ScenarioOptions = {}): OceanScenario {
  const lengthRng = createRng(`${seed}:length`);
  const rounds = options.rounds ?? rngInt(lengthRng, SEASON_WINDOW.min, SEASON_WINDOW.max);
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
      // The season's fuel varies with the boat, so the same policy meets a
      // different allocation problem on every seed.
      fuelBudget: Math.max(40, Math.round(boat.fuelBudget * (0.85 + rng() * 0.3))),
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
    seasonWindow:
      options.rounds === undefined
        ? { min: SEASON_WINDOW.min, max: SEASON_WINDOW.max }
        : { min: options.rounds, max: options.rounds },
    zones,
    boats,
    weather: generateWeather(seed, rounds, boats.map((boat) => boat.id)),
    price,
    spilloverRate: 0.05,
    reserveFinePerEffort: 3,
    effortCostPerUnit: 1.6,
  fuelPerEffort: 1,
    repairCost: 70,
    repairRounds: 1,
  };
}
