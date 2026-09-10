import {
  canonicalProtocolJson,
  computeContributionEvidence,
  computeOutcomeFrontier,
  type ContributionEvidence,
  type OutcomeMetric,
  type OutcomePoint,
} from "@frontier/shared";
import { keccak256, stringToHex, type Hex } from "viem";
import { createInitialState, transition } from "./engine";
import type { MatchLog } from "./match";
import { acceptProposal } from "./negotiation";
import { stable } from "./rng";
import type { OceanScenario } from "./scenario";
import type { BoatId, FishingAction, OceanState, Proposal } from "./types";

/**
 * Outcomes, replay and hashes.
 *
 * The three outcomes stay separate all the way through. There is no weighted
 * total anywhere in this file, and adding one would break the arena.
 */

// --- outcome metrics ------------------------------------------------------

/**
 * The three axes never combine. Livelihood asks whether this boat could keep
 * fishing, stewardship whether the sea survived, and cooperation what this
 * boat's agreements actually bought with the money that passed through them.
 *
 * Cooperation replaced a small-fleet resilience axis that could not tell two
 * policies apart inside 20 matches, and that ranked greed above restraint
 * however it was defined — in this world cash buys safety and fishing buys
 * cash, so caution always looked fragile. It is kept in the evidence below,
 * simply no longer scored.
 *
 * Stewardship is measured at the *lowest* point of the match, not the end, so
 * that draining the sea and letting it rebound in the final rounds does not
 * read as good stewardship.
 *
 * It is a fraction of the scenario's carrying capacity, not a fish count. The
 * generator varies zone sizes by ±20%, so raw counts are not comparable across
 * scenarios: measured absolutely, 89% of the spread came from which seed was
 * drawn and only 9% from how the fleet behaved. As a fraction those become 52%
 * and 42% — the same matches, measured by a yardstick that answers the
 * question actually being asked.
 */
export const oceanMetrics = [
  {
    key: "livelihood",
    name: "Livelihood",
    direction: "MAXIMIZE",
    unit: "DemoUSD",
    lowerBound: 0,
    upperBound: 900,
  },
  {
    key: "stewardship",
    name: "Commons stewardship",
    direction: "MAXIMIZE",
    unit: "share of capacity",
    lowerBound: 0,
    upperBound: 1,
  },
  {
    key: "cooperation",
    name: "Cooperation efficacy",
    direction: "MAXIMIZE",
    unit: "stewardship points per 1000 DemoUSD",
    lowerBound: -0.5,
    upperBound: 0.5,
  },
] as const satisfies readonly OutcomeMetric[];

export type BoatOutcome = {
  boatId: BoatId;
  finalCash: number;
  operatingProfit: number;
  survived: boolean;
  totalCatch: number;
  breaches: number;
  paidOut: number;
  received: number;
  smallFleet: boolean;
};

export type MatchOutcomes = {
  scenarioId: string;
  seed: string;
  boats: BoatOutcome[];
  /** Axis 1 — the median active boat's final cash. */
  livelihood: number;
  /**
   * Axis 2 — the lowest total stock seen at any point in the match, as a share
   * of carrying capacity so that scenarios of different sizes compare.
   */
  stewardship: number;
  /**
   * Axis 3 — the weakest small operator's final capital as a share of what it
   * started with, floored at zero. Absolute cash rewarded fleets that fished
   * hard: everyone ended richer, including the worst-off boat, so restraint
   * scored *lower* on resilience than greed. A ratio asks the intended
   * question — did the smallest operator stay viable — and a bankrupt boat
   * scores zero however well the rest of the fleet did.
   */
  resilience: number;
  evidence: {
    totalCapacity: number;
    finalTotalStock: number;
    minTotalStock: number;
    nurseryFinalStock: number;
    survivorCount: number;
    survivingSmallFleet: number;
    totalCatch: number;
    meanPrice: number;
    zoneRoundChoices: Record<string, number>;
  };
  contracts: {
    proposed: number;
    accepted: number;
    /** Accepted pacts that actually constrain fishing, so exclude mutual aid. */
    bindingAccepted: number;
    breached: number;
    escrowLocked: number;
    escrowReleased: number;
    escrowRefunded: number;
    aidPaid: number;
  };
};

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? stable((sorted[middle - 1]! + sorted[middle]!) / 2)
    : sorted[middle]!;
}

