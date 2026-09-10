import { effortForCatch, tooRough, yieldPerEffort } from "./engine";
import { capInForce, closedZones, standDownRequired } from "./negotiation";
import type { OceanScenario } from "./scenario";
import type {
  Boat,
  BoatId,
  BoatRoundMemory,
  BoatState,
  FishingAction,
  OceanState,
  PactKind,
  Proposal,
  ProposalResponse,
  RoundWeather,
  Sounding,
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
  allowedPurposes: [
    "CATCH_LIMIT",
    "CONSERVATION_BUYOUT",
    "MUTUAL_AID",
    "CONSERVATION_FUND",
    "SOUNDING_EXCHANGE",
  ],
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
  /**
   * Rounds this boat is *guaranteed* — the floor of the season window, not the
   * truth. A boat that knew the last round would strip the sea on it, and its
   * counterparty would break a nearly-empty escrow at the same moment; both
   * happened in live matches. Plan for `maxRoundsRemaining`, count on this.
   */
  roundsRemaining: number;
  /** The most that can still be left. Equal to `roundsRemaining` when pinned. */
  maxRoundsRemaining: number;
  /** This round's weather is forecast before acting, so compliance is never a gamble. */
  weather: RoundWeather;
  price: number;
  zones: readonly Zone[];
  /**
   * Everything this boat knows about the state of the sea. A ground with no
   * reading here has not been worked by anyone this boat could watch, and its
   * stock is genuinely unknown — the published biology on `zones` is all there
   * is to go on. Readings go stale; check `round` against the current one.
   */
  soundings: readonly Sounding[];
  self: Boat & BoatState;
  wallet: { policy: WalletPolicy; spentThisMatch: number; remaining: number };
  others: PublicBoatView[];
  activePacts: OceanState["pacts"];
  fund: OceanState["fund"];
  conservationFund: OceanState["conservationFund"];
  incomingProposals: Proposal[];
  /**
   * This boat's own memory of the season. Deliberately not `RoundRecord[]`,
   * which carries `stocksBefore`/`stocksAfter` for every ground and would hand
   * back the whole sea through the back door.
   */
  history: readonly BoatRoundMemory[];
};

export type NegotiationOutput = {
  proposals: Proposal[];
  responses: ProposalResponse[];
};

/**
 * The agent interface. An LLM-backed agent and a scripted baseline implement
 * the same two methods, so they are directly comparable in one match.
 *
 * Both may return a promise. A scripted policy answers immediately and a
 * model-backed one goes over the network, but the match loop awaits either,
 * so the two are interchangeable in the same fleet. The world stays
 * deterministic regardless: the engine only ever sees the actions that came
 * back, and a transcript of those actions replays to the same final state
 * whether a rule or a model produced them.
 */
