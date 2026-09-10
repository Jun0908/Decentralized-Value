import { effortForCatch, tooRough, yieldPerEffort } from "./engine";
import { capInForce, closedZones, standDownRequired } from "./negotiation";
import type { OceanScenario } from "./scenario";
import type {
  Boat,
  BoatId,
  BoatState,
  FishingAction,
  OceanState,
  PactKind,
  Proposal,
  ProposalResponse,
  RoundRecord,
  RoundWeather,
  Zone,
} from "./types";

/**
 * What an agent is allowed to see, and what it is allowed to spend.
 *
 * The wallet policy is the user-facing control surface: a user sets a mission
 * and a budget, never a per-round catch number. Limits are enforced by the
 * match loop, so an agent cannot exceed them however it reasons.
 */

export type WalletPolicy = {
  startingBudget: number;
  maxPaymentPerTransaction: number;
  maxAutonomousSpendPerMatch: number;
  allowedPurposes: PactKind[];
  /** Transfers with no contract attached are never permitted. */
  allowArbitraryTransfer: false;
};

export const defaultWalletPolicy: WalletPolicy = {
  startingBudget: 500,
  maxPaymentPerTransaction: 150,
  maxAutonomousSpendPerMatch: 600,
  allowedPurposes: ["CATCH_LIMIT", "CONSERVATION_BUYOUT", "MUTUAL_AID", "CONSERVATION_FUND"],
  allowArbitraryTransfer: false,
};

export type PublicBoatView = {
  id: BoatId;
  name: string;
  active: boolean;
  underRepair: boolean;
  /** Landings in the previous round — reputation is built from behaviour. */
  lastCatch: number;
  /** Where they fished last round. Raids on the reserve are visible to all. */
  lastZoneId: string | null;
  totalCatch: number;
  breaches: number;
  smallFleet: boolean;
};

export type Observation = {
  round: number;
  roundsRemaining: number;
  /** This round's weather is forecast before acting, so compliance is never a gamble. */
  weather: RoundWeather;
  price: number;
  zones: readonly Zone[];
  stocks: Record<string, number>;
  self: Boat & BoatState;
  wallet: { policy: WalletPolicy; spentThisMatch: number; remaining: number };
  others: PublicBoatView[];
  activePacts: OceanState["pacts"];
  fund: OceanState["fund"];
  conservationFund: OceanState["conservationFund"];
  incomingProposals: Proposal[];
  history: readonly RoundRecord[];
};

export type NegotiationOutput = {
  proposals: Proposal[];
  responses: ProposalResponse[];
};

/**
 * The agent interface. An LLM-backed agent and a scripted baseline implement
 * the same two methods, so they are directly comparable in one match.
 */
export type OceanAgent = {
  id: BoatId;
  name: string;
  /** Called before acting: answer offers, and optionally make your own. */
  negotiate(observation: Observation): NegotiationOutput;
  /** Called after negotiation: where to fish and how hard. */
  act(observation: Observation): FishingAction;
};

// --- shared helpers -------------------------------------------------------

/** Expected landings if this boat fishes `zone` at `effort` this round. */
export function expectedCatch(
  zone: Zone,
  stock: number,
  weather: RoundWeather,
  effort: number,
): number {
  return yieldPerEffort(zone, stock, weather) * effort;
}

/** Expected profit, net of travel, fuel, upkeep and any reserve fine. */
export function expectedProfit(
  zone: Zone,
  stock: number,
  weather: RoundWeather,
  effort: number,
  price: number,
  boat: Boat,
  scenario: OceanScenario,
): number {
  if (effort <= 0) return -boat.upkeepPerRound;
  const revenue = expectedCatch(zone, stock, weather, effort) * price;
  const fine = zone.reserve ? effort * scenario.reserveFinePerEffort : 0;
  const costs =
    boat.upkeepPerRound + zone.travelCost + effort * scenario.effortCostPerUnit + fine;
  return revenue - costs;
}

/** Stock level that maximises regrowth — fishing the surplus is sustainable. */
export function sustainableYield(zone: Zone, stock: number): number {
  return Math.max(0, zone.growthRate * stock * (1 - stock / zone.carryingCapacity));
}

type ZoneChoice = { zone: Zone; effort: number; profit: number };