export function evaluateMatch(log: MatchLog): MatchOutcomes {
  const { scenario, rounds, finalState } = log;
  const boatsById = new Map(scenario.boats.map((boat) => [boat.id, boat]));

  const boats: BoatOutcome[] = scenario.boats.map((boat) => {
    const state = finalState.boats[boat.id]!;
    return {
      boatId: boat.id,
      finalCash: state.cash,
      operatingProfit: stable(state.totalRevenue - state.totalCosts),
      survived: state.active,
      totalCatch: state.totalCatch,
      breaches: state.breaches,
      paidOut: state.totalPaidOut,
      received: state.totalReceived,
      smallFleet: boat.smallFleet,
    };
  });

  // Stock is tracked after every round so a mid-match collapse is visible.
  const totals = rounds.map((record) =>
    stable(Object.values(record.stocksAfter).reduce((sum, value) => sum + value, 0)),
  );
  const finalTotalStock = totals[totals.length - 1] ?? 0;
  const minTotalStock = totals.length > 0 ? Math.min(...totals) : 0;
  const totalCapacity = scenario.zones.reduce((sum, zone) => sum + zone.carryingCapacity, 0);

  const zoneRoundChoices: Record<string, number> = {};
  for (const zone of scenario.zones) zoneRoundChoices[zone.id] = 0;
  let totalCatch = 0;
  for (const record of rounds) {
    for (const entry of record.entries) {
      totalCatch += entry.catch;
      if (entry.zoneId && entry.appliedEffort > 0) {
        zoneRoundChoices[entry.zoneId] = (zoneRoundChoices[entry.zoneId] ?? 0) + 1;
      }
    }
  }

  const escrowReleased = rounds
    .flatMap((record) => record.escrowReleases)
    .filter((release) => release.type === "RELEASE")
    .reduce((sum, release) => sum + release.amount, 0);
  const escrowRefunded = rounds
    .flatMap((record) => record.escrowReleases)
    .filter((release) => release.type === "REFUND")
    .reduce((sum, release) => sum + release.amount, 0);
  const aidPaid = rounds
    .flatMap((record) => record.aidPayouts)
    .reduce((sum, payout) => sum + payout.amount, 0);

  const activeCash = boats.filter((boat) => boat.survived).map((boat) => boat.finalCash);
  const smallRatios = boats
    .filter((boat) => boat.smallFleet)
    .map((boat) => {
      const start = boatsById.get(boat.boatId)?.startingCash ?? 0;
      if (!boat.survived || start <= 0) return 0;
      return Math.max(0, boat.finalCash / start);
    });
  const worstSmall = smallRatios.length > 0 ? Math.min(...smallRatios) : 0;

  return {
    scenarioId: scenario.scenarioId,
    seed: scenario.seed,
    boats,
    livelihood: stable(Math.max(0, median(activeCash))),
    stewardship: totalCapacity === 0 ? 0 : stable(minTotalStock / totalCapacity),
    resilience: stable(worstSmall),
    evidence: {
      totalCapacity,
      finalTotalStock,
      minTotalStock,
      nurseryFinalStock: stable(
        scenario.zones
          .filter((zone) => zone.reserve)
          .reduce((sum, zone) => sum + (finalState.stocks[zone.id] ?? 0), 0),
      ),
      survivorCount: boats.filter((boat) => boat.survived).length,
      survivingSmallFleet: boats.filter((boat) => boat.smallFleet && boat.survived).length,
      totalCatch: stable(totalCatch),
      meanPrice: stable(
        rounds.reduce((sum, record) => sum + record.priceAfter, 0) / Math.max(1, rounds.length),
      ),
      zoneRoundChoices,
    },
    contracts: {
      proposed: log.acceptedProposals.length + log.rejectedProposals.length,
      accepted: log.acceptedProposals.length,
      bindingAccepted: log.acceptedProposals.filter(
        (proposal) => proposal.terms.kind !== "MUTUAL_AID",
      ).length,
      breached: rounds.reduce((sum, record) => sum + record.breachedPacts.length, 0),
      escrowLocked: stable(
        log.acceptedProposals.reduce((sum, proposal) => sum + proposal.payment, 0),
      ),
      escrowReleased: stable(escrowReleased),
      escrowRefunded: stable(escrowRefunded),
      aidPaid: stable(aidPaid),
    },
  };
}

