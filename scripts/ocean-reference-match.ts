/**
 * Produces the numbers the Ocean Commons settlement records on Sepolia.
 *
 * The contract stores unsigned integers and makes exactly one comparison —
 * dominance — so the encoding here has to be monotone per axis and nothing
 * else. Any affine map with a positive slope preserves a partial order, which
 * is why a plain scale, plus one offset on the axis that can go negative, is
 * enough. Nothing is summed here or there.
 *
 * This runs the published reference entries over the same twelve seeds a
 * submission is scored on, so the figures that land on-chain are the figures
 * the Arena would give anybody sailing those approaches. It writes JSON to
 * stdout and sends nothing; `settle-ocean-match.sh` is what spends gas.
 */

import { keccak256, stringToHex } from "viem";

import {
  defaultOceanEntry,
  evaluateOceanEntry,
  oceanSubmissionSeeds,
  type OceanEntry,
  type OceanSeasonScores,
} from "../packages/ocean-commons/src/index";

/** Reference entries, matching the approaches the Arena publishes on its page. */
const REFERENCES: { id: string; name: string; entry: OceanEntry }[] = [
  {
    id: "steady",
    name: "Work the season",
    entry: {
      ...defaultOceanEntry,
      name: "Work the season",
      sailing: { effortFraction: 0.6, reserve: "never", contracts: "cheap" },
    },
  },
  {
    id: "hard",
    name: "Fill the hold",
    entry: {
      ...defaultOceanEntry,
      name: "Fill the hold",
      sailing: { effortFraction: 1, reserve: "storm-only", contracts: "none" },
    },
  },
  {
    id: "sparing",
    name: "Hold back",
    entry: {
      ...defaultOceanEntry,
      name: "Hold back",
      sailing: { effortFraction: 0.2, reserve: "never", contracts: "generous" },
    },
  },
  {
    id: "shut-wallet",
    name: "Closed wallet",
    // The same sailing as the first, with every contract kind forbidden. It is
    // here because it is the clearest demonstration that the wallet is enforced
    // by the match loop and not by the boat.
    entry: {
      ...defaultOceanEntry,
      name: "Closed wallet",
      wallet: { ...defaultOceanEntry.wallet, allowedPurposes: [] },
      sailing: { effortFraction: 0.6, reserve: "never", contracts: "cheap" },
    },
  },
];

/**
 * Parts per million, and one offset.
 *
 * Livelihood and restraint are non-negative by construction. Cooperation is a
 * difference against a counterfactual and can be either sign, so it carries a
 * half-unit offset to fit an unsigned field. The offset is a constant, so it
 * changes no comparison the contract makes.
 */
const SCALE = 1_000_000;
const COOPERATION_OFFSET = 0.5;

const MATCH_ID = keccak256(stringToHex("ocean-commons-v1:reference-match:1"));
const entryIdFor = (id: string) => keccak256(stringToHex(`ocean-commons-v1:entry:${id}`));

function encode(scores: {
  livelihood: number;
  restraint: number;
  cooperation: number;
}): [string, string, string] {
  const cooperation = scores.cooperation + COOPERATION_OFFSET;
  if (scores.livelihood < 0 || scores.restraint < 0 || cooperation < 0) {
    throw new Error(`Axis below the encodable floor: ${JSON.stringify(scores)}`);
  }
  return [
    String(Math.round(scores.livelihood * SCALE)),
    String(Math.round(scores.restraint * SCALE)),
    String(Math.round(cooperation * SCALE)),
  ];
}

/** Seasons this entry took an axis outright, counted the way the page counts them. */
function seasonsWon(
  mine: OceanSeasonScores[],
  all: OceanSeasonScores[][],
  key: "livelihood" | "restraint" | "cooperation",
): number {
  let won = 0;
  for (let season = 0; season < mine.length; ++season) {
    if (all.every((other) => mine[season]![key] >= other[season]![key])) won += 1;
  }
  return won;
}

async function main() {
  const scored = [];
  for (const reference of REFERENCES) {
    const evaluation = await evaluateOceanEntry(reference.entry);
    if (!evaluation.correctness) {
      throw new Error(`${reference.id} failed its own bounds: ${evaluation.constraintFailures.join("; ")}`);
    }
    scored.push({ reference, evaluation });
  }

  const perSeason = scored.map(({ evaluation }) => evaluation.perSeason);
  const entries = scored.map(({ reference, evaluation }, index) => ({
    id: reference.id,
    name: reference.name,
    entryId: entryIdFor(reference.id),
    raw: {
      livelihood: evaluation.livelihood,
      restraint: evaluation.restraint,
      cooperation: evaluation.cooperation,
    },
    outcomes: encode(evaluation),
    seasonsWon: [
      seasonsWon(perSeason[index]!, perSeason, "livelihood"),
      seasonsWon(perSeason[index]!, perSeason, "restraint"),
      seasonsWon(perSeason[index]!, perSeason, "cooperation"),
    ],
    resultHash: evaluation.resultHash,
  }));

  // Which entry each pool would back: the one that served that pool's outcome.
  // Computed here only so the transactions can be written down; the contract is
  // told the answer and never derives it, because a funder is free to disagree.
  const axes = ["livelihood", "restraint", "cooperation"] as const;
  const backing = axes.map((axis, outcome) => {
    const best = entries.reduce((left, right) => (right.raw[axis] > left.raw[axis] ? right : left));
    return { outcome, axis, entryId: best.entryId, id: best.id, name: best.name };
  });

  console.log(
    JSON.stringify(
      {
        matchId: MATCH_ID,
        seasons: oceanSubmissionSeeds.length,
        seeds: oceanSubmissionSeeds,
        encoding: { scale: SCALE, cooperationOffset: COOPERATION_OFFSET },
        entries,
        backing,
      },
      null,
      2,
    ),
  );
}

await main();