function bestZone(
  observation: Observation,
  scenario: OceanScenario,
  options: { allowReserve: boolean; effortCap?: number; catchCap?: number },
): ZoneChoice | null {
  const shim = observationStateShim(observation);
  // A boat that sold its catch rights stays in port; there is no best ground.
  if (standDownRequired(shim, observation.self.id)) return null;
  const closed = closedZones(shim, observation.self.id);
  let best: ZoneChoice | null = null;

  for (const zone of observation.zones) {
    if (zone.reserve && !options.allowReserve) continue;
    if (closed.has(zone.id)) continue;
    if (tooRough(zone, observation.weather, observation.self)) continue;
    const stock = observation.stocks[zone.id] ?? 0;
    const cap = capInForce(observationStateShim(observation), observation.self.id, zone.id);
    let effort = Math.min(observation.self.effortCapacity, options.effortCap ?? Infinity);

    // Respect a cap by choosing the exact effort that lands it.
    const binding = [cap, options.catchCap].filter((value): value is number => value !== null && value !== undefined);
    if (binding.length > 0) {
      const target = Math.min(...binding);
      effort = Math.min(effort, effortForCatch(zone, stock, observation.weather, target));
    }
    effort = Math.max(0, Math.floor(effort * 100) / 100);
    if (effort <= 0) continue;

    const profit = expectedProfit(
      zone,
      stock,
      observation.weather,
      effort,
      observation.price,
      observation.self,
      scenario,
    );
    if (!best || profit > best.profit) best = { zone, effort, profit };
  }
  return best;
}

/** Minimal state view so shared pact helpers work against an Observation. */
function observationStateShim(observation: Observation): OceanState {
  return {
    round: observation.round,
    stocks: observation.stocks,
    boats: {},
    pacts: observation.activePacts,
    fund: observation.fund,
    conservationFund: observation.conservationFund,
    price: observation.price,
  };
}

function idle(observation: Observation): FishingAction {
  return { boatId: observation.self.id, zoneId: observation.zones[0]!.id, effort: 0 };
}

function proposalId(observation: Observation, tag: string): string {
  return `${observation.self.id}-${tag}-r${observation.round}`;
}

/** Total stock across every zone, the headline signal of commons health. */
export function totalStock(observation: Observation): number {
  return Object.values(observation.stocks).reduce((sum, value) => sum + value, 0);
}

/** Combined carrying capacity, the denominator for commons health. */
export function totalCapacity(observation: Observation): number {
  return observation.zones.reduce((sum, zone) => sum + zone.carryingCapacity, 0);
}

/**
 * What it should cost to keep another boat in port for `rounds`.
 *
 * Nobody can see a rival's books, so the estimate is built from what is
 * public: last round's landings valued at the current price, less a rough
 * operating margin. The offer clears that by a small head — enough to be
 * worth taking, not so much that breaking the deal stops being a real choice.
 * Escrow only disciplines behaviour while defection is a close call.
 */
export function priceStandDown(
  observation: Observation,
  target: PublicBoatView,
  rounds: number,
): number {
  const revenuePerRound = target.lastCatch * observation.price;
  const OPERATING_MARGIN = 0.6;
  const HEAD = 1.1;
  return Math.ceil(revenuePerRound * OPERATING_MARGIN * rounds * HEAD);
}

/**
 * The offer to buy a boat out of the water, or null when no such deal makes
 * sense this round. Shared, because more than one policy reaches for it: a
 * commons is rarely saved by a single buyer.
 */
