import { capInForce, settleRound, type ComplianceInput } from "./negotiation";
import { stable } from "./rng";
import type { OceanScenario } from "./scenario";
import type {
  AidPayout,
  Boat,
  BoatRoundEntry,
  BoatState,
  FishingAction,
  OceanState,
  RoundRecord,
  RoundWeather,
  Zone,
  ZoneId,
} from "./types";

/**
 * The sea. No agent ever writes to this state directly — every change comes
 * from `transition`, which is a pure function of
 * `(previous state, actions, scenario)`. Weather is drawn once when the
 * scenario is generated, so a match replays identically from its seed.
 */

export function createInitialState(scenario: OceanScenario): OceanState {
  const stocks: Record<ZoneId, number> = {};
  for (const zone of scenario.zones) stocks[zone.id] = zone.initialStock;

  const boats: Record<string, BoatState> = {};
  for (const boat of scenario.boats) {
    boats[boat.id] = {
      id: boat.id,
      cash: boat.startingCash,
      active: true,
      repairRoundsLeft: 0,
      fuelRemaining: boat.fuelBudget,
      totalCatch: 0,
      totalRevenue: 0,
      totalCosts: 0,
      totalPaidOut: 0,
      totalReceived: 0,
      breaches: 0,
    };
  }

  return {
    round: 1,
    stocks,
    boats,
    pacts: [],
    fund: null,
    conservationFund: null,
    price: scenario.price.basePrice,
  };
}

/**
 * Whether this hull can work this ground today. A big boat rides out weather
 * that drives a small one home, so a storm does not merely reduce the catch —
 * it decides who is allowed at sea at all.
 */
export function tooRough(zone: Zone, weather: RoundWeather, boat: Boat): boolean {
  return zone.stormExposure * weather.stormSeverity > boat.stormLimit;
}

/** How much a storm suppresses fishing in a zone. Never below 10%. */
export function stormFactor(zone: Zone, weather: RoundWeather): number {
  return Math.max(0.1, 1 - zone.stormExposure * weather.stormSeverity);
}

/**
 * Fish landed per unit of effort. Falls as the stock is drawn down, which is
 * what makes over-fishing self-defeating rather than merely impolite.
 */
export function yieldPerEffort(zone: Zone, stock: number, weather: RoundWeather): number {
  const depletion = stock / zone.carryingCapacity;
  return stable(zone.catchEfficiency * depletion * stormFactor(zone, weather));
}

/**
 * Effort needed to land exactly `target` fish. An agent under a catch limit
 * uses this to comply precisely — compliance must never be a lottery.
 */
export function effortForCatch(
  zone: Zone,
  stock: number,
  weather: RoundWeather,
  target: number,
): number {
  const perEffort = yieldPerEffort(zone, stock, weather);
  if (perEffort <= 0) return 0;
  return stable(target / perEffort);
}

function marketPrice(scenario: OceanScenario, totalCatch: number, weather: RoundWeather): number {
  const { basePrice, referenceCatch, elasticity, floorPrice } = scenario.price;
  const glut = totalCatch / referenceCatch;
  const price = basePrice * (1 - elasticity * (glut - 1)) * weather.priceShock;
  return stable(Math.max(floorPrice, price));
}

export type TransitionResult = { state: OceanState; record: RoundRecord };

/**
 * Advances the world one round.
 *
 * Order matters and is fixed: breakdowns land before fishing, catches are
 * shared out of a finite stock, the price responds to total landings, pacts
 * settle against measured catches, and only then does the stock regrow.
 */