export type OceanAgent = {
  id: BoatId;
  name: string;
  /** Called before acting: answer offers, and optionally make your own. */
  negotiate(observation: Observation): NegotiationOutput | Promise<NegotiationOutput>;
  /** Called after negotiation: where to fish and how hard. */
  act(observation: Observation): FishingAction | Promise<FishingAction>;
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


/**
 * The best guess this boat can make about a ground right now.
 *
 * A reading is a snapshot of a round that has already passed, and the sea has
 * moved since: it regrew, and anyone who went there took fish out. The boat
 * knows the published biology, so it can carry the reading forward through the
 * growth curve — but it cannot know what was landed after it looked away. That
 * gap is the uncertainty the arena is built on, and it widens with every round
 * a reading goes unrefreshed.
 *
 * With no reading at all, the published opening survey is all there is.
 */
export function believedStock(observation: Observation, zone: Zone): number {
  const readings = observation.soundings.filter((s) => s.zoneId === zone.id);
  const newest = readings.reduce<Sounding | null>(
    (best, s) => (best === null || s.round > best.round ? s : best),
    null,
  );
  let stock = newest?.stock ?? zone.initialStock;
  // Project forward one round at a time, the way the engine grows it.
  for (let round = newest?.round ?? observation.round; round < observation.round; round += 1) {
    const critical = zone.carryingCapacity * zone.collapseThreshold;
    const depensation = (stock - critical) / (zone.carryingCapacity - critical);
    stock += zone.growthRate * stock * (1 - stock / zone.carryingCapacity) * depensation;
    stock = Math.max(0, Math.min(zone.carryingCapacity, stock));
  }
  return stock;
}

/** Believed stock for every ground, keyed by id. */
export function believedStocks(observation: Observation): Record<string, number> {
  const stocks: Record<string, number> = {};
  for (const zone of observation.zones) stocks[zone.id] = believedStock(observation, zone);
  return stocks;
}

/** How many rounds old this boat's freshest reading of a ground is. */
export function soundingAge(observation: Observation, zoneId: string): number | null {
  const rounds = observation.soundings.filter((s) => s.zoneId === zoneId).map((s) => s.round);
  return rounds.length === 0 ? null : observation.round - Math.max(...rounds);
}

type ZoneChoice = { zone: Zone; effort: number; profit: number };

/** The most effort this boat can still pay fuel for on this ground. */
export function affordableEffort(
  observation: Observation,
  zone: Zone,
  scenario: OceanScenario,
): number {
  const left = observation.self.fuelRemaining - zone.travelFuel;
  if (left <= 0) return 0;
  return Math.max(0, left / scenario.fuelPerEffort);
}

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
    const stock = believedStock(observation, zone);
    const cap = capInForce(observationStateShim(observation), observation.self.id, zone.id);
    // Fuel is a season-long budget, so the hull limit is rarely what binds.
    const fuelEffort = affordableEffort(observation, zone, scenario);
    let effort = Math.min(
      observation.self.effortCapacity,
      fuelEffort,
      options.effortCap ?? Infinity,
    );

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
    stocks: believedStocks(observation),
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
  return Object.values(believedStocks(observation)).reduce((sum, value) => sum + value, 0);
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
    const stock = believedStock(observation, zone);
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
            .reduce((sum, zone) => sum + sustainableYield(zone, believedStock(observation, zone)), 0) /
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
          (zone) => believedStock(observation, zone) / zone.carryingCapacity,
        ),
      );

      const bound = (boatId: BoatId) =>
        observation.activePacts.some(
          (pact) => pact.status === "ACTIVE" && pact.counterparties.includes(boatId),
        );
      const reserve = observation.zones.find((zone) => zone.reserve);

      // Buy eyes before buying restraint.
      //
      // What is worth paying for is not an unseen ground — nobody can sell you
      // a reading of water they have not worked either — but a *banded* one.
      // Watching a rival land fish tells this boat roughly what was under them;
      // the rival knows exactly. Upgrading that estimate to the real number is
      // the only thing a counterparty can sell that they alone possess, and it
      // is worth most on the ground the fleet is actually competing over.
      const newestSource = (zoneId: string) => {
        const readings = observation.soundings.filter((entry) => entry.zoneId === zoneId);
        if (readings.length === 0) return null;
        return readings.reduce((best, entry) => (entry.round > best.round ? entry : best)).source;
      };
      const lastRound = observation.history[observation.history.length - 1];
      const bandedZone = observation.zones.find(
        (zone) => !zone.reserve && newestSource(zone.id) === "OBSERVED",
      );
      const witness = bandedZone
        ? observation.others.find(
            (other) =>
              other.active &&
              !bound(other.id) &&
              lastRound?.others.some(
                (entry) => entry.boatId === other.id && entry.zoneId === bandedZone.id,
              ),
          )
        : undefined;

      if (
        bandedZone &&
        witness &&
        budget > 0 &&
        observation.roundsRemaining >= 2 &&
        observation.wallet.policy.allowedPurposes.includes("SOUNDING_EXCHANGE")
      ) {
        // A reading is worth a fraction of what a stand-down costs: it changes
        // where you fish, not whether anyone fishes.
        const fee = Math.max(4, Math.min(budget, Math.round(policyCap * 0.15)));
        proposals.push({
          id: proposalId(observation, `read-${bandedZone.id}`),
          round: observation.round,
          proposer: id,
          counterparties: [witness.id],
          terms: { kind: "SOUNDING_EXCHANGE", zoneId: bandedZone.id },
          payment: fee,
          durationRounds: Math.min(3, observation.roundsRemaining),
          reasonCode: "BANDED_READING",
        });
      }

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
          const stock = believedStock(observation, zone);
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
                (sum, zone) => sum + sustainableYield(zone, believedStock(observation, zone)),
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
        const stock = believedStock(observation, home);
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
      // Who else worked this ground last round. Landings are visible even when
      // the stock behind them is not, so crowding is still readable.
      const crowd = (zoneId: string) =>
        last?.others.filter((entry) => entry.zoneId === zoneId && entry.catch > 0).length ?? 0;

      let best: { zoneId: string; effort: number; score: number } | null = null;
      for (const zone of observation.zones) {
        if (zone.reserve || closed.has(zone.id)) continue;
        if (tooRough(zone, observation.weather, observation.self)) continue;
        const stock = believedStock(observation, zone);
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

/**
 * A policy reduced to a handful of dials.
 *
 * The scripted baselines each express one author's idea of how to fish, so
 * they cannot answer the question that decides whether this is a competition
 * at all: is there a single setting that simply wins? Sweeping this policy
 * over its whole grid does answer it. If one dial setting takes most seeds,
 * the arena is solved and no agent — however clever — is doing anything a
 * lookup table could not. If different seeds want different settings, there
 * is something to be good at.
 */
export type TunableParams = {
  /** Share of hull capacity to commit when fishing. */
  effortFraction: number;
  /** When, if ever, to work the reserve. */
  reserve: "never" | "storm-only" | "always";
  /** How hard to push contracts, and at what price relative to fair value. */
  contracts: "none" | "cheap" | "fair" | "generous";
};

const CONTRACT_PRICE: Record<TunableParams["contracts"], number> = {
  none: 0,
  cheap: 0.7,
  fair: 1,
  generous: 1.5,
};

export function tunableAgent(
  id: BoatId,
  name: string,
  scenario: OceanScenario,
  params: TunableParams,
): OceanAgent {
  return {
    id,
    name,
    negotiate(observation) {
      if (params.contracts === "none") {
        return {
          proposals: [],
          responses: observation.incomingProposals.map((proposal) => ({
            type: "REJECT" as const,
            proposalId: proposal.id,
            reasonCode: "NO_CONTRACTS",
          })),
        };
      }
      const responses: ProposalResponse[] = observation.incomingProposals.map((proposal) => ({
        type: "ACCEPT" as const,
        proposalId: proposal.id,
      }));
      const proposals: Proposal[] = [];

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
          counterparties: observation.others.filter((other) => other.active).map((o) => o.id),
          terms: {
            kind: "CONSERVATION_FUND",
            contributionPerRound: 28,
            standDownCap: Math.round(observation.wallet.policy.maxPaymentPerTransaction * 2.5),
          },
          payment: 0,
          durationRounds: observation.roundsRemaining,
          reasonCode: "POOL_RESTRAINT",
        });
      }

      const offer = standDownOffer(observation, id, {
        priceMultiplier: CONTRACT_PRICE[params.contracts],
      });
      if (offer) proposals.push(offer);
      return { proposals, responses };
    },
    act(observation) {
      const allowReserve =
        params.reserve === "always" ||
        (params.reserve === "storm-only" && observation.weather.stormSeverity > 0.4);
      const choice = bestZone(observation, scenario, {
        allowReserve,
        effortCap: observation.self.effortCapacity * params.effortFraction,
      });
      if (!choice) return idle(observation);
      return { boatId: id, zoneId: choice.zone.id, effort: choice.effort };
    },
  };
}