/**
 * What one boat's agreements were worth, per DemoUSD it spent on them.
 *
 * The counterfactual removes only this boat's contracts and replays the same
 * weather, fleet and seed. Dividing by what it paid makes this a rate rather
 * than a budget: the boat that protected more sea for the same money scores
 * above the one that merely had more to spend. A boat that never paid scores
 * zero — not punished for abstaining, simply not credited.
 *
 * Only the payer is credited. Scoring both sides made the heaviest extractor
 * the best cooperator in the fleet, because buying it out moved the most fish
 * and it was the most expensive boat to stop. That rewards being maximally
 * destructive until somebody pays you to stop — a hostage, not a partner. The
 * boat that takes the money is already paid for its restraint in cash, and the
 * restraint itself already shows up in stewardship; crediting it here as well
 * would count the same act three times.
 */
export type CooperationScore = {
  /** Stewardship with this boat's contracts, minus stewardship without them. */
  stewardshipDelta: number;
  /** Escrow and fund contributions this boat paid out. */
  spent: number;
  /** The axis value: stewardship points per 1000 DemoUSD spent. */
  efficacy: number;
};

export function scoreCooperation(
  full: MatchOutcomes,
  without: MatchOutcomes,
  boatId: BoatId,
): CooperationScore {
  const self = full.boats.find((boat) => boat.boatId === boatId);
  const spent = stable(self?.paidOut ?? 0);
  const stewardshipDelta = stable(full.stewardship - without.stewardship);
  return {
    stewardshipDelta,
    spent,
    efficacy: spent <= 0 ? 0 : stable((stewardshipDelta * 1000) / spent),
  };
}

// --- fleet-wide cooperation efficacy, measured against a counterfactual ----

export type CooperationEfficacy = {
  /** Money actually moved between agents under contract. */
  spend: number;
  livelihoodDelta: number;
  stewardshipDelta: number;
  resilienceDelta: number;
  /** Stewardship gained per DemoUSD spent. Zero spend yields zero, not infinity. */
  stewardshipPerSpend: number;
  resiliencePerSpend: number;
};

/**
 * What did the contracts actually change?
 *
 * Because the engine is deterministic, the same scenario can be replayed with
 * the negotiation layer switched off. The difference — not the number of pacts
 * signed — is the entire measure of cooperation here.
 */
export function compareRuns(
  withContracts: MatchOutcomes,
  withoutContracts: MatchOutcomes,
): CooperationEfficacy {
  const spend = withContracts.contracts.escrowReleased + withContracts.contracts.aidPaid;
  const livelihoodDelta = stable(withContracts.livelihood - withoutContracts.livelihood);
  const stewardshipDelta = stable(withContracts.stewardship - withoutContracts.stewardship);
  const resilienceDelta = stable(withContracts.resilience - withoutContracts.resilience);
  return {
    spend: stable(spend),
    livelihoodDelta,
    stewardshipDelta,
    resilienceDelta,
    stewardshipPerSpend: spend > 0 ? stable(stewardshipDelta / spend) : 0,
    resiliencePerSpend: spend > 0 ? stable(resilienceDelta / spend) : 0,
  };
}

