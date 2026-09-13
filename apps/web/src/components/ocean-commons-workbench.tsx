"use client";

import {
  brokerAgent,
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
  type OceanEntry,
  type TunableParams,
  type Voyage,
  type WalletPolicy,
  checkOceanEntry,
  defaultOceanEntry,
  walletPolicyFor,
  OCEAN_ENTRY_LIMITS,
  OCEAN_PACT_KINDS,
  OCEAN_SUBMISSION_SEASONS,
  OCEAN_WALLET_STEPS,
  oceanEntrySpaceSize,
} from "@frontier/ocean-commons";
import { useEffect, useState } from "react";
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

const SEEDS = Array.from({ length: 8 }, (_, index) => `ocean-practice-v1:${index}`);

/**
 * How many seasons make a result.
 *
 * One season is close to one hand of poker: the draw accounts for a fifth to
 * nearly two fifths of an outcome, and detecting a real edge on livelihood
 * takes dozens of seasons (Plan 10 §67). Showing a visitor a single season and
 * calling it a result invites them to read luck as judgement. A scripted season
 * resolves in well under a millisecond, so a whole match costs nothing.
 */
const MATCH_SEASONS = 7;

type Scores = {
  livelihood: number;
  restraint: number;
  forgone: number;
  cooperation: number;
};

type Entry = Scores & {
  id: string;
  label: string;
  note: string;
  mine: boolean;
  frontier: boolean;
  /** Seasons this approach took each axis, out of the whole match. */
  won: { livelihood: number; restraint: number; cooperation: number };
};

/** One season the model sailed, as the route returns it. */
type MissionSeason = {
  seed: string;
  scores: Scores;
  voyage: Voyage;
  rounds: number;
  survived: number;
  fleet: number;
  fuelLeft: number;
  contracts: number;
  usage: { calls: number; failures: number; inputTokens: number; outputTokens: number };
};

/**
 * A match sailed from the mission text.
 *
 * Three seasons rather than one, for the same reason the scripted preview sails
 * seven: a single season is mostly the draw, and showing one result invites a
 * visitor to read luck as judgement. Three is the compromise the arithmetic
 * allows — a season costs three to six minutes of a model's time and cannot be
 * parallelised, because each round depends on the one before it.
 */
type MissionRun = {
  mission: string;
  seasons: MissionSeason[];
  /** Median of each axis across the match. */
  scores: Scores;
};

/** One scored submission, as the sandbox route returns it. */
type Submitted = {
  submissionId: string;
  revision: number;
  correctness: boolean;
  resultHash: string;
  scores: Scores | null;
  failures: string[];
};

/** Plain names for the contract kinds, and what allowing each one buys. */
const PACT_LABELS: Record<string, string> = {
  CATCH_LIMIT: "Catch limit",
  CONSERVATION_BUYOUT: "Buyout",
  MUTUAL_AID: "Mutual aid",
  CONSERVATION_FUND: "Conservation fund",
  SOUNDING_EXCHANGE: "Readings",
};
const PACT_NOTES: Record<string, string> = {
  CATCH_LIMIT: "Pay a rival to land no more than a cap each round.",
  CONSERVATION_BUYOUT: "Pay a rival to leave a ground, or the water, alone.",
  MUTUAL_AID: "Pool contributions against breakdowns.",
  CONSERVATION_FUND: "Pool money so no single wallet carries the cost of restraint.",
  SOUNDING_EXCHANGE: "Trade exact readings instead of guessing from a distance.",
};

const EFFORT_CHOICES = [
  [0.2, "Sparing", "A fifth of the hull. The tank outlasts the season."],
  [0.6, "Steady", "Most of the season at working pace."],
  [1, "Flat out", "Everything the hull has, until the fuel runs out."],
] as const;

const RESERVE_CHOICES = [
  ["never", "Never", "Leave the nursery alone, whatever the weather does."],
  ["storm-only", "Only in a gale", "Work it when the bank is shut and there is nowhere else."],
  ["always", "Whenever it pays", "Treat it as one more ground, fine and all."],
] as const;

const CONTRACT_CHOICES = [
  ["none", "Nothing", "Sign no contracts. Nobody is paid to hold back."],
  ["cheap", "Under the odds", "Offer less than the catch is worth and expect refusals."],
  ["fair", "What it is worth", "Offer roughly what the rival gives up."],
  ["generous", "Over the odds", "Pay above the odds so the offer is hard to refuse."],
] as const;

const MISSION_SEASONS = 3;

/** The settlement deployed for this Arena. Verified on Sepolia. */
const SETTLEMENT_ADDRESS = "0x0ee2EBa0AFF886De530AB8b51B96bd6297DbD7D6";