export function transition(
  previous: OceanState,
  actions: readonly FishingAction[],
  scenario: OceanScenario,
): TransitionResult {
  const state = structuredClone(previous);
  const weather = scenario.weather[state.round - 1];
  if (!weather) throw new Error(`No weather for round ${state.round}`);

  const zonesById = new Map(scenario.zones.map((zone) => [zone.id, zone]));
  const boatsById = new Map(scenario.boats.map((boat) => [boat.id, boat]));
  const stocksBefore = { ...state.stocks };
  const priceBefore = state.price;

  // 1. Breakdowns strike before anyone leaves port.
  for (const boatId of weather.breakdowns) {
    const boat = state.boats[boatId];
    if (!boat || !boat.active || boat.repairRoundsLeft > 0) continue;
    boat.repairRoundsLeft = scenario.repairRounds;
  }

  // 2. Resolve intended effort into effort the world actually allows.
  type Planned = {
    entry: BoatRoundEntry;
    zone: Zone | null;
  };
  const planned: Planned[] = [];

  for (const boat of scenario.boats) {
    const boatState = state.boats[boat.id]!;
    const action = actions.find((candidate) => candidate.boatId === boat.id);
    const entry: BoatRoundEntry = {
      boatId: boat.id,
      zoneId: null,
      requestedEffort: action?.effort ?? 0,
      appliedEffort: 0,
      capInForce: null,
      catch: 0,
      revenue: 0,
      costs: 0,
      fine: 0,
      cashAfter: boatState.cash,
      breached: false,
      clampReason: null,
      fuelBurned: 0,
      fuelAfter: boatState.fuelRemaining,
    };

    if (!boatState.active) {
      entry.clampReason = "BANKRUPT";
      planned.push({ entry, zone: null });
      continue;
    }
    if (boatState.repairRoundsLeft > 0) {
      entry.clampReason = "UNDER_REPAIR";
      planned.push({ entry, zone: null });
      continue;
    }
    if (!action || action.effort <= 0) {
      entry.clampReason = action ? null : "NO_ACTION";
      planned.push({ entry, zone: null });
      continue;
    }

    const zone = zonesById.get(action.zoneId);
    if (!zone) {
      entry.clampReason = "UNKNOWN_ZONE";
      planned.push({ entry, zone: null });
      continue;
    }

    // Weather the hull cannot work keeps it in port, whatever it intended.
    if (tooRough(zone, weather, boat)) {
      entry.clampReason = "TOO_ROUGH";
      planned.push({ entry, zone: null });
      continue;
    }

    // Fuel is a season-long budget. A boat that cannot pay the steam out to a
    // ground never leaves port, however much hull it still has.
    if (boatState.fuelRemaining < zone.travelFuel) {
      entry.clampReason = "OUT_OF_FUEL";
      planned.push({ entry, zone: null });
      continue;
    }

    entry.zoneId = zone.id;
    entry.capInForce = capInForce(state, boat.id, zone.id);
    // Effort above the hull's capacity is simply impossible.
    let effort = Math.min(action.effort, boat.effortCapacity);
    if (effort < action.effort) entry.clampReason = "OVER_CAPACITY";
    // Then by what is left in the tank after the steam out.
    const forEffort = (boatState.fuelRemaining - zone.travelFuel) / scenario.fuelPerEffort;
    if (effort > forEffort) {
      effort = Math.max(0, forEffort);
      entry.clampReason = "FUEL_LIMITED";
    }
    entry.appliedEffort = stable(effort);
    entry.fuelBurned = stable(zone.travelFuel + effort * scenario.fuelPerEffort);
    boatState.fuelRemaining = stable(Math.max(0, boatState.fuelRemaining - entry.fuelBurned));
    entry.fuelAfter = boatState.fuelRemaining;
    planned.push({ entry, zone });
  }

  // 3. Share each zone's finite stock among everyone fishing it.
  for (const zone of scenario.zones) {
    const here = planned.filter((item) => item.zone?.id === zone.id && item.entry.appliedEffort > 0);
    if (here.length === 0) continue;
    const stock = state.stocks[zone.id] ?? 0;
    const perEffort = yieldPerEffort(zone, stock, weather);
    const demanded = here.reduce((sum, item) => sum + item.entry.appliedEffort * perEffort, 0);
    // Never land more fish than the zone holds; scale everyone back equally.
    const scale = demanded > stock && demanded > 0 ? stock / demanded : 1;
    for (const item of here) {
      const landed = stable(item.entry.appliedEffort * perEffort * scale);
      item.entry.catch = landed;
      if (scale < 1) item.entry.clampReason = "STOCK_EXHAUSTED";
    }
    state.stocks[zone.id] = stable(Math.max(0, stock - here.reduce((sum, item) => sum + item.entry.catch, 0)));
  }

  // 4. One market clears for the whole fleet, so a glut hurts every boat.
  const totalCatch = planned.reduce((sum, item) => sum + item.entry.catch, 0);
  const price = marketPrice(scenario, totalCatch, weather);
  state.price = price;

  // 5. Money.
  for (const item of planned) {
    const boat = boatsById.get(item.entry.boatId)!;
    const boatState = state.boats[boat.id]!;
    const zone = item.zone;

    let costs = boat.upkeepPerRound;
    if (zone && item.entry.appliedEffort > 0) {
      costs += zone.travelCost + item.entry.appliedEffort * scenario.effortCostPerUnit;
      if (zone.reserve) {
        item.entry.fine = stable(item.entry.appliedEffort * scenario.reserveFinePerEffort);
        costs += item.entry.fine;
      }
    }
    if (boatState.repairRoundsLeft > 0 && weather.breakdowns.includes(boat.id)) {
      costs += scenario.repairCost;
    }

    const revenue = stable(item.entry.catch * price);
    item.entry.revenue = revenue;
    item.entry.costs = stable(costs);
    boatState.cash = stable(boatState.cash + revenue - costs);
    boatState.totalCatch = stable(boatState.totalCatch + item.entry.catch);
    boatState.totalRevenue = stable(boatState.totalRevenue + revenue);
    boatState.totalCosts = stable(boatState.totalCosts + costs);
  }

  // 6. Mutual aid: members pay in every round, and the fund covers repairs.
  const aidPayouts: AidPayout[] = [];
  if (state.fund) {
    for (const boatId of state.fund.members) {
      const boatState = state.boats[boatId];
      if (!boatState?.active) continue;
      const contribution = Math.min(state.fund.contributionPerRound, Math.max(0, boatState.cash));
      boatState.cash = stable(boatState.cash - contribution);
      state.fund.balance = stable(state.fund.balance + contribution);
    }
    for (const boatId of weather.breakdowns) {
      if (!state.fund.members.includes(boatId)) continue;
      const boatState = state.boats[boatId];
      if (!boatState?.active) continue;
      const payout = stable(Math.min(state.fund.payoutCap, state.fund.balance, scenario.repairCost));
      if (payout <= 0) continue;
      boatState.cash = stable(boatState.cash + payout);
      state.fund.balance = stable(state.fund.balance - payout);
      aidPayouts.push({ to: boatId, amount: payout, reason: "REPAIR" });
    }
  }

  // 6b. Conservation fund members pay their subscription every round. Unlike
  // mutual aid this pool never pays its own members — it buys other boats out
  // of the water, which is why it can act at a scale one wallet cannot.
  //
  // Collection stops before the final rounds. A stand-down needs rounds left to
  // run, so money paid in at the whistle can never be committed to anything —
  // it would only sit in the pool as a dead charge on its members.
  const roundsLeft = scenario.rounds - state.round + 1;
  if (state.conservationFund && roundsLeft > 2) {
    for (const boatId of state.conservationFund.members) {
      const boatState = state.boats[boatId];
      if (!boatState?.active) continue;
      const contribution = Math.min(
        state.conservationFund.contributionPerRound,
        Math.max(0, boatState.cash),
      );
      boatState.cash = stable(boatState.cash - contribution);
      boatState.totalPaidOut = stable(boatState.totalPaidOut + contribution);
      state.conservationFund.balance = stable(state.conservationFund.balance + contribution);
    }
  }

  // 7. Settle contracts against what the engine measured, not what was said.
  const compliance: ComplianceInput[] = planned.map((item) => ({
    boatId: item.entry.boatId,
    zoneId: item.entry.zoneId,
    catch: item.entry.catch,
  }));
  const { releases, breached } = settleRound(state, compliance);
  const breachedSet = new Set<string>();
  for (const pactId of breached) {
    const pact = state.pacts.find((candidate) => candidate.id === pactId);
    for (const boatId of pact?.counterparties ?? []) breachedSet.add(boatId);
  }
  for (const item of planned) {
    if (breachedSet.has(item.entry.boatId)) item.entry.breached = true;
    item.entry.cashAfter = state.boats[item.entry.boatId]!.cash;
  }

  // 8. Regrowth, then spillover out of the reserve into the fished zones.
  //
  // Growth carries a depensation term: below `collapseThreshold` the factor
  // turns negative and the ground keeps falling on its own. A fleet that fishes
  // past that line cannot undo it by stopping, which is exactly why buying
  // restraint before the line is worth more than the restraint costs.
  for (const zone of scenario.zones) {
    const stock = state.stocks[zone.id] ?? 0;
    const critical = zone.carryingCapacity * zone.collapseThreshold;
    const depensation = (stock - critical) / (zone.carryingCapacity - critical);
    const growth = zone.growthRate * stock * (1 - stock / zone.carryingCapacity) * depensation;
    state.stocks[zone.id] = stable(Math.max(0, Math.min(zone.carryingCapacity, stock + growth)));
  }
  const reserves = scenario.zones.filter((zone) => zone.reserve);
  const fished = scenario.zones.filter((zone) => !zone.reserve);
  for (const reserve of reserves) {
    const stock = state.stocks[reserve.id] ?? 0;
    const spill = stable(stock * scenario.spilloverRate);
    if (spill <= 0 || fished.length === 0) continue;
    state.stocks[reserve.id] = stable(stock - spill);
    const share = spill / fished.length;
    for (const zone of fished) {
      state.stocks[zone.id] = stable(
        Math.min(zone.carryingCapacity, (state.stocks[zone.id] ?? 0) + share),
      );
    }
  }

  // 9. A boat that cannot pay its bills stops fishing for good.
  for (const boatState of Object.values(state.boats)) {
    if (boatState.active && boatState.cash < 0) boatState.active = false;
    if (boatState.repairRoundsLeft > 0) boatState.repairRoundsLeft -= 1;
  }

  const record: RoundRecord = {
    round: state.round,
    weather,
    priceBefore,
    priceAfter: price,
    stocksBefore,
    stocksAfter: { ...state.stocks },
    entries: planned.map((item) => item.entry),
    escrowReleases: releases,
    aidPayouts,
    newPacts: [],
    breachedPacts: breached,
  };

  state.round += 1;
  return { state, record };
}