export function standDownOffer(
  observation: Observation,
  proposerId: BoatId,
  options: {
    priceMultiplier?: number;
    rounds?: number;
    /** Boats already spoken for by an offer made earlier this round. */
    exclude?: readonly BoatId[];
    /** Pool left after those earlier offers, so one round can buy several. */
    budgetOverride?: number;
  } = {},
): Proposal | null {
  const policy = observation.wallet.policy;
  if (!policy.allowedPurposes.includes("CONSERVATION_BUYOUT")) return null;
  if (observation.roundsRemaining < 2) return null;

  // Act while a ground is still falling, not once it is already past the
  // cliff — a stand-down bought after collapse buys nothing back.
  const nearCollapse = observation.zones.some((zone) => {
    const stock = observation.stocks[zone.id] ?? 0;
    return stock < zone.carryingCapacity * (zone.collapseThreshold + 0.55);
  });
  if (!nearCollapse) return null;

  // Spend the pool when there is one. It is deeper than any single wallet, and
  // using it does not force the buyer to wreck its own season to save the sea.
  const pool = observation.conservationFund;
  const inPool = pool?.members.includes(observation.self.id) ?? false;
  // The per-deal ceiling protects members from one reckless commitment early
  // on. Near the end there is no "later" left to protect, and an unspent pool
  // protects no fish either, so the whole balance becomes committable.
  const endgame = observation.roundsRemaining <= 4;
  const budget =
    options.budgetOverride ??
    (inPool && pool
      ? endgame
        ? pool.balance
        : Math.min(pool.standDownCap, pool.balance)
      : Math.min(
          policy.maxPaymentPerTransaction,
          observation.wallet.remaining,
          Math.max(0, observation.self.cash - observation.self.upkeepPerRound * 2),
        ));
  const rounds = Math.min(options.rounds ?? 3, observation.roundsRemaining);
  const multiplier = options.priceMultiplier ?? 1;
  const isBound = (boatId: BoatId) =>
    observation.activePacts.some(
      (pact) => pact.status === "ACTIVE" && pact.counterparties.includes(boatId),
    );

  // Take the heaviest boat that can actually be afforded rather than always
  // bidding for the biggest: the largest extractor is also the dearest to stop.
  const spokenFor = new Set(options.exclude ?? []);
  const affordable = [...observation.others]
    .filter(
      (other) =>
        other.active && !isBound(other.id) && !spokenFor.has(other.id) && other.lastCatch > 0,
    )
    .sort((left, right) => right.lastCatch - left.lastCatch)
    .map((other) => ({
      other,
      price: Math.ceil(priceStandDown(observation, other, rounds) * multiplier),
    }))
    .find((candidate) => candidate.price > 0 && candidate.price <= budget);
  if (!affordable) return null;

  return {
    id: `${proposerId}-standdown-r${observation.round}-${spokenFor.size}`,
    round: observation.round,
    proposer: proposerId,
    counterparties: [affordable.other.id],
    terms: { kind: "CONSERVATION_BUYOUT", zoneId: null },
    payment: affordable.price,
    durationRounds: rounds,
    reasonCode: "NEAR_COLLAPSE",
    fundedBy: inPool ? "CONSERVATION_FUND" : "SELF",
  };
}

// --- baseline policies ----------------------------------------------------

/**
 * Maximum extraction, always. The reference for "what happens with no
 * cooperation at all", and the pressure that makes pacts worth buying.
 */
export function greedyAgent(id: BoatId, name: string, scenario: OceanScenario): OceanAgent {
  return {
    id,
    name,
    negotiate(observation) {
      // Accepts payment only when it beats the profit it would give up.
      const responses: ProposalResponse[] = observation.incomingProposals.map((proposal) => {
        if (proposal.terms.kind === "MUTUAL_AID") {
          return { type: "REJECT", proposalId: proposal.id, reasonCode: "NO_POOLING" };
        }
        const share = proposal.payment / Math.max(1, proposal.counterparties.length);
        const free = bestZone(observation, scenario, { allowReserve: true });
        const forgone = Math.max(0, (free?.profit ?? 0) * proposal.durationRounds);
        return share >= forgone
          ? { type: "ACCEPT", proposalId: proposal.id }
          : { type: "REJECT", proposalId: proposal.id, reasonCode: "PRICE_TOO_LOW" };
      });
      return { proposals: [], responses };
    },
    act(observation) {
      const choice = bestZone(observation, scenario, { allowReserve: true });
      if (!choice || choice.profit <= 0) {
        const fallback = bestZone(observation, scenario, { allowReserve: false });
        if (!fallback) return idle(observation);
        return { boatId: id, zoneId: fallback.zone.id, effort: fallback.effort };
      }
      return { boatId: id, zoneId: choice.zone.id, effort: choice.effort };
    },
  };
}

/**
 * Fishes only the surplus its own share of the stock can regrow, and stays out
 * of the reserve. Sustainable alone, but defenceless against a race.
 */