/**
 * The reference match this Arena has actually settled.
 *
 * Recorded and funded on Sepolia rather than described: the four published
 * reference entries sailed the twelve scored seeds, the contract computed the
 * frontier itself from the outcomes it was given, and each of the three pools
 * paid its 10,000 FDT to whoever served its own axis. The interesting part is
 * that they did not agree — which is the only claim this Arena makes that a
 * ranking could not have made for it.
 *
 * Reproduced by `scripts/ocean-reference-match.ts`; sent by
 * `scripts/settle-ocean-match.sh`.
 */
const SETTLED_MATCH = {
  matchId: "0x0890e7fea9b7864c0f2991da29dba73c808d4d2ca788bb3a9769c3d542cbe443",
  sealTx: "0x378af3be818d896fb6ac1fcd82be3479e5bd1fe9b6913df16a146bbb9b7fad9c",
  seasons: 12,
  recorded: 4,
  onFrontier: ["Work the season", "Fill the hold"],
  pools: [
    {
      axis: "Crew livelihood",
      backed: "Fill the hold",
      amount: 10_000,
      note: "Landed the most fish, and gave up nothing to do it.",
      tx: "0x1ad10a1df302ac17bd7854bd564037b5a7c8b051c47a11b17148aaba38a7efdc",
    },
    {
      axis: "Restraint efficacy",
      backed: "Work the season",
      amount: 10_000,
      note: "Left fish in the water and they were still there at the end.",
      tx: "0x40d69c91b3c23e9842cf644ac0427a491b2871d6aaed9ff4e7f2a5d3879ed0d7",
    },
    {
      axis: "Cooperation efficacy",
      backed: "Work the season",
      amount: 10_000,
      note: "Its agreements changed the season; the closed wallet's could not.",
      tx: "0x639d79dbac62512b4df755a49b4dd50a417b1dad380a9806ce0ff07645c83c87",
    },
  ],
} as const;

