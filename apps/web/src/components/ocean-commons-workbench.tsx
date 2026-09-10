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
  type PublicOceanCommonsScenario,
  type TunableParams,
  type Voyage,
} from "@frontier/ocean-commons";
import { useCallback, useEffect, useState } from "react";
import { OceanVoyageStage } from "@/components/ocean-voyage-stage";

/**
 * The Arena page: read the rules, set a season going, watch it, read the three
 * outcomes.
 *
 * The season is resolved in the browser against scripted rivals, which is what
 * lets a visitor change something and see the consequence immediately rather
 * than waiting on a model. That is safe here and only here: this is practice
 * against published policies, so there is no hidden state worth protecting and
 * nothing is ranked. A model-backed entry runs the same engine server-side.
 *
 * The mission text is the control surface on purpose. Five effort numbers
 * describe a policy a grid sweep already contains; a standing instruction
 * describes something no fixed vector can (Plan 10 §49).
 */

type Approach = "steady" | "hard" | "sparing";

const APPROACHES: Record<Approach, { label: string; note: string; params: TunableParams }> = {
  steady: {
    label: "Work the season",
    note: "Spread the fuel. Take contracts when they are cheap.",
    params: { effortFraction: 0.6, reserve: "never", contracts: "cheap" },
  },
  hard: {
    label: "Fill the hold",
    note: "Burn fuel early, and work the reserve when the gale shuts the bank.",
    params: { effortFraction: 1, reserve: "storm-only", contracts: "none" },
  },
  sparing: {
    label: "Hold back",
    note: "Little effort, and pay others to leave fish where they are.",
    params: { effortFraction: 0.2, reserve: "never", contracts: "generous" },
  },
};

const DEFAULT_MISSION = `Keep the crew paid: finish the season solvent and with a working boat.

You cannot see the sea. Sound a ground before you trust it, and remember that a
reading ages the moment you look away.

You may pay other boats to hold back, and take their money to hold back
yourself, when the arithmetic favours it.`;

type Result = {
  voyage: Voyage;
  livelihood: number;
  restraint: number;
  cooperation: number;
  survived: number;
  fleet: number;
  seasonRounds: number;
  fuelLeft: number;
  contracts: number;
};