export function cautiousAgent(id: BoatId, name: string, scenario: OceanScenario): OceanAgent {
  return {
    id,
    name,
    negotiate(observation) {
      const responses: ProposalResponse[] = observation.incomingProposals.map((proposal) => {
        if (proposal.terms.kind === "CATCH_LIMIT" || proposal.terms.kind === "CONSERVATION_BUYOUT") {
          return { type: "ACCEPT", proposalId: proposal.id };
        }
        return { type: "ACCEPT", proposalId: proposal.id };
      });
      return { proposals: [], responses };
    },
    act(observation) {
      const fleet = observation.others.filter((other) => other.active).length + 1;
      const choice = bestZone(observation, scenario, {
        allowReserve: false,
        catchCap: Math.max(
          1,
          observation.zones
            .filter((zone) => !zone.reserve)
            .reduce((sum, zone) => sum + sustainableYield(zone, observation.stocks[zone.id] ?? 0), 0) /
            fleet,
        ),
      });
      if (!choice) return idle(observation);
      return { boatId: id, zoneId: choice.zone.id, effort: choice.effort };
    },
  };
}

/**
 * Buys restraint when the commons starts sliding. This is the agent that makes
 * the escrow machinery matter: it spends real money on other boats' behaviour.
 */
export type BrokerOptions = {
  /**
   * Scales every offer the broker makes. Phase 0 uses it to vary how thick the
   * escrow behind a deal is while holding everything else fixed, which is the
   * only way to ask whether the size of the stake changes who defects.
   */
  priceMultiplier?: number;
};

export function brokerAgent(
  id: BoatId,
  name: string,
  scenario: OceanScenario,
  options: BrokerOptions = {},
): OceanAgent {
  const priceMultiplier = options.priceMultiplier ?? 1;
  return {
    id,
    name,
    negotiate(observation) {
      const responses: ProposalResponse[] = observation.incomingProposals.map((proposal) => ({
        type: "ACCEPT" as const,
        proposalId: proposal.id,
      }));

      const proposals: Proposal[] = [];
      const policyCap = observation.wallet.policy.maxPaymentPerTransaction;
      const budget = Math.min(
        policyCap,
        observation.wallet.remaining,
        Math.max(0, observation.self.cash - observation.self.upkeepPerRound * 2),
      );

      // Scarcity shows up zone by zone long before the whole sea looks empty,
      // so watch the worst ground rather than the fleet-wide average.
      const pressure = Math.min(
        ...observation.zones.map(
          (zone) => (observation.stocks[zone.id] ?? 0) / zone.carryingCapacity,
        ),
      );

      const bound = (boatId: BoatId) =>
        observation.activePacts.some(
          (pact) => pact.status === "ACTIVE" && pact.counterparties.includes(boatId),
        );
      const reserve = observation.zones.find((zone) => zone.reserve);

      // Open the pool early, while every boat still has cash to subscribe and
      // enough rounds remain for the subscriptions to add up to something.
      if (
        !observation.conservationFund &&
        observation.round <= 3 &&
        observation.roundsRemaining >= 6 &&
        observation.wallet.policy.allowedPurposes.includes("CONSERVATION_FUND")
      ) {
        proposals.push({
          id: proposalId(observation, "fund"),
          round: observation.round,
          proposer: id,
          counterparties: observation.others
            .filter((other) => other.active)
            .map((other) => other.id),
          terms: {
            kind: "CONSERVATION_FUND",
            contributionPerRound: 28,
            standDownCap: Math.round(policyCap * 2.5),
          },
          payment: 0,
          durationRounds: observation.roundsRemaining,
          reasonCode: "POOL_RESTRAINT",
        });
      }

      // Idle as many boats as the pool can carry this round. Money that sits
      // in the fund protects nothing: measured over 200 seeds, a single offer
      // per round left 46% of the pool unspent at the final whistle.
      const pool = observation.conservationFund;
      const pooled = pool?.members.includes(id) ?? false;
      let purse = pooled && pool
        ? observation.roundsRemaining <= 4
          ? pool.balance
          : Math.min(pool.standDownCap, pool.balance)
        : budget;
      const spokenFor: BoatId[] = [];

      for (let slot = 0; slot < 3; slot += 1) {
        const offer = standDownOffer(observation, id, {
          priceMultiplier,
          exclude: spokenFor,
          budgetOverride: purse,
        });
        if (!offer) break;
        proposals.push(offer);
        spokenFor.push(...offer.counterparties);
        purse = Math.max(0, purse - offer.payment);
        if (!pooled) break;
      }

      const boughtStandDown = spokenFor.length > 0;

      if (!boughtStandDown && pressure < 0.7 && budget >= 10 && observation.roundsRemaining >= 3) {
        // Otherwise fall back to capping whoever is landing the most.
        const target = [...observation.others]
          .filter((other) => other.active && other.breaches === 0 && !bound(other.id))
          .sort((left, right) => right.lastCatch - left.lastCatch)[0];
        if (target && target.lastCatch > 0) {
          proposals.push({
            id: proposalId(observation, "cap"),
            round: observation.round,
            proposer: id,
            counterparties: [target.id],
            terms: {
              kind: "CATCH_LIMIT",
              capPerRound: Math.max(4, target.lastCatch * 0.5),
              zoneId: null,
            },
            payment: Math.floor(budget),
            durationRounds: Math.min(2, observation.roundsRemaining),
            reasonCode: "STOCK_DECLINE",
          });
        }
      }
      return { proposals, responses };
    },
    act(observation) {
      const choice = bestZone(observation, scenario, { allowReserve: false });
      if (!choice) return idle(observation);
      return { boatId: id, zoneId: choice.zone.id, effort: choice.effort };
    },
  };
}

