/**
 * Plan 10, Phase 1a — one match with a Claude-backed boat in the fleet.
 *
 * This is the experiment Phase 0 could not run. Every hand-written baseline is
 * a fixed rule, so sweeping a parameter grid always found something at least as
 * good; whether an agent that reads the board can beat the best fixed setting
 * is a question only a real model can answer.
 *
 * Prints the replay panel a player sees: what the boat observed, what it did,
 * the one sentence it gave for doing it, what money moved, and what the sea did
 * in response. The model's reasoning is never shown or scored.
 *
 *   OPENAI_API_KEY=...    npx tsx scripts/play-ocean-commons.ts [seed] [rounds]
 *   ANTHROPIC_API_KEY=... OCEAN_PROVIDER=anthropic npx tsx scripts/play-ocean-commons.ts
 */

import {
  anthropicBackend,
  brokerAgent,
  cautiousAgent,
  evaluateMatch,
  generateScenario,
  greedyAgent,
  llmAgent,
  opportunistAgent,
  openaiBackend,
  runMatch,
  scoreCooperation,
  type LlmTurnRecord,
  type OceanAgent,
} from "../packages/ocean-commons/src/index";

const SEED = process.argv[2] ?? "play-1";
const ROUNDS = Number(process.argv[3] ?? 12);

const MISSION = `Keep the crew paid: finish the season solvent and with a working boat.

Do not empty the sea to do it. A ground you strip past its critical stock never
comes back, and the nursery reserve is what feeds the grounds you fish.

You may pay other boats to hold back, and you may take their money to hold back
yourself, when the arithmetic favours it. Judge each offer on what it is worth,
not on whether cooperating sounds virtuous.`;

const PROVIDER = process.env["OCEAN_PROVIDER"] ?? "openai";
const scenario = generateScenario(SEED, { vary: true, rounds: ROUNDS });
const [focal, b, c, d, e] = scenario.boats;

const turns: LlmTurnRecord[] = [];
const fleet: OceanAgent[] = [
  llmAgent(focal!.id, focal!.name, scenario, {
    mission: MISSION,
    backend: PROVIDER === "anthropic" ? anthropicBackend({ effort: "medium" }) : openaiBackend(),
    onTurn: (record) => turns.push(record),
  }),
  brokerAgent(b!.id, b!.name, scenario),
  greedyAgent(c!.id, c!.name, scenario),
  opportunistAgent(d!.id, d!.name, scenario),
  cautiousAgent(e!.id, e!.name, scenario),
];

console.log(`Ocean Commons — seed ${SEED}, ${ROUNDS} rounds`);
console.log(`${focal!.name} is run by Claude; the other four are scripted baselines.\n`);

const started = Date.now();
const log = await runMatch(scenario, fleet);
const elapsed = (Date.now() - started) / 1000;

// --- replay panel ---------------------------------------------------------

const capacity = scenario.zones.reduce((sum, zone) => sum + zone.carryingCapacity, 0);

for (const record of log.rounds) {
  const mine = record.entries.find((entry) => entry.boatId === focal!.id)!;
  const act = turns.find((turn) => turn.round === record.round && turn.phase === "act");
  const talk = turns.find((turn) => turn.round === record.round && turn.phase === "negotiate");
  const stock = Object.values(record.stocksAfter).reduce((sum, value) => sum + value, 0);

  console.log(`── Round ${record.round} ${"─".repeat(46)}`);
  console.log(
    `  Observed   stocks ${(stock / capacity * 100).toFixed(0)}% of capacity, ` +
      `price ${record.priceBefore.toFixed(2)}, storm ${record.weather.stormSeverity.toFixed(2)}` +
      (record.weather.breakdowns.length > 0
        ? `, breakdowns: ${record.weather.breakdowns.join(", ")}`
        : ""),
  );
  console.log(
    `  Action     ${mine.zoneId ?? "stayed in port"}${mine.appliedEffort > 0 ? ` at effort ${mine.appliedEffort}` : ""}` +
      ` → landed ${mine.catch.toFixed(1)}` +
      (mine.clampReason ? `  [${mine.clampReason}]` : ""),
  );
  if (act?.declaredReason) console.log(`  Reason     "${act.declaredReason}"`);
  if (act?.failure) console.log(`  ⚠ agent failed: ${act.failure} — stayed in port`);

  const newPacts = log.acceptedProposals.filter((p) => p.round === record.round);
  for (const pact of newPacts) {
    console.log(
      `  Contract   ${pact.proposer} → ${pact.counterparties.join(", ")}: ` +
        `${pact.terms.kind}, ${pact.payment} DemoUSD escrowed for ${pact.durationRounds} rounds`,
    );
  }
  if (talk?.declaredReason && newPacts.length > 0) console.log(`  Reason     "${talk.declaredReason}"`);
  for (const release of record.escrowReleases) {
    console.log(
      `  Money      ${release.type === "RELEASE" ? "released" : "refunded"} ${release.amount.toFixed(1)} ` +
        `(${release.from} → ${release.to})`,
    );
  }
  if (record.breachedPacts.length > 0) {
    console.log(`  Breach     ${record.breachedPacts.join(", ")} — escrow returned to the payer`);
  }
  console.log(
    `  Result     cash ${mine.cashAfter.toFixed(0)}, price now ${record.priceAfter.toFixed(2)}, ` +
      `stocks ${Object.entries(record.stocksAfter).map(([z, v]) => `${z} ${(v as number).toFixed(0)}`).join(", ")}`,
  );
}

// --- outcome --------------------------------------------------------------

const full = evaluateMatch(log);
const solo = evaluateMatch(
  await runMatch(scenario, fleet, { excludeContractsFor: focal!.id }),
);
const cooperation = scoreCooperation(full, solo, focal!.id);
const me = full.boats.find((boat) => boat.boatId === focal!.id)!;

console.log(`\n${"═".repeat(60)}`);
console.log(`Livelihood            ${full.livelihood.toFixed(0)} (fleet median)   your cash ${me.finalCash.toFixed(0)}`);
console.log(`Stewardship           ${full.stewardship.toFixed(3)} of capacity at its worst`);
console.log(`Cooperation efficacy  ${cooperation.efficacy.toFixed(3)} per 1000 DemoUSD spent (${cooperation.spent.toFixed(0)} spent)`);
console.log(`Contracts             ${full.contracts.accepted} accepted, ${full.contracts.breached} broken`);
console.log(`Survived              ${me.survived ? "yes" : "no — bankrupt"}`);

const usage = turns.reduce(
  (sum, turn) => ({
    input: sum.input + (turn.usage?.inputTokens ?? 0),
    output: sum.output + (turn.usage?.outputTokens ?? 0),
    cached: sum.cached + (turn.usage?.cacheReadTokens ?? 0),
  }),
  { input: 0, output: 0, cached: 0 },
);

console.log(
  `\nModel calls           ${turns.length} (${turns.filter((t) => t.failure).length} failed)  ` +
    `${elapsed.toFixed(1)}s wall clock`,
);
console.log(
  `Tokens                ${usage.input} in (${usage.cached} cached), ${usage.output} out`,
);
