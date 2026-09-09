"use client";

import type {
  DisasterResponseEvaluation,
  DisasterResponseStrategy,
  SupplierId,
} from "@frontier/disaster-response";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CalculatedLoadout, DisasterReplayStage } from "@/components/disaster-replay-stage";
import {
  describeStrategyChanges,
  metricOrigins,
  nextTradeoffMoves,
  worstScenarioReasons,
} from "@/lib/disaster-response-insights";
import { useFrontierAccount } from "@/components/wallet-panel";

type Scenario = {
  challengeId: string;
  name: string;
  durationHours: number;
  maxBudgetUsd: number;
  contextHash: string;
  finalScenarioCommitment: string;
  finalScenarioCount: number;
  disclosure: string;
  defaultStrategy: DisasterResponseStrategy;
  suppliers: readonly {
    id: SupplierId;
    name: string;
    unitCost: number;
    capacity: number;
    routeId: string;
    routeName: string;
    leadHours: number;
  }[];
  regions: readonly {
    id: string;
    name: string;
    demand: number;
    deadlineHour: number;
  }[];
  trainingScenarios: readonly { id: string; name: string; summary: string }[];
  benchmarks: readonly { id: string; name: string; approach: string }[];
};

type Challenge = {
  state: string;
  rewardPool: string;
  participantCount: number;
  submissionCount: number;
  maxRevisions: number;
  storage: string;
  authentication: string;
  settlement: string;
  scenario: Scenario;
};

type Submission = {
  submissionId: string;
  revision: number;
  sourceMethod: "VISUAL" | "JSON" | "UPLOAD";
  inputHash: string;
  artifact: { strategy: DisasterResponseStrategy };
  evaluation: DisasterResponseEvaluation;
  submittedAt: string;
};

type Participant = { participantId: string; displayName: string; wallet: string };
type FinalEntry = { submissionId: string; selectedAt: string };
type Reward = {
  amount: string;
  awardIds: string[];
  poolAllocations?: {
    poolId: string;
    poolName: string;
    manifestHash: string;
    credits: number;
  }[];
  allocationEvidenceHash?: string | null;
  status: "PREVIEW" | "SENDING" | "PAID" | "FAILED";
  allocationRoot: string | null;
  transactionHash: string | null;
  blockNumber: string | null;
  recipient: string;
  error: string | null;
};

type ValuePoolAllocation = {
  entryId: string;
  entryName: string;
  entryKind: "BENCHMARK" | "PARTICIPANT";
  credits: number;
  evidenceValue: number;
  evidenceLabel: string;
};

type ValuePool = {
  poolId: string;
  source: "BUILT_IN" | "COMMUNITY";
  funderLabel: string;
  name: string;
  valueStatement: string;
  ruleLabel: string;
  poolCredits: number;
  status: "PRACTICE" | "COMMITTED";
  manifestHash: string;
  allocations: ValuePoolAllocation[];
};

type EntryValueAllocation = {
  poolId: string;
  poolName: string;
  poolStatus: "PRACTICE" | "COMMITTED";
  manifestHash: string;
  credits: number;
  evidenceValue: number;
  evidenceLabel: string;
};

type LeaderboardEntry = {
  id: string;
  name: string;
  approach: string;
  kind: "BENCHMARK" | "PARTICIPANT";
  revision: number | null;
  totalProcurementCost: number;
  worstCaseDeliveredKits: number;
  regionalFairnessPpm: number;
  correctness: boolean;
  frontier: boolean;
  dominatedBy: string[];
  contributionPpm: number;
  awardIds: string[];
  valueAllocations: EntryValueAllocation[];
  rewardPreview: number;
  settlementEligibleCredits: number;
};

type Leaderboard = {
  participantCount: number;
  submissionCount: number;
  poolCredits: number;
  committedPoolCredits: number;
  practicePoolCredits: number;
  valuePools: ValuePool[];
  entries: LeaderboardEntry[];
};

const supplierOrders = {
  balanced: {
    primarySupplierOrder: ["harbor-aid", "inland-works", "northstar", "local-grid", "airbridge"],
    emergencySupplierOrder: ["airbridge", "local-grid", "northstar", "inland-works", "harbor-aid"],
  },
  budget: {
    primarySupplierOrder: ["harbor-aid", "northstar", "inland-works", "local-grid", "airbridge"],
    emergencySupplierOrder: ["inland-works", "local-grid", "airbridge", "northstar", "harbor-aid"],
  },
  resilient: {
    primarySupplierOrder: ["inland-works", "local-grid", "harbor-aid", "northstar", "airbridge"],
    emergencySupplierOrder: ["airbridge", "local-grid", "northstar", "harbor-aid", "inland-works"],
  },
} as const satisfies Record<
  string,
  Pick<DisasterResponseStrategy, "primarySupplierOrder" | "emergencySupplierOrder">
>;

