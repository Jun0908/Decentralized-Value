/**
 * A season, shaped for a picture rather than a table.
 *
 * The first replay this arena had was three water-level tanks, a row of boat
 * cards and some arcs. Everything in it was true and none of it looked like
 * anything: a reader could not tell that boats were catching fish, let alone
 * that two of them had signed a contract. A viewer needs a scene — where each
 * boat is, what came up in the net, who is bound to whom, and which water
 * nobody can see.
 *
 * That last point is what makes this arena's replay different from the other
 * ones in this repo. The sea is dark (Plan 10 §53.3), so the picture must be
 * dark too: the fog over each ground is not decoration, it is the rule. Fog is
 * computed per viewpoint, so watching one boat's season shows what that boat
 * knew, not what the engine knew.
 */

import type { MatchLog } from "./match";
import { stable } from "./rng";
import type { BoatId, PactKind, ZoneId } from "./types";

export type VoyagePhase = "SET_SAIL" | "CONTRACT" | "GALE" | "RESULT";

export type VoyageBoat = {
  boatId: BoatId;
  name: string;
  /** Where the hull is this round; null means tied up in port. */
  zoneId: ZoneId | null;
  catch: number;
  cash: number;
  /** 0..1 of the season's budget still in the tank. */
  fuelShare: number;
  active: boolean;
  underRepair: boolean;
  /** Set when the engine cut this boat's effort, with the reason it gave. */
  clampReason: string | null;
  breached: boolean;
  smallFleet: boolean;
};

export type VoyageGround = {
  zoneId: ZoneId;
  name: string;
  reserve: boolean;
  /**
   * 0..1 of carrying capacity, as the viewpoint believes it to be. Drawn as
   * the density of the shoal.
   */
  believedShare: number;
  /**
   * 0..1, how blind the viewpoint is here. 0 is a reading taken this round;
   * 1 is water nobody has ever worked. Drawn as fog.
   */
  fog: number;
  /** True share, for the post-season reveal only. Never shown while playing. */
  actualShare: number;
  collapsed: boolean;
};

export type VoyageBond = {
  pactId: string;
  kind: PactKind;
  from: BoatId;
  to: BoatId;
  /** Money still riding on the promise. Drawn as the weight of the line. */
  escrowRemaining: number;
  /** A broken promise; the line snaps. */
  broken: boolean;
  /** Struck this round. The moment a deal is made is worth showing. */
  fresh: boolean;
};

export type VoyageRound = {
  round: number;
  phase: VoyagePhase;
  stormSeverity: number;
  price: number;
  /** One line of plain English for the caption under the scene. */
  caption: string;
  boats: VoyageBoat[];
  grounds: VoyageGround[];
  bonds: VoyageBond[];
};

export type Voyage = {
  seed: string;
  rounds: VoyageRound[];
  /** Whose knowledge the fog reflects; null draws the sea as the engine saw it. */
  viewpoint: BoatId | null;
};

/** A gale is what shuts the offshore bank and forces the fleet together. */
const GALE = 0.85;

/**
 * How stale the viewpoint's knowledge of a ground is, as 0..1.
 *
 * Fishing it yourself clears the fog completely. Watching a rival work it
 * clears most of it — you saw fish come up, you just did not measure them.
 * After that it creeps back one step per round, because the ground keeps
 * moving while you are not looking.
 */
function fogFor(
  log: MatchLog,
  zoneId: ZoneId,
  round: number,
  viewpoint: BoatId | null,
): number {
  if (viewpoint === null) return 0;
  let best = 1;
  for (const record of log.rounds) {
    if (record.round > round) break;
    const worked = record.entries.filter(
      (entry) => entry.zoneId === zoneId && entry.appliedEffort > 0,
    );
    if (worked.length === 0) continue;
    const age = round - record.round;
    const mine = worked.some((entry) => entry.boatId === viewpoint);
    const floor = mine ? 0 : 0.35;
    best = Math.min(best, Math.min(1, floor + age * 0.15));
  }
  return stable(best);
}

function captionFor(phase: VoyagePhase, round: VoyageRound["boats"], storm: number): string {
  const raiders = round.filter((boat) => boat.zoneId === "nursery").length;
  const idle = round.filter((boat) => boat.clampReason === "OUT_OF_FUEL").length;
  if (phase === "GALE") {
    return raiders > 0
      ? `The bank is shut. ${raiders} ${raiders === 1 ? "boat is" : "boats are"} in the nursery.`
      : "The bank is shut. Everyone is inshore.";
  }
  if (idle > 0) {
    return `${idle} ${idle === 1 ? "boat is" : "boats are"} out of fuel and stuck in port.`;
  }
  if (storm > 0.5) return "Rough water. The exposed grounds pay badly today.";
  return "The fleet is at sea.";
}

