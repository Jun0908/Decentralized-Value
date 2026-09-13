/**
 * Plan 10, Phase 0 — is the arena simply solvable?
 *
 * Sweeps a parameterised policy over its entire grid on every seed. The
 * question is not which setting is best on average but whether the *same*
 * setting is best everywhere. A single dominant vector means no agent can do
 * better than a lookup table, and the arena is not a competition; different
 * seeds preferring different settings means there is something to be good at.
 *
 *   npx tsx scripts/solve-ocean-commons.ts [seeds] [trainSplit]
 */

import {
  brokerAgent,
  reciprocatorAgent,
  evaluateMatch,
  generateScenario,
  greedyAgent,
  opportunistAgent,
  runMatch,
  scoreCooperation,
  scoreRestraint,
  takerAgent,
  tunableAgent,
  type OceanAgent,
  type OceanScenario,
  type TunableParams,
} from "../packages/ocean-commons/src/index";

const SEEDS = Number(process.argv[2] ?? 200);
/** Seeds below this index are "practice"; the rest are unseen finals. */
const TRAIN = Number(process.argv[3] ?? Math.floor(SEEDS / 2));

const EFFORT = [0.2, 0.4, 0.6, 0.8, 1] as const;
const RESERVE = ["never", "storm-only", "always"] as const;
const CONTRACTS = ["none", "cheap", "fair", "generous"] as const;

const GRID: TunableParams[] = [];
for (const effortFraction of EFFORT) {
  for (const reserve of RESERVE) {
    for (const contracts of CONTRACTS) GRID.push({ effortFraction, reserve, contracts });
  }
}

const label = (p: TunableParams) => `e${p.effortFraction} ${p.reserve} ${p.contracts}`;

/** Held fixed so the swept policy is the only thing that varies. */
// The fleet the Arena ships: three maximisers and one boat that answers back.
function background(scenario: OceanScenario): OceanAgent[] {
  const [, b, c, d, e] = scenario.boats;
  return [
    brokerAgent(b!.id, b!.name, scenario),
    greedyAgent(c!.id, c!.name, scenario),
    opportunistAgent(d!.id, d!.name, scenario),
    reciprocatorAgent(e!.id, e!.name, scenario),
  ];
}

type Axis = "livelihood" | "restraint" | "cooperation";
const AXES: Axis[] = ["livelihood", "restraint", "cooperation"];

// scores[axis][gridIndex][seedIndex]
const scores: Record<Axis, number[][]> = {
  livelihood: GRID.map(() => []),
  restraint: GRID.map(() => []),
  cooperation: GRID.map(() => []),
};

const started = Date.now();
for (let seedIndex = 0; seedIndex < SEEDS; seedIndex += 1) {
  const scenario = generateScenario(`solve-${seedIndex}`, { vary: true });
  const focal = scenario.boats[0]!;

  for (let g = 0; g < GRID.length; g += 1) {
    const build = (): OceanAgent[] => [
      tunableAgent(focal.id, focal.name, scenario, GRID[g]!),
      ...background(scenario),
    ];
    const full = evaluateMatch(await runMatch(scenario, build()));
    const solo = evaluateMatch(
      await runMatch(scenario, build(), { excludeContractsFor: focal.id }),
    );
    const ifTaken = evaluateMatch(
      await runMatch(scenario, [
        takerAgent(focal.id, focal.name, scenario),
        ...background(scenario),
      ]),
    );
    scores.livelihood[g]!.push(full.livelihood);
    scores.restraint[g]!.push(scoreRestraint(full, ifTaken, focal.id).efficacy);
    scores.cooperation[g]!.push(scoreCooperation(full, solo, focal.id).efficacy);
  }
}
const elapsed = (Date.now() - started) / 1000;

// --- A. does one setting win everywhere? ----------------------------------

console.log(`\nOcean Commons — Phase 0 / 全探索可能性`);
console.log(
  `grid=${GRID.length} settings  seeds=${SEEDS}  matches=${GRID.length * SEEDS * 2}  elapsed=${elapsed.toFixed(1)}s\n`,
);

console.log("| 軸 | 最頻の勝者 | その勝率 | 勝者の種類数 | 判定 |");
console.log("| --- | --- | --- | --- | --- |");

