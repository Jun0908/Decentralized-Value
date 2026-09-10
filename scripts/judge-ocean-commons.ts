/**
 * Plan 10, Phase 1a — can a model beat the best fixed setting?
 *
 * This is the question Phase 0 could not ask. Every hand-written baseline is
 * itself a fixed rule, so a grid sweep always found something at least as
 * good; only an agent that reads the board can settle it.
 *
 * ── PRE-REGISTERED, BEFORE ANY MATCH WAS RUN ─────────────────────────────
 *
 * Opponents. One fixed setting per axis, each chosen on practice seeds 0-29
 * and confirmed on unseen seeds 30-59 (ranks 1st, 2nd and 1st of 60):
 *   livelihood    e1   storm-only cheap
 *   stewardship   e0.2 storm-only cheap
 *   cooperation   e1   always     cheap
 *
 * Design. Paired: the model and the fixed setting take the same seat, on the
 * same seed, against the same four scripted boats, over the same weather.
 * Seeds are `judge-*`, used by nothing else — no tuning has seen them.
 *
 * Test. Wilcoxon signed-rank on the per-seed differences, two-sided, p<0.05.
 * Chosen over a sign test because it uses the size of each difference, which
 * matters at this sample size. The win rate is reported alongside but is not
 * the test.
 *
 * Verdict, fixed in advance:
 *   BEATS      model above the fixed setting, p<0.05
 *   NO EFFECT  p>=0.05 — the sweep's conclusion stands, adaptivity buys nothing
 *   LOSES      model below the fixed setting, p<0.05
 *
 * A NO EFFECT on all three axes is a real answer, not a failed experiment: it
 * would mean this arena does not reward reading the board, and no amount of
 * model quality would change that.
 *
 *   OPENAI_API_KEY=... npx tsx scripts/judge-ocean-commons.ts [seeds] [effort] [concurrency]
 */

import {
  brokerAgent,
  cautiousAgent,
  evaluateMatch,
  generateScenario,
  greedyAgent,
  llmAgent,
  opportunistAgent,
  openaiBackend,
  recordedActionsFor,
  recordedAgent,
  runMatch,
  scoreCooperation,
  tunableAgent,
  type LlmTurnRecord,
  type OceanAgent,
  type OceanScenario,
  type TunableParams,
} from "../packages/ocean-commons/src/index";

const SEEDS = Number(process.argv[2] ?? 12);
const EFFORT = (process.argv[3] ?? "low") as "minimal" | "low" | "medium" | "high";
const CONCURRENCY = Number(process.argv[4] ?? 4);
const ROUNDS = 12;

type Axis = "livelihood" | "stewardship" | "cooperation";
const AXES: Axis[] = ["livelihood", "stewardship", "cooperation"];

const CHAMPION: Record<Axis, TunableParams> = {
  livelihood: { effortFraction: 1, reserve: "storm-only", contracts: "cheap" },
  stewardship: { effortFraction: 0.2, reserve: "storm-only", contracts: "cheap" },
  cooperation: { effortFraction: 1, reserve: "always", contracts: "cheap" },
};

const MISSION = `Keep the crew paid: finish the season solvent and with a working boat.

Do not empty the sea to do it. A ground you strip past its critical stock never
comes back, and the nursery reserve is what feeds the grounds you fish.

You may pay other boats to hold back, and you may take their money to hold back
yourself, when the arithmetic favours it. Judge each offer on what it is worth,
not on whether cooperating sounds virtuous.`;

/** Held identical for both entrants so the seat is the only thing that differs. */
function background(scenario: OceanScenario): OceanAgent[] {
  const [, b, c, d, e] = scenario.boats;
  return [
    brokerAgent(b!.id, b!.name, scenario),
    greedyAgent(c!.id, c!.name, scenario),
    opportunistAgent(d!.id, d!.name, scenario),
    cautiousAgent(e!.id, e!.name, scenario),
  ];
}

type Scores = Record<Axis, number> & { zoneChoices: Record<string, number>; calls: number };

async function scoreEntrant(
  scenario: OceanScenario,
  build: () => OceanAgent,
  calls: { n: number },
): Promise<Scores> {
  const focal = scenario.boats[0]!;
  const fleet = [build(), ...background(scenario)];
  const log = await runMatch(scenario, fleet);
  const full = evaluateMatch(log);

  // The counterfactual replays this boat's own fishing, so it costs nothing.
  const solo = evaluateMatch(
    await runMatch(
      scenario,
      [recordedAgent(focal.id, focal.name, recordedActionsFor(log, focal.id)), ...fleet.slice(1)],
      { excludeContractsFor: focal.id },
    ),
  );

  const mine: Record<string, number> = {};
  for (const record of log.rounds) {
    const entry = record.entries.find((candidate) => candidate.boatId === focal.id);
    if (entry?.zoneId && entry.appliedEffort > 0) {
      mine[entry.zoneId] = (mine[entry.zoneId] ?? 0) + 1;
    }
  }

  return {
    livelihood: full.livelihood,
    stewardship: full.stewardship,
    cooperation: scoreCooperation(full, solo, focal.id).efficacy,
    zoneChoices: mine,
    calls: calls.n,
  };
}

// --- statistics -----------------------------------------------------------

