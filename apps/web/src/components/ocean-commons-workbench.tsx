"use client";

import {
  brokerAgent,
  cautiousAgent,
  evaluateMatch,
  generateScenario,
  greedyAgent,
  opportunistAgent,
  reciprocatorAgent,
  runMatch,
  scoreCooperation,
  scoreRestraint,
  takerAgent,
  toVoyage,
  tunableAgent,
  type OceanAgent,
  type OceanScenario,
  type PublicOceanCommonsScenario,
  type TunableParams,
  type Voyage,
} from "@frontier/ocean-commons";
import { useCallback, useEffect, useState } from "react";
import { OceanVoyageStage } from "@/components/ocean-voyage-stage";

/**
 * The Arena page.
 *
 * Built on the `competition-*` vocabulary the other Arenas already share, so
 * this page carries the same nav, scoreboard, leaderboard and settlement
 * furniture as 72-Hour Disaster Response rather than a private set of styles.
 * Only the parts with no equivalent elsewhere — the voyage stage and its fog —
 * are Ocean's own.
 *
 * The season is resolved in the browser against scripted rivals, which is what
 * lets a visitor change an approach and see the consequence immediately. That
 * is safe here and only here: this is practice against published policies, so
 * there is no hidden state worth protecting and nothing is ranked.
 */

type ApproachId = "steady" | "hard" | "sparing";

type Approach = {
  id: ApproachId;
  label: string;
  note: string;
  /** Which part of a season this choice actually moves. */
  affects: string;
  params: TunableParams;
};

const APPROACHES: readonly Approach[] = [
  {
    id: "steady",
    label: "Work the season",
    note: "Spread the fuel. Take contracts when they are cheap.",
    affects:
      "Affects SAIL + CONTRACT. The tank lasts most of the season, so the late grounds stay open to you.",
    params: { effortFraction: 0.6, reserve: "never", contracts: "cheap" },
  },
  {
    id: "hard",
    label: "Fill the hold",
    note: "Burn fuel early, and work the reserve when the gale shuts the bank.",
    affects:
      "Affects SAIL. Everything is landed early and nothing is held back, so there is nothing to have given up.",
    params: { effortFraction: 1, reserve: "storm-only", contracts: "none" },
  },
  {
    id: "sparing",
    label: "Hold back",
    note: "Little effort, and pay others to leave fish where they are.",
    affects:
      "Affects RESTRAINT + CONTRACT. Fuel is left in the tank and money goes into other boats' hulls.",
    params: { effortFraction: 0.2, reserve: "never", contracts: "generous" },
  },
];

const DEFAULT_MISSION = `Keep the crew paid: finish the season solvent and with a working boat.

You cannot see the sea. Sound a ground before you trust it, and remember that a
reading ages the moment you look away.

You may pay other boats to hold back, and take their money to hold back
yourself, when the arithmetic favours it.`;

const SEEDS = Array.from({ length: 8 }, (_, index) => `ocean-practice-v1:${index}`);

type Scores = {
  livelihood: number;
  restraint: number;
  forgone: number;
  cooperation: number;
};

type Entry = Scores & {
  id: ApproachId;
  label: string;
  note: string;
  frontier: boolean;
};

type Result = {
  voyage: Voyage;
  scores: Scores;
  board: Entry[];
  survived: number;
  fleet: number;
  seasonRounds: number;
  fuelLeft: number;
  contracts: number;
  scenarioSeed: string;
};

/** The four rivals, rebuilt per replay so no state leaks between runs. */
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

/** One season for one approach, with both counterfactual replays the axes need. */
async function sail(scenario: OceanScenario, params: TunableParams): Promise<Scores> {
  const seat = scenario.boats[0]!;
  const fleet = (): OceanAgent[] => [
    tunableAgent(seat.id, seat.name, scenario, params),
    ...rivalsFor(scenario),
  ];

  const full = evaluateMatch(await runMatch(scenario, fleet()));
  const solo = evaluateMatch(await runMatch(scenario, fleet(), { excludeContractsFor: seat.id }));
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

/** Nothing is summed. An entry survives unless something beats it on all three. */
function onFrontier(entry: Scores, others: readonly Scores[]): boolean {
  return !others.some(
    (other) =>
      other !== entry &&
      other.livelihood >= entry.livelihood &&
      other.restraint >= entry.restraint &&
      other.cooperation >= entry.cooperation &&
      (other.livelihood > entry.livelihood ||
        other.restraint > entry.restraint ||
        other.cooperation > entry.cooperation),
  );
}

const pct = (value: number) => `${(value * 100).toFixed(0)}%`;
const cash = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 0 });