const verdicts: { axis: Axis; share: number; distinct: number }[] = [];
for (const axis of AXES) {
  const wins = new Map<number, number>();
  for (let s = 0; s < SEEDS; s += 1) {
    let best = 0;
    for (let g = 1; g < GRID.length; g += 1) {
      if (scores[axis][g]![s]! > scores[axis][best]![s]!) best = g;
    }
    wins.set(best, (wins.get(best) ?? 0) + 1);
  }
  const [topIndex, topWins] = [...wins.entries()].sort((a, b) => b[1] - a[1])[0]!;
  const share = topWins / SEEDS;
  verdicts.push({ axis, share, distinct: wins.size });
  // A single setting taking most seeds is a lookup table beating the arena.
  const verdict = share >= 0.8 ? "**解けている**" : share >= 0.5 ? "偏りあり" : "解けていない";
  console.log(
    `| ${axis} | ${label(GRID[topIndex]!)} | ${(share * 100).toFixed(0)}% | ${wins.size} | ${verdict} |`,
  );
}

// A setting that tops every axis at once would end the arena outright.
const perAxisTop = AXES.map((axis) => {
  const wins = new Map<number, number>();
  for (let s = 0; s < SEEDS; s += 1) {
    let best = 0;
    for (let g = 1; g < GRID.length; g += 1) {
      if (scores[axis][g]![s]! > scores[axis][best]![s]!) best = g;
    }
    wins.set(best, (wins.get(best) ?? 0) + 1);
  }
  return [...wins.entries()].sort((a, b) => b[1] - a[1])[0]![0];
});
console.log(
  `\n3軸すべてを取る単一設定: ${new Set(perAxisTop).size === 1 ? `あり (${label(GRID[perAxisTop[0]!]!)}) — STOP相当` : "なし"}`,
);

// --- B. does a setting tuned on practice hold up on unseen seeds? ---------

console.log(
  `\n--- 一般化 (Practice seed 0-${TRAIN - 1} で選び、Final seed ${TRAIN}-${SEEDS - 1} で評価) ---`,
);
console.log("| 軸 | Practiceでの最良設定 | Final順位 | 全体順位の相関 |");
console.log("| --- | --- | --- | --- |");

const mean = (v: readonly number[]) => v.reduce((a, b) => a + b, 0) / v.length;
function ranks(values: readonly number[]): number[] {
  const idx = values.map((value, index) => ({ value, index }));
  idx.sort((a, b) => b.value - a.value);
  const out = new Array<number>(values.length);
  idx.forEach((entry, position) => (out[entry.index] = position + 1));
  return out;
}
function spearman(a: readonly number[], b: readonly number[]): number {
  const ra = ranks(a);
  const rb = ranks(b);
  const ma = mean(ra);
  const mb = mean(rb);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < ra.length; i += 1) {
    num += (ra[i]! - ma) * (rb[i]! - mb);
    da += (ra[i]! - ma) ** 2;
    db += (rb[i]! - mb) ** 2;
  }
  return num / Math.sqrt(da * db);
}

for (const axis of AXES) {
  const practice = GRID.map((_, g) => mean(scores[axis][g]!.slice(0, TRAIN)));
  const final = GRID.map((_, g) => mean(scores[axis][g]!.slice(TRAIN)));
  let bestPractice = 0;
  for (let g = 1; g < GRID.length; g += 1)
    if (practice[g]! > practice[bestPractice]!) bestPractice = g;
  const finalRank = ranks(final)[bestPractice]!;
  console.log(
    `| ${axis} | ${label(GRID[bestPractice]!)} | ${finalRank}位 / ${GRID.length} | ρ=${spearman(practice, final).toFixed(3)} |`,
  );
}

// --- C. does the ranking survive a different final pack? ------------------

console.log(`\n--- Final Pack 感度 (20 Seed のPackを5本作り、順位が一致するか) ---`);
const PACK = 20;
for (const axis of AXES) {
  const packRanks: number[][] = [];
  for (let p = 0; p + PACK <= Math.min(SEEDS, PACK * 5); p += PACK) {
    packRanks.push(ranks(GRID.map((_, g) => mean(scores[axis][g]!.slice(p, p + PACK)))));
  }
  const pairs: number[] = [];
  for (let i = 0; i < packRanks.length; i += 1) {
    for (let j = i + 1; j < packRanks.length; j += 1) {
      pairs.push(
        spearman(
          packRanks[i]!.map((r) => -r),
          packRanks[j]!.map((r) => -r),
        ),
      );
    }
  }
  const top = packRanks.map((r) => r.indexOf(1));
  console.log(
    `${axis.padEnd(12)} Pack間の順位相関 ρ=${mean(pairs).toFixed(3)}   各Packの1位: ${[...new Set(top)].length} 種類`,
  );
}