/**
 * Punishes over-fishing itself, not merely broken promises.
 *
 * Every other policy here responds only to contract breaches, so a boat that
 * signs nothing and simply strips the sea pays no social cost at all. Against
 * opponents that never react, the best reply is a fixed setting — which is
 * exactly what the grid sweep found. This agent reacts to behaviour: it works
 * whichever ground the heaviest taker is on, so the two of them split a stock
 * that neither can then take alone, and it refuses to put money in that boat's
 * pocket. Whether a fixed strategy survives contact with an opponent that
 * answers back is the question the sweep could not ask.
 */
/**
 * The reference against which restraint is measured — never an entrant.
 *
 * The restraint axis asks what a boat gave up, and that question needs a fixed
 * answer to "gave up compared with what". This boat is that answer: it signs
 * nothing, works whichever legal ground pays best, and commits its whole hull
 * every round. Replaying a seed with an entrant swapped for this boat gives the
 * landings the entrant could have taken and the sea that would have been left.
 *
 * It stays out of the reserve deliberately. A reference that raids the nursery
 * would wreck the counterfactual sea for everyone, and the resulting gap would
 * measure the reference's brutality rather than the entrant's judgement.
 */
export function takerAgent(id: BoatId, name: string, scenario: OceanScenario): OceanAgent {
  return {
    id,
    name,
    negotiate(observation) {
      return {
        proposals: [],
        responses: observation.incomingProposals.map((proposal) => ({
          type: "REJECT" as const,
          proposalId: proposal.id,
          reasonCode: "TAKES_EVERYTHING",
        })),
      };
    },
    act(observation) {
      const choice = bestZone(observation, scenario, { allowReserve: false });
      if (!choice) return idle(observation);
      return { boatId: id, zoneId: choice.zone.id, effort: observation.self.effortCapacity };
    },
  };
}