function medianOf(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

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
  /** Which approach and season produced this, so a stale run can be discarded. */
  key: string;
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

/**
 * One season for one entry, with both counterfactual replays the axes need.
 *
 * The wallet is passed to the match rather than left at its default, because
 * it is the half of the entry that decides what the boat may do at all: a seat
 * that is not permitted to buy a stand-down cannot buy one however it reasons.
 */
async function sail(
  scenario: OceanScenario,
  params: TunableParams,
  wallet: WalletPolicy,
): Promise<Scores> {
  const seat = scenario.boats[0]!;
  const wallets = { [seat.id]: wallet };
  const fleet = (): OceanAgent[] => [
    tunableAgent(seat.id, seat.name, scenario, params),
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
  // The whole submission: a name, a standing instruction, the wallet the match
  // loop enforces, and how the boat works the grounds without a model.
  const [entry, setEntry] = useState<OceanEntry>(defaultOceanEntry);
  const [mode, setMode] = useState<"BUILDER" | "JSON" | "UPLOAD">("BUILDER");
  const [draft, setDraft] = useState(() => JSON.stringify(defaultOceanEntry, null, 2));
  const [entryErrors, setEntryErrors] = useState<string[]>([]);
  const [seed, setSeed] = useState(SEEDS[0]!);
  const mission = entry.mission;
  const [result, setResult] = useState<Result | null>(null);
  // Every season already sailed this visit. Seeing your own runs side by side
  // is what turns three buttons into an experiment.
  const [tried, setTried] = useState<
    { key: string; approach: string; seed: string; rounds: number; scores: Scores }[]
  >([]);

  // A season sailed by a model from the mission text. Separate from the
  // scripted preview on purpose: one is instant, the other costs a minute and
  // real money, and conflating them would hide which is which.
  const [sailing, setSailing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [seasonsDone, setSeasonsDone] = useState(0);
  const [missionRun, setMissionRun] = useState<MissionRun | null>(null);
  const [missionError, setMissionError] = useState<string | null>(null);

  // Submission. Practice is local and free; a submission is scored on the
  // server over twelve seeds the entrant never chose, which is the only way a
  // number here means anything at all.
  const [wallet, setWallet] = useState("");
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Submitted[]>([]);

  const runKey = `${JSON.stringify(entry.sailing)}|${JSON.stringify(entry.wallet)}@${seed}`;
  // Derived rather than stored: a `busy` flag set from inside the effect would
  // be a synchronous setState on every render pass, which cascades.
  const busy = result?.key !== runKey;

  useEffect(() => {
    // A visitor can change approach mid-season; the run that finishes second
    // must not overwrite the one they are now waiting for.
    let cancelled = false;

    void (async () => {
      const scenario = generateScenario(seed, { vary: true });
      const seat = scenario.boats[0]!;
      const wallet = walletPolicyFor(entry);

      // Your entry against the three published references, over the same seven
      // seasons each. A match rather than one season, because one season is
      // mostly the draw. References sail on the default wallet — they are the
      // Arena's own yardstick, not somebody else's submission.
      const matchSeeds = SEEDS.slice(0, MATCH_SEASONS);
      const runners = [
        {
          id: "mine",
          label: entry.name || "Your entry",
          note: "Your entry",
          mine: true,
          params: entry.sailing,
          wallet,
        },
        ...APPROACHES.map((one) => ({
          id: one.id,
          label: one.label,
          note: one.note,
          mine: false,
          params: one.params,
          wallet: walletPolicyFor(defaultOceanEntry),
        })),
      ];
      const perSeason = await Promise.all(
        runners.map(async (one) => ({
          one,
          seasons: await Promise.all(
            matchSeeds.map((each) =>
              sail(generateScenario(each, { vary: true }), one.params, one.wallet),
            ),
          ),
        })),
      );

      const median = (values: number[]) => {
        const sorted = [...values].sort((l, r) => l - r);
        const middle = sorted.length >> 1;
        return sorted.length % 2 === 0
          ? (sorted[middle - 1]! + sorted[middle]!) / 2
          : sorted[middle]!;
      };
      const summarised = perSeason.map(({ one, seasons }) => ({
        one,
        seasons,
        scores: {
          livelihood: median(seasons.map((x) => x.livelihood)),
          restraint: median(seasons.map((x) => x.restraint)),
          forgone: median(seasons.map((x) => x.forgone)),
          cooperation: median(seasons.map((x) => x.cooperation)),
        } satisfies Scores,
      }));

      // Seasons taken, axis by axis: the part that tells a visitor whether a
      // lead is a habit or a lucky draw.
      const countWins = (key: "livelihood" | "restraint" | "cooperation", index: number) =>
        matchSeeds.filter((_, season) =>
          summarised.every(
            (other, rival) =>
              rival === index ||
              summarised[index]!.seasons[season]![key] >= other.seasons[season]![key],
          ),
        ).length;

      const all = summarised.map(({ scores }) => scores);
      const board: Entry[] = summarised.map(({ one, scores }, index) => ({
        ...scores,
        id: one.id,
        label: one.label,
        note: one.note,
        mine: one.mine,
        frontier: onFrontier(scores, all),
        won: {
          livelihood: countWins("livelihood", index),
          restraint: countWins("restraint", index),
          cooperation: countWins("cooperation", index),
        },
      }));

      const log = await runMatch(
        scenario,
        [tunableAgent(seat.id, seat.name, scenario, entry.sailing), ...rivalsFor(scenario)],
        { wallets: { [seat.id]: wallet } },
      );
      const full = evaluateMatch(log);
      if (cancelled) return;

      const mine = board.find((row) => row.mine)!;
      setResult({
        // Fog is drawn from this seat, so the replay shows the season the
        // entrant actually experienced rather than the one the engine ran.
        voyage: toVoyage(log, seat.id),
        scores: mine,
        board,
        survived: full.boats.filter((boat) => boat.survived).length,
        fleet: full.boats.length,
        seasonRounds: log.rounds.length,
        fuelLeft: log.finalState.boats[seat.id]?.fuelRemaining ?? 0,
        contracts: full.contracts.accepted,
        scenarioSeed: scenario.seed,
        key: runKey,
      });
      setTried((history) =>
        history.some((row) => row.key === runKey)
          ? history
          : [
              ...history,
              {
                key: runKey,
                approach: entry.name || "Your entry",
                seed: seed.replace("ocean-practice-v1:", "season "),
                rounds: log.rounds.length,
                scores: mine,
              },
            ],
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [entry, seed, runKey]);

  // A season takes minutes and the wait varies, so a disabled button on its own
  // is indistinguishable from a page that has stopped responding.
  useEffect(() => {
    if (!sailing) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.round((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sailing]);

  function patchEntry(patch: Partial<OceanEntry>) {
    setEntry((current) => {
      const next = { ...current, ...patch };
      setDraft(JSON.stringify(next, null, 2));
      setEntryErrors([]);
      return next;
    });
  }
  const patchWallet = (patch: Partial<OceanEntry["wallet"]>) =>
    patchEntry({ wallet: { ...entry.wallet, ...patch } });
  const patchSailing = (patch: Partial<TunableParams>) =>
    patchEntry({ sailing: { ...entry.sailing, ...patch } });

  /** Accept an entry typed into the JSON tab or dropped in as a file. */
  function adoptJson(text: string) {
    setDraft(text);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setEntryErrors(["That is not valid JSON"]);
      return;
    }
    const { entry: checked, failures } = checkOceanEntry(parsed);
    setEntryErrors(failures);
    if (checked) setEntry(checked);
  }

  /**
   * Register the wallet if it is new, then send the entry to be scored.
   *
   * The entry is checked here first so an obvious mistake is shown without a
   * round trip, but the server checks it again regardless — a browser is the
   * submitter's, not ours.
   */
  async function submitEntry() {
    const { failures } = checkOceanEntry(entry);
    if (failures.length > 0) {
      setEntryErrors(failures);
      setSubmitError("Fix the entry above before submitting.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      let id = participantId;
      if (id === null) {
        const registration = await fetch("/v2/sandbox/participants/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ challengeId: published.challengeId, wallet: wallet.trim() }),
        });
        const payload = await registration.json();
        if (!registration.ok) throw new Error(payload.error?.message ?? "Registration failed");
        id = payload.participant.participantId as string;
        setParticipantId(id);
      }

      const response = await fetch("/v2/sandbox/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          participantId: id,
          challengeId: published.challengeId,
          source: {
            method: "INLINE",
            visibility: "PUBLIC",
            filename: "entry.json",
            content: JSON.stringify(entry, null, 2),
          },
          artifactInput: entry,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Submission failed");
      const scored = payload.submission.evaluation;
      setSubmissions((current) => [
        {
          submissionId: payload.submission.submissionId,
          revision: payload.submission.revision,
          correctness: payload.submission.correctness,
          resultHash: payload.submission.evaluationResultHash,
          scores: scored.correctness
            ? {
                livelihood: scored.livelihood,
                restraint: scored.restraint,
                forgone: scored.forgone,
                cooperation: scored.cooperation,
              }
            : null,
          failures: scored.constraintFailures ?? [],
        },
        ...current,
      ]);
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function sailWithMission() {
    setSailing(true);
    setElapsed(0);
    setMissionError(null);
    setMissionRun(null);
    setSeasonsDone(0);

    // Seasons are requested one at a time rather than as one long call. A match
    // is nine to eighteen minutes, and no single HTTP request should be held
    // open that long; this way each season lands as it finishes and a failure
    // half way through still leaves the seasons already sailed on screen.
    const sailed: MissionSeason[] = [];
    const seeds = SEEDS.slice(0, MISSION_SEASONS);
    try {
      for (const each of seeds) {
        const response = await fetch("/v1/ocean-commons/seasons", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mission, seed: each }),
        });
        const payload = (await response.json()) as MissionSeason & {
          error?: { code?: string; message?: string };
        };
        if (!response.ok) {
          throw new Error(
            payload.error?.code === "SEASON_UNCONFIGURED"
              ? "No model is configured on this server, so a mission cannot be sailed here."
              : payload.error?.code === "SEASON_RATE_LIMITED"
                ? "Two matches in ten minutes is the limit; each season is a paid model run."
                : (payload.error?.message ?? "The season could not be sailed."),
          );
        }
        sailed.push(payload);
        setSeasonsDone(sailed.length);
        setMissionRun({
          mission,
          seasons: [...sailed],
          scores: {
            livelihood: medianOf(sailed.map((one) => one.scores.livelihood)),
            restraint: medianOf(sailed.map((one) => one.scores.restraint)),
            forgone: medianOf(sailed.map((one) => one.scores.forgone)),
            cooperation: medianOf(sailed.map((one) => one.scores.cooperation)),
          },
        });
      }
    } catch (cause) {
      setMissionError(cause instanceof Error ? cause.message : "The season could not be sailed.");
    } finally {
      setSailing(false);
    }
  }

  // The replay shows whichever season the visitor last produced — for a mission
  // match, the most recent of its seasons.
  const shown = missionRun?.seasons[missionRun.seasons.length - 1] ?? result;

  return (
    <div className="competition-shell ocean-competition">
      <section className="competition-scoreboard">
        <div>
          <span>ROUND</span>
          <strong>OPEN PRACTICE</strong>
        </div>
        <div>
          <span>REWARD POOL</span>
          <strong>30,000 FDT</strong>
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
        <a href="#submit">Submit</a>
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

        <div className="submission-mode-tabs" role="tablist" aria-label="Entry editor">
          {(["BUILDER", "JSON", "UPLOAD"] as const).map((one) => (
            <button
              aria-selected={mode === one}
              className={mode === one ? "active" : "secondary-action"}
              key={one}
              onClick={() => setMode(one)}
              role="tab"
              type="button"
            >
              {one === "BUILDER" ? "Entry builder" : one === "JSON" ? "JSON editor" : "Upload file"}
            </button>
          ))}
        </div>

        <p className="lever-explanation">
          An entry is a name, a standing instruction, the wallet the match loop enforces, and how
          the boat works a ground without a model. The three tabs edit one and the same thing, so a
          dial moved here shows up in the JSON and a file dropped in moves the dials. The form alone
          reaches {oceanEntrySpaceSize().toLocaleString("en-US")} distinct entries; the JSON editor
          is not bound by the sliders&apos; steps, so it reaches more.
        </p>

        {entryErrors.length > 0 ? (
          <ul className="ocean-entry-errors" role="alert">
            {entryErrors.map((failure) => (
              <li key={failure}>{failure}</li>
            ))}
          </ul>
        ) : null}

        {mode === "JSON" ? (
          <label className="json-submission-editor">
            <span>The whole entry, as the evaluator receives it</span>
            <textarea
              onChange={(event) => adoptJson(event.target.value)}
              rows={22}
              spellCheck={false}
              value={draft}
            />
          </label>
        ) : mode === "UPLOAD" ? (
          <label className="file-drop">
            <span>Choose a .json entry</span>
            <input
              accept="application/json,.json"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (file) adoptJson(await file.text());
              }}
              type="file"
            />
          </label>
        ) : null}

        <label className="ocean-field">
          <span>Entry name</span>
          <input
            maxLength={OCEAN_ENTRY_LIMITS.nameMaxLength}
            onChange={(event) => patchEntry({ name: event.target.value })}
            type="text"
            value={entry.name}
          />
        </label>

        <label className="ocean-field">
          <span>Standing instruction — what your skipper is for</span>
          <textarea
            value={mission}
            rows={7}
            onChange={(event) => patchEntry({ mission: event.target.value })}
            spellCheck={false}
          />
        </label>
        <div className="ocean-mission-actions">
          <button type="button" onClick={() => void sailWithMission()} disabled={sailing}>
            {sailing
              ? `Season ${Math.min(seasonsDone + 1, MISSION_SEASONS)} of ${MISSION_SEASONS}… ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`
              : `Sail ${MISSION_SEASONS} seasons with your mission`}
          </button>
          <p className="lever-explanation">
            A model-backed boat reads this text and nothing else about your intent. One season has
            measured between three and six minutes — the model answers twice a round, once to
            negotiate and once to fish, and how long it thinks is its own business. The page stays
            usable while it runs.
          </p>
        </div>
        {missionError ? (
          <p className="ocean-mission-error" role="alert">
            {missionError}
          </p>
        ) : null}
        {missionRun ? (
          <div className="ocean-mission-result">
            <p className="eyebrow">
              Your mission · {missionRun.seasons.length} of {MISSION_SEASONS} seasons sailed
            </p>
            <div className="live-preview-metrics">
              <article>
                <span>CREW LIVELIHOOD</span>
                <strong>{cash(missionRun.scores.livelihood)}</strong>
                <small>DemoUSD · median solvent boat</small>
              </article>
              <article>
                <span>RESTRAINT EFFICACY</span>
                <strong>{pct(missionRun.scores.restraint)}</strong>
                <small>
                  {missionRun.scores.forgone < 1
                    ? "gave up nothing to measure"
                    : `of the ${missionRun.scores.forgone.toFixed(0)} fish left, this much held`}
                </small>
              </article>
              <article>
                <span>COOPERATION EFFICACY</span>
                <strong>{missionRun.scores.cooperation.toFixed(3)}</strong>
                <small>
                  {missionRun.scores.cooperation < 0
                    ? "negative · contracts left the sea worse"
                    : "stewardship points per 1,000 spent"}
                </small>
              </article>
            </div>
            <ol className="ocean-tried">
              {missionRun.seasons.map((season) => (
                <li key={season.seed}>
                  <div>
                    <strong>{season.seed.replace("ocean-practice-v1:", "Season ")}</strong>
                    <small>
                      {season.rounds} rounds · {season.survived} of {season.fleet} solvent ·{" "}
                      {season.contracts} contracts
                    </small>
                  </div>
                  <span>{cash(season.scores.livelihood)}</span>
                  <span>{pct(season.scores.restraint)}</span>
                  <span>{season.scores.cooperation.toFixed(3)}</span>
                </li>
              ))}
            </ol>
            <p className="lever-explanation">
              The figures above the list are the median of the match; the rows are the seasons it is
              made of, and how far they sit apart is how much of this was the draw. The model
              answered {missionRun.seasons.reduce((sum, season) => sum + season.usage.calls, 0)}{" "}
              times
              {missionRun.seasons.reduce((sum, season) => sum + season.usage.failures, 0) > 0
                ? `, and ${missionRun.seasons.reduce((sum, season) => sum + season.usage.failures, 0)} of those could not be used — a boat whose agent fails stays in port that round.`
                : "."}{" "}
              The replay above shows the last of these seasons.
            </p>
          </div>
        ) : (
          <p className="lever-explanation">
            The scripted preview below is instant and costs nothing, so it shows the world reacting.
            Sailing your mission shows your words being interpreted.
          </p>
        )}

        <fieldset className="policy-picker">
          <legend>What is this boat allowed to sign?</legend>
          <p className="lever-explanation">
            Enforced by the match loop, not by the skipper. A boat that may not sign a buyout cannot
            buy restraint however it reasons — strike one off and an outcome changes shape rather
            than degree.
          </p>
          {OCEAN_PACT_KINDS.map((kind) => {
            const allowed = entry.wallet.allowedPurposes.includes(kind);
            return (
              <button
                aria-pressed={allowed}
                className={allowed ? "active" : "secondary-action"}
                key={kind}
                onClick={() =>
                  patchWallet({
                    allowedPurposes: allowed
                      ? entry.wallet.allowedPurposes.filter((one) => one !== kind)
                      : [...entry.wallet.allowedPurposes, kind],
                  })
                }
                type="button"
              >
                <span className="policy-state">{allowed ? "ALLOWED" : "FORBIDDEN"}</span>
                <strong>{PACT_LABELS[kind]}</strong>
                <small>{PACT_NOTES[kind]}</small>
              </button>
            );
          })}
        </fieldset>

        <div className="strategy-sliders">
          {(
            [
              [
                "maxPaymentPerTransaction",
                "Ceiling on one contract",
                OCEAN_ENTRY_LIMITS.maxPaymentPerTransaction,
                OCEAN_WALLET_STEPS.maxPaymentPerTransaction,
                "The heaviest boat is also the dearest to stop. Set this low and only the small ones are affordable.",
              ],
              [
                "maxAutonomousSpendPerMatch",
                "Ceiling for the season",
                OCEAN_ENTRY_LIMITS.maxAutonomousSpendPerMatch,
                OCEAN_WALLET_STEPS.maxAutonomousSpendPerMatch,
                "How many times the skipper can intervene before the wallet is closed for the rest of the season.",
              ],
              [
                "startingBudget",
                "Starting budget",
                OCEAN_ENTRY_LIMITS.startingBudget,
                OCEAN_WALLET_STEPS.startingBudget,
                "Cash in hand at the first round, before anything is landed or paid.",
              ],
            ] as const
          ).map(([key, title, bounds, step, note]) => (
            <label key={key}>
              <span>
                <strong>{title}</strong>
                <span className="mono">{entry.wallet[key]} DemoUSD</span>
              </span>
              <input
                max={bounds.max}
                min={bounds.min}
                onChange={(event) => patchWallet({ [key]: Number(event.target.value) })}
                step={step}
                type="range"
                value={entry.wallet[key]}
              />
              <small>{note}</small>
            </label>
          ))}
        </div>

        <fieldset className="policy-picker">
          <legend>How hard does the boat work a ground?</legend>
          <p className="lever-explanation">
            Affects SAIL. Fuel is a season budget, so working harder empties the tank sooner rather
            than landing more overall.
          </p>
          {EFFORT_CHOICES.map(([value, title, note]) => (
            <button
              aria-pressed={entry.sailing.effortFraction === value}
              className={entry.sailing.effortFraction === value ? "active" : "secondary-action"}
              key={title}
              onClick={() => patchSailing({ effortFraction: value })}
              type="button"
            >
              <span className="policy-state">
                {entry.sailing.effortFraction === value ? "SELECTED" : "CHOOSE"}
              </span>
              <strong>{title}</strong>
              <small>{note}</small>
            </button>
          ))}
        </fieldset>

        <fieldset className="policy-picker">
          <legend>When may the boat work the nursery reserve?</legend>
          <p className="lever-explanation">
            Affects RESTRAINT. The reserve feeds the other grounds, and it is most tempting in the
            gale, when the bank is shut and everyone is inshore.
          </p>
          {RESERVE_CHOICES.map(([value, title, note]) => (
            <button
              aria-pressed={entry.sailing.reserve === value}
              className={entry.sailing.reserve === value ? "active" : "secondary-action"}
              key={value}
              onClick={() => patchSailing({ reserve: value })}
              type="button"
            >
              <span className="policy-state">
                {entry.sailing.reserve === value ? "SELECTED" : "CHOOSE"}
              </span>
              <strong>{title}</strong>
              <small>{note}</small>
            </button>
          ))}
        </fieldset>

        <fieldset className="policy-picker">
          <legend>What does the boat pay for somebody else&apos;s restraint?</legend>
          <p className="lever-explanation">
            Affects COOPERATION. Offer too little and the offer is refused; offer generously and the
            money is gone whether or not it bought anything.
          </p>
          {CONTRACT_CHOICES.map(([value, title, note]) => (
            <button
              aria-pressed={entry.sailing.contracts === value}
              className={entry.sailing.contracts === value ? "active" : "secondary-action"}
              key={value}
              onClick={() => patchSailing({ contracts: value })}
              type="button"
            >
              <span className="policy-state">
                {entry.sailing.contracts === value ? "SELECTED" : "CHOOSE"}
              </span>
              <strong>{title}</strong>
              <small>{note}</small>
            </button>
          ))}
        </fieldset>

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
          <span>
            {missionRun ? "Your mission" : "Scripted preview"} · seed{" "}
            {shown === undefined || shown === null
              ? seed
              : "scenarioSeed" in shown
                ? shown.scenarioSeed
                : shown.seed}
          </span>
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
        {shown ? (
          <OceanVoyageStage voyage={shown.voyage} />
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
            <h2>Seven seasons, because one season is mostly the draw.</h2>
          </div>
          <span>Best of {MATCH_SEASONS} · no overall winner</span>
        </div>
        <div className="leaderboard-table ocean-leaderboard">
          <div className="leaderboard-row leaderboard-head">
            <span>Approach</span>
            <span>Livelihood · median</span>
            <span>Restraint · median</span>
            <span>Cooperation · median</span>
            <span>Standing</span>
          </div>
          {result ? (
            result.board.map((entry) => (
              <div
                key={entry.id}
                className={`leaderboard-row ${entry.frontier ? "on-frontier" : "dominated"}${
                  entry.mine ? " mine" : ""
                }`}
              >
                <span>
                  <strong>{entry.label}</strong>
                  <small>{entry.mine ? "Your entry" : entry.note}</small>
                </span>
                <span>
                  {cash(entry.livelihood)}
                  <small>
                    {entry.won.livelihood} of {MATCH_SEASONS} seasons
                  </small>
                </span>
                <span>
                  {pct(entry.restraint)}
                  <small>
                    {entry.won.restraint} of {MATCH_SEASONS} seasons
                  </small>
                </span>
                <span>
                  {entry.cooperation.toFixed(3)}
                  <small>
                    {entry.won.cooperation} of {MATCH_SEASONS} seasons
                  </small>
                </span>
                <span>{entry.frontier ? "On the frontier" : "Beaten on all three"}</span>
              </div>
            ))
          ) : (
            <p className="empty-state">Sailing your entry and the three references…</p>
          )}
        </div>
        <p className="lever-explanation">
          Each approach sails the same {MATCH_SEASONS} seasons; the figure is its median and the
          line beneath counts the seasons it took that axis. An approach stays on the frontier
          unless another beats it on all three at once, and more than one usually survives — there
          is no single best season, only seasons that are good at different things. Watch the season
          counts rather than the medians: a lead held in one season out of seven is the draw, and a
          lead held in five is a habit.
        </p>
      </section>

      <section className="value-allocations ocean-awards" id="allocations">
        <div className="section-title">
          <div>
            <p className="eyebrow">06 · VALUE ALLOCATIONS</p>
            <h2>Different values support different seasons.</h2>
          </div>
          <span>Three pools · 10,000 FDT each</span>
        </div>
        <div className="value-allocation-grid">
          {(
            [
              ["Crew livelihood", "livelihood", "Fishing families and the crews they employ."],
              ["Restraint efficacy", "restraint", "Everyone who will fish this water next season."],
              [
                "Cooperation efficacy",
                "cooperation",
                "Those who fund restraint rather than perform it.",
              ],
            ] as const
          ).map(([name, key, statement]) => {
            const best = result?.board.reduce((top, entry) =>
              entry[key] > top[key] ? entry : top,
            );
            return (
              <article key={key} className={best?.mine ? "my-award" : ""}>
                <header>
                  <span>Value pool</span>
                  <b>10,000 FDT</b>
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
          No pool is funded, because one season decides very little. Measured across 7,200 scripted
          seasons, the draw accounts for 20–38% of an outcome and a fixed policy for only 3–8%; the
          rest — 54–77% — is which policy suited which season, and that is the part only a skipper
          who reads the water can reach. Picking the right approach per season, with hindsight,
          beats the best single approach by 36% to 286%. So a single result here is closer to one
          hand of poker than to a race, and nothing is ranked on one.
        </p>
      </section>

      <section className="competition-build ocean-submit" id="submit">
        <div className="section-title">
          <div>
            <p className="eyebrow">07 · SUBMIT</p>
            <h2>Sail it against seeds you did not choose.</h2>
          </div>
          <span>{submissions.length} submitted</span>
        </div>

        <p className="lever-explanation">
          Everything above this line runs in your browser on a season you picked, which is practice
          and worth exactly what practice is worth. A submission is scored on the server over{" "}
          {OCEAN_SUBMISSION_SEASONS} published seeds, all of them, with the wallet policy enforced
          by the match loop rather than by the boat. The three outcomes come back separately and are
          hashed together; nothing adds them up.
        </p>

        <div className="ocean-submit-row">
          <label className="ocean-field">
            <span>Wallet address</span>
            <input
              onChange={(event) => setWallet(event.target.value)}
              placeholder="0x…"
              spellCheck={false}
              type="text"
              value={wallet}
            />
          </label>
          <button
            className="primary-action"
            disabled={submitting || wallet.trim().length === 0}
            onClick={() => void submitEntry()}
            type="button"
          >
            {submitting ? "Scoring…" : "Submit this entry"}
          </button>
        </div>

        {submitError ? (
          <p className="ocean-entry-errors" role="alert">
            {submitError}
          </p>
        ) : null}

        {submissions.length > 0 ? (
          <ol className="ocean-tried">
            {submissions.map((one) => (
              <li key={one.submissionId}>
                <div>
                  <strong>
                    {entry.name || "Your entry"} · revision {one.revision}
                  </strong>
                  <small className="mono">{one.resultHash.slice(0, 18)}…</small>
                </div>
                {one.scores ? (
                  <>
                    <span>{cash(one.scores.livelihood)}</span>
                    <span>{pct(one.scores.restraint)}</span>
                    <span>{one.scores.cooperation.toFixed(3)}</span>
                  </>
                ) : (
                  <span>{one.failures[0] ?? "rejected"}</span>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty-state">Nothing submitted yet.</p>
        )}

        <p className="competition-trust-note">
          The sandbox identifies an entrant by wallet only, which is not proof of personhood, and
          keeps nothing past a restart. A revision never overwrites the one before it: every
          submission keeps its own result hash, so a worse one cannot be quietly buried.
        </p>
      </section>

      <section className="competition-revisions ocean-revisions">
        <div className="section-title">
          <div>
            <p className="eyebrow">08 · WHAT YOU HAVE TRIED</p>
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
            <p className="eyebrow">09 · EVIDENCE</p>
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
          <article>
            <span>SETTLEMENT · SEPOLIA</span>
            <strong className="mono">
              <a
                href={`https://sepolia.etherscan.io/address/${SETTLEMENT_ADDRESS}`}
                rel="noreferrer"
                target="_blank"
              >
                {SETTLEMENT_ADDRESS.slice(0, 10)}…{SETTLEMENT_ADDRESS.slice(-6)}
              </a>
            </strong>
            <small>Verified · records a match and its frontier</small>
          </article>
        </div>
        <div className="ocean-settled">
          <div className="section-title">
            <div>
              <h3>The three pools have paid, and they disagreed.</h3>
              <p>
                Four reference entries sailed the {SETTLED_MATCH.seasons} scored seeds. The contract
                was told what each one scored, worked out the frontier itself, and kept{" "}
                {SETTLED_MATCH.onFrontier.length} of {SETTLED_MATCH.recorded} — nothing beats either
                on all three at once. Then each pool paid its own axis.
              </p>
            </div>
            <a
              className="mono"
              href={`https://sepolia.etherscan.io/tx/${SETTLED_MATCH.sealTx}`}
              rel="noreferrer"
              target="_blank"
            >
              seal tx ↗
            </a>
          </div>
          <div className="ocean-pools">
            {SETTLED_MATCH.pools.map((pool) => (
              <article key={pool.axis}>
                <h3>{pool.axis}</h3>
                <p className="ocean-pool-backed">
                  <strong>{pool.backed}</strong>
                  <span className="mono">{cash(pool.amount)} FDT</span>
                </p>
                <p>{pool.note}</p>
                <a
                  className="mono"
                  href={`https://sepolia.etherscan.io/tx/${pool.tx}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  {pool.tx.slice(0, 12)}… ↗
                </a>
              </article>
            ))}
          </div>
        </div>

        <p className="lever-explanation">
          Two pools backed the same entry and one did not, which is the whole point: the boat that
          landed the most fish gave up nothing and signed nothing, so it served one axis and no
          other. Had the contract been able to rank, that disagreement would have been averaged away
          into a single winner and the result would have said less than it does.
        </p>
        <p className="lever-explanation">
          The settlement contract has no function that ranks entries and none that adds the three
          outcomes together. It records what each entry scored, marks everything nothing beats on
          all three at once, and lets each of the three pools back whoever served its own outcome —
          so three funders can and do support three different skippers. It also refuses to record a
          result from fewer than three seasons, because one season is mostly the draw and paying out
          on it would be paying out on the weather.
        </p>
        <p className="competition-trust-note">
          FDT are demonstration credits on a test network and make no monetary claim. The engine
          resolves the sea; an agent only chooses where to fish and what to offer.
        </p>
      </section>
    </div>
  );
}