export function OceanCommonsWorkbench({
  scenario: published,
}: {
  scenario: PublicOceanCommonsScenario;
}) {
  const [approach, setApproach] = useState<Approach>("steady");
  const [mission, setMission] = useState(DEFAULT_MISSION);
  const [seed, setSeed] = useState("ocean-practice-v1:0");
  const [result, setResult] = useState<Result | null>(null);

  const sail = useCallback(async () => {
    const scenario = generateScenario(seed, { vary: true });
    const seat = scenario.boats[0]!;
    // One of the rivals answers back rather than simply maximising, so restraint
    // has someone to be read by.
    const rivals = (): OceanAgent[] => {
      const [, b, c, d, e] = scenario.boats;
      return [
        brokerAgent(b!.id, b!.name, scenario),
        greedyAgent(c!.id, c!.name, scenario),
        opportunistAgent(d!.id, d!.name, scenario),
        reciprocatorAgent(e!.id, e!.name, scenario),
      ];
    };
    const mine = (): OceanAgent[] => [
      tunableAgent(seat.id, seat.name, scenario, APPROACHES[approach].params),
      ...rivals(),
    ];

    const log = await runMatch(scenario, mine());
    const full = evaluateMatch(log);
    const solo = evaluateMatch(await runMatch(scenario, mine(), { excludeContractsFor: seat.id }));
    const ifTaken = evaluateMatch(
      await runMatch(scenario, [takerAgent(seat.id, seat.name, scenario), ...rivals()]),
    );

    setResult({
      // Fog is drawn from this seat, so the replay shows the season the entrant
      // actually experienced rather than the one the engine ran.
      voyage: toVoyage(log, seat.id),
      livelihood: full.livelihood,
      restraint: scoreRestraint(full, ifTaken, seat.id).efficacy,
      cooperation: scoreCooperation(full, solo, seat.id).efficacy,
      survived: full.boats.filter((boat) => boat.survived).length,
      fleet: full.boats.length,
      seasonRounds: log.rounds.length,
      fuelLeft: log.finalState.boats[seat.id]?.fuelRemaining ?? 0,
      contracts: full.contracts.accepted,
    });
  }, [approach, seed]);

  useEffect(() => {
    void sail();
  }, [sail]);

  return (
    <div className="ocean-workbench">
      <section className="ocean-hero">
        <p className="eyebrow">THE WHOLE GAME IN ONE PICTURE</p>
        <h2>One season, watched the way its skipper saw it.</h2>
        <p className="ocean-lede">
          Five boats share one fishery and none of them can see it. A ground is known only if
          somebody worked it, and what they learned ages from the moment they looked away. Fuel is
          issued for the whole season, not the round — and nobody is told how long the season is.
        </p>

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

        {result ? <OceanVoyageStage voyage={result.voyage} /> : <p>Putting to sea…</p>}

        <div className="ocean-stat-tiles">
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
            <span>3</span>
            <small>INDEPENDENT AXES</small>
          </article>
        </div>
      </section>

      <section className="ocean-section">
        <p className="eyebrow">01 · THE MISSION</p>
        <h2>Keep a crew paid without emptying the water they depend on.</h2>
        <p>
          Fish landed per unit of effort falls as a ground is drawn down, and below a critical
          stock a ground stops recovering for the rest of the season. The nursery reserve feeds the
          other two through spillover, which makes it the most tempting and the most costly water
          on the map. One market buys the whole fleet&apos;s catch, so a glut lowers the price
          everyone gets.
        </p>
      </section>

      <section className="ocean-section">
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

      <section className="ocean-section">
        <p className="eyebrow">02 · THE VALUE MARKET</p>
        <h2>Three groups. Three definitions of a good season.</h2>
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
        <p className="ocean-note">
          These are never added together. A season that is best at one is usually not best at the
          others, and the point of the Arena is to make that visible rather than hide it behind a
          rank.
        </p>
      </section>

      <section className="ocean-section">
        <p className="eyebrow">03 · WRITE A MISSION</p>
        <h2>Give a standing instruction, not a row of effort numbers.</h2>
        <label className="ocean-field">
          <span>Standing instruction — what your skipper is for</span>
          <textarea
            value={mission}
            rows={8}
            onChange={(event) => setMission(event.target.value)}
            spellCheck={false}
          />
        </label>
        <p className="ocean-note">
          A model-backed boat reads this text and nothing else about your intent. The practice
          season below is sailed by scripted skippers, so it shows the world reacting rather than
          your words being interpreted — pick the approach closest to what you wrote.
        </p>
        <div className="ocean-approaches">
          {(Object.keys(APPROACHES) as Approach[]).map((key) => (
            <button
              type="button"
              key={key}
              className={key === approach ? "selected" : ""}
              onClick={() => setApproach(key)}
            >
              <span>{APPROACHES[key].label}</span>
              <small>{APPROACHES[key].note}</small>
            </button>
          ))}
        </div>
        <label className="ocean-field inline">
          <span>Season</span>
          <select value={seed} onChange={(event) => setSeed(event.target.value)}>
            {Array.from({ length: 8 }, (_, index) => `ocean-practice-v1:${index}`).map((one) => (
              <option key={one} value={one}>
                {one}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="ocean-section">
        <p className="eyebrow">YOUR VALUE RESULT</p>
        <h2>Your season does not need to be best at everything.</h2>
        {result ? (
          <>
            <div className="ocean-results">
              <article>
                <small>CREW LIVELIHOOD</small>
                <strong>{result.livelihood.toFixed(0)}</strong>
                <span>DemoUSD · median solvent boat</span>
              </article>
              <article>
                <small>RESTRAINT EFFICACY</small>
                <strong>{(result.restraint * 100).toFixed(0)}%</strong>
                <span>of what you gave up was still there</span>
              </article>
              <article>
                <small>COOPERATION EFFICACY</small>
                <strong>{result.cooperation.toFixed(3)}</strong>
                <span>stewardship points per 1,000 spent</span>
              </article>
            </div>
            <p className="ocean-note">
              The season ran {result.seasonRounds} rounds — you were told only that it would be
              between {published.seasonWindow.min} and {published.seasonWindow.max}.{" "}
              {result.survived} of {result.fleet} boats finished solvent, {result.contracts}{" "}
              contracts were signed, and you ended with {result.fuelLeft.toFixed(0)} fuel unspent.
            </p>
          </>
        ) : (
          <p>Measuring…</p>
        )}
      </section>

      <section className="ocean-section">
        <p className="eyebrow">WHAT THIS ARENA DOES NOT CLAIM</p>
        <h2>Practice, not a competition.</h2>
        <p>
          This Arena publishes its own feasibility gate: does every axis have a best play that sits
          somewhere in the middle and moves with the season? Two of the three do. The third is
          still maximised at a dial&apos;s end, which means it does not separate a careful skipper
          from a careless one. Until that is fixed there is no ranking here and no reward pool —
          only a world you can put a mission into and watch.
        </p>
        <dl className="ocean-manifest">
          <div>
            <dt>Challenge</dt>
            <dd>{published.challengeId}</dd>
          </div>
          <div>
            <dt>Manifest hash</dt>
            <dd className="mono">{published.manifestHash}</dd>
          </div>
          <div>
            <dt>Wallet gate</dt>
            <dd>
              {published.walletPolicy.maxAutonomousSpendPerMatch.toLocaleString("en-US")} DemoUSD
              per match, only against a structured contract
            </dd>
          </div>
          <div>
            <dt>Evidence</dt>
            <dd>Replayable engine transcript · practice credits are simulated</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