// --- Pareto integration ---------------------------------------------------

export function toOutcomePoint(
  id: string,
  name: string,
  outcomes: MatchOutcomes,
  cooperation: number,
  options: { correctness?: boolean; baseline?: boolean } = {},
): OutcomePoint {
  return {
    id,
    name,
    correctness: options.correctness ?? true,
    baseline: options.baseline ?? false,
    values: {
      livelihood: outcomes.livelihood,
      stewardship: outcomes.stewardship,
      cooperation,
    },
  };
}

export function oceanFrontier(points: readonly OutcomePoint[]): OutcomePoint[] {
  return computeOutcomeFrontier(points, oceanMetrics);
}

/**
 * Contribution of a single artifact — an agent, but equally a pact or a
 * coalition — against the set of results that would exist without it.
 */
export function oceanContribution(
  baselinePoints: readonly OutcomePoint[],
  candidate: OutcomePoint,
): ContributionEvidence {
  return computeContributionEvidence(baselinePoints, candidate, oceanMetrics);
}

// --- transcript, replay, hashes -------------------------------------------

export type TranscriptRound = {
  round: number;
  acceptedProposals: Proposal[];
  actions: FishingAction[];
};

export type MatchTranscript = {
  schemaVersion: "1";
  arenaId: "ocean-commons-v1";
  scenarioId: string;
  seed: string;
  rounds: TranscriptRound[];
};

/**
 * Reduces a match to the only inputs the engine needs. Agent reasoning is not
 * part of it: replay reproduces the world, never the thinking.
 */
export function toTranscript(log: MatchLog): MatchTranscript {
  return {
    schemaVersion: "1",
    arenaId: "ocean-commons-v1",
    scenarioId: log.scenario.scenarioId,
    seed: log.scenario.seed,
    rounds: log.rounds.map((record) => ({
      round: record.round,
      acceptedProposals: log.acceptedProposals.filter(
        (proposal) => proposal.round === record.round,
      ),
      actions: record.entries
        .filter((entry) => entry.zoneId !== null && entry.requestedEffort > 0)
        .map((entry) => ({
          boatId: entry.boatId,
          zoneId: entry.zoneId!,
          effort: entry.requestedEffort,
        })),
    })),
  };
}

/** This boat's actions, round by round, as the engine actually applied them. */
export function recordedActionsFor(
  log: MatchLog,
  boatId: BoatId,
): Map<number, FishingAction> {
  const actions = new Map<number, FishingAction>();
  for (const record of log.rounds) {
    const entry = record.entries.find((candidate) => candidate.boatId === boatId);
    if (!entry || entry.zoneId === null) continue;
    actions.set(record.round, {
      boatId,
      zoneId: entry.zoneId,
      effort: entry.requestedEffort,
    });
  }
  return actions;
}

/** Re-runs a transcript through the engine with no agents involved. */
export function replayTranscript(
  scenario: OceanScenario,
  transcript: MatchTranscript,
): OceanState {
  let state = createInitialState(scenario);
  const zoneIds = scenario.zones.map((zone) => zone.id);
  for (const round of transcript.rounds) {
    for (const proposal of round.acceptedProposals) acceptProposal(state, proposal, zoneIds);
    state = transition(state, round.actions, scenario).state;
  }
  return state;
}

function hash(value: unknown): Hex {
  return keccak256(stringToHex(canonicalProtocolJson(value)));
}

export function hashScenario(scenario: OceanScenario): Hex {
  return hash(scenario);
}

export function hashTranscript(transcript: MatchTranscript): Hex {
  return hash(transcript);
}

/** Covers the final world state and the three outcomes, nothing else. */
export function hashResult(state: OceanState, outcomes: MatchOutcomes): Hex {
  return hash({
    stocks: state.stocks,
    boats: state.boats,
    price: state.price,
    livelihood: outcomes.livelihood,
    stewardship: outcomes.stewardship,
    resilience: outcomes.resilience,
  });
}
