/**
 * Is there anything to be good at?
 *
 * Phase 0's ten criteria all passed while the arena was degenerate, because
 * none of them asked the one question that matters for an agent benchmark:
 * does the best setting sit in the interior, or at an end of the dial?
 *
 * An axis that rises monotonically with effort is maximised by effort=1, and
 * one that falls monotonically is maximised by effort=0. Both optima are at a
 * boundary, reachable without reading anything about the situation. A grid
 * sweep finds them, an LLM cannot beat them, and no amount of skill separates
 * two players. That is not a hard arena — it is a dial with a printed answer.
 *
 * What makes an arena worth entering is an interior optimum whose location
 * MOVES: fishing harder pays until the stock crosses its collapse threshold,
 * and where that line falls depends on the weather, the seed, and what the
 * other boats are doing. Then reading the situation is worth something.
 *
 * Usage:
 *   OCEAN_PRESSURE=2 npx tsx scripts/monotonicity-ocean-commons.ts [seeds]
 */

import {
  brokerAgent,
  evaluateMatch,
  generateScenario,
  greedyAgent,
  opportunistAgent,
  runMatch,
  reciprocatorAgent,
  scoreCooperation,
  scoreRestraint,
  takerAgent,
  tunableAgent,
  type OceanAgent,
  type OceanScenario,
  type TunableParams,
} from "../packages/ocean-commons/src/index";

const SEEDS = Number(process.argv[2] ?? 80);
const EFFORT = [0.2, 0.4, 0.6, 0.8, 1] as const;
type Axis = "livelihood" | "stewardship" | "restraint" | "cooperation";
const AXES: Axis[] = ["livelihood", "stewardship", "restraint", "cooperation"];

/**
 * Who the entrant is sailing against.
 *
 * The original four guarantee the sea is stripped no matter what the entrant
 * does — measured over 60 seeds they end a season at 0.07 of capacity with one
 * boat in five still solvent, while a fleet of restrained boats ends at 0.88
 * with 98% solvent and still lands half the sea's capacity. Against opponents
 * that will take everything regardless, holding back buys nothing, which is
 * why the restraint axis had nothing to measure.
 */
const BACKGROUND = process.env["OCEAN_BACKGROUND"] ?? "mixed";

function background(scenario: OceanScenario): OceanAgent[] {
  const [, b, c, d, e] = scenario.boats;
  if (BACKGROUND === "reactive") {
    return [
      brokerAgent(b!.id, b!.name, scenario),
      enforcerAgent(c!.id, c!.name, scenario),
      opportunistAgent(d!.id, d!.name, scenario),
      cautiousAgent(e!.id, e!.name, scenario),
    ];
  }
  if (BACKGROUND === "enforcer") {
    return [
      brokerAgent(b!.id, b!.name, scenario),
      enforcerAgent(c!.id, c!.name, scenario),
      enforcerAgent(d!.id, d!.name, scenario),
      cautiousAgent(e!.id, e!.name, scenario),
    ];
  }
  // The fleet the Arena actually ships (see the workbench): three maximisers
  // and one boat that answers back. The earlier line-up predated
  // `reciprocatorAgent` and so measured a world nobody plays in.
  return [
    brokerAgent(b!.id, b!.name, scenario),
    greedyAgent(c!.id, c!.name, scenario),
    opportunistAgent(d!.id, d!.name, scenario),
    reciprocatorAgent(e!.id, e!.name, scenario),
  ];
}

const mean = (xs: number[]) => xs.reduce((sum, x) => sum + x, 0) / xs.length;

// scores[axis][effortIndex][seedIndex]
const scores: Record<Axis, number[][]> = {
  livelihood: EFFORT.map(() => []),
  stewardship: EFFORT.map(() => []),
  restraint: EFFORT.map(() => []),
  cooperation: EFFORT.map(() => []),
};
const survival: number[][] = EFFORT.map(() => []);

const started = Date.now();
for (let seedIndex = 0; seedIndex < SEEDS; seedIndex += 1) {
  const scenario = generateScenario(`mono-${seedIndex}`, { vary: true });
  const focal = scenario.boats[0]!;

  for (let e = 0; e < EFFORT.length; e += 1) {
    const params: TunableParams = {
      effortFraction: EFFORT[e]!,
      reserve: "never",
      contracts: "cheap",
    };
    const build = (): OceanAgent[] => [
      tunableAgent(focal.id, focal.name, scenario, params),
      ...background(scenario),
    ];
    const full = evaluateMatch(await runMatch(scenario, build()));
    const solo = evaluateMatch(
      await runMatch(scenario, build(), { excludeContractsFor: focal.id }),
    );
    // The same seed with this seat swapped for the boat that takes everything.
    const ifTaken = evaluateMatch(
      await runMatch(scenario, [
        takerAgent(focal.id, focal.name, scenario),
        ...background(scenario),
      ]),
    );
    scores.livelihood[e]!.push(full.livelihood);
    scores.stewardship[e]!.push(full.stewardship);
    scores.restraint[e]!.push(scoreRestraint(full, ifTaken, focal.id).efficacy);
    scores.cooperation[e]!.push(scoreCooperation(full, solo, focal.id).efficacy);
    survival[e]!.push(full.boats.filter((boat) => boat.survived).length / full.boats.length);
  }
}
const elapsed = (Date.now() - started) / 1000;

const pressure = Number(process.env["OCEAN_PRESSURE"] ?? 1);
console.log(`\nOcean Commons — 単調性 (圧力 ${pressure}x)`);
console.log(
  `seeds=${SEEDS}  matches=${SEEDS * EFFORT.length * 3}  elapsed=${elapsed.toFixed(1)}s\n`,
);