export function OceanCommonsWorkbench({
  scenario: published,
}: {
  scenario: PublicOceanCommonsScenario;
}) {
  const [approach, setApproach] = useState<ApproachId>("steady");
  const [mission, setMission] = useState(DEFAULT_MISSION);
  const [seed, setSeed] = useState(SEEDS[0]!);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(true);
  // Every season already sailed this visit. Seeing your own runs side by side
  // is what turns three buttons into an experiment.
  const [tried, setTried] = useState<
    { key: string; approach: string; seed: string; rounds: number; scores: Scores }[]
  >([]);

  const run = useCallback(async () => {
    setBusy(true);
    const scenario = generateScenario(seed, { vary: true });
    const seat = scenario.boats[0]!;

    // Every approach sails the same seed, so the table below is a real answer
    // rather than a decoration.
    const scored = await Promise.all(
      APPROACHES.map(async (one) => ({ one, scores: await sail(scenario, one.params) })),
    );
    const all = scored.map(({ scores }) => scores);
    const board: Entry[] = scored.map(({ one, scores }) => ({
      ...scores,
      id: one.id,
      label: one.label,
      note: one.note,
      frontier: onFrontier(scores, all),
    }));

    const chosen = APPROACHES.find((one) => one.id === approach)!;
    const log = await runMatch(scenario, [
      tunableAgent(seat.id, seat.name, scenario, chosen.params),
      ...rivalsFor(scenario),
    ]);
    const full = evaluateMatch(log);

    setResult({
      // Fog is drawn from this seat, so the replay shows the season the entrant
      // actually experienced rather than the one the engine ran.
      voyage: toVoyage(log, seat.id),
      scores: board.find((entry) => entry.id === approach)!,
      board,
      survived: full.boats.filter((boat) => boat.survived).length,
      fleet: full.boats.length,
      seasonRounds: log.rounds.length,
      fuelLeft: log.finalState.boats[seat.id]?.fuelRemaining ?? 0,
      contracts: full.contracts.accepted,
      scenarioSeed: scenario.seed,
    });
    const mine = board.find((entry) => entry.id === approach)!;
    setTried((history) => {
      const key = `${approach}@${seed}`;
      if (history.some((entry) => entry.key === key)) return history;
      return [
        ...history,
        {
          key,
          approach: chosen.label,
          seed: seed.replace("ocean-practice-v1:", "season "),
          rounds: log.rounds.length,
          scores: mine,
        },
      ];
    });
    setBusy(false);
  }, [approach, seed]);

  useEffect(() => {
    void run();
  }, [run]);

  const chosen = APPROACHES.find((one) => one.id === approach)!;

  return (
    <div className="competition-shell ocean-competition">
      <section className="competition-scoreboard">
        <div>
          <span>ROUND</span>
          <strong>OPEN PRACTICE</strong>
        </div>
        <div>
          <span>REWARD POOL</span>
          <strong>0 FDT</strong>
        </div>
        <div>
          <span>SEASON</span>
          <strong>
            {published.seasonWindow.min}–{published.seasonWindow.max} ROUNDS
          </strong>
        </div>
        <div>
          <span>AXES</span>
          <strong>3 · NEVER SUMMED</strong>
        </div>
        <div>
          <span>YOUR STATUS</span>
          <strong>{busy ? "SAILING" : "SEASON CLOSED"}</strong>
        </div>
      </section>

      <nav className="competition-nav" aria-label="Ocean Commons sections">
        <a href="#mission">Mission</a>
        <a href="#rules">Rules</a>
        <a href="#values">Three values</a>
        <a href="#build">Write a mission</a>
        <a href="#replay">Voyage replay</a>
        <a href="#landscape">Landscape</a>
        <a href="#allocations">Allocations</a>
      </nav>

      <section className="ocean-story" id="mission">
        <p className="eyebrow">01 · THE MISSION</p>
        <h2>Keep a crew paid without emptying the water they depend on.</h2>
        <p>
          Five boats share one fishery and none of them can see it. A ground is known only if
          somebody worked it, and what they learned ages from the moment they looked away. Fuel is
          issued for the whole season, not the round — and nobody is told how long the season is.
        </p>
        <div className="ocean-story-facts">
          <article>
            <span>7–10</span>
            <small>ROUNDS · LENGTH HIDDEN</small>
          </article>
          <article>
            <span>3</span>
            <small>GROUNDS · ONE A RESERVE</small>
          </article>
          <article>
            <span>~4</span>
            <small>ROUNDS OF FUEL AT FULL EFFORT</small>
          </article>
          <article>
            <span>5</span>
            <small>BOATS · ONE IS YOURS</small>
          </article>
        </div>
      </section>

      <section className="ocean-rules-section" id="rules">
        <p className="eyebrow">RULES IN 30 SECONDS</p>
        <ul className="ocean-rules">
          <li>
            <strong>You cannot see the sea.</strong> Working a ground measures it exactly. Watching
            a rival land fish gives you a band, not a number. Untouched water is dark.
          </li>
          <li>
            <strong>Fuel is a season budget.</strong> Steaming out costs fuel before you fish at
            all. An empty tank means port until the season ends.
          </li>
          <li>
            <strong>Contracts are typed and escrowed.</strong> Money locks on acceptance, releases
            round by round while the terms hold, and refunds to the payer on a breach.
          </li>
          <li>
            <strong>The engine decides, never a model.</strong> Compliance is measured from landed
            catch. Nobody&apos;s word counts, including yours.
          </li>
        </ul>
      </section>

      <section className="ocean-values" id="values">
        <div className="section-title">
          <div>
            <p className="eyebrow">02 · THE VALUE MARKET</p>
            <h2>Three groups. Three definitions of a good season.</h2>
          </div>
          <span>Never summed</span>
        </div>
        <div className="ocean-pools">
          <article>
            <h3>Crew livelihood</h3>
            <p>
              The median solvent boat&apos;s cash at the end. Cares that people were paid, not that
              the fishery was left pretty.
            </p>
          </article>
          <article>
            <h3>Restraint efficacy</h3>
            <p>
              Of the fish you gave up against a boat that takes everything, how many were still in
              the water at the end. Leaving a ground a greedy rival is steaming towards buys
              nothing.
            </p>
          </article>
          <article>
            <h3>Cooperation efficacy</h3>
            <p>
              What your contracts changed, per DemoUSD you paid for it — measured by replaying the
              same season with your agreements removed.
            </p>
          </article>
        </div>
      </section>

      <section className="competition-build ocean-builder" id="build">
        <div className="section-title">
          <div>
            <p className="eyebrow">03 · WRITE A MISSION</p>
            <h2>Give a standing instruction, not a row of effort numbers.</h2>
          </div>
          <span>{busy ? "Sailing…" : "Season closed"}</span>
        </div>

        <label className="ocean-field">
          <span>Standing instruction — what your skipper is for</span>
          <textarea
            value={mission}
            rows={7}
            onChange={(event) => setMission(event.target.value)}
            spellCheck={false}
          />
        </label>
        <p className="lever-explanation">
          A model-backed boat reads this text and nothing else about your intent. The practice
          season below is sailed by scripted skippers, so it shows the world reacting rather than
          your words being interpreted — pick the approach closest to what you wrote.
        </p>

        <div className="ocean-approaches">
          {APPROACHES.map((one) => (
            <button
              type="button"
              key={one.id}
              className={one.id === approach ? "selected" : ""}
              aria-pressed={one.id === approach}
              onClick={() => setApproach(one.id)}
            >
              <span>{one.label}</span>
              <small>{one.note}</small>
            </button>
          ))}
        </div>
        <p className="lever-explanation">{chosen.affects}</p>

        <label className="ocean-field inline">
          <span>Season</span>
          <select value={seed} onChange={(event) => setSeed(event.target.value)}>
            {SEEDS.map((one) => (
              <option key={one} value={one}>
                {one}
              </option>
            ))}
          </select>
        </label>

        {result ? (
          <div className="live-preview-metrics">
            <article>
              <span>CREW LIVELIHOOD</span>
              <strong>{cash(result.scores.livelihood)}</strong>
              <small>DemoUSD · median solvent boat</small>
            </article>
            <article>
              <span>RESTRAINT EFFICACY</span>
              <strong>{pct(result.scores.restraint)}</strong>
              <small>
                {result.scores.forgone < 1
                  ? "you gave up nothing to measure"
                  : `of the ${result.scores.forgone.toFixed(0)} fish you left, this much held`}
              </small>
            </article>
            <article>
              <span>COOPERATION EFFICACY</span>
              <strong>{result.scores.cooperation.toFixed(3)}</strong>
              <small>
                {result.scores.cooperation < 0
                  ? "negative · your contracts left the sea worse"
                  : "stewardship points per 1,000 spent"}
              </small>
            </article>
          </div>
        ) : null}
      </section>

      <section className="ocean-replay-section" id="replay">
        <div className="section-title">
          <div>
            <p className="eyebrow">04 · WATCH THE SEASON</p>
            <h2>See what you could not see at the time.</h2>
          </div>
          <span>Seed {result?.scenarioSeed ?? seed}</span>
        </div>
        <div className="ocean-reading-key" aria-label="How to read the scene">
          <span>
            <b>Fish</b> are what this skipper believes is down there.
          </span>
          <span>
            <b>Dark water</b> is a ground nobody has read.
          </span>
          <span>
            <b>Lines</b> are contracts with DemoUSD still in escrow.
          </span>
          <span>
            <b>Bars under each hull</b> are fuel left for the whole season.
          </span>
        </div>
        {result ? (
          <OceanVoyageStage voyage={result.voyage} />
        ) : (
          <p className="empty-state">Putting to sea…</p>
        )}
        {result ? (
          <p className="lever-explanation">
            The season ran {result.seasonRounds} rounds — you were told only that it would be
            between {published.seasonWindow.min} and {published.seasonWindow.max}. {result.survived}{" "}
            of {result.fleet} boats finished solvent, {result.contracts} contracts were signed, and
            you ended with {result.fuelLeft.toFixed(0)} fuel unspent.
          </p>
        ) : null}
      </section>

      <section className="competition-leaderboard ocean-landscape" id="landscape">
        <div className="section-title">
          <div>
            <p className="eyebrow">05 · SOLUTION LANDSCAPE</p>
            <h2>Compare trade-offs without forcing a single rank.</h2>
          </div>
          <span>No overall winner</span>
        </div>
        <div className="leaderboard-table ocean-leaderboard">
          <div className="leaderboard-row leaderboard-head">
            <span>Approach</span>
            <span>Livelihood</span>
            <span>Restraint</span>
            <span>Cooperation</span>
            <span>Standing</span>
          </div>
          {result ? (
            result.board.map((entry) => (
              <div
                key={entry.id}
                className={`leaderboard-row ${entry.frontier ? "on-frontier" : "dominated"}${
                  entry.id === approach ? " mine" : ""
                }`}
              >
                <span>
                  <strong>{entry.label}</strong>
                  <small>{entry.id === approach ? "Your approach" : entry.note}</small>
                </span>
                <span>{cash(entry.livelihood)}</span>
                <span>{pct(entry.restraint)}</span>
                <span>{entry.cooperation.toFixed(3)}</span>
                <span>{entry.frontier ? "On the frontier" : "Beaten on all three"}</span>
              </div>
            ))
          ) : (
            <p className="empty-state">Sailing all three approaches on this seed…</p>
          )}
        </div>
        <p className="lever-explanation">
          An approach stays on the frontier unless another beats it on all three axes at once. More
          than one usually survives, which is the point: there is no single best season, only
          seasons that are good at different things.
        </p>
      </section>

      <section className="value-allocations ocean-awards" id="allocations">
        <div className="section-title">
          <div>
            <p className="eyebrow">06 · VALUE ALLOCATIONS</p>
            <h2>Different values support different seasons.</h2>
          </div>
          <span>Practice · no reward</span>
        </div>
        <div className="value-allocation-grid">
          {(
            [
              ["Crew livelihood", "livelihood", "Fishing families and the crews they employ."],
              [
                "Restraint efficacy",
                "restraint",
                "Everyone who will fish this water next season.",
              ],
              [
                "Cooperation efficacy",
                "cooperation",
                "Those who fund restraint rather than perform it.",
              ],
            ] as const
          ).map(([name, key, statement]) => {
            const best = result?.board.reduce((top, entry) => (entry[key] > top[key] ? entry : top));
            return (
              <article key={key} className={best?.id === approach ? "my-award" : ""}>
                <header>
                  <span>Practice pool</span>
                  <b>0 FDT</b>
                </header>
                <h3>{name}</h3>
                <p>{statement}</p>
                <div className="pool-allocation-list">
                  {best ? (
                    <div>
                      <strong>{best.label}</strong>
                      <span>
                        {key === "livelihood"
                          ? cash(best.livelihood)
                          : key === "restraint"
                            ? pct(best.restraint)
                            : best.cooperation.toFixed(3)}
                      </span>
                    </div>
                  ) : (
                    <p className="empty-state">Sailing…</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        <p className="lever-explanation">
          No pool is funded. This Arena publishes its own feasibility gate — does every axis have a
          best play that sits somewhere in the middle and moves with the season — and passes on two
          of three. The third is still maximised at a dial&apos;s end, so it does not separate a
          careful skipper from a careless one. Until that is fixed there is no ranking and no money.
        </p>
      </section>

      <section className="competition-revisions ocean-revisions">
        <div className="section-title">
          <div>
            <p className="eyebrow">07 · WHAT YOU HAVE TRIED</p>
            <h2>Your seasons so far.</h2>
          </div>
          <span>{tried.length} sailed</span>
        </div>
        {tried.length > 0 ? (
          <ol className="ocean-tried">
            {tried.map((entry) => (
              <li key={entry.key}>
                <div>
                  <strong>{entry.approach}</strong>
                  <small>
                    {entry.seed} · {entry.rounds} rounds
                  </small>
                </div>
                <span>{cash(entry.scores.livelihood)}</span>
                <span>{pct(entry.scores.restraint)}</span>
                <span>{entry.scores.cooperation.toFixed(3)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty-state">Nothing sailed yet.</p>
        )}
        <p className="lever-explanation">
          Nothing here is saved beyond this visit. Change the approach or the season above and the
          run is added to this list, so you can see whether an approach holds up across seasons or
          only won the one you happened to look at.
        </p>
      </section>

      <section className="competition-settlement ocean-settlement">
        <div className="section-title">
          <div>
            <p className="eyebrow">08 · EVIDENCE</p>
            <h2>Every season here replays to the same result.</h2>
          </div>
          <span>Evidence L0</span>
        </div>
        <div className="evidence-chain">
          <article>
            <span>CHALLENGE</span>
            <strong>{published.challengeId}</strong>
            <small>Registered in the public catalog</small>
          </article>
          <article>
            <span>MANIFEST HASH</span>
            <strong className="mono">{published.manifestHash.slice(0, 18)}…</strong>
            <small>Changing the rules changes this</small>
          </article>
          <article>
            <span>SEED</span>
            <strong className="mono">{result?.scenarioSeed ?? seed}</strong>
            <small>Weather and season length derive from it</small>
          </article>
          <article>
            <span>WALLET GATE</span>
            <strong>{cash(published.walletPolicy.maxAutonomousSpendPerMatch)} DemoUSD</strong>
            <small>Per match, only against a structured contract</small>
          </article>
        </div>
        <p className="competition-trust-note">
          Practice credits are simulated and no token payment occurs. The engine resolves the sea;
          an agent only chooses where to fish and what to offer.
        </p>
      </section>
    </div>
  );
}