/**
 * Signs pacts, takes the money, and walks away the moment breaking the deal
 * pays better than the escrow it forfeits. Without this agent the contract
 * layer would never be tested.
 */
export function opportunistAgent(id: BoatId, name: string, scenario: OceanScenario): OceanAgent {
  return {
    id,
    name,
    negotiate(observation) {
      const responses: ProposalResponse[] = observation.incomingProposals.map((proposal) => ({
        type: "ACCEPT" as const,
        proposalId: proposal.id,
      }));
      return { proposals: [], responses };
    },
    act(observation) {
      const state = observationStateShim(observation);
      const bound = observation.activePacts.filter(
        (pact) => pact.status === "ACTIVE" && pact.counterparties.includes(id),
      );
      const atStake = bound.reduce((sum, pact) => sum + pact.escrowRemaining, 0);

      const compliant = bestZone(observation, scenario, { allowReserve: false });
      const unconstrained = (() => {
        let best: ZoneChoice | null = null;
        for (const zone of observation.zones) {
          const stock = observation.stocks[zone.id] ?? 0;
          const effort = observation.self.effortCapacity;
          const profit = expectedProfit(
            zone,
            stock,
            observation.weather,
            effort,
            observation.price,
            observation.self,
            scenario,
          );
          if (!best || profit > best.profit) best = { zone, effort, profit };
        }
        return best;
      })();

      // Defect only when the extra profit exceeds the escrow it would lose.
      const gain = (unconstrained?.profit ?? 0) - (compliant?.profit ?? 0);
      const choice = gain > atStake && unconstrained ? unconstrained : compliant;
      void state;
      if (!choice) return idle(observation);
      return { boatId: id, zoneId: choice.zone.id, effort: choice.effort };
    },
  };
}

/** Mirrors the fleet: restrained while others are, hard-fishing once betrayed. */
export function reciprocatorAgent(id: BoatId, name: string, scenario: OceanScenario): OceanAgent {
  return {
    id,
    name,
    negotiate(observation) {
      const responses: ProposalResponse[] = observation.incomingProposals.map((proposal) => {
        const proposer = observation.others.find((other) => other.id === proposal.proposer);
        if (proposer && proposer.breaches > 0) {
          return { type: "REJECT" as const, proposalId: proposal.id, reasonCode: "PRIOR_BREACH" };
        }
        return { type: "ACCEPT" as const, proposalId: proposal.id };
      });

      const proposals: Proposal[] = [];
      // Propose a fund once a breakdown has actually been seen in the fleet.
      const sawBreakdown = observation.history.some((record) => record.weather.breakdowns.length > 0);
      if (
        !observation.fund &&
        sawBreakdown &&
        observation.roundsRemaining >= 4 &&
        observation.wallet.policy.allowedPurposes.includes("MUTUAL_AID")
      ) {
        proposals.push({
          id: proposalId(observation, "aid"),
          round: observation.round,
          proposer: id,
          counterparties: observation.others.filter((other) => other.active).map((other) => other.id),
          terms: { kind: "MUTUAL_AID", contributionPerRound: 4, payoutCap: 45 },
          payment: 0,
          durationRounds: observation.roundsRemaining,
          reasonCode: "BREAKDOWN_RISK",
        });
      }

      return { proposals, responses };
    },
    act(observation) {
      const betrayed = observation.others.some((other) => other.breaches > 0);
      const fleet = observation.others.filter((other) => other.active).length + 1;
      const budget = betrayed
        ? Number.POSITIVE_INFINITY
        : Math.max(
            1,
            observation.zones
              .filter((zone) => !zone.reserve)
              .reduce(
                (sum, zone) => sum + sustainableYield(zone, observation.stocks[zone.id] ?? 0),
                0,
              ) / fleet,
          );
      const choice = bestZone(observation, scenario, {
        allowReserve: betrayed,
        catchCap: budget,
      });
      if (!choice) return idle(observation);
      return { boatId: id, zoneId: choice.zone.id, effort: choice.effort };
    },
  };
}