/** Two-sided Wilcoxon signed-rank, normal approximation with tie correction. */
function wilcoxon(differences: readonly number[]): { p: number; n: number } {
  const nonZero = differences.filter((d) => Math.abs(d) > 1e-12);
  const n = nonZero.length;
  if (n < 6) return { p: 1, n };

  const sorted = [...nonZero].map((d) => ({ abs: Math.abs(d), sign: Math.sign(d) }));
  sorted.sort((a, b) => a.abs - b.abs);
  const ranks = new Array<number>(n);
  let i = 0;
  const tieGroups: number[] = [];
  while (i < n) {
    let j = i;
    while (j + 1 < n && sorted[j + 1]!.abs === sorted[i]!.abs) j += 1;
    const average = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) ranks[k] = average;
    tieGroups.push(j - i + 1);
    i = j + 1;
  }

  let positive = 0;
  for (let k = 0; k < n; k += 1) if (sorted[k]!.sign > 0) positive += ranks[k]!;

  const mean = (n * (n + 1)) / 4;
  const tieAdjust = tieGroups.reduce((sum, t) => sum + (t ** 3 - t), 0) / 48;
  const sd = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24 - tieAdjust);
  if (sd === 0) return { p: 1, n };
  const z = (positive - mean) / sd;
  // Two-sided normal tail, Abramowitz & Stegun 7.1.26.
  const a = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * a);
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-a * a);
  return { p: 1 - erf, n };
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
};

/** Runs jobs with a ceiling on how many are in flight, to respect rate limits. */
async function pooled<T>(jobs: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results = new Array<T>(jobs.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, jobs.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= jobs.length) return;
      results[index] = await jobs[index]!();
    }
  });
  await Promise.all(workers);
  return results;
}

// --- run ------------------------------------------------------------------

console.log(`Ocean Commons — Phase 1a judgement`);
console.log(`seeds=${SEEDS}  rounds=${ROUNDS}  effort=${EFFORT}  concurrency=${CONCURRENCY}\n`);

const started = Date.now();
const turns: LlmTurnRecord[] = [];

const jobs = Array.from({ length: SEEDS }, (_, index) => async () => {
  const scenario = generateScenario(`judge-${index}`, { vary: true, rounds: ROUNDS });
  const focal = scenario.boats[0]!;
  const calls = { n: 0 };

  const model = await scoreEntrant(
    scenario,
    () =>
      llmAgent(focal.id, focal.name, scenario, {
        mission: MISSION,
        backend: openaiBackend({ reasoningEffort: EFFORT }),
        onTurn: (record) => {
          calls.n += 1;
          turns.push(record);
        },
      }),
    calls,
  );

  const fixed: Record<Axis, Scores> = {} as never;
  for (const axis of AXES) {
    fixed[axis] = await scoreEntrant(
      scenario,
      () => tunableAgent(focal.id, focal.name, scenario, CHAMPION[axis]!),
      { n: 0 },
    );
  }
  process.stdout.write(".");
  return { model, fixed };
});

const rows = await pooled(jobs, CONCURRENCY);
const elapsed = (Date.now() - started) / 1000;
console.log("\n");

// --- verdict --------------------------------------------------------------

console.log("| 軸 | 対戦相手 | modelの中央値 | 固定の中央値 | 勝率 | p値 | 判定 |");
console.log("| --- | --- | --- | --- | --- | --- | --- |");

for (const axis of AXES) {
  const modelScores = rows.map((row) => row.model[axis]);
  const fixedScores = rows.map((row) => row.fixed[axis]![axis]);
  const differences = modelScores.map((value, index) => value - fixedScores[index]!);
  const wins = differences.filter((d) => d > 0).length;
  const { p } = wilcoxon(differences);
  const better = median(modelScores) > median(fixedScores);
  const verdict = p >= 0.05 ? "NO EFFECT" : better ? "**BEATS**" : "LOSES";
  const label = `e${CHAMPION[axis]!.effortFraction} ${CHAMPION[axis]!.reserve} ${CHAMPION[axis]!.contracts}`;
  console.log(
    `| ${axis} | ${label} | ${median(modelScores).toFixed(3)} | ${median(fixedScores).toFixed(3)} | ` +
      `${wins}/${rows.length} | ${p.toFixed(3)} | ${verdict} |`,
  );
}

// --- herding evidence (Plan10 §35.5) --------------------------------------

const modelZones: Record<string, number> = {};
for (const row of rows) {
  for (const [zone, count] of Object.entries(row.model.zoneChoices)) {
    modelZones[zone] = (modelZones[zone] ?? 0) + count;
  }
}
const zoneTotal = Object.values(modelZones).reduce((sum, value) => sum + value, 0);
console.log(
  `\nmodel の漁場選択  ` +
    Object.entries(modelZones)
      .map(([zone, count]) => `${zone} ${((count / zoneTotal) * 100).toFixed(0)}%`)
      .join("  "),
);

const usage = turns.reduce(
  (sum, turn) => ({
    input: sum.input + (turn.usage?.inputTokens ?? 0),
    output: sum.output + (turn.usage?.outputTokens ?? 0),
  }),
  { input: 0, output: 0 },
);
console.log(
  `モデル呼び出し    ${turns.length} 回 (${turns.filter((t) => t.failure).length} 失敗)  ` +
    `入力 ${usage.input} / 出力 ${usage.output} トークン`,
);
console.log(`実時間            ${elapsed.toFixed(0)}秒  (${(elapsed / SEEDS).toFixed(0)}秒/seed)`);