export function enforcerAgent(id: BoatId, name: string, scenario: OceanScenario): OceanAgent {
  /** The boat taking the largest share of everything landed so far. */
  const offenderOf = (observation: Observation): PublicBoatView | null => {
    const rivals = observation.others.filter((other) => other.active);
    if (rivals.length === 0 || observation.round < 3) return null;
    const landed = rivals.reduce((sum, other) => sum + other.totalCatch, 0) +
      observation.self.totalCatch;
    if (landed <= 0) return null;
    const worst = [...rivals].sort((left, right) => right.totalCatch - left.totalCatch)[0]!;
    // Only a share well past an even split counts as taking more than its due.
    const evenShare = landed / (rivals.length + 1);
    return worst.totalCatch > evenShare * 1.25 ? worst : null;
  };

  return {
    id,
    name,
    negotiate(observation) {
      const offender = offenderOf(observation);
      return {
        proposals: [],
        responses: observation.incomingProposals.map((proposal) => {
          // Never fund the boat that is doing the damage.
          const paysOffender = offender !== null && proposal.counterparties.includes(offender.id);
          return paysOffender
            ? { type: "REJECT" as const, proposalId: proposal.id, reasonCode: "WONT_FUND_OFFENDER" }
            : { type: "ACCEPT" as const, proposalId: proposal.id };
        }),
      };
    },
    act(observation) {
      const shim = observationStateShim(observation);
      if (standDownRequired(shim, id)) return idle(observation);

      const offender = offenderOf(observation);
      const contested = offender?.lastZoneId ?? null;
      if (contested) {
        const zone = observation.zones.find((candidate) => candidate.id === contested);
        const closed = closedZones(shim, id);
        if (zone && !closed.has(zone.id) && !tooRough(zone, observation.weather, observation.self)) {
          const stock = believedStock(observation, zone);
          const cap = capInForce(shim, id, zone.id);
          let effort = observation.self.effortCapacity;
          if (cap !== null) {
            effort = Math.min(effort, effortForCatch(zone, stock, observation.weather, cap));
          }
          effort = Math.max(0, Math.floor(effort * 100) / 100);
          const profit = expectedProfit(
            zone,
            stock,
            observation.weather,
            effort,
            observation.price,
            observation.self,
            scenario,
          );
          // Crowding is worth doing only while it still pays its own way.
          if (effort > 0 && profit > 0) return { boatId: id, zoneId: zone.id, effort };
        }
      }

      const fleet = observation.others.filter((other) => other.active).length + 1;
      const share = Math.max(
        1,
        observation.zones
          .filter((zone) => !zone.reserve)
          .reduce((sum, zone) => sum + sustainableYield(zone, believedStock(observation, zone)), 0) /
          fleet,
      );
      const choice = bestZone(observation, scenario, { allowReserve: false, catchCap: share });
      if (!choice) return idle(observation);
      return { boatId: id, zoneId: choice.zone.id, effort: choice.effort };
    },
  };
}

/**
 * Replays one boat's recorded fishing actions instead of deciding again.
 *
 * The cooperation axis re-runs a match with a single boat's contracts removed.
 * For a scripted boat that costs nothing, but a model-backed one would be
 * asked to decide the whole season a second time, doubling the bill for every
 * entry. Holding its own fishing fixed and letting the other boats respond
 * freely isolates what the contract did to them and to the sea, without paying
 * for a second season of judgement.
 *
 * The approximation is explicit: a boat that never signed would likely have
 * fished differently. What is measured is the contract's effect on everyone
 * else, not the signer's own change of heart.
 */
export function recordedAgent(
  id: BoatId,
  name: string,
  actionsByRound: ReadonlyMap<number, FishingAction>,
): OceanAgent {
  return {
    id,
    name,
    negotiate: () => ({ proposals: [], responses: [] }),
    act: (observation) =>
      actionsByRound.get(observation.round) ?? {
        boatId: id,
        zoneId: observation.zones[0]!.id,
        effort: 0,
      },
  };
}