/**
 * Turn a finished match into the sequence a stage can play.
 *
 * `viewpoint` decides whose fog is drawn. Passing a boat id shows the season as
 * that skipper experienced it — which is the honest way to show an arena whose
 * whole premise is that nobody can see the sea.
 */
export function toVoyage(log: MatchLog, viewpoint: BoatId | null = null): Voyage {
  const { scenario } = log;
  const boatsById = new Map(scenario.boats.map((boat) => [boat.id, boat]));

  const rounds: VoyageRound[] = log.rounds.map((record, index) => {
    const storm = record.weather.stormSeverity;
    // A pact is on screen from the round it was struck until its term runs out
    // or it is broken. `RoundRecord` carries only the ids, so the terms come
    // back from the proposals the match actually settled.
    const live = log.acceptedProposals.filter((proposal) => {
      const broke = log.rounds.find((candidate) =>
        candidate.breachedPacts.includes(proposal.id),
      );
      const last = proposal.round + proposal.durationRounds - 1;
      return (
        record.round >= proposal.round &&
        record.round <= last &&
        (broke === undefined || record.round <= broke.round)
      );
    });

    const phase: VoyagePhase =
      index === log.rounds.length - 1
        ? "RESULT"
        : storm >= GALE
          ? "GALE"
          : live.length > 0
            ? "CONTRACT"
            : "SET_SAIL";

    const boats: VoyageBoat[] = record.entries.map((entry) => {
      const boat = boatsById.get(entry.boatId)!;
      return {
        boatId: entry.boatId,
        name: boat.name,
        zoneId: entry.appliedEffort > 0 ? entry.zoneId : null,
        catch: stable(entry.catch),
        cash: stable(entry.cashAfter),
        fuelShare: stable(Math.max(0, Math.min(1, entry.fuelAfter / boat.fuelBudget))),
        active: entry.clampReason !== "BANKRUPT",
        underRepair: entry.clampReason === "UNDER_REPAIR",
        clampReason: entry.clampReason,
        breached: entry.breached,
        smallFleet: boat.smallFleet,
      };
    });

    const grounds: VoyageGround[] = scenario.zones.map((zone) => {
      const actual = record.stocksAfter[zone.id] ?? 0;
      const fog = fogFor(log, zone.id, record.round, viewpoint);
      // Under fog the viewer sees the last thing anyone saw, not the truth.
      const lastSeen = [...log.rounds]
        .filter((candidate) => candidate.round <= record.round)
        .reverse()
        .find((candidate) =>
          candidate.entries.some(
            (entry) => entry.zoneId === zone.id && entry.appliedEffort > 0,
          ),
        );
      const believed =
        viewpoint === null || lastSeen === undefined
          ? actual
          : (lastSeen.stocksBefore[zone.id] ?? actual);
      return {
        zoneId: zone.id,
        name: zone.name,
        reserve: zone.reserve,
        believedShare: stable(Math.max(0, Math.min(1, believed / zone.carryingCapacity))),
        fog,
        actualShare: stable(Math.max(0, Math.min(1, actual / zone.carryingCapacity))),
        collapsed: actual < zone.carryingCapacity * zone.collapseThreshold,
      };
    });

    const bonds: VoyageBond[] = live.flatMap((proposal) => {
      const roundsLeft = proposal.round + proposal.durationRounds - record.round;
      const remaining = (proposal.payment * Math.max(0, roundsLeft)) / proposal.durationRounds;
      const broken = record.breachedPacts.includes(proposal.id);
      return proposal.counterparties.map((party) => ({
        pactId: proposal.id,
        kind: proposal.terms.kind,
        from: proposal.proposer,
        to: party,
        escrowRemaining: stable(broken ? 0 : remaining),
        broken,
        fresh: proposal.round === record.round,
      }));
    });

    return {
      round: record.round,
      phase,
      stormSeverity: stable(storm),
      price: stable(record.priceBefore),
      caption: captionFor(phase, boats, storm),
      boats,
      grounds,
      bonds,
    };
  });

  return { seed: scenario.seed, rounds, viewpoint };
}
