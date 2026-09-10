"use client";

import Image from "next/image";
import Link from "next/link";
import type {
  evaluateRescuePracticeEpisode,
  finalizeRescueCommanderPracticeEvaluation,
  publicRescueRoomScenario,
  RescueProtocolActionType,
  RescuePracticePolicyId,
  ServiceId,
  TranscriptEvent,
} from "@frontier/rescue-room";
import { useEffect, useMemo, useRef, useState } from "react";

type RescueScenario = ReturnType<typeof publicRescueRoomScenario>;
type RescueEvaluation = ReturnType<typeof evaluateRescuePracticeEpisode> & {
  state: "simulated";
  paymentState: "game-credits";
};
type RescueAiEvaluation = ReturnType<typeof finalizeRescueCommanderPracticeEvaluation> & {
  state: "simulated";
  inferenceState: "openai-api";
  paymentState: "game-credits";
};
type RescueRunEvaluation = RescueEvaluation | RescueAiEvaluation;

const playbookPresets: Array<{
  name: string;
  description: string;
  instructions: string;
  serviceIds: ServiceId[];
  actions: RescueProtocolActionType[];
  maxPrice: number;
}> = [
  {
    name: "Evidence first",
    description: "Values confidence; accepts investigation cost.",
    instructions:
      "Treat every initial alert as uncertain. Buy fast monitoring evidence first, seek a second opinion when confidence is weak, and prefer targeted containment over a full protocol pause.",
    serviceIds: ["pulse-monitor", "trace-audit", "accounting-audit", "second-opinion"],
    actions: ["PAUSE_MODULE", "PAUSE_PROTOCOL", "WAIT", "CLOSE_INCIDENT"],
    maxPrice: 30,
  },
  {
    name: "Cautious",
    description: "Values user protection; accepts spend and downtime.",
    instructions:
      "Prioritize user asset protection. Pause the likely affected module early when credible evidence indicates active loss, then hire audit and patch specialists and verify before resuming service.",
    serviceIds: [
      "pulse-monitor",
      "trace-audit",
      "accounting-audit",
      "patch-builder",
      "patch-verifier",
    ],
    actions: [
      "PAUSE_MODULE",
      "PAUSE_PROTOCOL",
      "APPLY_PATCH",
      "RESUME_MODULE",
      "RESUME_PROTOCOL",
      "WAIT",
      "CLOSE_INCIDENT",
    ],
    maxPrice: 50,
  },
  {
    name: "Availability first",
    description: "Values uptime; accepts more unresolved risk.",
    instructions:
      "Preserve protocol availability unless a fast, credible signal identifies an affected module. Prefer waiting, low-cost monitoring, targeted pauses, and closing benign alerts without broad intervention.",
    serviceIds: ["pulse-monitor", "second-opinion"],
    actions: ["PAUSE_MODULE", "WAIT", "CLOSE_INCIDENT"],
    maxPrice: 12,
  },
];

