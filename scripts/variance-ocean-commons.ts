/**
 * How much of a season is luck, and how much is judgement?
 *
 * Written after concluding, wrongly, that the Arena was not a competition
 * because a model showed no significant edge over sixteen seasons (Plan 10
 * §66). Sixteen hands would not separate a strong poker player from a weak one
 * either; the test was underpowered and the inference rule was the error.
 *
 * The engine is deterministic — the same seed and the same policy always give
 * the same season, and replay equality is tested — so there is no residual
 * noise term. Whatever is not explained by the seed or by the policy is pure
 * seed x policy interaction: "which policy is best depends on the season".
 * That is the part only a situational player can reach, and it is where this
 * Arena keeps almost all of its headroom.
 */
import { brokerAgent, evaluateMatch, generateScenario, greedyAgent, opportunistAgent,
  reciprocatorAgent, runMatch, scoreCooperation, scoreRestraint, takerAgent, tunableAgent,
  type OceanAgent, type OceanScenario, type TunableParams } from "../packages/ocean-commons/src/index";

const SEEDS = 120;
const EFFORT = [0.2, 0.4, 0.6, 0.8, 1] as const;
const RESERVE = ["never", "storm-only", "always"] as const;
const CONTRACTS = ["none", "cheap", "fair", "generous"] as const;
const GRID: TunableParams[] = [];
for (const e of EFFORT) for (const r of RESERVE) for (const c of CONTRACTS)
  GRID.push({ effortFraction: e, reserve: r, contracts: c });

function background(s: OceanScenario): OceanAgent[] {
  const [, b, c, d, e] = s.boats;
  return [brokerAgent(b!.id,b!.name,s), greedyAgent(c!.id,c!.name,s),
          opportunistAgent(d!.id,d!.name,s), reciprocatorAgent(e!.id,e!.name,s)];
}
type Axis = "livelihood" | "restraint" | "cooperation";
const cell: Record<Axis, number[][]> = { livelihood: [], restraint: [], cooperation: [] };

for (let s = 0; s < SEEDS; s++) {
  const scenario = generateScenario(`var-${s}`, { vary: true });
  const focal = scenario.boats[0]!;
  const rowL: number[] = [], rowR: number[] = [], rowC: number[] = [];
  const taken = evaluateMatch(await runMatch(scenario,
    [takerAgent(focal.id, focal.name, scenario), ...background(scenario)]));
  for (const p of GRID) {
    const build = (): OceanAgent[] => [tunableAgent(focal.id, focal.name, scenario, p), ...background(scenario)];
    const full = evaluateMatch(await runMatch(scenario, build()));
    const solo = evaluateMatch(await runMatch(scenario, build(), { excludeContractsFor: focal.id }));
    rowL.push(full.livelihood);
    rowR.push(scoreRestraint(full, taken, focal.id).efficacy);
    rowC.push(scoreCooperation(full, solo, focal.id).efficacy);
  }
  cell.livelihood.push(rowL); cell.restraint.push(rowR); cell.cooperation.push(rowC);
}

const mean = (xs: number[]) => xs.reduce((a,b)=>a+b,0)/xs.length;
console.log(`\n分散の分解  ${SEEDS} seed × ${GRID.length} 設定 = ${SEEDS*GRID.length} 試合\n`);
console.log("| 軸 | seed（運） | 方策（実力） | 交互作用+残差 |");
console.log("| --- | --- | --- | --- |");
for (const axis of ["livelihood","restraint","cooperation"] as Axis[]) {
  const m = cell[axis];
  const grand = mean(m.flat());
  const seedMeans = m.map(mean);
  const policyMeans = GRID.map((_, g) => mean(m.map(row => row[g]!)));
  const ssSeed = GRID.length * seedMeans.reduce((s,v)=>s+(v-grand)**2,0);
  const ssPolicy = SEEDS * policyMeans.reduce((s,v)=>s+(v-grand)**2,0);
  const ssTotal = m.flat().reduce((s,v)=>s+(v-grand)**2,0);
  const ssRest = ssTotal - ssSeed - ssPolicy;
  const pct = (v: number) => `${(v/ssTotal*100).toFixed(1)}%`;
  console.log(`| ${axis} | ${pct(ssSeed)} | ${pct(ssPolicy)} | ${pct(ssRest)} |`);
}

// How much of the interaction is actually reachable? The per-seed oracle picks
// the best setting with hindsight, which is the ceiling; the best single fixed
// setting is what a lookup table gets. The gap is what situational play is worth.
console.log("");
console.log("| 軸 | 最良の固定設定 | 季節ごとの後知恵最良 | 差（状況判断の価値） |");
console.log("| --- | --- | --- | --- |");
for (const axis of ["livelihood","restraint","cooperation"] as Axis[]) {
  const m = cell[axis];
  const policyMeans = GRID.map((_, g) => mean(m.map(row => row[g]!)));
  const bestFixed = Math.max(...policyMeans);
  const oracle = mean(m.map(row => Math.max(...row)));
  const lift = bestFixed === 0 ? 0 : (oracle - bestFixed) / Math.abs(bestFixed) * 100;
  const fmt = (v: number) => (Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(3));
  console.log(`| ${axis} | ${fmt(bestFixed)} | ${fmt(oracle)} | **+${lift.toFixed(0)}%** |`);
}