function errorMessage(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object" &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  )
    return payload.error.message;
  return fallback;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function percent(ppm: number) {
  return `${(ppm / 10_000).toFixed(1)}%`;
}

function shortHash(value: string | null | undefined) {
  return value ? `${value.slice(0, 10)}…${value.slice(-8)}` : "PENDING";
}

function signedNumber(value: number, suffix = "") {
  return `${value > 0 ? "+" : ""}${value.toLocaleString("en-US")}${suffix}`;
}

function outcomeDelta(
  current: DisasterResponseEvaluation,
  previous: DisasterResponseEvaluation | null,
  key: "cost" | "delivery" | "fairness",
) {
  if (!previous) return null;
  if (key === "cost")
    return signedNumber(current.totalProcurementCost - previous.totalProcurementCost, " USD");
  if (key === "delivery")
    return signedNumber(current.worstCaseDeliveredKits - previous.worstCaseDeliveredKits, " kits");
  return signedNumber((current.regionalFairnessPpm - previous.regionalFairnessPpm) / 10_000, " pt");
}

export function DisasterResponseCompetition({ initialScenario }: { initialScenario: Scenario }) {
  const account = useFrontierAccount();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [finalEntry, setFinalEntry] = useState<FinalEntry | null>(null);
  const [reward, setReward] = useState<Reward | null>(null);
  const [strategy, setStrategy] = useState<DisasterResponseStrategy>({
    ...initialScenario.defaultStrategy,
    primarySupplierOrder: [...initialScenario.defaultStrategy.primarySupplierOrder],
    emergencySupplierOrder: [...initialScenario.defaultStrategy.emergencySupplierOrder],
  });
  const [jsonDraft, setJsonDraft] = useState(
    JSON.stringify({ strategy: initialScenario.defaultStrategy }, null, 2),
  );
  const [sourceMethod, setSourceMethod] = useState<"VISUAL" | "JSON" | "UPLOAD">("VISUAL");
  const [practiceEvaluation, setPracticeEvaluation] = useState<DisasterResponseEvaluation | null>(
    null,
  );
  const [previousEvaluation, setPreviousEvaluation] = useState<DisasterResponseEvaluation | null>(
    null,
  );
  const [previewEvaluation, setPreviewEvaluation] = useState<DisasterResponseEvaluation | null>(
    null,
  );
  const [previewPending, setPreviewPending] = useState(true);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [valuePoolNotice, setValuePoolNotice] = useState<string | null>(null);
  const [valuePoolDraft, setValuePoolDraft] = useState({
    name: "Highland Care Pool",
    valueStatement: "Protect the clinic that the main network is most likely to leave behind.",
    regionId: "highland",
    poolCredits: 1_200,
  });
  const scenario = challenge?.scenario ?? initialScenario;

  const loadPublic = useCallback(async () => {
    const [challengeResponse, leaderboardResponse] = await Promise.all([
      fetch("/v1/challenges/disaster-response", { cache: "no-store" }),
      fetch("/v1/challenges/disaster-response/leaderboard", { cache: "no-store" }),
    ]);
    if (challengeResponse.ok) setChallenge((await challengeResponse.json()) as Challenge);
    if (leaderboardResponse.ok) setLeaderboard((await leaderboardResponse.json()) as Leaderboard);
  }, []);

  const loadMine = useCallback(async () => {
    if (!account.authenticated) {
      setParticipant(null);
      setSubmissions([]);
      setFinalEntry(null);
      setReward(null);
      return;
    }
    try {
      const auth = await account.authHeaders();
      const [entriesResponse, rewardResponse] = await Promise.all([
        fetch("/v1/challenges/disaster-response/submissions/mine", {
          cache: "no-store",
          headers: auth,
        }),
        fetch("/v1/challenges/disaster-response/reward/mine", {
          cache: "no-store",
          headers: auth,
        }),
      ]);
      const entriesPayload = await entriesResponse.json();
      if (!entriesResponse.ok)
        throw new Error(
          errorMessage(entriesPayload, "Your competition record could not be loaded"),
        );
      setParticipant(entriesPayload.participant);
      setSubmissions(entriesPayload.submissions);
      setFinalEntry(entriesPayload.finalEntry);
      if (rewardResponse.ok) setReward((await rewardResponse.json()).reward);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Your competition record could not be loaded",
      );
    }
  }, [account]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPublic(), 0);
    return () => window.clearTimeout(timer);
  }, [loadPublic]);

  useEffect(() => {
    if (!account.ready) return;
    const timer = window.setTimeout(() => void loadMine(), 0);
    return () => window.clearTimeout(timer);
  }, [account.ready, account.authenticated, loadMine]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPreviewPending(true);
      try {
        const response = await fetch("/v1/disaster-response/evaluations", {
          body: JSON.stringify(strategy),
          headers: { "content-type": "application/json" },
          method: "POST",
          signal: controller.signal,
        });
        if (!response.ok) return;
        setPreviewEvaluation((await response.json()) as DisasterResponseEvaluation);
      } catch (cause) {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) {
          setPreviewEvaluation(null);
        }
      } finally {
        if (!controller.signal.aborted) setPreviewPending(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [strategy]);

  function setVisualStrategy(next: DisasterResponseStrategy) {
    if (practiceEvaluation) setPreviousEvaluation(practiceEvaluation);
    setStrategy(next);
    setJsonDraft(JSON.stringify({ strategy: next }, null, 2));
    setPracticeEvaluation(null);
  }

  function patchStrategy(next: Partial<DisasterResponseStrategy>) {
    setVisualStrategy({ ...strategy, ...next });
  }

  function applyPreset(preset: "budget" | "balanced" | "resilient") {
    const tuning = {
      budget: {
        reserveKits: 40,
        emergencyBudgetUsd: 7_000,
        regionPolicy: "deadline-first" as const,
      },
      balanced: {
        reserveKits: 220,
        emergencyBudgetUsd: 18_000,
        regionPolicy: "equalize-coverage" as const,
      },
      resilient: {
        reserveKits: 300,
        emergencyBudgetUsd: 24_000,
        regionPolicy: "highest-need" as const,
      },
    }[preset];
    patchStrategy({
      ...supplierOrders[preset],
      ...tuning,
      name:
        preset === "budget"
          ? "My budget response"
          : preset === "resilient"
            ? "My resilient response"
            : "My balanced response",
    });
  }

  function resetStrategy() {
    setVisualStrategy({
      ...initialScenario.defaultStrategy,
      primarySupplierOrder: [...initialScenario.defaultStrategy.primarySupplierOrder],
      emergencySupplierOrder: [...initialScenario.defaultStrategy.emergencySupplierOrder],
    });
  }

  function setNumericStrategy(
    key: "reserveKits" | "emergencyBudgetUsd",
    rawValue: number,
    maximum: number,
  ) {
    const value = Number.isFinite(rawValue)
      ? Math.min(maximum, Math.max(0, Math.round(rawValue)))
      : 0;
    patchStrategy({ [key]: value });
  }

  function moveSupplier(
    field: "primarySupplierOrder" | "emergencySupplierOrder",
    index: number,
    offset: -1 | 1,
  ) {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= strategy[field].length) return;
    const order = [...strategy[field]];
    [order[index], order[nextIndex]] = [order[nextIndex]!, order[index]!];
    patchStrategy({ [field]: order });
  }

  function moveSupplierTo(
    field: "primarySupplierOrder" | "emergencySupplierOrder",
    index: number,
    nextIndex: number,
  ) {
    if (nextIndex < 0 || nextIndex >= strategy[field].length || nextIndex === index) return;
    const order = [...strategy[field]];
    const [supplier] = order.splice(index, 1);
    order.splice(nextIndex, 0, supplier!);
    patchStrategy({ [field]: order });
  }

  function applyJson(raw: string) {
    setJsonDraft(raw);
    try {
      const parsed = JSON.parse(raw) as { strategy?: DisasterResponseStrategy };
      if (parsed.strategy) {
        if (practiceEvaluation) setPreviousEvaluation(practiceEvaluation);
        setStrategy(parsed.strategy);
        setError(null);
        setPracticeEvaluation(null);
      }
    } catch {
      // Report malformed JSON when the user runs or submits it.
    }
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setSourceMethod("UPLOAD");
    applyJson(await file.text());
  }

  async function mutate(path: string, method: "POST" | "PUT", body?: unknown) {
    const auth = await account.authHeaders();
    const response = await fetch(path, {
      method,
      headers: {
        ...auth,
        "content-type": "application/json",
        "idempotency-key": crypto.randomUUID(),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(errorMessage(payload, "Competition action failed"));
    return payload;
  }

  async function join() {
    if (!account.authenticated) {
      account.login();
      return;
    }
    setPending("join");
    setError(null);
    try {
      const payload = await mutate("/v1/challenges/disaster-response/join", "POST");
      setParticipant(payload.participant);
      await loadPublic();
      document.querySelector("#build")?.scrollIntoView({ behavior: "smooth" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not join the challenge");
    } finally {
      setPending(null);
    }
  }

  async function runPractice() {
    setPending("practice");
    setError(null);
    try {
      const parsed = JSON.parse(jsonDraft) as { strategy?: DisasterResponseStrategy };
      if (!parsed.strategy) throw new Error("strategy.json must contain a strategy object");
      const response = await fetch("/v1/disaster-response/evaluations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.strategy),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload, "Practice run failed"));
      setPracticeEvaluation(payload as DisasterResponseEvaluation);
      setSelectedScenarioId((payload as DisasterResponseEvaluation).worstScenarioId);
      window.requestAnimationFrame(() => {
        document
          .querySelector(".replay-experience")
          ?.scrollIntoView({ behavior: "auto", block: "start" });
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Practice run failed");
    } finally {
      setPending(null);
    }
  }

  async function submit() {
    setPending("submit");
    setError(null);
    try {
      const parsed = JSON.parse(jsonDraft) as { strategy?: DisasterResponseStrategy };
      if (!parsed.strategy) throw new Error("strategy.json must contain a strategy object");
      const payload = await mutate("/v1/challenges/disaster-response/submissions", "POST", {
        strategy: parsed.strategy,
        sourceMethod,
        repositoryUrl: null,
        sourceCommit: null,
      });
      setSubmissions((current) => [...current, payload.submission]);
      setPracticeEvaluation(payload.submission.evaluation);
      setSelectedScenarioId(payload.submission.evaluation.worstScenarioId);
      await loadPublic();
      document.querySelector("#results")?.scrollIntoView({ behavior: "smooth" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Submission failed");
    } finally {
      setPending(null);
    }
  }

  async function chooseFinal(submissionId: string) {
    setPending(submissionId);
    setError(null);
    try {
      const payload = await mutate("/v1/challenges/disaster-response/final-entry", "PUT", {
        submissionId,
      });
      setFinalEntry(payload.finalEntry);
      await loadPublic();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Final Entry could not be saved");
    } finally {
      setPending(null);
    }
  }

  async function settle() {
    setPending("settle");
    setError(null);
    try {
      const payload = await mutate("/v1/challenges/disaster-response/demo-settlement", "POST");
      setReward(payload.reward);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Demo reward could not be sent");
    } finally {
      setPending(null);
    }
  }

  async function fundValue() {
    if (!account.authenticated) {
      account.login();
      return;
    }
    setPending("fund-value");
    setError(null);
    setValuePoolNotice(null);
    try {
      const payload = await mutate(
        "/v1/challenges/disaster-response/value-pools",
        "POST",
        valuePoolDraft,
      );
      setValuePoolNotice(`${payload.valuePool.name} is now part of this practice value market.`);
      await loadPublic();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Value Pool could not be published");
    } finally {
      setPending(null);
    }
  }

  const latest = submissions.at(-1) ?? null;
  const selectedSubmission = finalEntry
    ? (submissions.find(({ submissionId }) => submissionId === finalEntry.submissionId) ?? null)
    : latest;
  const activeEvaluation = practiceEvaluation ?? selectedSubmission?.evaluation ?? null;
  const selectedOutcome = activeEvaluation
    ? (activeEvaluation.scenarioOutcomes.find(
        ({ scenarioId }) => scenarioId === selectedScenarioId,
      ) ??
      activeEvaluation.scenarioOutcomes.find(
        ({ scenarioId }) => scenarioId === activeEvaluation.worstScenarioId,
      ) ??
      activeEvaluation.scenarioOutcomes[0] ??
      null)
    : null;
  const boardEntryId = finalEntry?.submissionId ?? latest?.submissionId;
  const myBoardEntry = leaderboard?.entries.find(({ id }) => id === boardEntryId);
  const myValueAllocations = myBoardEntry?.valueAllocations ?? [];
  const evidenceEvaluation =
    selectedSubmission?.evaluation ?? practiceEvaluation ?? previewEvaluation ?? null;
  const selectedSubmissionIndex = selectedSubmission
    ? submissions.findIndex(({ submissionId }) => submissionId === selectedSubmission.submissionId)
    : -1;
  const previousSavedEvaluation =
    selectedSubmissionIndex > 0 ? submissions[selectedSubmissionIndex - 1]!.evaluation : null;
  const comparisonEvaluation = practiceEvaluation
    ? previousEvaluation
    : (previousSavedEvaluation ?? previousEvaluation);
  const previewComparison = previousEvaluation ?? selectedSubmission?.evaluation ?? null;
  const supplierNames = Object.fromEntries(scenario.suppliers.map(({ id, name }) => [id, name]));
  const previewChanges = previewEvaluation
    ? describeStrategyChanges(previewComparison?.strategy ?? null, strategy, supplierNames)
    : [];
  const activeMetricOrigins = activeEvaluation ? metricOrigins(activeEvaluation) : [];
  const activeWorstExplanation = activeEvaluation ? worstScenarioReasons(activeEvaluation) : null;
  const activeNextMoves = activeEvaluation ? nextTradeoffMoves(activeEvaluation) : [];
  const activeStrategyChanges = activeEvaluation
    ? describeStrategyChanges(
        comparisonEvaluation?.strategy ?? null,
        activeEvaluation.strategy,
        supplierNames,
      )
    : [];
  const totalPositiveContributionPpm =
    leaderboard?.entries.reduce((total, entry) => total + Math.max(0, entry.contributionPpm), 0) ??
    0;

  return (
    <div className="competition-shell disaster-competition">
      <section className="disaster-story" aria-label="How the challenge works">
        <Image
          alt="Relief warehouses reroute supplies around a storm-damaged port and road to reach four communities"
          className="disaster-story-image"
          height={1024}
          priority
          sizes="(max-width: 900px) 100vw, 1200px"
          src="/images/disaster-response-network.png"
          width={1536}
        />
        <div className="disaster-story-copy">
          <p className="eyebrow">THE WHOLE GAME IN ONE PICTURE</p>
          <h2>Routes fail. Your strategy reroutes aid.</h2>
          <div className="disaster-story-facts">
            <span>
              <b>72</b> HOURS
            </span>
            <span>
              <b>{money(scenario.maxBudgetUsd)}</b> LIMIT
            </span>
            <span>
              <b>{scenario.regions.length}</b> REGIONS
            </span>
            <span>
              <b>{leaderboard?.valuePools.length ?? 4}</b> VALUE POOLS
            </span>
          </div>
        </div>
      </section>

      <ol className="disaster-how">
        <li>
          <span>01</span>
          <strong>Build a strategy</strong>
          <small>Choose suppliers, recovery budget, and regional priority.</small>
        </li>
        <li>
          <span>02</span>
          <strong>Survive disruption</strong>
          <small>Committed scenarios close ports, roads, rail, or air.</small>
        </li>
        <li>
          <span>03</span>
          <strong>Earn from values</strong>
          <small>Different funders reward different kinds of useful solution.</small>
        </li>
      </ol>

      <section className="competition-scoreboard">
        <div>
          <span>ROUND</span>
          <strong>INSTANT FINAL DEMO</strong>
        </div>
        <div>
          <span>REWARD POOL</span>
          <strong>{challenge?.rewardPool ?? "10,000 FDT"}</strong>
        </div>
        <div>
          <span>BUILDERS</span>
          <strong>{leaderboard?.participantCount ?? 0}</strong>
        </div>
        <div>
          <span>SUBMISSIONS</span>
          <strong>{leaderboard?.submissionCount ?? 0}</strong>
        </div>
        <div>
          <span>YOUR STATUS</span>
          <strong>{finalEntry ? "FINAL READY" : participant ? "BUILDING" : "NOT JOINED"}</strong>
        </div>
      </section>

      <nav className="competition-nav" aria-label="Disaster Response sections">
        <a href="#mission">Mission</a>
        <a href="#rules">Rules</a>
        <a href="#value-pools">Value pools</a>
        <a href="#build">Build strategy</a>
        <a href="#replay">Disaster replay</a>
        <a href="#allocations">Allocations</a>
      </nav>

      <section className="disaster-mission" id="mission">
        <div>
          <p className="eyebrow">01 · THE MISSION</p>
          <h2>Keep every region supplied for 72 hours.</h2>
          <p>
            Suppliers are cheap or fast, but their routes can fail. Create a policy that buys stock,
            keeps emergency capacity, and decides which community receives the next shipment.
          </p>
          <div className="actions">
            <button
              disabled={!account.configured || pending === "join" || Boolean(participant)}
              onClick={() => void join()}
            >
              {participant
                ? "Challenge joined"
                : account.authenticated
                  ? "Join challenge"
                  : account.configured
                    ? "Sign in to join"
                    : "Local sign-in not configured"}
            </button>
            <a
              className="secondary-action"
              download
              href="/v1/challenges/disaster-response/starter-kit"
            >
              Download Starter Kit
            </a>
          </div>
          <div className="auth-boundary-note">
            <strong>Practice needs no login.</strong>
            <span>
              You only sign in to save revisions, choose a Final Entry, and receive a Sepolia demo
              reward.
            </span>
            {!account.configured ? (
              <small>
                This local server has no Privy verification configuration. The evaluator below is
                still fully interactive.
              </small>
            ) : null}
          </div>
        </div>
        <div className="mission-values">
          <article>
            <span>NO OVERALL SCORE</span>
            <strong>Useful can mean different things</strong>
            <small>Cost, resilience, and fairness remain independent.</small>
          </article>
          <article>
            <span>VALUE OWNERS</span>
            <strong>Funders publish what they support</strong>
            <small>Every Pool keeps its rule and budget visible.</small>
          </article>
          <article>
            <span>OPEN VALUE</span>
            <strong>A community can add another reason</strong>
            <small>The same evidence can unlock a new reward.</small>
          </article>
        </div>
      </section>

      <section aria-labelledby="rules-title" className="rules-brief" id="rules">
        <header>
          <p className="eyebrow">RULES IN 30 SECONDS</p>
          <h2 id="rules-title">You are designing a response policy, not guessing five numbers.</h2>
          <p>
            Split one {money(scenario.maxBudgetUsd)} budget before disaster strikes, then survive
            the same seven published and committed scenarios as every other strategy.
          </p>
        </header>
        <ol className="rules-flow">
          <li>
            <span>01 · SPLIT</span>
            <strong>Keep cash or buy now</strong>
            <small>Recovery cash is subtracted from the initial buying budget.</small>
          </li>
          <li>
            <span>02 · BUY</span>
            <strong>Order 1,000 kits</strong>
            <small>Primary and backup rankings decide price, route, capacity, and arrival.</small>
          </li>
          <li>
            <span>03 · BREAK</span>
            <strong>Lose exposed shipments</strong>
            <small>Stock arriving after its route or supplier fails is lost.</small>
          </li>
          <li>
            <span>04 · RECOVER</span>
            <strong>Buy from survivors</strong>
            <small>Your emergency ranking spends the cash you kept in reserve.</small>
          </li>
          <li>
            <span>05 · DELIVER</span>
            <strong>Meet four deadlines</strong>
            <small>Your region policy decides who receives each arriving shipment first.</small>
          </li>
        </ol>
        <div className="rules-outcomes">
          <article>
            <span>MEASUREMENT 01 · MINIMIZE</span>
            <strong>Cost exposure</strong>
            <p>The most expensive result across all seven scenarios.</p>
          </article>
          <article>
            <span>MEASUREMENT 02 · MAXIMIZE</span>
            <strong>Worst delivery</strong>
            <p>The fewest kits delivered before deadlines in any scenario.</p>
          </article>
          <article>
            <span>MEASUREMENT 03 · MAXIMIZE</span>
            <strong>Worst-region coverage</strong>
            <p>The lowest coverage received by any region in any scenario.</p>
          </article>
        </div>
        <div className="rules-references">
          <div>
            <span>THREE PUBLIC REFERENCE STRATEGIES</span>
            <strong>They show the trade-offs you are trying to improve.</strong>
          </div>
          {scenario.benchmarks.map((benchmark) => (
            <article key={benchmark.id}>
              <strong>{benchmark.name}</strong>
              <small>{benchmark.approach}</small>
            </article>
          ))}
        </div>
        <aside className="rules-no-winner">
          <strong>No overall score. No single overall winner.</strong>
          <span>
            Four Value Pools independently support delivery, efficiency, fairness, or a genuinely
            new Pareto trade-off. Correctness is a hard gate before any Pool can support a strategy.
          </span>
        </aside>
      </section>

      <section className="value-pool-market" id="value-pools">
        <div className="section-title">
          <div>
            <p className="eyebrow">02 · THE VALUE MARKET</p>
            <h2>Four groups. Four definitions of value.</h2>
          </div>
          <span>AI optimizes routes. People choose what deserves funding.</span>
        </div>
        <div className="value-pool-grid">
          {leaderboard?.valuePools.map((pool) => (
            <article
              className={pool.source === "COMMUNITY" ? "community-pool" : ""}
              key={pool.poolId}
            >
              <header>
                <span>{pool.funderLabel}</span>
                <b>
                  {pool.status === "PRACTICE" ? "PRACTICE · NOT FUNDED" : "COMMITTED DEMO VALUE"}
                </b>
              </header>
              <h3>{pool.name}</h3>
              <p>{pool.valueStatement}</p>
              <div className="pool-rule">
                <span>PUBLIC RULE</span>
                <strong>{pool.ruleLabel}</strong>
              </div>
              <footer>
                <span>VALUE BUDGET</span>
                <strong>{pool.poolCredits.toLocaleString()} FDT credits</strong>
              </footer>
            </article>
          )) ?? <p>Loading Value Pools…</p>}
        </div>
        <div className="value-market-thesis">
          <span>NO GLOBAL WINNER</span>
          <strong>A strategy only needs to create value for someone.</strong>
          <p>
            Each Pool keeps its own rule and budget. No hidden weighting collapses their priorities
            into one score.
          </p>
        </div>
        <details className="fund-value-panel">
          <summary>Fund another value</summary>
          <div>
            <header>
              <span>COMMUNITY POOL TEMPLATE · PRACTICE</span>
              <h3>Protect one region that the main market overlooks.</h3>
              <p>
                Publish one practice Pool from measured regional coverage. This creates demo
                credits; it does not deposit or transfer Sepolia tokens.
              </p>
            </header>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void fundValue();
              }}
            >
              <label>
                Pool name
                <input
                  maxLength={60}
                  onChange={(event) =>
                    setValuePoolDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  value={valuePoolDraft.name}
                />
              </label>
              <label>
                Region to protect
                <select
                  onChange={(event) =>
                    setValuePoolDraft((current) => ({ ...current, regionId: event.target.value }))
                  }
                  value={valuePoolDraft.regionId}
                >
                  {scenario.regions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Practice budget
                <span className="numeric-control">
                  <input
                    max={2500}
                    min={100}
                    onChange={(event) =>
                      setValuePoolDraft((current) => ({
                        ...current,
                        poolCredits: Math.min(2500, Math.max(100, Number(event.target.value))),
                      }))
                    }
                    step={100}
                    type="number"
                    value={valuePoolDraft.poolCredits}
                  />
                  <b>FDT credits</b>
                </span>
              </label>
              <label className="value-statement-field">
                Why this value matters
                <textarea
                  maxLength={180}
                  onChange={(event) =>
                    setValuePoolDraft((current) => ({
                      ...current,
                      valueStatement: event.target.value,
                    }))
                  }
                  rows={3}
                  value={valuePoolDraft.valueStatement}
                />
              </label>
              <button disabled={pending === "fund-value"} type="submit">
                {pending === "fund-value"
                  ? "Publishing value…"
                  : account.authenticated
                    ? "Publish practice Pool"
                    : "Sign in to publish"}
              </button>
              {valuePoolNotice ? <p role="status">{valuePoolNotice}</p> : null}
            </form>
          </div>
        </details>
      </section>

      <section className="competition-build disaster-builder" id="build">
        <header>
          <div>
            <p className="eyebrow">03 · BUILD YOUR RESPONSE</p>
            <h2>Create a strategy, not five allocation numbers.</h2>
          </div>
          <div className="strategy-version">
            <span>ARTIFACT</span>
            <strong>Strategy v2</strong>
          </div>
        </header>

        <div className="submission-mode-tabs" role="tablist" aria-label="Strategy editor">
          {(["VISUAL", "JSON", "UPLOAD"] as const).map((mode) => (
            <button
              aria-selected={sourceMethod === mode}
              className={sourceMethod === mode ? "active" : "secondary-action"}
              key={mode}
              onClick={() => setSourceMethod(mode)}
              role="tab"
              type="button"
            >
              {mode === "VISUAL"
                ? "Strategy builder"
                : mode === "JSON"
                  ? "JSON editor"
                  : "Upload file"}
            </button>
          ))}
        </div>

        {sourceMethod === "VISUAL" ? (
          <div className="strategy-builder-grid">
            <div className="strategy-presets">
              <span>STARTING APPROACH</span>
              <div>
                <button className="secondary-action" onClick={() => applyPreset("budget")}>
                  Spend less
                </button>
                <button className="secondary-action" onClick={() => applyPreset("balanced")}>
                  Balance
                </button>
                <button className="secondary-action" onClick={() => applyPreset("resilient")}>
                  Survive more
                </button>
                <button className="secondary-action" onClick={resetStrategy}>
                  Reset
                </button>
              </div>
            </div>
            <label className="strategy-name">
              Strategy name
              <input
                value={strategy.name}
                onChange={(event) => patchStrategy({ name: event.target.value })}
              />
            </label>
            <fieldset className="policy-picker">
              <legend>When aid arrives, who gets it first?</legend>
              <p className="lever-explanation">
                Affects <b>DELIVER</b>. The same arriving stock can produce a different regional
                result depending on this rule.
              </p>
              {(
                [
                  ["deadline-first", "Urgent first", "Serve the earliest deadline."],
                  ["highest-need", "Largest need", "Move the most kits quickly."],
                  ["equalize-coverage", "Fair coverage", "Raise the worst-served region first."],
                ] as const
              ).map(([value, title, description]) => (
                <button
                  aria-pressed={strategy.regionPolicy === value}
                  className={strategy.regionPolicy === value ? "active" : "secondary-action"}
                  key={value}
                  onClick={() => patchStrategy({ regionPolicy: value })}
                  type="button"
                >
                  <span className="policy-state">
                    {strategy.regionPolicy === value ? "SELECTED" : "CHOOSE"}
                  </span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </button>
              ))}
            </fieldset>
            <div className="strategy-sliders">
              <label>
                <span>
                  <strong>Stage backup inventory</strong>
                  <span className="numeric-control">
                    <input
                      aria-label="Backup route reserve kits"
                      max={300}
                      min={0}
                      onChange={(event) =>
                        setNumericStrategy("reserveKits", Number(event.target.value), 300)
                      }
                      step={10}
                      type="number"
                      value={strategy.reserveKits}
                    />
                    <b>kits</b>
                  </span>
                </span>
                <input
                  max={300}
                  min={0}
                  onChange={(event) =>
                    setNumericStrategy("reserveKits", Number(event.target.value), 300)
                  }
                  step={10}
                  type="range"
                  value={strategy.reserveKits}
                />
                <small>
                  Affects <b>BUY</b>. {strategy.reserveKits} kits follow the backup order and{" "}
                  {1_000 - strategy.reserveKits} follow the primary order. More route diversity can
                  cost more.
                </small>
              </label>
              <label>
                <span>
                  <strong>Emergency recovery budget</strong>
                  <span className="numeric-control money-input">
                    <b>$</b>
                    <input
                      aria-label="Emergency recovery budget in US dollars"
                      max={25000}
                      min={0}
                      onChange={(event) =>
                        setNumericStrategy("emergencyBudgetUsd", Number(event.target.value), 25_000)
                      }
                      step={1000}
                      type="number"
                      value={strategy.emergencyBudgetUsd}
                    />
                  </span>
                </span>
                <input
                  max={25000}
                  min={0}
                  onChange={(event) =>
                    setNumericStrategy("emergencyBudgetUsd", Number(event.target.value), 25_000)
                  }
                  step={1000}
                  type="range"
                  value={strategy.emergencyBudgetUsd}
                />
                <small>
                  Affects <b>SPLIT + RECOVER</b>. More recovery cash buys after a failure, but
                  leaves less for initial procurement.
                </small>
              </label>
            </div>
            <div className="budget-ledger" aria-label="Budget split">
              <div>
                <span>INITIAL BUYING</span>
                <strong>{money(scenario.maxBudgetUsd - strategy.emergencyBudgetUsd)}</strong>
                <small>Available before a route or supplier fails</small>
              </div>
              <b aria-hidden="true">+</b>
              <div>
                <span>RECOVERY VAULT</span>
                <strong>{money(strategy.emergencyBudgetUsd)}</strong>
                <small>Held back for purchases after disruption</small>
              </div>
              <b aria-hidden="true">=</b>
              <div>
                <span>FIXED LIMIT</span>
                <strong>{money(scenario.maxBudgetUsd)}</strong>
                <small>The evaluator never gives you extra budget</small>
              </div>
            </div>
            <div className="priority-columns">
              {(
                [
                  ["primarySupplierOrder", "Primary buying order"],
                  ["emergencySupplierOrder", "Backup & recovery priority"],
                ] as const
              ).map(([field, title]) => (
                <div key={field}>
                  <h3>{title}</h3>
                  <p className="lever-explanation">
                    {field === "primarySupplierOrder"
                      ? "Affects BUY. The evaluator fills the initial order from #1 downward."
                      : "Affects BUY + RECOVER. Reserve and post-failure orders try #1 first, skipping failed options."}
                  </p>
                  <ol>
                    {strategy[field].map((supplierId, index) => {
                      const supplier = scenario.suppliers.find(({ id }) => id === supplierId)!;
                      return (
                        <li key={supplierId}>
                          <span>{index + 1}</span>
                          <div>
                            <strong>{supplier.name}</strong>
                            <small>
                              {supplier.routeName} · {money(supplier.unitCost)}/kit ·{" "}
                              {supplier.leadHours}h · cap {supplier.capacity}
                            </small>
                          </div>
                          <div className="priority-actions">
                            <label>
                              <span className="sr-only">Position for {supplier.name}</span>
                              <select
                                aria-label={`Position for ${supplier.name}`}
                                onChange={(event) =>
                                  moveSupplierTo(field, index, Number(event.target.value))
                                }
                                value={index}
                              >
                                {strategy[field].map((_, position) => (
                                  <option key={position} value={position}>
                                    #{position + 1}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button
                              aria-label={`Move ${supplier.name} up`}
                              className="text-button"
                              disabled={index === 0}
                              onClick={() => moveSupplier(field, index, -1)}
                            >
                              ↑
                            </button>
                            <button
                              aria-label={`Move ${supplier.name} down`}
                              className="text-button"
                              disabled={index === strategy[field].length - 1}
                              onClick={() => moveSupplier(field, index, 1)}
                            >
                              ↓
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </div>
            <CalculatedLoadout evaluation={previewEvaluation} />
          </div>
        ) : sourceMethod === "JSON" ? (
          <label className="json-submission-editor">
            strategy.json
            <textarea
              onChange={(event) => applyJson(event.target.value)}
              rows={24}
              value={jsonDraft}
            />
          </label>
        ) : (
          <label className="file-drop">
            <strong>Upload strategy.json</strong>
            <span>Use the same Strategy v2 schema included in the Starter Kit.</span>
            <input
              accept="application/json,.json"
              onChange={(event) => void upload(event.target.files?.[0])}
              type="file"
            />
          </label>
        )}

        <section className="strategy-live-preview" aria-live="polite">
          <header>
            <div>
              <span>LIVE FORECAST · NO LOGIN REQUIRED</span>
              <strong>Every edit reruns all seven scenarios.</strong>
            </div>
            <b>{previewPending ? "CALCULATING…" : "UPDATED"}</b>
          </header>
          <div className="live-preview-metrics">
            <article>
              <span>Cost exposure</span>
              <strong>
                {previewEvaluation ? money(previewEvaluation.totalProcurementCost) : "—"}
              </strong>
              <small>Lower is better</small>
            </article>
            <article>
              <span>Worst delivery</span>
              <strong>
                {previewEvaluation ? `${previewEvaluation.worstCaseDeliveredKits} kits` : "—"}
              </strong>
              <small>Higher is better</small>
            </article>
            <article>
              <span>Worst region</span>
              <strong>
                {previewEvaluation ? percent(previewEvaluation.regionalFairnessPpm) : "—"}
              </strong>
              <small>Higher is better</small>
            </article>
            <article>
              <span>Pareto result</span>
              <strong>
                {previewEvaluation
                  ? previewEvaluation.pareto.frontier
                    ? "NEW TRADE-OFF"
                    : "DOMINATED"
                  : "—"}
              </strong>
              <small>
                {previewEvaluation
                  ? `${percent(previewEvaluation.contribution.exclusiveContributionPpm)} exclusive area`
                  : "Compared with three public strategies"}
              </small>
            </article>
          </div>
          {previewEvaluation ? (
            <p className={previewEvaluation.regionalFairnessPpm === 0 ? "preview-warning" : ""}>
              {previewEvaluation.regionalFairnessPpm === 0
                ? "At least one community receives nothing in one disaster. Lower cost alone does not make this strategy fair."
                : previewEvaluation.pareto.frontier
                  ? "No published benchmark is at least as good on cost, resilience, and fairness at the same time."
                  : `This strategy is beaten on all three public values by ${previewEvaluation.pareto.dominatedBy.map(({ name }) => name).join(" · ")}.`}
            </p>
          ) : null}
          {previewEvaluation && previewComparison ? (
            <div className="live-change-explanation">
              <div>
                <span>WHAT YOU CHANGED</span>
                {previewChanges.length ? (
                  <ul>
                    {previewChanges.map((change) => (
                      <li key={change.key}>
                        <strong>{change.label}</strong>
                        <b>
                          {change.before} → {change.after}
                        </b>
                        <small>{change.effect}</small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Change a strategy lever to see its operational effect here.</p>
                )}
              </div>
              <dl>
                <div>
                  <dt>Cost change</dt>
                  <dd>{outcomeDelta(previewEvaluation, previewComparison, "cost")}</dd>
                  <small>Lower is better</small>
                </div>
                <div>
                  <dt>Delivery change</dt>
                  <dd>{outcomeDelta(previewEvaluation, previewComparison, "delivery")}</dd>
                  <small>Higher is better</small>
                </div>
                <div>
                  <dt>Fairness change</dt>
                  <dd>{outcomeDelta(previewEvaluation, previewComparison, "fairness")}</dd>
                  <small>Higher is better</small>
                </div>
              </dl>
            </div>
          ) : null}
        </section>

        <div className="strategy-submit-bar">
          <div>
            <strong>Test before you submit</strong>
            <span>
              Practice and final use the same deterministic evaluator. The instant demo reveals its
              committed final scenarios.
            </span>
          </div>
          <div>
            <button
              aria-busy={pending === "practice"}
              aria-label={
                pending === "practice"
                  ? "Running the practice simulation"
                  : "Run the practice simulation"
              }
              className="secondary-action notranslate"
              disabled={pending === "practice"}
              onClick={() => void runPractice()}
              translate="no"
            >
              Run simulation / シミュレーション実行
            </button>
            <button disabled={!participant || pending === "submit"} onClick={() => void submit()}>
              {pending === "submit" ? "Evaluating final…" : "Submit strategy"}
            </button>
          </div>
        </div>
      </section>

      <section className="decentralized-math" id="scoring">
        <header>
          <p className="eyebrow">04 · HOW DECENTRALIZED VALUE WORKS</p>
          <h2>The evaluator measures. Value owners decide what to support.</h2>
          <p>
            Every strategy produces the same public evidence. Independent Pools use that evidence
            without collapsing cost, resilience, and fairness into one organizer-controlled score.
          </p>
        </header>
        <div className="math-flow">
          <article>
            <span>01 · BUY</span>
            <h3>Split one public budget</h3>
            <code>initial = $72,000 − recovery budget</code>
            <p>
              Supplier order, capacity, unit price, reserve stock, and lead time decide purchases.
            </p>
          </article>
          <article>
            <span>02 · BREAK</span>
            <h3>Replay the same failures</h3>
            <code>arrival ≥ failure hour → stock lost</code>
            <p>Closed suppliers and routes are excluded before the recovery order is executed.</p>
          </article>
          <article>
            <span>03 · MEASURE</span>
            <h3>Keep three values separate</h3>
            <code>min cost · max delivery · max fairness</code>
            <p>The worst disaster and worst-served region determine resilience and fairness.</p>
          </article>
        </div>
        <div className="pareto-rule">
          <div>
            <span>PARETO RULE</span>
            <h3>Strategy A only defeats B when A is no worse everywhere.</h3>
          </div>
          <div className="pareto-conditions" aria-label="Pareto dominance conditions">
            <b>COST A ≤ B</b>
            <b>DELIVERY A ≥ B</b>
            <b>FAIRNESS A ≥ B</b>
          </div>
          <p>
            At least one condition must be strictly better. Otherwise both strategies can remain as
            valuable choices. Frontier contribution measures the normalized three-dimensional area
            that disappears when one strategy is removed.
          </p>
        </div>
      </section>

      {error ? (
        <p className="error-banner" role="alert">
          {error}
        </p>
      ) : null}

      <section className="disaster-replay" id="replay">
        <div className="section-title">
          <div>
            <p className="eyebrow">05 · WATCH THE CONSEQUENCES</p>
            <h2>See exactly what failed and how you responded.</h2>
          </div>
          {activeEvaluation ? (
            <span>
              Worst scenario:{" "}
              {
                activeEvaluation.scenarioOutcomes.find(
                  ({ scenarioId }) => scenarioId === activeEvaluation.worstScenarioId,
                )?.scenarioName
              }
            </span>
          ) : null}
        </div>
        {activeEvaluation && activeWorstExplanation ? (
          <section aria-labelledby="result-explanation-title" className="result-explanation">
            <header>
              <div>
                <span>MEASUREMENT RESULTS · WHY THESE NUMBERS</span>
                <h3 id="result-explanation-title">
                  Seven scenarios become three worst-case measurements.
                </h3>
              </div>
              {comparisonEvaluation ? (
                <small>Compared with your previous measured revision</small>
              ) : (
                <small>Your first measured result</small>
              )}
            </header>
            <div className="metric-origin-grid">
              {activeMetricOrigins.map((origin) => (
                <article key={origin.key}>
                  <span>{origin.label}</span>
                  <strong>
                    {origin.key === "cost"
                      ? money(origin.value)
                      : origin.key === "delivery"
                        ? `${origin.value.toLocaleString()} kits`
                        : percent(origin.value)}
                  </strong>
                  {comparisonEvaluation ? (
                    <b>{outcomeDelta(activeEvaluation, comparisonEvaluation, origin.key)}</b>
                  ) : null}
                  <small>Set by: {origin.scenarioName}</small>
                  <p>{origin.explanation}</p>
                </article>
              ))}
            </div>
            <div className="result-reason-grid">
              {comparisonEvaluation ? (
                <div>
                  <span>WHAT YOU CHANGED</span>
                  <strong>
                    {activeStrategyChanges.length
                      ? `${activeStrategyChanges.length} strategy lever${activeStrategyChanges.length === 1 ? "" : "s"} changed`
                      : "The measured strategy inputs are unchanged."}
                  </strong>
                  {activeStrategyChanges.length ? (
                    <ol>
                      {activeStrategyChanges.map((change) => (
                        <li key={change.key}>
                          <b>{change.label}:</b> {change.before} → {change.after}. {change.effect}
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </div>
              ) : null}
              <div>
                <span>WHY THE WORST SCENARIO HURT</span>
                <strong>{activeWorstExplanation.scenarioName}</strong>
                <ol>
                  {activeWorstExplanation.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ol>
              </div>
              <div>
                <span>THREE HONEST NEXT MOVES</span>
                <strong>Improve one value without hiding the trade-off.</strong>
                <ol>
                  {activeNextMoves.map((move) => (
                    <li key={move}>{move}</li>
                  ))}
                </ol>
              </div>
            </div>
          </section>
        ) : null}
        {!activeEvaluation ? (
          <div className="empty-state">
            <div>
              <strong>No simulation yet.</strong>
              <p>
                Build a strategy and run the public evaluator. No sign-in is required for practice.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="scenario-tabs" role="tablist" aria-label="Evaluated disaster scenarios">
              {activeEvaluation.scenarioOutcomes.map((outcome) => (
                <button
                  aria-selected={selectedOutcome?.scenarioId === outcome.scenarioId}
                  className={
                    selectedOutcome?.scenarioId === outcome.scenarioId
                      ? "active"
                      : "secondary-action"
                  }
                  key={outcome.scenarioId}
                  onClick={() => setSelectedScenarioId(outcome.scenarioId)}
                  role="tab"
                >
                  <span>{outcome.scenarioName}</span>
                  <small>{outcome.deliveredKits} delivered</small>
                </button>
              ))}
            </div>
            {selectedOutcome ? (
              <DisasterReplayStage
                evaluation={activeEvaluation}
                key={`${activeEvaluation.resultHash}-${selectedOutcome.scenarioId}`}
                onImprove={() =>
                  document.querySelector("#build")?.scrollIntoView({ behavior: "smooth" })
                }
                outcome={selectedOutcome}
                previousEvaluation={previousEvaluation}
              />
            ) : null}
            <details className="evaluation-evidence">
              <summary>Verify committed evaluation evidence</summary>
              <dl>
                <div>
                  <dt>Context hash</dt>
                  <dd>{activeEvaluation.contextHash}</dd>
                </div>
                <div>
                  <dt>Final scenario commitment</dt>
                  <dd>{activeEvaluation.finalScenarioCommitment}</dd>
                </div>
                <div>
                  <dt>Result hash</dt>
                  <dd>{activeEvaluation.resultHash}</dd>
                </div>
              </dl>
              <p>{scenario.disclosure}</p>
            </details>
          </>
        )}
      </section>

      <section className="competition-results" id="results">
        <div className="section-title">
          <div>
            <p className="eyebrow">06 · CHOOSE YOUR FINAL</p>
            <h2>Your strategy revisions</h2>
          </div>
          <span>
            {submissions.length} / {challenge?.maxRevisions ?? 20} used
          </span>
        </div>
        {submissions.length === 0 ? (
          <div className="empty-state">
            <div>
              <strong>No saved submissions yet.</strong>
              <p>Join the challenge, test a strategy, and submit it.</p>
            </div>
          </div>
        ) : (
          <div className="competition-revisions disaster-revisions">
            {[...submissions].reverse().map((submission) => {
              const entry = leaderboard?.entries.find(({ id }) => id === submission.submissionId);
              return (
                <article key={submission.submissionId}>
                  <header>
                    <div>
                      <span>REVISION {submission.revision}</span>
                      <strong>{submission.artifact.strategy.name}</strong>
                    </div>
                    <b className={submission.evaluation.correctness ? "status-good" : "status-bad"}>
                      {submission.evaluation.correctness ? "VALID" : "INVALID"}
                    </b>
                  </header>
                  <dl>
                    <div>
                      <dt>Cost</dt>
                      <dd>{money(submission.evaluation.totalProcurementCost)}</dd>
                    </div>
                    <div>
                      <dt>Worst delivery</dt>
                      <dd>{submission.evaluation.worstCaseDeliveredKits}</dd>
                    </div>
                    <div>
                      <dt>Worst region</dt>
                      <dd>{percent(submission.evaluation.regionalFairnessPpm)}</dd>
                    </div>
                  </dl>
                  {entry?.valueAllocations.length ? (
                    <p className="award-line">
                      {entry.valueAllocations.map(({ poolName }) => poolName).join(" · ")}
                    </p>
                  ) : null}
                  <code>{submission.evaluation.resultHash}</code>
                  <button
                    className={
                      finalEntry?.submissionId === submission.submissionId
                        ? "selected-final"
                        : "secondary-action"
                    }
                    disabled={
                      !submission.evaluation.correctness || pending === submission.submissionId
                    }
                    onClick={() => void chooseFinal(submission.submissionId)}
                  >
                    {finalEntry?.submissionId === submission.submissionId
                      ? "Selected Final Entry"
                      : "Choose as Final Entry"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="my-value-result" aria-live="polite">
        <div>
          <p className="eyebrow">YOUR VALUE RESULT</p>
          <h2>Your strategy does not need to be best at everything.</h2>
          <p>
            It receives support from every committed or practice Pool whose public rule it meets.
          </p>
        </div>
        {myBoardEntry ? (
          <div className="my-value-console">
            <span>YOUR STRATEGY CREATED VALUE FOR</span>
            <div>
              {leaderboard?.valuePools.map((pool) => {
                const allocation = myValueAllocations.find(({ poolId }) => poolId === pool.poolId);
                return (
                  <article className={allocation ? "supported" : "not-supported"} key={pool.poolId}>
                    <span>{allocation ? "SUPPORTED" : "NOT SELECTED"}</span>
                    <strong>{pool.name}</strong>
                    <b>{allocation ? `${allocation.credits.toLocaleString()} FDT` : "0 FDT"}</b>
                    <small>{allocation?.evidenceLabel ?? pool.ruleLabel}</small>
                  </article>
                );
              })}
            </div>
            <footer>
              <span>ALL VALUE CREDITS</span>
              <strong>{myBoardEntry.rewardPreview.toLocaleString()} FDT</strong>
              <small>
                {myBoardEntry.settlementEligibleCredits.toLocaleString()} committed ·{" "}
                {(
                  myBoardEntry.rewardPreview - myBoardEntry.settlementEligibleCredits
                ).toLocaleString()}{" "}
                practice
              </small>
            </footer>
            <section className="reward-explanation">
              <header>
                <span>WHY THIS STRATEGY RECEIVED SUPPORT</span>
                <strong>This is not an overall win.</strong>
                <p>
                  Each amount comes from one public Pool rule applied to the same three measurement
                  results.
                </p>
              </header>
              <div>
                {myValueAllocations.map((allocation) => {
                  const pool = leaderboard?.valuePools.find(
                    ({ poolId }) => poolId === allocation.poolId,
                  );
                  if (!pool) return null;
                  const frontierFormula =
                    allocation.poolId === "frontier" &&
                    myBoardEntry.contributionPpm > 0 &&
                    totalPositiveContributionPpm > 0;
                  return (
                    <article key={allocation.poolId}>
                      <span>
                        {allocation.poolStatus === "PRACTICE"
                          ? "PRACTICE SUPPORT"
                          : "COMMITTED SUPPORT"}
                      </span>
                      <strong>{allocation.poolName}</strong>
                      <p>
                        <b>Public rule:</b> {pool.ruleLabel}
                      </p>
                      <p>
                        <b>Your evidence:</b> {allocation.evidenceLabel}
                      </p>
                      <p>
                        <b>Compared with:</b>{" "}
                        {leaderboard?.entries.filter(({ correctness }) => correctness).length ?? 0}{" "}
                        valid reference and Final Entry strategies
                      </p>
                      {frontierFormula ? (
                        <>
                          <code>
                            {pool.poolCredits.toLocaleString()} ×{" "}
                            {myBoardEntry.contributionPpm.toLocaleString()} ÷{" "}
                            {totalPositiveContributionPpm.toLocaleString()} ={" "}
                            {allocation.credits.toLocaleString()} FDT
                          </code>
                          <small>
                            Pool budget × your positive exclusive contribution ÷ all positive
                            contributions. Deterministic remainder handling produces the final
                            integer amount.
                          </small>
                        </>
                      ) : (
                        <small>
                          This Pool applied its rule independently. It can support this strategy
                          even when another Pool selects a different one.
                        </small>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        ) : (
          <div className="empty-state">
            <div>
              <strong>Choose a Final Entry to see who supports it.</strong>
              <p>
                The three reference strategies below already demonstrate different value recipients.
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="disaster-awards value-allocations" id="allocations">
        <div className="section-title">
          <div>
            <p className="eyebrow">07 · VALUE ALLOCATIONS</p>
            <h2>Different values support different solutions.</h2>
          </div>
          <span>No overall winner</span>
        </div>
        <div className="value-allocation-grid">
          {leaderboard?.valuePools.map((pool) => (
            <article
              key={pool.poolId}
              className={
                pool.allocations.some(({ entryId }) => entryId === boardEntryId) ? "my-award" : ""
              }
            >
              <header>
                <span>{pool.funderLabel}</span>
                <b>{pool.poolCredits.toLocaleString()} FDT credits</b>
              </header>
              <h3>{pool.name}</h3>
              <p>{pool.valueStatement}</p>
              <div className="pool-allocation-list">
                {pool.allocations.length ? (
                  pool.allocations.map((allocation) => (
                    <div key={allocation.entryId}>
                      <span>
                        <strong>{allocation.entryName}</strong>
                        <small>{allocation.evidenceLabel}</small>
                      </span>
                      <b>{allocation.credits.toLocaleString()} FDT</b>
                    </div>
                  ))
                ) : (
                  <span>No qualifying strategy</span>
                )}
              </div>
              <footer>
                <span>
                  {pool.status === "PRACTICE" ? "PRACTICE ALLOCATION" : "COMMITTED ALLOCATION"}
                </span>
                <code>{shortHash(pool.manifestHash)}</code>
              </footer>
            </article>
          )) ?? <p>Loading allocations…</p>}
        </div>
      </section>

      <section className="competition-leaderboard">
        <div className="section-title">
          <div>
            <p className="eyebrow">08 · SOLUTION LANDSCAPE</p>
            <h2>Compare trade-offs without forcing a single rank.</h2>
          </div>
          <span>Benchmarks + selected Final Entries</span>
        </div>
        <div className="leaderboard-table disaster-leaderboard">
          <div className="leaderboard-row leaderboard-head">
            <span>Entry</span>
            <span>Cost</span>
            <span>Worst delivery</span>
            <span>Worst region</span>
            <span>Supported values</span>
          </div>
          {leaderboard?.entries.map((entry) => (
            <div
              className={`leaderboard-row ${entry.frontier ? "on-frontier" : "dominated"}`}
              key={entry.id}
            >
              <span>
                <strong>{entry.name}</strong>
                <small>
                  {entry.kind === "BENCHMARK" ? entry.approach : `Revision ${entry.revision}`}
                </small>
              </span>
              <span>{money(entry.totalProcurementCost)}</span>
              <span>{entry.worstCaseDeliveredKits} kits</span>
              <span>{percent(entry.regionalFairnessPpm)}</span>
              <span>
                <strong>
                  {entry.valueAllocations.length
                    ? entry.valueAllocations.map(({ poolName }) => poolName).join(" · ")
                    : "No Pool allocation"}
                </strong>
                <small>{entry.rewardPreview.toLocaleString()} FDT credits</small>
              </span>
            </div>
          )) ?? <p>Loading leaderboard…</p>}
        </div>
      </section>

      <section className="competition-settlement disaster-settlement">
        <div>
          <p className="eyebrow">09 · ETHEREUM SETTLEMENT</p>
          <h2>The organizer cannot rewrite who each value supported.</h2>
          <p>
            Pool manifests, selected strategy, measured result, committed allocation, and payment
            form one verifiable chain.
          </p>
          <ol className="evidence-chain" aria-label="Verifiable evidence chain">
            <li className={evidenceEvaluation ? "complete" : "pending"}>
              <span>01</span>
              <div>
                <strong>Rules and scenarios</strong>
                <code title={evidenceEvaluation?.contextHash}>
                  {shortHash(evidenceEvaluation?.contextHash)}
                </code>
              </div>
            </li>
            <li className={selectedSubmission ? "complete" : "pending"}>
              <span>02</span>
              <div>
                <strong>Selected Final Entry</strong>
                <code title={selectedSubmission?.inputHash}>
                  {shortHash(selectedSubmission?.inputHash)}
                </code>
              </div>
            </li>
            <li className={selectedSubmission ? "complete" : "pending"}>
              <span>03</span>
              <div>
                <strong>Measured result</strong>
                <code title={selectedSubmission?.evaluation.resultHash}>
                  {shortHash(selectedSubmission?.evaluation.resultHash)}
                </code>
              </div>
            </li>
            <li className={reward?.allocationEvidenceHash ? "complete" : "pending"}>
              <span>04</span>
              <div>
                <strong>Value Pool allocation evidence</strong>
                <code title={reward?.allocationEvidenceHash ?? undefined}>
                  {shortHash(reward?.allocationEvidenceHash)}
                </code>
              </div>
            </li>
            <li className={reward?.allocationRoot ? "complete" : "pending"}>
              <span>05</span>
              <div>
                <strong>Sepolia allocation and payment</strong>
                <code title={reward?.allocationRoot ?? undefined}>
                  {shortHash(reward?.allocationRoot)}
                </code>
              </div>
            </li>
          </ol>
        </div>
        <div className="reward-console">
          <span>YOUR COMMITTED VALUE TOTAL</span>
          <strong>{(myBoardEntry?.settlementEligibleCredits ?? 0).toLocaleString()} FDT</strong>
          <small>
            {myValueAllocations
              .filter(({ poolStatus }) => poolStatus === "COMMITTED")
              .map(({ poolName }) => poolName)
              .join(" · ") || "Select a supported Final Entry"}
          </small>
          {reward?.status === "PAID" && reward.transactionHash ? (
            <a
              href={`https://sepolia.etherscan.io/tx/${reward.transactionHash}`}
              rel="noreferrer"
              target="_blank"
            >
              RewardPaid confirmed →
            </a>
          ) : (
            <button
              disabled={
                !finalEntry || pending === "settle" || !myBoardEntry?.settlementEligibleCredits
              }
              onClick={() => void settle()}
            >
              {pending === "settle" ? "Confirming on Sepolia…" : "Send committed value reward"}
            </button>
          )}
          <small>
            {challenge?.settlement === "sepolia-ready"
              ? "Sepolia relayer ready"
              : "Sepolia payout configuration pending"}
          </small>
        </div>
      </section>

      <aside className="competition-trust-note disaster-trust-note">
        <strong>What is real now</strong>
        <p>
          Every displayed scenario is executed by the deterministic Strategy v2 evaluator. The
          instant demo reveals a precommitted final set immediately; it is not a scheduled
          production tournament. Community-created Pools allocate practice credits only; the
          settlement button uses committed built-in Pool allocations from the shared Sepolia demo
          reward path.
        </p>
        <Link href="/arenas/emergency-supply-classic">
          Open the preserved Classic allocation demo →
        </Link>
      </aside>
    </div>
  );
}