function shortHash(value: string) {
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

function transcriptCopy(event: TranscriptEvent): { title: string; detail: string } {
  if (event.type === "OBSERVATION") {
    const observation = event.data.observation as { headline?: string; source?: string };
    return {
      title: observation.source === "SERVICE" ? "Evidence entered the inbox" : "Protocol alert",
      detail: observation.headline ?? "Observation recorded",
    };
  }
  if (event.type === "ACTION") {
    const action = event.data.action as {
      type?: string;
      serviceId?: string;
      module?: string;
      minutes?: number;
      receiptId?: string;
    };
    const target = action.serviceId ?? action.module ?? action.receiptId;
    return {
      title: "Commander action",
      detail: [action.type?.replaceAll("_", " "), target, action.minutes && `${action.minutes} min`]
        .filter(Boolean)
        .join(" · "),
    };
  }
  if (event.type === "PAYMENT_RESERVED") {
    return {
      title: "Service budget reserved",
      detail: `${event.data.credits} Rescue Credits · ${event.data.serviceId}`,
    };
  }
  if (event.type === "PAYMENT_RELEASED") {
    return {
      title: "Simulated payment released",
      detail: `${event.data.credits} Rescue Credits · ${event.data.serviceId}`,
    };
  }
  if (event.type === "PAYMENT_REFUNDED") {
    return {
      title: "Service budget refunded",
      detail: `${event.data.credits} Rescue Credits · ${event.data.serviceId}`,
    };
  }
  if (event.type === "SERVICE_RECEIPT") {
    const receipt = event.data.receipt as {
      summary?: string;
      receiptHash?: string;
      confidencePpm?: number;
    };
    const confidence =
      typeof receipt.confidencePpm === "number"
        ? ` · ${(receipt.confidencePpm / 10_000).toFixed(0)}% confidence`
        : "";
    return {
      title: "Service Agent delivered evidence",
      detail: `${receipt.summary ?? "Receipt delivered"}${confidence}${receipt.receiptHash ? ` · ${shortHash(receipt.receiptHash)}` : ""}`,
    };
  }
  if (event.type === "STATE_TRANSITION") {
    const paused = event.data.pausedModules as string[] | undefined;
    const served = Number(event.data.servedDemandDelta ?? 0);
    const demand = Number(event.data.totalDemandDelta ?? 0);
    return {
      title: "Protocol state advanced",
      detail: `${Number(event.data.userLossDeltaUsd ?? 0).toLocaleString()} USD loss · ${served.toLocaleString()}/${demand.toLocaleString()} demand served · ${paused?.length ? `${paused.length} module(s) paused` : "protocol serving"}`,
    };
  }
  if (event.type === "INVALID_ACTION") {
    return { title: "Invalid action", detail: String(event.data.reason ?? "Rejected") };
  }
  return {
    title: "Episode closed",
    detail: event.data.incidentResolved ? "Incident resolved" : "Unresolved at the horizon",
  };
}

function liveState(events: readonly TranscriptEvent[], initialBudget: number) {
  let available = initialBudget;
  let reserved = 0;
  let spent = 0;
  let pausedModules: string[] = [];
  let receiptCount = 0;
  let resolved = false;
  const suspectedModules = new Set<string>();
  const activeOrders = new Map<string, { serviceId: string; dueAtMinute: number }>();
  for (const event of events) {
    const credits = Number(event.data.credits ?? 0);
    if (event.type === "PAYMENT_RESERVED") {
      available -= credits;
      reserved += credits;
      activeOrders.set(String(event.data.orderId), {
        serviceId: String(event.data.serviceId),
        dueAtMinute: Number(event.data.dueAtMinute),
      });
    }
    if (event.type === "PAYMENT_RELEASED") {
      reserved -= credits;
      spent += credits;
      activeOrders.delete(String(event.data.orderId));
    }
    if (event.type === "PAYMENT_REFUNDED") {
      reserved -= credits;
      available += credits;
      activeOrders.delete(String(event.data.orderId));
    }
    if (event.type === "SERVICE_RECEIPT") {
      receiptCount += 1;
      const receipt = event.data.receipt as { likelyAffectedModule?: string | null };
      if (receipt.likelyAffectedModule) suspectedModules.add(receipt.likelyAffectedModule);
    }
    if (event.type === "STATE_TRANSITION") {
      pausedModules = (event.data.pausedModules as string[] | undefined) ?? pausedModules;
      resolved = Boolean(event.data.incidentResolved);
    }
  }
  return {
    available,
    reserved,
    spent,
    pausedModules,
    receiptCount,
    resolved,
    suspectedModules: [...suspectedModules],
    activeOrders: [...activeOrders.values()],
  };
}

function resultInsights(evaluation: RescueRunEvaluation) {
  const { outcome } = evaluation;
  const truth = evaluation.episode.revealedAfterRun.incidentFamily;
  const receipts = outcome.transcript
    .filter(({ type }) => type === "SERVICE_RECEIPT")
    .map(({ data }) => data.receipt as { classification?: string });
  const correctReceipts = receipts.filter(({ classification }) => classification === truth).length;
  const misleadingReceipts = receipts.filter(
    ({ classification }) =>
      classification && classification !== "inconclusive" && classification !== truth,
  ).length;
  const availabilityLoss = 100 - outcome.servedProtocolDemandPpm / 10_000;

  return [
    {
      label: "What went right",
      title:
        outcome.userLossUsd === 0
          ? "No user loss during the episode"
          : "The incident kept causing loss",
      detail:
        outcome.userLossUsd === 0
          ? truth === "false-positive"
            ? "The final reveal shows that the alert was benign; no simulated user assets were at risk."
            : "The response contained the risk before simulated assets were lost."
          : `$${outcome.userLossUsd.toLocaleString()} accrued while the affected path remained exposed.`,
    },
    {
      label: misleadingReceipts > 0 ? "What was wasteful" : "Evidence outcome",
      title:
        misleadingReceipts > 0
          ? `${misleadingReceipts} paid finding${misleadingReceipts === 1 ? " was" : "s were"} misleading`
          : correctReceipts > 0
            ? `${correctReceipts} finding${correctReceipts === 1 ? " matched" : "s matched"} the revealed incident`
            : "The Commander closed without a confirmed diagnosis",
      detail:
        receipts.length === 0
          ? "No Service Agent was hired, so the budget was preserved but uncertainty remained."
          : "Service receipts are fallible; confidence is evidence, not ground truth.",
    },
    {
      label: "Value tradeoff",
      title: `${availabilityLoss.toFixed(1)}% of protocol demand went unserved`,
      detail: `${outcome.netResponseSpendCredits} Rescue Credits were paid. These remain separate outcomes, not penalties folded into one score.`,
    },
  ];
}

function serviceSpendBreakdown(evaluation: RescueRunEvaluation) {
  const spend = new Map<string, number>();
  for (const event of evaluation.outcome.transcript) {
    if (event.type !== "PAYMENT_RELEASED") continue;
    const serviceId = String(event.data.serviceId);
    spend.set(serviceId, (spend.get(serviceId) ?? 0) + Number(event.data.credits ?? 0));
  }
  return [...spend.entries()];
}

export function RescueRoomWorkbench({ scenario }: { scenario: RescueScenario }) {
  const [commanderMode, setCommanderMode] = useState<"reference" | "ai">("reference");
  const [policyId, setPolicyId] = useState<RescuePracticePolicyId>("simple-adaptive");
  const [episodeId, setEpisodeId] = useState(scenario.episodes[0]!.id);
  const [evaluation, setEvaluation] = useState<RescueRunEvaluation | null>(null);
  const [playbookName, setPlaybookName] = useState(scenario.commanderRuntime.starterPlaybook.name);
  const [playbookInstructions, setPlaybookInstructions] = useState(
    scenario.commanderRuntime.starterPlaybook.instructions,
  );
  const [allowedServiceIds, setAllowedServiceIds] = useState<ServiceId[]>([
    ...scenario.commanderRuntime.starterPlaybook.allowedServiceIds,
  ]);
  const [allowedProtocolActions, setAllowedProtocolActions] = useState<RescueProtocolActionType[]>([
    ...scenario.commanderRuntime.starterPlaybook.allowedProtocolActions,
  ]);
  const [maxServicePriceCredits, setMaxServicePriceCredits] = useState(
    scenario.commanderRuntime.starterPlaybook.maxServicePriceCredits,
  );
  const [visibleEvents, setVisibleEvents] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2>(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const consoleRef = useRef<HTMLElement>(null);
  const timelineEndRef = useRef<HTMLLIElement>(null);
  const transcript = evaluation?.outcome.transcript ?? [];
  const shownTranscript = transcript.slice(0, visibleEvents);
  const playbackActive = isPlaying && visibleEvents < transcript.length;
  const current = liveState(shownTranscript, scenario.initialBudgetCredits);
  const selectedEpisode = scenario.episodes.find(({ id }) => id === episodeId)!;
  const selectedAggregate = scenario.policyResults.find(({ policyId: id }) => id === policyId)!;
  const referenceEvaluation =
    evaluation?.schemaVersion === "rescue-practice-evaluation-v0" ? evaluation : null;
  const aiEvaluation =
    evaluation?.schemaVersion === "rescue-ai-practice-evaluation-v0" ? evaluation : null;
  const serviceAware = scenario.policyResults.find(({ policyId: id }) => id === "simple-adaptive")!;
  const noServiceControl = scenario.policyResults.find(({ policyId: id }) => id === "never-pause")!;
  const policyNames = useMemo(
    () => new Map(scenario.policies.map(({ id, name }) => [id, name])),
    [scenario.policies],
  );
  const insights = evaluation ? resultInsights(evaluation) : [];
  const spendBreakdown = evaluation ? serviceSpendBreakdown(evaluation) : [];

  useEffect(() => {
    if (!evaluation || !playbackActive) return;
    const timer = window.setTimeout(
      () => setVisibleEvents((count) => count + 1),
      playbackSpeed === 2 ? 110 : 260,
    );
    return () => window.clearTimeout(timer);
  }, [evaluation, playbackActive, playbackSpeed, visibleEvents]);

  useEffect(() => {
    if (visibleEvents === 0) return;
    timelineEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [visibleEvents]);

  async function runCommander() {
    setPending(true);
    setError(null);
    setEvaluation(null);
    setVisibleEvents(0);
    setIsPlaying(false);
    try {
      const aiPlaybook = {
        schemaVersion: "rescue-commander-playbook-v0" as const,
        name: playbookName,
        instructions: playbookInstructions,
        allowedServiceIds,
        allowedProtocolActions,
        maxServicePriceCredits,
      };
      const response = await fetch(
        commanderMode === "ai"
          ? "/v1/rescue-room/commander-evaluations"
          : "/v1/rescue-room/evaluations",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            commanderMode === "ai" ? { episodeId, playbook: aiPlaybook } : { policyId, episodeId },
          ),
        },
      );
      const payload = (await response.json()) as RescueRunEvaluation & {
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(payload.error?.message ?? "Practice run failed");
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setEvaluation(payload);
      setVisibleEvents(reduceMotion ? payload.outcome.transcript.length : 0);
      setIsPlaying(!reduceMotion);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Practice run failed");
    } finally {
      setPending(false);
    }
  }

  function watchSample() {
    consoleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    void runCommander();
  }

  function applyPlaybookPreset(preset: (typeof playbookPresets)[number]) {
    setPlaybookName(preset.name);
    setPlaybookInstructions(preset.instructions);
    setAllowedServiceIds([...preset.serviceIds]);
    setAllowedProtocolActions([...preset.actions]);
    setMaxServicePriceCredits(preset.maxPrice);
    setEvaluation(null);
  }

  function toggleService(serviceId: ServiceId) {
    setAllowedServiceIds((currentIds) =>
      currentIds.includes(serviceId)
        ? currentIds.filter((id) => id !== serviceId)
        : [...currentIds, serviceId],
    );
    setEvaluation(null);
  }

  function toggleProtocolAction(action: RescueProtocolActionType) {
    setAllowedProtocolActions((currentActions) => {
      if (currentActions.includes(action) && currentActions.length === 1) return currentActions;
      return currentActions.includes(action)
        ? currentActions.filter((candidate) => candidate !== action)
        : [...currentActions, action];
    });
    setEvaluation(null);
  }

  function downloadEvidence() {
    if (!evaluation) return;
    const payload = JSON.stringify(
      {
        context: {
          contextId: scenario.contextId,
          contextHash: scenario.contextHash,
          manifestHash: scenario.manifestHash,
        },
        evaluation,
      },
      null,
      2,
    );
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `rescue-room-${evaluation.episode.id}-${
      aiEvaluation ? aiEvaluation.playbookHash.slice(2, 10) : policyId
    }.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rescue-workbench">
      <header className="rescue-storyboard-hero">
        <Image
          alt="A fictional Ethereum protocol under incident response, with a command center connected to monitoring, audit, and patch services"
          className="rescue-storyboard-image"
          height={856}
          preload
          sizes="(max-width: 900px) 100vw, 1280px"
          src="/images/rescue-room-incident-storyboard.png"
          width={1904}
        />
        <div className="rescue-storyboard-copy">
          <div className="arena-breadcrumb">
            <Link href="/arenas">Arenas</Link>
            <span aria-hidden="true">/</span>
            <span>Incident response</span>
          </div>
          <p className="eyebrow">Rescue Room · Controlled Practice</p>
          <h1>An incident is already moving.</h1>
          <p>
            Your AI Commander has {scenario.initialBudgetCredits} Rescue Credits and 60 simulated
            minutes. It must decide what to investigate, who to hire, and when to intervene—without
            seeing the true incident.
          </p>
          <div className="rescue-storyboard-actions">
            <button disabled={pending} onClick={watchSample} type="button">
              {pending ? "Preparing the Incident Room…" : "Watch the first 60 minutes"}
            </button>
            <button
              className="secondary-action"
              onClick={() => {
                setCommanderMode("ai");
                consoleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              type="button"
            >
              Configure my AI Commander
            </button>
          </div>
        </div>
        <ol className="rescue-storyboard-loop" aria-label="What happens in Rescue Room">
          <li>
            <span>01</span>
            <strong>Alert</strong>
            <small>Ambiguous protocol signals</small>
          </li>
          <li>
            <span>02</span>
            <strong>Hire</strong>
            <small>Buy specialist services</small>
          </li>
          <li>
            <span>03</span>
            <strong>Evidence</strong>
            <small>Fallible, priced findings</small>
          </li>
          <li>
            <span>04</span>
            <strong>Decide</strong>
            <small>Pause, patch, wait, or close</small>
          </li>
        </ol>
        <dl className="rescue-storyboard-contract">
          <div>
            <dt>Budget</dt>
            <dd>{scenario.initialBudgetCredits} Rescue Credits</dd>
          </div>
          <div>
            <dt>Clock</dt>
            <dd>{scenario.horizonMinutes} simulated minutes</dd>
          </div>
          <div>
            <dt>Payments</dt>
            <dd>Game credits</dd>
          </div>
          <div>
            <dt>Independent values</dt>
            <dd>Protection · Availability · Treasury</dd>
          </div>
        </dl>
      </header>

      <section className="rescue-console" ref={consoleRef}>
        <div className="rescue-control-panel">
          <p className="eyebrow">Practice control</p>
          <h2>Choose the alert and Commander policy.</h2>
          <label>
            Initial protocol alert
            <select
              value={episodeId}
              onChange={(event) => {
                setEpisodeId(event.target.value);
                setEvaluation(null);
              }}
            >
              {scenario.episodes.map((episode, index) => (
                <option key={episode.id} value={episode.id}>
                  Alert {String(index + 1).padStart(2, "0")} · {episode.headline}
                </option>
              ))}
            </select>
          </label>
          <div className="rescue-alert-card">
            <span>INCOMING · T+00</span>
            <strong>{selectedEpisode.headline}</strong>
            <ul>
              {selectedEpisode.facts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
            <small>True incident, severity, and valid patch are hidden until this run ends.</small>
          </div>
          <div className="rescue-mode-switch" aria-label="Commander type">
            <button
              aria-pressed={commanderMode === "reference"}
              onClick={() => {
                setCommanderMode("reference");
                setEvaluation(null);
              }}
              type="button"
            >
              Reference policy
            </button>
            <button
              aria-pressed={commanderMode === "ai"}
              onClick={() => {
                setCommanderMode("ai");
                setEvaluation(null);
              }}
              type="button"
            >
              AI Playbook
            </button>
          </div>
          {commanderMode === "reference" ? (
            <>
              <label>
                Reference Commander
                <select
                  value={policyId}
                  onChange={(event) => {
                    setPolicyId(event.target.value as RescuePracticePolicyId);
                    setEvaluation(null);
                  }}
                >
                  {scenario.policies.map((policy) => (
                    <option key={policy.id} value={policy.id}>
                      {policy.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rescue-policy-preview">
                <span>Reference baseline · 35 public episodes</span>
                <strong>{policyNames.get(policyId)}</strong>
                <small>
                  {selectedAggregate.totalUserLossUsd.toLocaleString()} USD loss ·{" "}
                  {(selectedAggregate.servedProtocolDemandPpm / 10_000).toFixed(1)}% served ·{" "}
                  {selectedAggregate.netResponseSpendCredits.toLocaleString()} RC spent
                </small>
              </div>
            </>
          ) : (
            <div className="rescue-playbook-editor">
              <div className="rescue-playbook-presets">
                <span>Start from a judgment</span>
                {playbookPresets.map((preset) => (
                  <button
                    aria-pressed={playbookName === preset.name}
                    key={preset.name}
                    onClick={() => applyPlaybookPreset(preset)}
                    type="button"
                  >
                    <strong>{preset.name}</strong>
                    <small>{preset.description}</small>
                  </button>
                ))}
              </div>
              <div className="rescue-runtime-chip">
                <span>Fixed runtime</span>
                <strong>{scenario.commanderRuntime.model}</strong>
                <small>
                  {scenario.commanderRuntime.maximumModelTurns} model turns · replay from Actions
                </small>
              </div>
              <details className="rescue-playbook-advanced">
                <summary>Advanced Playbook controls</summary>
                <label>
                  Playbook name
                  <input
                    maxLength={80}
                    minLength={3}
                    onChange={(event) => {
                      setPlaybookName(event.target.value);
                      setEvaluation(null);
                    }}
                    type="text"
                    value={playbookName}
                  />
                </label>
                <label>
                  Commander instructions
                  <textarea
                    maxLength={4_000}
                    minLength={40}
                    onChange={(event) => {
                      setPlaybookInstructions(event.target.value);
                      setEvaluation(null);
                    }}
                    rows={6}
                    value={playbookInstructions}
                  />
                </label>
                <fieldset>
                  <legend>Service Agents this Playbook may hire</legend>
                  <div className="rescue-playbook-options">
                    {scenario.services.map((service) => (
                      <label key={service.id}>
                        <input
                          checked={allowedServiceIds.includes(service.id)}
                          onChange={() => toggleService(service.id)}
                          type="checkbox"
                        />
                        <span>{service.name}</span>
                        <small>{service.priceCredits} RC</small>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label>
                  Maximum price for one Service Agent · {maxServicePriceCredits} RC
                  <input
                    max={scenario.initialBudgetCredits}
                    min={0}
                    onChange={(event) => {
                      setMaxServicePriceCredits(Number(event.target.value));
                      setEvaluation(null);
                    }}
                    type="range"
                    value={maxServicePriceCredits}
                  />
                </label>
                <fieldset>
                  <legend>Authorized protocol actions</legend>
                  <div className="rescue-playbook-options compact">
                    {scenario.commanderRuntime.starterPlaybook.allowedProtocolActions.map(
                      (action) => (
                        <label key={action}>
                          <input
                            checked={allowedProtocolActions.includes(action)}
                            onChange={() => toggleProtocolAction(action)}
                            type="checkbox"
                          />
                          <span>{action.replaceAll("_", " ")}</span>
                        </label>
                      ),
                    )}
                  </div>
                </fieldset>
              </details>
              <a className="secondary-action" download href="/v1/rescue-room/starter-kit">
                Download Playbook Starter Kit
              </a>
              <small>
                The API key remains server-side. Playbook prose, token use, and attempt count are
                not reward metrics.
              </small>
            </div>
          )}
          <button disabled={pending} onClick={runCommander} type="button">
            {pending
              ? commanderMode === "ai"
                ? "AI Commander is deciding…"
                : "Running deterministic Episode…"
              : commanderMode === "ai"
                ? "Run AI Commander"
                : "Run Reference Commander"}
          </button>
          {error ? <p className="error-banner">{error}</p> : null}
        </div>

        <div className="rescue-live-room">
          <div className="rescue-room-heading">
            <div>
              <p className="eyebrow">Incident Room</p>
              <h2>
                {referenceEvaluation?.policy.name ??
                  aiEvaluation?.playbook.name ??
                  "Awaiting Commander"}
              </h2>
            </div>
            <span>{evaluation ? `T+${shownTranscript.at(-1)?.gameMinute ?? 0}` : "STANDBY"}</span>
          </div>
          <div className="rescue-protocol-stage">
            <Image
              alt=""
              fill
              loading="eager"
              sizes="(max-width: 900px) 100vw, 760px"
              src="/images/rescue-room-incident-storyboard.png"
            />
            <div className="rescue-protocol-overlay">
              <span data-state={current.pausedModules.length ? "restricted" : "serving"}>
                {current.pausedModules.length ? "PROTOCOL RESTRICTED" : "PROTOCOL SERVING"}
              </span>
              {current.activeOrders.map((order) => (
                <span className="service-job" key={`${order.serviceId}-${order.dueAtMinute}`}>
                  {order.serviceId} working · due T+{order.dueAtMinute}
                </span>
              ))}
            </div>
          </div>
          <div className="rescue-state-grid">
            <article>
              <span>Available</span>
              <strong>{current.available} RC</strong>
              <small>
                {current.reserved} reserved · {current.spent} paid
              </small>
            </article>
            <article>
              <span>Protocol</span>
              <strong>{current.pausedModules.length ? "Restricted" : "Serving"}</strong>
              <small>
                {current.pausedModules.length
                  ? current.pausedModules.join(", ")
                  : "No modules paused"}
              </small>
            </article>
            <article>
              <span>Evidence inbox</span>
              <strong>{current.receiptCount}</strong>
              <small>
                {current.resolved ? "Response closed as resolved" : "True cause remains hidden"}
              </small>
            </article>
          </div>
          <div className="rescue-module-grid" aria-label="Protocol module states">
            {scenario.modules.map((module) => {
              const moduleState = current.pausedModules.includes(module)
                ? "restricted"
                : current.suspectedModules.includes(module)
                  ? "risk signal"
                  : "serving";
              return (
                <span data-state={moduleState} key={module}>
                  <strong>{module}</strong>
                  <small>{moduleState}</small>
                </span>
              );
            })}
          </div>
          {evaluation ? (
            <>
              <div className="rescue-playback-controls" aria-label="Timeline playback controls">
                <button
                  onClick={() => {
                    if (visibleEvents >= transcript.length) setVisibleEvents(0);
                    setIsPlaying(!playbackActive);
                  }}
                  type="button"
                >
                  {playbackActive
                    ? "Pause"
                    : visibleEvents >= transcript.length
                      ? "Replay"
                      : "Play"}
                </button>
                <button
                  disabled={visibleEvents >= transcript.length}
                  onClick={() => {
                    setIsPlaying(false);
                    setVisibleEvents((count) => Math.min(transcript.length, count + 1));
                  }}
                  type="button"
                >
                  Step
                </button>
                <button
                  aria-label={`Playback speed ${playbackSpeed} times`}
                  onClick={() => setPlaybackSpeed((speed) => (speed === 1 ? 2 : 1))}
                  type="button"
                >
                  {playbackSpeed}× speed
                </button>
                <button
                  onClick={() => {
                    setVisibleEvents(transcript.length);
                    setIsPlaying(false);
                  }}
                  type="button"
                >
                  Skip to outcome
                </button>
              </div>
              <p className="sr-only" aria-live="polite" role="status">
                {shownTranscript.length
                  ? transcriptCopy(shownTranscript.at(-1)!).title
                  : "Incident simulation ready"}
              </p>
              <ol className="rescue-timeline">
                {shownTranscript.map((event) => {
                  const copy = transcriptCopy(event);
                  return (
                    <li key={event.sequence} data-event={event.type}>
                      <span>T+{String(event.gameMinute).padStart(2, "0")}</span>
                      <div>
                        <strong>{copy.title}</strong>
                        <small>{copy.detail}</small>
                      </div>
                    </li>
                  );
                })}
                <li aria-hidden="true" className="rescue-timeline-end" ref={timelineEndRef} />
              </ol>
              {visibleEvents >= transcript.length ? (
                <button
                  className="secondary-action"
                  onClick={() => {
                    setVisibleEvents(0);
                    setIsPlaying(true);
                  }}
                  type="button"
                >
                  Replay evidence timeline
                </button>
              ) : null}
            </>
          ) : (
            <div className="rescue-empty-room">
              <span>01</span>
              <p>
                The Commander sees only the alert above. Run it to watch actions, orders, payments,
                evidence, and state changes in sequence.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="rescue-market" aria-labelledby="service-market-title">
        <div className="builder-heading">
          <div>
            <p className="eyebrow">Service Agents behind the run</p>
            <h2 id="service-market-title">Speed, price, and confidence are all different.</h2>
          </div>
          <span className="rescue-simulated-label">Simulated payments · not tokens</span>
        </div>
        <p className="rescue-market-intro">
          An expensive specialist can still be wrong. A fast monitor can be cheap and inconclusive.
          The Commander must decide whether another opinion is worth its time and budget.
        </p>
        <div className="rescue-service-grid">
          {scenario.services.map((service) => (
            <article key={service.id}>
              <div>
                <strong>{service.name}</strong>
                <span>{service.task.replaceAll("_", " ")}</span>
              </div>
              <p>{service.description}</p>
              <dl>
                <div>
                  <dt>Price</dt>
                  <dd>{service.priceCredits} RC</dd>
                </div>
                <div>
                  <dt>Delivery</dt>
                  <dd>{service.deliveryMinutes} min</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="rescue-ablation" aria-labelledby="rescue-ablation-title">
        <div>
          <p className="eyebrow">Service market ablation</p>
          <h2 id="rescue-ablation-title">
            Buying information changes the tradeoff—not every axis for free.
          </h2>
          <p>
            These two Reference Commanders face the same 35 Episodes. The no-service control keeps
            all credits and availability, but accepts more user loss. The service-aware Commander
            buys evidence and reduces loss while sometimes pausing the protocol.
          </p>
        </div>
        {[noServiceControl, serviceAware].map((entry) => (
          <article key={entry.policyId}>
            <span>{entry.policyId === "never-pause" ? "No services" : "Service-aware"}</span>
            <h3>{entry.policyName}</h3>
            <dl>
              <div>
                <dt>User loss</dt>
                <dd>${entry.totalUserLossUsd.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Demand served</dt>
                <dd>{(entry.servedProtocolDemandPpm / 10_000).toFixed(1)}%</dd>
              </div>
              <div>
                <dt>Response spend</dt>
                <dd>{entry.netResponseSpendCredits.toLocaleString()} RC</dd>
              </div>
            </dl>
          </article>
        ))}
      </section>

      {evaluation && visibleEvents >= transcript.length ? (
        <section className="rescue-result" aria-live="polite">
          <div className="supply-result-heading">
            <div>
              <p className="eyebrow">Independent outcome vector</p>
              <h2>No weighted score. No overall winner.</h2>
            </div>
            <span
              className={
                aiEvaluation || referenceEvaluation?.aggregate.pareto.frontier
                  ? "status-good"
                  : "status-bad"
              }
            >
              {aiEvaluation
                ? "Action replay verified"
                : referenceEvaluation?.aggregate.pareto.frontier
                  ? "Practice frontier"
                  : "Dominated in pack"}
            </span>
          </div>
          <div className="supply-metrics">
            <article>
              <span>User loss · this Episode</span>
              <strong>${evaluation.outcome.userLossUsd.toLocaleString()}</strong>
              <small>
                {referenceEvaluation
                  ? `Minimize · pack total $${referenceEvaluation.aggregate.totalUserLossUsd.toLocaleString()}`
                  : "Minimize · AI run is not yet ranked across the full pack"}
              </small>
            </article>
            <article>
              <span>Protocol demand served</span>
              <strong>{(evaluation.outcome.servedProtocolDemandPpm / 10_000).toFixed(1)}%</strong>
              <small>
                {referenceEvaluation
                  ? `Maximize · pack ${(referenceEvaluation.aggregate.servedProtocolDemandPpm / 10_000).toFixed(1)}%`
                  : "Maximize · one Episode of Controlled Practice"}
              </small>
            </article>
            <article>
              <span>Response spend · this Episode</span>
              <strong>{evaluation.outcome.netResponseSpendCredits} RC</strong>
              <small>
                {referenceEvaluation
                  ? `Minimize · pack ${referenceEvaluation.aggregate.netResponseSpendCredits.toLocaleString()} RC`
                  : "Minimize · model usage is not part of this axis"}
              </small>
            </article>
          </div>
          <div className="rescue-result-explainer">
            <div>
              <p className="eyebrow">Why these numbers happened</p>
              <h3>The same replay supports three different judgments.</h3>
            </div>
            <div className="rescue-insight-grid">
              {insights.map((insight) => (
                <article key={insight.label}>
                  <span>{insight.label}</span>
                  <strong>{insight.title}</strong>
                  <p>{insight.detail}</p>
                </article>
              ))}
            </div>
            <div className="rescue-spend-breakdown">
              <strong>Response spend by Service Agent</strong>
              {spendBreakdown.length ? (
                <dl>
                  {spendBreakdown.map(([serviceId, credits]) => (
                    <div key={serviceId}>
                      <dt>{serviceId}</dt>
                      <dd>{credits} RC paid</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p>No Service Agent payments in this episode.</p>
              )}
            </div>
          </div>
          <div className="rescue-pool-impact">
            <div>
              <p className="eyebrow">Same evidence · different values</p>
              <h3>This Episode does not produce one overall score.</h3>
              <small>Pool allocation is calculated only across the complete 35-Episode pack.</small>
            </div>
            <ul>
              <li>
                <strong>User Protection</strong>
                <span>reads ${evaluation.outcome.userLossUsd.toLocaleString()} loss</span>
              </li>
              <li>
                <strong>Availability</strong>
                <span>
                  reads {(evaluation.outcome.servedProtocolDemandPpm / 10_000).toFixed(1)}% served
                </span>
              </li>
              <li>
                <strong>Treasury Stewardship</strong>
                <span>reads {evaluation.outcome.netResponseSpendCredits} RC spent</span>
              </li>
              <li>
                <strong>Frontier Expansion</strong>
                <span>needs the full comparable field</span>
              </li>
            </ul>
          </div>
          {aiEvaluation ? (
            <div className="rescue-ai-proof">
              <div>
                <span>AI runtime</span>
                <strong>{aiEvaluation.runtime.configuredModel}</strong>
                <small>
                  {aiEvaluation.runtime.usage.requests} requests ·{" "}
                  {aiEvaluation.runtime.usage.totalTokens.toLocaleString()} tokens
                </small>
              </div>
              <div>
                <span>Decision evidence</span>
                <strong>{aiEvaluation.decisions.length} Actions</strong>
                <small>Views and Actions are hash-bound; chain-of-thought is not recorded.</small>
              </div>
              <div>
                <span>Reward state</span>
                <strong>Not eligible</strong>
                <small>Controlled Practice only · hidden Final is not implemented.</small>
              </div>
            </div>
          ) : null}
          <div className="rescue-reveal">
            <div>
              <p className="eyebrow">Hidden state revealed after evaluation</p>
              <h3>{evaluation.episode.revealedAfterRun.incidentName}</h3>
            </div>
            <dl>
              <div>
                <dt>Severity</dt>
                <dd>{evaluation.episode.revealedAfterRun.severity} / 3</dd>
              </div>
              <div>
                <dt>Affected module</dt>
                <dd>{evaluation.episode.revealedAfterRun.affectedModule}</dd>
              </div>
              <div>
                <dt>Valid patch</dt>
                <dd>{evaluation.episode.revealedAfterRun.validPatchId}</dd>
              </div>
            </dl>
          </div>
          <div className="rescue-next-moves">
            <p className="eyebrow">Try a different judgment</p>
            <div>
              <button
                className="secondary-action"
                onClick={() => {
                  setCommanderMode("reference");
                  setPolicyId("never-pause");
                  setEvaluation(null);
                  consoleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                type="button"
              >
                Preserve availability
              </button>
              <button
                className="secondary-action"
                onClick={() => {
                  setCommanderMode("reference");
                  setPolicyId("always-pause");
                  setEvaluation(null);
                  consoleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                type="button"
              >
                Protect users first
              </button>
              <button
                className="secondary-action"
                onClick={() => {
                  setCommanderMode("ai");
                  setEvaluation(null);
                  consoleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                type="button"
              >
                Rewrite the AI Playbook
              </button>
            </div>
          </div>
          <div className="rescue-result-actions">
            <button onClick={downloadEvidence} type="button">
              Download Context + Result Evidence
            </button>
            <code>{shortHash(evaluation.evaluationHash)}</code>
          </div>
        </section>
      ) : null}

      <section className="rescue-value-pools">
        <div className="builder-heading">
          <div>
            <p className="eyebrow">Value Decentralization</p>
            <h2>Four pools read the same evidence differently.</h2>
          </div>
          <span className="rescue-simulated-label">10,000 practice credits · no token value</span>
        </div>
        <div className="rescue-pool-grid">
          {scenario.valuePools.map((pool) => (
            <article key={pool.poolId}>
              <span>{pool.budgetCredits.toLocaleString()} credits</span>
              <h3>{pool.name}</h3>
              <p>{pool.valueStatement}</p>
              <small>{pool.rule}</small>
              <div>
                {pool.allocations.map((allocation) => (
                  <span key={allocation.policyId}>
                    {policyNames.get(allocation.policyId)} · {allocation.credits.toLocaleString()}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="rescue-evidence-boundary">
        <strong>Evidence boundary</strong>
        <p>
          The protocol world, Service Agent evidence, and payments on this page are deterministic
          off-chain simulations. The optional AI Commander uses a fixed server-side OpenAI runtime;
          its recorded Actions, not hidden reasoning, are replayable. Rescue Credits are game
          accounting units—not ERC-20 tokens. No wallet delegation, escrow contract, hidden Final,
          or reward settlement is claimed in this Controlled Practice Arena.
        </p>
        <code>
          Context {shortHash(scenario.contextHash)} · Manifest {shortHash(scenario.manifestHash)}
        </code>
      </footer>
    </div>
  );
}
