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

/**
 * Everything notable this round, most dramatic first.
 *
 * The replay used to say "The fleet is at sea" for almost every round while
 * three and a half contracts a season were being struck, argued over and
 * occasionally broken underneath it. All of it was in the data and none of it
 * was in words, so a viewer watched hulls drift and learned nothing.
 *
 * A list rather than a single line, because the same fact stays true for
 * several rounds — a boat is out of fuel for the rest of the season — and
 * repeating it makes a replay look stuck. The caller takes the first line that
 * is not what it said last round.
 */
function captionsFor(
  phase: VoyagePhase,
  boats: VoyageBoat[],
  bonds: VoyageBond[],
  storm: number,
  names: Map<BoatId, string>,
  before: VoyageBoat[],
): string[] {
  // Going bankrupt and running dry are events, not states. Reporting them for
  // every round they remain true made a replay look stuck on bad news.
  const wasActive = new Set(before.filter((boat) => boat.active).map((boat) => boat.boatId));
  const hadFuel = new Set(
    before.filter((boat) => boat.clampReason !== "OUT_OF_FUEL").map((boat) => boat.boatId),
  );
  const who = (id: BoatId) => names.get(id) ?? id;
  const list = (crew: VoyageBoat[]) => crew.map((boat) => boat.name).join(" and ");
  const out: string[] = [];

  for (const bond of bonds.filter((one) => one.broken)) {
    out.push(`${who(bond.to)} broke its word to ${who(bond.from)}. The escrow goes back.`);
  }
  for (const bond of bonds.filter((one) => one.fresh)) {
    // A pooled fund is paid into round by round, so nothing sits in escrow at
    // the moment it is struck; reporting "pays 0" reads as a bug.
    out.push(
      bond.escrowRemaining > 0
        ? `${who(bond.from)} pays ${who(bond.to)} ${bond.escrowRemaining.toFixed(0)} to ${termsOf(bond)}.`
        : `${who(bond.from)} and ${who(bond.to)} agree to ${termsOf(bond)}.`,
    );
  }

  const sunk = boats.filter((boat) => !boat.active && wasActive.has(boat.boatId));
  if (sunk.length > 0) {
    out.push(`${list(sunk)} ${sunk.length === 1 ? "has" : "have"} gone bankrupt.`);
  }

  const raiders = boats.filter((boat) => boat.zoneId === "nursery");
  if (phase === "GALE") {
    out.push(
      raiders.length > 0
        ? `The bank is shut, and ${list(raiders)} went into the nursery.`
        : "The bank is shut. Everyone is working inshore.",
    );
  } else if (raiders.length > 0) {
    out.push(`${list(raiders)} ${raiders.length === 1 ? "is" : "are"} fishing the nursery reserve.`);
  }

  const dry = boats.filter(
    (boat) => boat.clampReason === "OUT_OF_FUEL" && hadFuel.has(boat.boatId),
  );
  if (dry.length > 0) {
    out.push(`${list(dry)} ${dry.length === 1 ? "is" : "are"} out of fuel and tied up for the rest of the season.`);
  }

  const best = boats.reduce((top, boat) => (boat.catch > top.catch ? boat : top), boats[0]!);
  if (phase === "RESULT") out.push("The season is over.");
  if (storm > 0.5) out.push("Rough water. The exposed grounds pay badly today.");
  if (best.catch > 0) out.push(`${best.name} has the best of it, landing ${best.catch.toFixed(0)}.`);
  out.push("A quiet round. Nobody landed anything worth the fuel.");
  return out;
}

/** What a contract actually obliges someone to do, in plain words. */
function termsOf(bond: VoyageBond): string {
  switch (bond.kind) {
    case "CATCH_LIMIT":
      return "hold to a catch limit";
    case "CONSERVATION_BUYOUT":
      return "leave a ground alone";
    case "MUTUAL_AID":
      return "share the aid fund";
    case "CONSERVATION_FUND":
      return "pool money for restraint";
    case "SOUNDING_EXCHANGE":
      return "trade readings";
  }
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
  const names = new Map(scenario.boats.map((boat) => [boat.id, boat.name]));

  let saidLast = "";
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
      caption: "",
      boats,
      grounds,
      bonds,
    };
  });

  for (const [index, round] of rounds.entries()) {
    const options = captionsFor(
      round.phase,
      round.boats,
      round.bonds,
      round.stormSeverity,
      names,
      index === 0 ? round.boats.map((boat) => ({ ...boat, active: true, clampReason: null })) : rounds[index - 1]!.boats,
    );
    round.caption = options.find((line) => line !== saidLast) ?? options[0]!;
    saidLast = round.caption;
  }

  return { seed: scenario.seed, rounds, viewpoint };
}
