/**
 * One season sailed by a boat that reads the owner's mission, and nothing else
 * about their intent.
 *
 * This is the claim the whole arena rests on: a standing instruction in prose
 * moves all three outcomes together, which no fixed parameter vector can do
 * (Plan 10 §49). Until now the page collected that prose and threw it away —
 * the practice run was sailed by scripted skippers — so the central mechanism
 * went untested in the product even though it was measured in the harness.
 *
 * Kept in the package rather than the API so the same function backs the route,
 * the judgement scripts, and the tests.
 */

import {
  brokerAgent,
  greedyAgent,
  opportunistAgent,
  reciprocatorAgent,
  type OceanAgent,
} from "./agents";
import { evaluateMatch, scoreCooperation, scoreRestraint } from "./evaluator";
import { llmAgent, type DecisionBackend, type LlmTurnRecord } from "./llm-agent";
import { runMatch } from "./match";
import { generateScenario, type OceanScenario } from "./scenario";
import { takerAgent, tunableAgent, type TunableParams } from "./agents";
import { toVoyage, type Voyage } from "./voyage";

/**
 * A mission is written by whoever opened the page, so it is untrusted text on
 * its way into a model prompt. Length is the part that costs money: the rules
 * themselves are fixed by `systemPrompt`, and the model can only ever act
 * through the validated turn schema, so a mission cannot reach the engine
 * except as the actions that come back.
 */
export const MISSION_MAX_LENGTH = 2_000;

export type SeasonScores = {
  livelihood: number;
  /** Share of the catch given up that was still in the water at the end. */
  restraint: number;
  /** Catch given up against a boat that takes everything. */
  forgone: number;
  /** Stewardship points per 1000 DemoUSD this boat paid out. */
  cooperation: number;
};

export type SeasonResult = {
  scores: SeasonScores;
  voyage: Voyage;
  seed: string;
  rounds: number;
  survived: number;
  fleet: number;
  fuelLeft: number;
  contracts: number;
  /** What the model was asked and what it answered, for the owner to read. */
  turns: LlmTurnRecord[];
  usage: { calls: number; failures: number; inputTokens: number; outputTokens: number };
};

/** The four rivals, rebuilt per replay so nothing leaks between runs. */
function rivalsFor(scenario: OceanScenario): OceanAgent[] {
  const [, b, c, d, e] = scenario.boats;
  return [
    brokerAgent(b!.id, b!.name, scenario),
    greedyAgent(c!.id, c!.name, scenario),
    opportunistAgent(d!.id, d!.name, scenario),
    // One rival answers back rather than simply maximising, so restraint has
    // somebody to be read by.
    reciprocatorAgent(e!.id, e!.name, scenario),
  ];
}

/**
 * The two counterfactual replays the axes are defined against.
 *
 * Both are sailed by scripted policies, never by the model: re-running the
 * model would cost three times as much and, worse, would not be a
 * counterfactual at all — it would be a different season.
 */
async function counterfactuals(
  scenario: OceanScenario,
  entrant: () => OceanAgent[],
  boatId: string,
) {
  const seat = scenario.boats[0]!;
  const solo = evaluateMatch(await runMatch(scenario, entrant(), { excludeContractsFor: boatId }));
  const ifTaken = evaluateMatch(
    await runMatch(scenario, [takerAgent(seat.id, seat.name, scenario), ...rivalsFor(scenario)]),
  );
  return { solo, ifTaken };
}

export type SailSeasonOptions = {
  mission: string;
  seed: string;
  backend: DecisionBackend;
};

/** Sail one season with a model-backed boat in the first seat. */
export async function sailSeasonWithMission(options: SailSeasonOptions): Promise<SeasonResult> {
  const mission = options.mission.trim();
  if (mission.length === 0) throw new Error("A mission cannot be empty");
  if (mission.length > MISSION_MAX_LENGTH) {
    throw new Error(`A mission must be at most ${MISSION_MAX_LENGTH} characters`);
  }

  const scenario = generateScenario(options.seed, { vary: true });
  const seat = scenario.boats[0]!;
  const turns: LlmTurnRecord[] = [];

  const fleet = (): OceanAgent[] => [
    llmAgent(seat.id, seat.name, scenario, {
      backend: options.backend,
      mission,
      onTurn: (record) => turns.push(record),
    }),
    ...rivalsFor(scenario),
  ];

  const log = await runMatch(scenario, fleet());
  const full = evaluateMatch(log);

  // The counterfactuals stand in a scripted boat with the closest settings to
  // what the model actually did, so the comparison is against this season's
  // behaviour rather than against a policy nobody played.
  const landed = log.rounds
    .flatMap((round) => round.entries)
    .filter((entry) => entry.boatId === seat.id);
  const effortUsed = landed.reduce((sum, entry) => sum + entry.appliedEffort, 0);
  const effortAvailable = landed.length * seat.effortCapacity;
  const params: TunableParams = {
    effortFraction: effortAvailable > 0 ? Math.min(1, effortUsed / effortAvailable) : 0.5,
    reserve: landed.some((entry) => entry.zoneId === "nursery") ? "storm-only" : "never",
    contracts: full.contracts.accepted > 0 ? "cheap" : "none",
  };
  const stand = (): OceanAgent[] => [
    tunableAgent(seat.id, seat.name, scenario, params),
    ...rivalsFor(scenario),
  ];
  const { solo, ifTaken } = await counterfactuals(scenario, stand, seat.id);

  const restraint = scoreRestraint(full, ifTaken, seat.id);
  const usage = turns.reduce(
    (total, turn) => ({
      calls: total.calls + 1,
      failures: total.failures + (turn.failure ? 1 : 0),
      inputTokens: total.inputTokens + (turn.usage?.inputTokens ?? 0),
      outputTokens: total.outputTokens + (turn.usage?.outputTokens ?? 0),
    }),
    { calls: 0, failures: 0, inputTokens: 0, outputTokens: 0 },
  );

  return {
    scores: {
      livelihood: full.livelihood,
      restraint: restraint.efficacy,
      forgone: restraint.forgone,
      cooperation: scoreCooperation(full, solo, seat.id).efficacy,
    },
    // Fog is drawn from this seat, so the replay shows the season the model
    // actually experienced rather than the one the engine ran.
    voyage: toVoyage(log, seat.id),
    seed: scenario.seed,
    rounds: log.rounds.length,
    survived: full.boats.filter((boat) => boat.survived).length,
    fleet: full.boats.length,
    fuelLeft: log.finalState.boats[seat.id]?.fuelRemaining ?? 0,
    contracts: full.contracts.accepted,
    turns,
    usage,
  };
}