console.log("| effort | livelihood | stewardship | restraint | cooperation | 生存率 |");
console.log("| --- | --- | --- | --- | --- | --- |");
for (let e = 0; e < EFFORT.length; e += 1) {
  console.log(
    `| ${EFFORT[e]!.toFixed(1)} | ${mean(scores.livelihood[e]!).toFixed(1)} | ` +
      `${mean(scores.stewardship[e]!).toFixed(4)} | ${mean(scores.restraint[e]!).toFixed(4)} | ` +
      `${mean(scores.cooperation[e]!).toFixed(4)} | ` +
      `${(mean(survival[e]!) * 100).toFixed(0)}% |`,
  );
}

/**
 * Where the axis peaks on average, and how often a seed's own peak sits away
 * from the fleet-wide one. The second number is the real prize: if every seed
 * peaks in the same place, one constant still answers the whole arena.
 */
console.log(
  "\n| 軸 | 平均の最良effort | 内点か | 端に対する優位 | seedごとの最良がばらける率 | 判定 |",
);
console.log("| --- | --- | --- | --- | --- | --- |");

/**
 * How much better the peak is than the better of the two ends.
 *
 * Without this, a dead flat axis passes: every setting scores the same, so the
 * mean peak lands somewhere in the middle by rounding and each seed's argmax
 * falls wherever noise puts it — which reads as "interior optimum, highly
 * situational" when nothing is happening at all. The first run of this script
 * scored surplus production 0.2501/0.2504/0.2512/0.2502/0.2495 and called it a
 * PASS. A peak has to be worth reaching.
 */
const LIFT_THRESHOLD = 0.03;

let interiorAxes = 0;
for (const axis of AXES) {
  const means = EFFORT.map((_, e) => mean(scores[axis][e]!));
  const bestIndex = means.indexOf(Math.max(...means));
  const interior = bestIndex > 0 && bestIndex < EFFORT.length - 1;
  const bestEnd = Math.max(means[0]!, means[means.length - 1]!);
  const lift = bestEnd === 0 ? 0 : (means[bestIndex]! - bestEnd) / Math.abs(bestEnd);

  let awayFromMode = 0;
  for (let s = 0; s < SEEDS; s += 1) {
    const perSeed = EFFORT.map((_, e) => scores[axis][e]![s]!);
    const seedBest = perSeed.indexOf(Math.max(...perSeed));
    if (seedBest !== bestIndex) awayFromMode += 1;
  }
  const spread = awayFromMode / SEEDS;
  // Three things must hold together: the optimum is off the boundary, it is
  // worth more than the boundary by a margin a player could feel, and it moves
  // with the seed. Any two without the third describes a dial, not an arena.
  const pass = interior && lift >= LIFT_THRESHOLD && spread >= 0.4;
  if (pass) interiorAxes += 1;

  console.log(
    `| ${axis} | ${EFFORT[bestIndex]!.toFixed(1)} | ${interior ? "内点" : "端"} | ` +
      `${(lift * 100).toFixed(1)}% | ${(spread * 100).toFixed(0)}% | ${pass ? "PASS" : "FAIL"} |`,
  );
}

console.log(
  `\n判定: ${interiorAxes >= 2 ? "GO" : "PIVOT"} — 内点かつ状況依存の軸 ${interiorAxes}/3 (>=2 で GO)`,
);

// --- independence ----------------------------------------------------------
//
// Three axes that move together are one axis with three names. Phase 0's
// criterion #7 asks for max|rho| < 0.8; it passed while all three were monotone
// in the same dial, because monotone-up and monotone-down are still |rho|=1
// apart in opposite directions and the check only looks at magnitude per pair.
// Worth re-reading now that the axes are supposed to be genuinely different.

function spearman(a: number[], b: number[]): number {
  const rank = (xs: number[]): number[] => {
    const order = xs.map((value, index) => ({ value, index })).sort((l, r) => l.value - r.value);
    const ranks = new Array<number>(xs.length);
    for (let i = 0; i < order.length;) {
      let j = i;
      while (j + 1 < order.length && order[j + 1]!.value === order[i]!.value) j += 1;
      const shared = (i + j) / 2 + 1;
      for (let k = i; k <= j; k += 1) ranks[order[k]!.index] = shared;
      i = j + 1;
    }
    return ranks;
  };
  const ra = rank(a);
  const rb = rank(b);
  const n = a.length;
  const mean_ = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const ma = mean_(ra);
  const mb = mean_(rb);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i += 1) {
    const x = ra[i]! - ma;
    const y = rb[i]! - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  return da === 0 || db === 0 ? 0 : num / Math.sqrt(da * db);
}

// Pool every (seed, effort) run: the question is whether a player who moves up
// one axis is dragged along the others, whatever setting they arrived by.
const pooled: Record<Axis, number[]> = {
  livelihood: [],
  stewardship: [],
  restraint: [],
  cooperation: [],
};
for (const axis of AXES) for (const column of scores[axis]) pooled[axis].push(...column);

console.log("\n| 軸の組 | ρ |");
console.log("| --- | --- |");
const shown: Axis[] = ["livelihood", "restraint", "cooperation"];
let worst = 0;
for (let i = 0; i < shown.length; i += 1) {
  for (let j = i + 1; j < shown.length; j += 1) {
    const rho = spearman(pooled[shown[i]!], pooled[shown[j]!]);
    worst = Math.max(worst, Math.abs(rho));
    console.log(`| ${shown[i]} ~ ${shown[j]} | ${rho.toFixed(3)} |`);
  }
}
console.log(`\n独立性: max|ρ|=${worst.toFixed(3)} ${worst < 0.8 ? "PASS" : "FAIL"} (< 0.8)`);