/**
 * Fishes one ground and stays there.
 *
 * Every other baseline computes the same "best zone" from the same public
 * numbers, so the fleet moves as one school: it hammers a ground, moves on,
 * and the ground recovers before anyone comes back. Nothing is ever fished
 * hard enough to fail. A boat with a home ground keeps pressure on one patch,
 * which is what real effort looks like and what a commons needs in order to
 * be at risk at all.
 */
export function territorialAgent(
  id: BoatId,
  name: string,
  scenario: OceanScenario,
  homeZoneId: string,
): OceanAgent {
  return {
    id,
    name,
    negotiate(observation) {
      return {
        proposals: [],
        responses: observation.incomingProposals.map((proposal) => ({
          type: "ACCEPT" as const,
          proposalId: proposal.id,
        })),
      };
    },
    act(observation) {
      const shim = observationStateShim(observation);
      if (standDownRequired(shim, id)) return idle(observation);
      const home = observation.zones.find((zone) => zone.id === homeZoneId);
      const closed = closedZones(shim, id);

      if (home && !closed.has(home.id) && !tooRough(home, observation.weather, observation.self)) {
        const stock = observation.stocks[home.id] ?? 0;
        const cap = capInForce(shim, id, home.id);
        let effort = observation.self.effortCapacity;
        if (cap !== null) {
          effort = Math.min(effort, effortForCatch(home, stock, observation.weather, cap));
        }
        effort = Math.max(0, Math.floor(effort * 100) / 100);
        const profit = expectedProfit(
          home,
          stock,
          observation.weather,
          effort,
          observation.price,
          observation.self,
          scenario,
        );
        // Only abandons the home ground when working it actually loses money.
        if (effort > 0 && profit > 0) return { boatId: id, zoneId: home.id, effort };
      }

      const fallback = bestZone(observation, scenario, { allowReserve: false });
      if (!fallback) return idle(observation);
      return { boatId: id, zoneId: fallback.zone.id, effort: fallback.effort };
    },
  };
}

/**
 * Goes where the rest of the fleet is not.
 *
 * Discounts each ground by how many boats worked it last round, so it peels
 * away from the school rather than joining it. Between this and the
 * territorial policy the fleet stops arriving everywhere at once.
 */
export function crowdAverseAgent(id: BoatId, name: string, scenario: OceanScenario): OceanAgent {
  return {
    id,
    name,
    negotiate(observation) {
      return {
        proposals: [],
        responses: observation.incomingProposals.map((proposal) => ({
          type: "ACCEPT" as const,
          proposalId: proposal.id,
        })),
      };
    },
    act(observation) {
      const shim = observationStateShim(observation);
      if (standDownRequired(shim, id)) return idle(observation);
      const closed = closedZones(shim, id);
      const last = observation.history[observation.history.length - 1];
      const crowd = (zoneId: string) =>
        last?.entries.filter((entry) => entry.zoneId === zoneId && entry.appliedEffort > 0).length ??
        0;

      let best: { zoneId: string; effort: number; score: number } | null = null;
      for (const zone of observation.zones) {
        if (zone.reserve || closed.has(zone.id)) continue;
        if (tooRough(zone, observation.weather, observation.self)) continue;
        const stock = observation.stocks[zone.id] ?? 0;
        const cap = capInForce(shim, id, zone.id);
        let effort = observation.self.effortCapacity;
        if (cap !== null) {
          effort = Math.min(effort, effortForCatch(zone, stock, observation.weather, cap));
        }
        effort = Math.max(0, Math.floor(effort * 100) / 100);
        if (effort <= 0) continue;
        const profit = expectedProfit(
          zone,
          stock,
          observation.weather,
          effort,
          observation.price,
          observation.self,
          scenario,
        );
        const score = profit / (1 + crowd(zone.id));
        if (!best || score > best.score) best = { zoneId: zone.id, effort, score };
      }
      if (!best) return idle(observation);
      return { boatId: id, zoneId: best.zoneId, effort: best.effort };
    },
  };
}
