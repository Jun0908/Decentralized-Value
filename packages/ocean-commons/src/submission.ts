/**
 * Scoring a submitted entry, away from the browser.
 *
 * The workbench sails the same match locally so a visitor sees the consequence
 * of a dial immediately. That is practice. A submission has to be scored
 * somewhere a player cannot reach, over seeds they did not choose, or the
 * number means nothing — so the identical match runs here and only the result
 * crosses back.
 *
 * Nothing is summed. The three axes are reported separately and hashed
 * together, because the settlement contract has no function that could combine
 * them even if somebody wanted to.
 */

import { canonicalProtocolJson } from "@frontier/shared";
import { keccak256, stringToHex, type Hex } from "viem";

import {
  brokerAgent,
  greedyAgent,
  opportunistAgent,
  reciprocatorAgent,
  takerAgent,
  tunableAgent,
  type OceanAgent,
} from "./agents";
import { checkOceanEntry, walletPolicyFor, type OceanEntry } from "./entry";
import { evaluateMatch, scoreCooperation, scoreRestraint } from "./evaluator";
import { oceanCommonsChallengeId, oceanPracticeSeeds } from "./manifest";
import { runMatch } from "./match";
import { generateScenario, type OceanScenario } from "./scenario";

/**
 * How many seasons a submission is scored over.
 *
 * A season is roughly a hand of poker — the draw accounts for a fifth to nearly
 * two fifths of an outcome (Plan 10 §67) — so a single season would rank the
 * shuffle. Twelve is what the published seed list affords while a scripted
 * match still resolves in well under a second.
 */
export const OCEAN_SUBMISSION_SEASONS = 12;

/** The seeds every submission is scored on. Published, so a result is checkable. */
export const oceanSubmissionSeeds: readonly string[] = oceanPracticeSeeds.slice(
  0,
  OCEAN_SUBMISSION_SEASONS,
);

export type OceanSeasonScores = {
  livelihood: number;
  restraint: number;
  forgone: number;
  cooperation: number;
};

export type OceanEntryEvaluation = {
  schemaVersion: "1";
  arenaId: string;
  /** True when the entry passed every bound; a failed entry is still returned. */
  correctness: boolean;
  constraintFailures: string[];
  seeds: readonly string[];
  /** Median of each axis across the match, which is what a board row shows. */
  livelihood: number;
  restraint: number;
  cooperation: number;
  forgone: number;
  perSeason: OceanSeasonScores[];
  resultHash: Hex;
};

function rivalsFor(scenario: OceanScenario): OceanAgent[] {
  const [, b, c, d, e] = scenario.boats;
  return [
    brokerAgent(b!.id, b!.name, scenario),
    greedyAgent(c!.id, c!.name, scenario),
    opportunistAgent(d!.id, d!.name, scenario),
    reciprocatorAgent(e!.id, e!.name, scenario),
  ];
}

function medianOf(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

/** One season for one entry, with the two counterfactual replays the axes need. */
async function sailSeason(entry: OceanEntry, seed: string): Promise<OceanSeasonScores> {
  const scenario = generateScenario(seed, { vary: true });
  const seat = scenario.boats[0]!;
  const wallets = { [seat.id]: walletPolicyFor(entry) };
  const fleet = (): OceanAgent[] => [
    tunableAgent(seat.id, seat.name, scenario, entry.sailing),
    ...rivalsFor(scenario),
  ];

  const full = evaluateMatch(await runMatch(scenario, fleet(), { wallets }));
  const solo = evaluateMatch(
    await runMatch(scenario, fleet(), { wallets, excludeContractsFor: seat.id }),
  );
  const ifTaken = evaluateMatch(
    await runMatch(scenario, [takerAgent(seat.id, seat.name, scenario), ...rivalsFor(scenario)]),
  );
  const restraint = scoreRestraint(full, ifTaken, seat.id);
  return {
    livelihood: full.livelihood,
    restraint: restraint.efficacy,
    forgone: restraint.forgone,
    cooperation: scoreCooperation(full, solo, seat.id).efficacy,
  };
}

/**
 * Scores an entry that arrived over the wire.
 *
 * The input is checked here rather than trusted: an entry that fails its bounds
 * comes back with `correctness: false` and every failure listed, instead of
 * throwing, so a submitter is told all of what is wrong at once.
 */
export async function evaluateOceanEntry(input: unknown): Promise<OceanEntryEvaluation> {
  const { entry, failures } = checkOceanEntry(input);
  if (entry === null) {
    const withoutHash = {
      schemaVersion: "1" as const,
      arenaId: oceanCommonsChallengeId,
      correctness: false,
      constraintFailures: failures,
      seeds: oceanSubmissionSeeds,
      livelihood: 0,
      restraint: 0,
      cooperation: 0,
      forgone: 0,
      perSeason: [],
    };
    return { ...withoutHash, resultHash: hash(withoutHash) };
  }

  const perSeason: OceanSeasonScores[] = [];
  // Sequential rather than parallel: a submission is scored on a shared server,
  // and twelve seasons at once would let one entry crowd out everybody else's.
  for (const seed of oceanSubmissionSeeds) perSeason.push(await sailSeason(entry, seed));

  const withoutHash = {
    schemaVersion: "1" as const,
    arenaId: oceanCommonsChallengeId,
    correctness: true,
    constraintFailures: [] as string[],
    seeds: oceanSubmissionSeeds,
    livelihood: medianOf(perSeason.map((one) => one.livelihood)),
    restraint: medianOf(perSeason.map((one) => one.restraint)),
    cooperation: medianOf(perSeason.map((one) => one.cooperation)),
    forgone: medianOf(perSeason.map((one) => one.forgone)),
    perSeason,
  };
  return { ...withoutHash, resultHash: hash(withoutHash) };
}

function hash(value: unknown): Hex {
  return keccak256(stringToHex(canonicalProtocolJson(value)));
}
