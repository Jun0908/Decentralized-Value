"use client";

import Image from "next/image";
import Link from "next/link";
import type {
  evaluateRescueDoctrinePracticeEpisode,
  evaluateRescuePracticeEpisode,
  finalizeRescueCommanderPracticeEvaluation,
  publicRescueRoomScenario,
  RescueDoctrine,
  RescueDoctrinePresetId,
  RescueProtocolActionType,
  ServiceId,
  TranscriptEvent,
} from "@frontier/rescue-room";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  RescueIncidentTheatre,
  type RescueIncidentChapter,
} from "@/components/rescue-incident-theatre";
import { RescuePaymentJourney } from "@/components/rescue-payment-journey";

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
type RescueDoctrineEvaluation = ReturnType<typeof evaluateRescueDoctrinePracticeEpisode> & {
  state: "simulated";
  strategyState: "deterministic-rules";
  paymentState: "game-credits";
};
type RescueRunEvaluation = RescueEvaluation | RescueAiEvaluation | RescueDoctrineEvaluation;

const EMPTY_TRANSCRIPT: readonly TranscriptEvent[] = [];

type DoctrineId = RescueDoctrinePresetId;

type Doctrine = RescueScenario["doctrineRuntime"]["presets"][number] & {
  name: string;
  number: string;
  accent: "lime" | "cyan" | "orange";
  rules: readonly string[];
  serviceIds: readonly ServiceId[];
};

const doctrinePresentation: Record<DoctrineId, { number: string; accent: Doctrine["accent"] }> = {
  "evidence-first": { number: "01", accent: "lime" },
  "user-guardian": { number: "02", accent: "cyan" },
  "keep-running": { number: "03", accent: "orange" },
};

type ServicePriorityId = "speed" | "accuracy" | "price";

const servicePriorityProfiles: Record<
  ServicePriorityId,
  RescueDoctrine["rules"]["servicePriority"]
> = {
  speed: ["pulse-monitor", "second-opinion", "trace-audit", "accounting-audit"],
  accuracy: ["trace-audit", "accounting-audit", "second-opinion", "pulse-monitor"],
  price: ["pulse-monitor", "second-opinion"],
};

type PreviousRun = {
  doctrineName: string;
  episodeId: string;
  evaluation: RescueRunEvaluation;
};

type BaselineEvaluations = {
  alwaysPause: RescueEvaluation;
  neverPause: RescueEvaluation;
};

const playbookPresets: Array<{
  name: string;
  description: string;
  instructions: string;
  serviceIds: ServiceId[];
  actions: RescueProtocolActionType[];
  maxPrice: number;
  budget: number;
}> = [
  {
    name: "Evidence first",
    description: "Values confidence; accepts investigation cost.",
    instructions:
      "Treat every initial alert as uncertain. Buy fast monitoring evidence first, seek a second opinion when confidence is weak, and prefer targeted containment over a full protocol pause.",
    serviceIds: ["pulse-monitor", "trace-audit", "accounting-audit", "second-opinion"],
    actions: ["PAUSE_MODULE", "PAUSE_PROTOCOL", "WAIT", "CLOSE_INCIDENT"],
    maxPrice: 30,
    budget: 90,
  },
  {
    name: "User Guardian",
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
    budget: 80,
  },
  {
    name: "Keep It Running",
    description: "Values uptime; accepts more unresolved risk.",
    instructions:
      "Preserve protocol availability unless a fast, credible signal identifies an affected module. Prefer waiting, low-cost monitoring, targeted pauses, and closing benign alerts without broad intervention.",
    serviceIds: ["pulse-monitor", "second-opinion"],
    actions: ["PAUSE_MODULE", "WAIT", "CLOSE_INCIDENT"],
    maxPrice: 12,
    budget: 50,
  },
];

function cloneDoctrine(doctrine: RescueDoctrine): RescueDoctrine {
  return {
    ...doctrine,
    constraints: {
      ...doctrine.constraints,
      allowedServiceIds: [...doctrine.constraints.allowedServiceIds],
      allowedProtocolActions: [...doctrine.constraints.allowedProtocolActions],
    },
    rules: { ...doctrine.rules, servicePriority: [...doctrine.rules.servicePriority] },
  };
}

function doctrineRuleLabels(doctrine: RescueDoctrine): string[] {
  const scope =
    doctrine.rules.containmentScope === "none"
      ? "No pause authority"
      : doctrine.rules.containmentScope === "module"
        ? "Module pause only"
        : "Protocol-wide pause";
  return [
    `${doctrine.constraints.investigationBudgetCredits} RC investigation budget`,
    `${doctrine.rules.minimumEvidenceCount} matching finding${doctrine.rules.minimumEvidenceCount === 1 ? "" : "s"}`,
    `${doctrine.rules.minimumConfidencePpm / 10_000}% confidence gate`,
    scope,
    doctrine.rules.requirePatchVerification ? "Verify before patching" : "Direct patch allowed",
  ];
}

function selectedPriorityProfile(doctrine: RescueDoctrine): ServicePriorityId {
  const serialized = JSON.stringify(doctrine.rules.servicePriority);
  return (
    (Object.entries(servicePriorityProfiles).find(
      ([, priority]) => JSON.stringify(priority) === serialized,
    )?.[0] as ServicePriorityId | undefined) ?? "accuracy"
  );
}

function shortHash(value: string) {
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

function ControlMeaning({ meaning, tradeoff }: { meaning: string; tradeoff: string }) {
  return (
    <span className="rescue-control-meaning">
      <span>{meaning}</span>
      <small>{tradeoff}</small>
    </span>
  );
}

function RangeScale({ low, high }: { low: string; high: string }) {
  return (
    <span aria-hidden="true" className="rescue-range-scale">
      <span>{low}</span>
      <span>{high}</span>
    </span>
  );
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
      likelyAffectedModule?: string | null;
    };
    const confidence =
      typeof receipt.confidencePpm === "number"
        ? ` · ${(receipt.confidencePpm / 10_000).toFixed(0)}% confidence`
        : "";
    const targetModule = receipt.likelyAffectedModule
      ? ` · ${receipt.likelyAffectedModule} suspected`
      : " · no module isolated";
    return {
      title: "Service Agent delivered evidence",
      detail: `${receipt.summary ?? "Receipt delivered"}${confidence}${targetModule}${receipt.receiptHash ? ` · ${shortHash(receipt.receiptHash)}` : ""}`,
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
  let userLossUsd = 0;
  let demandServed = 0;
  let totalDemand = 0;
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
      userLossUsd += Number(event.data.userLossDeltaUsd ?? 0);
      demandServed += Number(event.data.servedDemandDelta ?? 0);
      totalDemand += Number(event.data.totalDemandDelta ?? 0);
    }
  }
  return {
    available,
    reserved,
    spent,
    pausedModules,
    receiptCount,
    resolved,
    userLossUsd,
    demandServed,
    totalDemand,
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

function latestTranscriptEvent(
  events: readonly TranscriptEvent[],
  types: readonly TranscriptEvent["type"][],
) {
  return [...events].reverse().find(({ type }) => types.includes(type));
}

/**
 * Keep the canonical transcript event-by-event, but let the viewer advance in
 * human-sized beats. The first alert gets its own beat; after that, everything
 * the engine records at one game minute appears together.
 */
function storyBeatStops(events: readonly TranscriptEvent[]): number[] {
  if (events.length === 0) return [];
  const stops = new Set<number>([1]);
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]!;
    const next = events[index + 1];
    if (!next || next.gameMinute !== event.gameMinute) stops.add(index + 1);
  }
  return [...stops].sort((left, right) => left - right);
}

function currentStoryBeatEvents(events: readonly TranscriptEvent[]): TranscriptEvent[] {
  const latest = events.at(-1);
  if (!latest) return [];
  if (events.length === 1) return [latest];
  return events.filter(({ gameMinute }) => gameMinute === latest.gameMinute);
}

function storyBeatHighlight(events: readonly TranscriptEvent[]): TranscriptEvent | undefined {
  const beat = currentStoryBeatEvents(events);
  const priority: readonly TranscriptEvent["type"][] = [
    "EPISODE_END",
    "SERVICE_RECEIPT",
    "ACTION",
    "PAYMENT_RESERVED",
    "PAYMENT_RELEASED",
    "PAYMENT_REFUNDED",
    "STATE_TRANSITION",
    "OBSERVATION",
    "INVALID_ACTION",
  ];
  for (const type of priority) {
    const event = [...beat].reverse().find((candidate) => candidate.type === type);
    if (event) return event;
  }
  return beat.at(-1);
}

function incidentChapter(
  events: readonly TranscriptEvent[],
  activeServiceCount: number,
): RescueIncidentChapter {
  if (events.length === 0) return "alert";
  const beat = currentStoryBeatEvents(events);
  if (beat.some(({ type }) => type === "EPISODE_END")) return "outcome";
  const actionEvent = [...beat].reverse().find(({ type }) => type === "ACTION");
  const action = actionEvent?.data.action as { type?: string } | undefined;
  if (
    ["APPLY_PATCH", "RESUME_MODULE", "RESUME_PROTOCOL", "CLOSE_INCIDENT"].includes(
      action?.type ?? "",
    )
  ) {
    return "recover";
  }
  if (["PAUSE_MODULE", "PAUSE_PROTOCOL"].includes(action?.type ?? "")) return "decide";
  if (
    activeServiceCount > 0 ||
    action?.type === "BUY_SERVICE" ||
    beat.some(({ type }) => type === "SERVICE_RECEIPT")
  ) {
    return "investigate";
  }
  if (actionEvent) return "decide";
  return "alert";
}

function visitedIncidentChapters(events: readonly TranscriptEvent[]): RescueIncidentChapter[] {
  const visited = new Set<RescueIncidentChapter>(["alert"]);
  for (const event of events) {
    if (
      ["PAYMENT_RESERVED", "PAYMENT_RELEASED", "PAYMENT_REFUNDED", "SERVICE_RECEIPT"].includes(
        event.type,
      )
    ) {
      visited.add("investigate");
    }
    if (event.type === "ACTION") {
      const action = event.data.action as { type?: string };
      if (action.type === "BUY_SERVICE") visited.add("investigate");
      else visited.add("decide");
      if (
        ["APPLY_PATCH", "RESUME_MODULE", "RESUME_PROTOCOL", "CLOSE_INCIDENT"].includes(
          action.type ?? "",
        )
      ) {
        visited.add("recover");
      }
    }
    if (event.type === "EPISODE_END") visited.add("outcome");
  }
  return [...visited];
}

function outcomeCell(evaluation: RescueRunEvaluation) {
  return {
    loss: `$${evaluation.outcome.userLossUsd.toLocaleString()}`,
    availability: `${(evaluation.outcome.servedProtocolDemandPpm / 10_000).toFixed(1)}%`,
    spend: `${evaluation.outcome.netResponseSpendCredits} RC`,
  };
}

export function RescueRoomWorkbench({ scenario }: { scenario: RescueScenario }) {
  const doctrines = useMemo<Doctrine[]>(
    () =>
      scenario.doctrineRuntime.presets.map((preset) => ({
        ...preset,
        ...doctrinePresentation[preset.id],
        name: preset.doctrine.name,
        rules: doctrineRuleLabels(preset.doctrine),
        serviceIds: preset.doctrine.constraints.allowedServiceIds,
      })),
    [scenario.doctrineRuntime.presets],
  );
  const [commanderMode, setCommanderMode] = useState<"reference" | "ai">("reference");
  const [doctrineId, setDoctrineId] = useState<DoctrineId>("evidence-first");
  const [doctrine, setDoctrine] = useState<RescueDoctrine>(() =>
    cloneDoctrine(scenario.doctrineRuntime.presets[0]!.doctrine),
  );
  const [doctrineDirty, setDoctrineDirty] = useState(false);
  const [studioTab, setStudioTab] = useState<"basic" | "prompt" | "artifact">("basic");
  const [artifactCopied, setArtifactCopied] = useState(false);
  const [episodeId, setEpisodeId] = useState(scenario.episodes[0]!.id);
  const [evaluation, setEvaluation] = useState<RescueRunEvaluation | null>(null);
  const [previousRun, setPreviousRun] = useState<PreviousRun | null>(null);
  const [baselineEvaluations, setBaselineEvaluations] = useState<BaselineEvaluations | null>(null);
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
  const [investigationBudgetCredits, setInvestigationBudgetCredits] = useState(
    scenario.commanderRuntime.starterPlaybook.investigationBudgetCredits,
  );
  const [visibleEvents, setVisibleEvents] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2>(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const consoleRef = useRef<HTMLElement>(null);
  const transcript = evaluation?.outcome.transcript ?? EMPTY_TRANSCRIPT;
  const shownTranscript = transcript.slice(0, visibleEvents);
  const playbackStops = useMemo(() => storyBeatStops(transcript), [transcript]);
  const playbackActive = isPlaying && visibleEvents < transcript.length;
  const current = liveState(shownTranscript, scenario.initialBudgetCredits);
  const selectedEpisode = scenario.episodes.find(({ id }) => id === episodeId)!;
  const permittedServiceIds =
    commanderMode === "ai" ? allowedServiceIds : doctrine.constraints.allowedServiceIds;
  const referenceEvaluation =
    evaluation?.schemaVersion === "rescue-practice-evaluation-v0" ? evaluation : null;
  const doctrineEvaluation =
    evaluation?.schemaVersion === "rescue-doctrine-practice-evaluation-v0" ? evaluation : null;
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
  const latestObservation = latestTranscriptEvent(shownTranscript, ["OBSERVATION"]);
  const latestAction = latestTranscriptEvent(shownTranscript, ["ACTION"]);
  const latestEvidence = latestTranscriptEvent(shownTranscript, ["SERVICE_RECEIPT"]);
  const latestTransition = latestTranscriptEvent(shownTranscript, ["STATE_TRANSITION"]);
  const beatEvents = currentStoryBeatEvents(shownTranscript);
  const beatHighlight = storyBeatHighlight(shownTranscript);
  const beatCopy = beatHighlight
    ? transcriptCopy(beatHighlight)
    : { title: "Incident simulation ready", detail: selectedEpisode.headline };
  const beatAction = latestTranscriptEvent(beatEvents, ["ACTION", "INVALID_ACTION"]);
  const beatActionType = (beatAction?.data.action as { type?: string } | undefined)?.type;
  const protocolActionActive = Boolean(
    beatActionType && !["BUY_SERVICE", "WAIT"].includes(beatActionType),
  );
  const beatService = latestTranscriptEvent(beatEvents, [
    "PAYMENT_RESERVED",
    "PAYMENT_RELEASED",
    "PAYMENT_REFUNDED",
  ]);
  const beatEvidence = latestTranscriptEvent(beatEvents, ["SERVICE_RECEIPT"]);
  const currentChapter = incidentChapter(shownTranscript, current.activeOrders.length);
  const visitedChapters = visitedIncidentChapters(shownTranscript);
  const currentStoryBeat = playbackStops.filter((stop) => stop <= visibleEvents).length;
  const decisionEvidence = doctrineEvaluation?.decisions ?? aiEvaluation?.decisions ?? [];
  const visibleActionCount = shownTranscript.filter(
    ({ type }) => type === "ACTION" || type === "INVALID_ACTION",
  ).length;
  const currentDecision = decisionEvidence[Math.max(0, visibleActionCount - 1)];
  const aiPlaybook = {
    schemaVersion: "rescue-commander-playbook-v0" as const,
    name: playbookName,
    instructions: playbookInstructions,
    allowedServiceIds,
    allowedProtocolActions,
    maxServicePriceCredits,
    investigationBudgetCredits,
  };
  const activeArtifact = commanderMode === "ai" ? aiPlaybook : doctrine;
  const activeArtifactHash = doctrineEvaluation?.doctrineHash ?? aiEvaluation?.playbookHash ?? null;
  const activeStrategyName =
    aiEvaluation?.playbook.name ?? doctrineEvaluation?.doctrine.name ?? doctrine.name;
  const strategySnapshot =
    commanderMode === "ai"
      ? [
          {
            label: "Spend",
            value: `${investigationBudgetCredits} RC total · ${maxServicePriceCredits} RC each`,
            note: "Hard wallet limits. The prompt cannot exceed them.",
          },
          {
            label: "Certainty",
            value: "Judged by the AI prompt",
            note: "Its public observation and structured Action are recorded at every turn.",
          },
          {
            label: "Containment",
            value: allowedProtocolActions.includes("PAUSE_PROTOCOL")
              ? "Module or protocol pause"
              : allowedProtocolActions.includes("PAUSE_MODULE")
                ? "Module pause only"
                : "No pause authority",
            note: "Permissions are enforced outside the model.",
          },
        ]
      : [
          {
            label: "Spend",
            value: `${doctrine.constraints.investigationBudgetCredits} RC total · ${doctrine.constraints.maxServicePriceCredits} RC each`,
            note: "More budget can buy stronger evidence, but lowers Treasury Stewardship.",
          },
          {
            label: "Certainty",
            value: `${doctrine.rules.minimumEvidenceCount} matching finding${doctrine.rules.minimumEvidenceCount === 1 ? "" : "s"} · ${doctrine.rules.minimumConfidencePpm / 10_000}%`,
            note: "A higher gate avoids weak evidence but can delay containment.",
          },
          {
            label: "Containment",
            value:
              doctrine.rules.containmentScope === "protocol"
                ? "Protocol-wide pause"
                : doctrine.rules.containmentScope === "module"
                  ? "Module pause only"
                  : "No pause authority",
            note: "Broader authority can protect users at a larger availability cost.",
          },
        ];
  const comparisonEntries: Array<{
    id: string;
    label: string;
    note: string;
    evaluation: RescueRunEvaluation;
  }> = evaluation
    ? [
        {
          id: "your-commander",
          label: "Your Commander",
          note: activeStrategyName,
          evaluation,
        },
        ...(baselineEvaluations
          ? [
              {
                id: "always-pause",
                label: "Always Pause",
                note: "Maximum immediate containment",
                evaluation: baselineEvaluations.alwaysPause,
              },
              {
                id: "never-pause",
                label: "Never Pause",
                note: "Maximum immediate availability",
                evaluation: baselineEvaluations.neverPause,
              },
            ]
          : []),
        ...(previousRun?.episodeId === evaluation.episode.id
          ? [
              {
                id: "previous-revision",
                label: "Previous Revision",
                note: previousRun.doctrineName,
                evaluation: previousRun.evaluation,
              },
            ]
          : []),
      ]
    : [];

  useEffect(() => {
    if (!evaluation || !playbackActive) return;
    const nextStop = playbackStops.find((stop) => stop > visibleEvents) ?? transcript.length;
    const timer = window.setTimeout(
      () => setVisibleEvents(nextStop),
      playbackSpeed === 2 ? 550 : 1_100,
    );
    return () => window.clearTimeout(timer);
  }, [evaluation, playbackActive, playbackSpeed, playbackStops, transcript.length, visibleEvents]);

  async function runCommander() {
    const completedRun = evaluation;
    const completedDoctrineName = activeStrategyName;
    setPending(true);
    setError(null);
    setEvaluation(null);
    setBaselineEvaluations(null);
    setVisibleEvents(0);
    setIsPlaying(false);
    try {
      const response = await fetch(
        commanderMode === "ai"
          ? "/v1/rescue-room/commander-evaluations"
          : "/v1/rescue-room/doctrine-evaluations",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            commanderMode === "ai" ? { episodeId, playbook: aiPlaybook } : { doctrine, episodeId },
          ),
        },
      );
      const payload = (await response.json()) as RescueRunEvaluation & {
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(payload.error?.message ?? "Practice run failed");
      const fetchBaseline = async (baselineId: "always-pause" | "never-pause") => {
        const baselineResponse = await fetch("/v1/rescue-room/evaluations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ policyId: baselineId, episodeId }),
        });
        if (!baselineResponse.ok) throw new Error("Baseline comparison failed");
        return (await baselineResponse.json()) as RescueEvaluation;
      };
      const [alwaysPause, neverPause] = await Promise.all([
        fetchBaseline("always-pause"),
        fetchBaseline("never-pause"),
      ]);
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (completedRun) {
        setPreviousRun({
          doctrineName: completedDoctrineName,
          episodeId: completedRun.episode.id,
          evaluation: completedRun,
        });
      }
      setBaselineEvaluations({ alwaysPause, neverPause });
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
  }

  function rememberCurrentRun() {
    if (!evaluation) return;
    setPreviousRun({
      doctrineName: activeStrategyName,
      episodeId: evaluation.episode.id,
      evaluation,
    });
  }

  function chooseDoctrine(preset: Doctrine) {
    rememberCurrentRun();
    setDoctrineId(preset.id);
    setDoctrine(cloneDoctrine(preset.doctrine));
    setDoctrineDirty(false);
    setEvaluation(null);
    setBaselineEvaluations(null);
    if (commanderMode === "ai") {
      const presetIndex = doctrines.findIndex(({ id }) => id === preset.id);
      const playbookPreset = playbookPresets[presetIndex];
      if (playbookPreset) applyPlaybookPreset(playbookPreset);
    }
  }

  function applyPlaybookPreset(preset: (typeof playbookPresets)[number]) {
    setPlaybookName(preset.name);
    setPlaybookInstructions(preset.instructions);
    setAllowedServiceIds([...preset.serviceIds]);
    setAllowedProtocolActions([...preset.actions]);
    setMaxServicePriceCredits(preset.maxPrice);
    setInvestigationBudgetCredits(preset.budget);
    setEvaluation(null);
  }

  function updateDoctrine(change: (current: RescueDoctrine) => RescueDoctrine) {
    rememberCurrentRun();
    setDoctrine((current) => change(cloneDoctrine(current)));
    setDoctrineDirty(true);
    setEvaluation(null);
    setBaselineEvaluations(null);
    setArtifactCopied(false);
  }

  function toggleDoctrineService(serviceId: ServiceId) {
    updateDoctrine((current) => {
      const enabled = current.constraints.allowedServiceIds.includes(serviceId);
      const isDiagnostic = [
        "pulse-monitor",
        "trace-audit",
        "accounting-audit",
        "second-opinion",
      ].includes(serviceId);
      if (enabled && current.constraints.allowedServiceIds.length === 1) return current;
      if (
        enabled &&
        isDiagnostic &&
        current.rules.servicePriority.length === 1 &&
        current.rules.servicePriority.includes(
          serviceId as RescueDoctrine["rules"]["servicePriority"][number],
        )
      ) {
        return current;
      }
      current.constraints.allowedServiceIds = enabled
        ? current.constraints.allowedServiceIds.filter((id) => id !== serviceId)
        : [...current.constraints.allowedServiceIds, serviceId];
      if (isDiagnostic) {
        const diagnosticId = serviceId as RescueDoctrine["rules"]["servicePriority"][number];
        current.rules.servicePriority = enabled
          ? current.rules.servicePriority.filter((id) => id !== diagnosticId)
          : current.rules.servicePriority.includes(diagnosticId)
            ? current.rules.servicePriority
            : [...current.rules.servicePriority, diagnosticId];
      }
      if ((serviceId === "patch-builder" || serviceId === "patch-verifier") && enabled) {
        current.rules.requirePatchVerification = false;
      }
      return current;
    });
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

  async function copyArtifact() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(activeArtifact, null, 2));
      setArtifactCopied(true);
    } catch {
      setError("The strategy Artifact could not be copied in this browser.");
    }
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
      aiEvaluation
        ? aiEvaluation.playbookHash.slice(2, 10)
        : doctrineEvaluation
          ? doctrineEvaluation.doctrineHash.slice(2, 10)
          : referenceEvaluation?.policy.id
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
          <h1>Unknown incident. One doctrine.</h1>
          <p>
            Design the rules your Commander will follow before the truth is known. Then lock the
            strategy and watch it hire specialists, spend Rescue Credits, and intervene on its own.
          </p>
          <div className="rescue-storyboard-actions">
            <button disabled={pending} onClick={watchSample} type="button">
              Build my Commander doctrine
            </button>
            <button
              className="secondary-action"
              onClick={() => {
                setCommanderMode("ai");
                setStudioTab("prompt");
                const preset = playbookPresets[0];
                if (preset) applyPlaybookPreset(preset);
                consoleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              type="button"
            >
              Use an AI Playbook
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
          <div className="rescue-doctrine-heading">
            <div>
              <p className="eyebrow">Commander design · Step 1 of 3</p>
              <h2>Choose your strategic doctrine.</h2>
              <p>
                Choose what your Commander protects before it can see the true cause. The strategy
                stays locked for the entire incident.
              </p>
            </div>
            <div className="rescue-mode-switch" aria-label="Commander runtime">
              <button
                aria-pressed={commanderMode === "reference"}
                onClick={() => {
                  rememberCurrentRun();
                  setCommanderMode("reference");
                  setStudioTab("basic");
                  setEvaluation(null);
                }}
                type="button"
              >
                Replayable doctrine
              </button>
              <button
                aria-pressed={commanderMode === "ai"}
                onClick={() => {
                  rememberCurrentRun();
                  setCommanderMode("ai");
                  setStudioTab("prompt");
                  const presetIndex = doctrines.findIndex(({ id }) => id === doctrineId);
                  const preset = playbookPresets[presetIndex];
                  if (preset) applyPlaybookPreset(preset);
                }}
                type="button"
              >
                AI Commander
              </button>
            </div>
          </div>

          <div className="rescue-briefing-grid">
            <label>
              Practice alert
              <select
                value={episodeId}
                onChange={(event) => {
                  setEpisodeId(event.target.value);
                  setEvaluation(null);
                  setBaselineEvaluations(null);
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
              <span>INCOMING · T+00 · TRUTH HIDDEN</span>
              <strong>{selectedEpisode.headline}</strong>
              <ul>
                {selectedEpisode.facts.map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rescue-doctrine-list" aria-label="Commander doctrines">
            {doctrines.map((preset) => {
              const selected = preset.id === doctrineId;
              return (
                <button
                  aria-pressed={selected}
                  className="rescue-doctrine-card"
                  data-accent={preset.accent}
                  key={preset.id}
                  onClick={() => chooseDoctrine(preset)}
                  type="button"
                >
                  <span className="rescue-doctrine-number">{preset.number}</span>
                  <span className="rescue-doctrine-copy">
                    <strong>{preset.name}</strong>
                    <small>{preset.promise}</small>
                  </span>
                  <span className="rescue-doctrine-tradeoff">
                    <small>Protects</small>
                    <strong>{preset.protects}</strong>
                    <small>Accepts · {preset.accepts}</small>
                  </span>
                  <span className="rescue-doctrine-select">
                    {selected && doctrineDirty ? "Custom" : selected ? "Selected" : "Choose"}
                  </span>
                  {selected ? (
                    <span className="rescue-doctrine-rules">
                      {doctrineRuleLabels(doctrine).map((rule) => (
                        <span key={rule}>{rule}</span>
                      ))}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="rescue-doctrine-toolkit">
            <div>
              <p className="eyebrow">Service toolkit · information has a cost</p>
              <div className="rescue-doctrine-services">
                {scenario.services
                  .filter(({ id }) => permittedServiceIds.includes(id))
                  .map((service) => (
                    <article key={service.id}>
                      <strong>{service.name}</strong>
                      <small>{service.task.replaceAll("_", " ")}</small>
                      <span>
                        {service.priceCredits} RC · {service.deliveryMinutes} min
                      </span>
                    </article>
                  ))}
              </div>
            </div>
            <div className="rescue-value-focus">
              <p className="eyebrow">Three values stay separate</p>
              <span>User Protection</span>
              <span>Protocol Availability</span>
              <span>Treasury Stewardship</span>
            </div>
          </div>

          <div className="rescue-strategy-studio">
            <div className="rescue-studio-tabs" aria-label="Commander strategy editor">
              {(["basic", "prompt", "artifact"] as const).map((tab) => (
                <button
                  aria-pressed={studioTab === tab}
                  key={tab}
                  onClick={() => setStudioTab(tab)}
                  type="button"
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="rescue-strategy-explainer">
              <div>
                <span>GAME STRATEGY CONTROLS · NOT MODEL TUNING</span>
                <strong>
                  Set what the Commander may spend, when it may trust evidence, and how far it may
                  intervene.
                </strong>
                <p>
                  These controls change the recorded decisions and outcomes. Model version,
                  temperature, turn limit, and evaluator rules stay fixed so every entry faces the
                  same competition context.
                </p>
              </div>
              <div
                className="rescue-strategy-snapshot"
                aria-label="Current strategy in plain language"
              >
                {strategySnapshot.map((item) => (
                  <article key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                    <small>{item.note}</small>
                  </article>
                ))}
              </div>
            </div>

            {studioTab === "basic" ? (
              <div className="rescue-studio-panel">
                <div className="rescue-studio-heading">
                  <div>
                    <span>
                      {commanderMode === "ai" ? "AI authority envelope" : "Executable rules"}
                    </span>
                    <strong>{commanderMode === "ai" ? playbookName : doctrine.name}</strong>
                  </div>
                  <small>{commanderMode === "ai" || doctrineDirty ? "CUSTOM" : "PRESET"}</small>
                </div>
                {commanderMode === "ai" ? (
                  <div className="rescue-rule-grid">
                    <label>
                      Playbook name
                      <ControlMeaning
                        meaning="Names this revision in comparisons and Evidence. It does not change behavior."
                        tradeoff="Use a name that describes the strategy you intend to test."
                      />
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
                      Investigation budget · {investigationBudgetCredits} RC
                      <ControlMeaning
                        meaning="The total amount the AI may spend hiring Service Agents during this incident."
                        tradeoff="Higher: more evidence and patch options · Lower: more Treasury preserved."
                      />
                      <input
                        max={scenario.initialBudgetCredits}
                        min={0}
                        onChange={(event) => {
                          setInvestigationBudgetCredits(Number(event.target.value));
                          setEvaluation(null);
                        }}
                        type="range"
                        value={investigationBudgetCredits}
                      />
                      <RangeScale
                        high={`${scenario.initialBudgetCredits} · full wallet available`}
                        low="0 · preserve every credit"
                      />
                    </label>
                    <label>
                      Maximum single service price · {maxServicePriceCredits} RC
                      <ControlMeaning
                        meaning="A hard price ceiling for one Service Agent purchase."
                        tradeoff="Higher unlocks specialist audits and patches · Lower prevents one hire consuming the wallet."
                      />
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
                      <RangeScale
                        high={`${scenario.initialBudgetCredits} · any service allowed`}
                        low="0 · no paid service"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="rescue-rule-grid">
                    <label>
                      Doctrine name
                      <ControlMeaning
                        meaning="Names this deterministic rule set in comparisons and Evidence."
                        tradeoff="The name is descriptive only; the rules below drive every Action."
                      />
                      <input
                        maxLength={80}
                        minLength={3}
                        onChange={(event) =>
                          updateDoctrine((current) => ({ ...current, name: event.target.value }))
                        }
                        type="text"
                        value={doctrine.name}
                      />
                    </label>
                    <label>
                      Investigation budget · {doctrine.constraints.investigationBudgetCredits} RC
                      <ControlMeaning
                        meaning="The total Rescue Credits this doctrine may spend to reduce uncertainty."
                        tradeoff="Higher can buy more evidence · Lower improves Treasury Stewardship if the alert is benign."
                      />
                      <input
                        max={scenario.initialBudgetCredits}
                        min={0}
                        onChange={(event) =>
                          updateDoctrine((current) => ({
                            ...current,
                            constraints: {
                              ...current.constraints,
                              investigationBudgetCredits: Number(event.target.value),
                            },
                          }))
                        }
                        type="range"
                        value={doctrine.constraints.investigationBudgetCredits}
                      />
                      <RangeScale
                        high={`${scenario.initialBudgetCredits} · full wallet available`}
                        low="0 · preserve every credit"
                      />
                    </label>
                    <label>
                      Evidence required
                      <ControlMeaning
                        meaning="How many Service findings must point to the same cause before containment or recovery."
                        tradeoff="More findings reduce false confidence · They also cost time and Rescue Credits."
                      />
                      <select
                        onChange={(event) =>
                          updateDoctrine((current) => ({
                            ...current,
                            rules: {
                              ...current.rules,
                              minimumEvidenceCount: Number(event.target.value),
                            },
                          }))
                        }
                        value={doctrine.rules.minimumEvidenceCount}
                      >
                        <option value={1}>1 matching finding</option>
                        <option value={2}>2 matching findings</option>
                        <option value={3}>3 matching findings</option>
                      </select>
                    </label>
                    <label>
                      Confidence gate · {doctrine.rules.minimumConfidencePpm / 10_000}%
                      <ControlMeaning
                        meaning="The minimum confidence a finding needs before it counts as usable Evidence."
                        tradeoff="Higher rejects weak reports · It can delay action when every report is uncertain."
                      />
                      <input
                        max={950000}
                        min={500000}
                        onChange={(event) =>
                          updateDoctrine((current) => ({
                            ...current,
                            rules: {
                              ...current.rules,
                              minimumConfidencePpm: Number(event.target.value),
                            },
                          }))
                        }
                        step={50000}
                        type="range"
                        value={doctrine.rules.minimumConfidencePpm}
                      />
                      <RangeScale
                        low="50% · accept weaker signals"
                        high="95% · require strong evidence"
                      />
                    </label>
                    <label>
                      Evidence disagreement
                      <ControlMeaning
                        meaning="The fallback when paid specialists identify different causes or modules."
                        tradeoff="A second opinion buys certainty; waiting saves money; containment protects first."
                      />
                      <select
                        onChange={(event) =>
                          updateDoctrine((current) => ({
                            ...current,
                            rules: {
                              ...current.rules,
                              disagreementAction: event.target
                                .value as RescueDoctrine["rules"]["disagreementAction"],
                            },
                          }))
                        }
                        value={doctrine.rules.disagreementAction}
                      >
                        <option value="second-opinion">Buy a second opinion</option>
                        <option value="wait">Wait once</option>
                        <option value="contain">Contain the suspected module</option>
                      </select>
                    </label>
                    <label>
                      Pause authority
                      <ControlMeaning
                        meaning="The widest part of the Protocol this Commander is allowed to stop."
                        tradeoff="Broader pause can stop loss faster · It also reduces Protocol Availability."
                      />
                      <select
                        onChange={(event) =>
                          updateDoctrine((current) => ({
                            ...current,
                            rules: {
                              ...current.rules,
                              containmentScope: event.target
                                .value as RescueDoctrine["rules"]["containmentScope"],
                            },
                          }))
                        }
                        value={doctrine.rules.containmentScope}
                      >
                        <option value="none">No pause</option>
                        <option value="module">Module only</option>
                        <option value="protocol">Whole protocol</option>
                      </select>
                    </label>
                    <label>
                      Service priority
                      <ControlMeaning
                        meaning="The order used when several allowed Service Agents could investigate the alert."
                        tradeoff="Speed acts sooner; specialists are more accurate; low-cost services preserve budget."
                      />
                      <select
                        onChange={(event) => {
                          const priority =
                            servicePriorityProfiles[event.target.value as ServicePriorityId];
                          updateDoctrine((current) => ({
                            ...current,
                            constraints: {
                              ...current.constraints,
                              allowedServiceIds: Array.from(
                                new Set([...current.constraints.allowedServiceIds, ...priority]),
                              ),
                            },
                            rules: { ...current.rules, servicePriority: [...priority] },
                          }));
                        }}
                        value={selectedPriorityProfile(doctrine)}
                      >
                        <option value="speed">Speed first</option>
                        <option value="accuracy">Specialists first</option>
                        <option value="price">Low-cost services only</option>
                      </select>
                    </label>
                    <label>
                      Patch safety
                      <ControlMeaning
                        meaning="Whether a second Service Agent must verify a proposed patch before it is applied."
                        tradeoff="Verification lowers bad-patch risk · Direct apply saves one purchase and its delivery time."
                      />
                      <select
                        onChange={(event) => {
                          const required = event.target.value === "verify";
                          updateDoctrine((current) => ({
                            ...current,
                            constraints: {
                              ...current.constraints,
                              allowedServiceIds: required
                                ? Array.from(
                                    new Set([
                                      ...current.constraints.allowedServiceIds,
                                      "patch-builder" as const,
                                      "patch-verifier" as const,
                                    ]),
                                  )
                                : current.constraints.allowedServiceIds,
                            },
                            rules: { ...current.rules, requirePatchVerification: required },
                          }));
                        }}
                        value={doctrine.rules.requirePatchVerification ? "verify" : "direct"}
                      >
                        <option value="verify">Verify before apply</option>
                        <option value="direct">Direct apply allowed</option>
                      </select>
                    </label>
                    <label>
                      If the investigation budget runs out
                      <ControlMeaning
                        meaning="The final fallback when no more Service Evidence can be purchased."
                        tradeoff="Contain protects users; wait protects availability; close protects the remaining Treasury."
                      />
                      <select
                        onChange={(event) =>
                          updateDoctrine((current) => ({
                            ...current,
                            rules: {
                              ...current.rules,
                              budgetExhaustedAction: event.target
                                .value as RescueDoctrine["rules"]["budgetExhaustedAction"],
                            },
                          }))
                        }
                        value={doctrine.rules.budgetExhaustedAction}
                      >
                        <option value="contain">Contain risk</option>
                        <option value="wait">Wait once</option>
                        <option value="close">Close and preserve budget</option>
                      </select>
                    </label>
                    <label>
                      Maximum single service price · {doctrine.constraints.maxServicePriceCredits}{" "}
                      RC
                      <ControlMeaning
                        meaning="A hard cap on any one Service Agent order, separate from the total investigation budget."
                        tradeoff="Higher unlocks expensive specialists · Lower forces cheaper and sometimes weaker information."
                      />
                      <input
                        max={scenario.initialBudgetCredits}
                        min={0}
                        onChange={(event) =>
                          updateDoctrine((current) => ({
                            ...current,
                            constraints: {
                              ...current.constraints,
                              maxServicePriceCredits: Number(event.target.value),
                            },
                          }))
                        }
                        type="range"
                        value={doctrine.constraints.maxServicePriceCredits}
                      />
                      <RangeScale
                        high={`${scenario.initialBudgetCredits} · any service allowed`}
                        low="0 · no paid service"
                      />
                    </label>
                  </div>
                )}

                <fieldset>
                  <legend>Service Agents this strategy may hire</legend>
                  <p className="rescue-fieldset-help">
                    This is the available roster, not a shopping list. The Commander still decides
                    whether each purchase is worth its price and delivery time.
                  </p>
                  <div className="rescue-playbook-options">
                    {scenario.services.map((service) => (
                      <label key={service.id}>
                        <input
                          checked={permittedServiceIds.includes(service.id)}
                          onChange={() =>
                            commanderMode === "ai"
                              ? toggleService(service.id)
                              : toggleDoctrineService(service.id)
                          }
                          type="checkbox"
                        />
                        <span>{service.name}</span>
                        <small>{service.priceCredits} RC</small>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {commanderMode === "ai" ? (
                  <fieldset>
                    <legend>Protocol actions this AI may take</legend>
                    <p className="rescue-fieldset-help">
                      These are hard permissions enforced by the Arena. Prompt text cannot bypass an
                      unchecked Action.
                    </p>
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
                ) : null}
              </div>
            ) : null}

            {studioTab === "prompt" ? (
              <div className="rescue-studio-panel">
                <div className="rescue-runtime-chip">
                  <span>Prompt controls the AI runtime only</span>
                  <strong>{scenario.commanderRuntime.model}</strong>
                  <small>
                    Rules mode ignores this prose. Both modes use the same budget and permission
                    gate, but only the recorded Actions are replayed. Model version, temperature,
                    turn limit, and evaluator stay fixed as the competition context.
                  </small>
                </div>
                <label>
                  Commander instructions
                  <textarea
                    maxLength={4000}
                    minLength={40}
                    onChange={(event) => {
                      setPlaybookInstructions(event.target.value);
                      setEvaluation(null);
                    }}
                    rows={8}
                    value={playbookInstructions}
                  />
                </label>
                {commanderMode !== "ai" ? (
                  <button
                    className="secondary-action"
                    onClick={() => setCommanderMode("ai")}
                    type="button"
                  >
                    Use this prompt with AI Commander
                  </button>
                ) : null}
              </div>
            ) : null}

            {studioTab === "artifact" ? (
              <div className="rescue-studio-panel rescue-artifact-panel">
                <div className="rescue-artifact-meta">
                  <span>Schema · {activeArtifact.schemaVersion}</span>
                  <span>
                    Hash ·{" "}
                    {activeArtifactHash ? shortHash(activeArtifactHash) : "calculated on deploy"}
                  </span>
                  <span>
                    Runtime ·{" "}
                    {commanderMode === "ai"
                      ? scenario.commanderRuntime.runtimeVersion
                      : scenario.doctrineRuntime.interpreterVersion}
                  </span>
                </div>
                <pre>{JSON.stringify(activeArtifact, null, 2)}</pre>
                <div className="rescue-artifact-actions">
                  <button className="secondary-action" onClick={copyArtifact} type="button">
                    {artifactCopied ? "Artifact copied" : "Copy Artifact JSON"}
                  </button>
                  <small>
                    Arbitrary Code mode is intentionally disabled until sandboxing and deterministic
                    execution limits are specified.
                  </small>
                </div>
              </div>
            ) : null}
          </div>

          {commanderMode === "ai" ? (
            <div className="rescue-playbook-editor">
              <div className="rescue-runtime-chip" hidden>
                <span>Fixed AI runtime</span>
                <strong>{scenario.commanderRuntime.model}</strong>
                <small>
                  {scenario.commanderRuntime.maximumModelTurns} model turns · replay from recorded
                  Actions
                </small>
              </div>
              <details className="rescue-playbook-advanced" hidden>
                <summary>Inspect or customize this AI Playbook</summary>
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
            </div>
          ) : (
            <div className="rescue-policy-preview">
              <span>Deterministic training doctrine · replayable</span>
              <strong>{doctrine.name}</strong>
              <small>
                {doctrineDirty ? "Custom revision" : "Preset"} · executable structured rules ·
                deterministic replay
              </small>
            </div>
          )}

          <div className="rescue-deploy-bar">
            <div>
              <span>Locked for this run</span>
              <strong>{activeStrategyName}</strong>
              <small>
                Baselines are revealed after the same Incident. No weighted score is calculated.
              </small>
            </div>
            <button disabled={pending} onClick={runCommander} type="button">
              {pending
                ? commanderMode === "ai"
                  ? "AI Commander is deciding…"
                  : "Deploying doctrine…"
                : commanderMode === "ai"
                  ? "Lock strategy & deploy AI Commander"
                  : "Lock doctrine & start incident"}
            </button>
          </div>
          {error ? <p className="error-banner">{error}</p> : null}
        </div>

        <div className="rescue-live-room">
          <div className="rescue-room-heading">
            <div>
              <p className="eyebrow">Autonomous run · Step 2 of 3</p>
              <h2>{evaluation ? activeStrategyName : `${activeStrategyName} is ready`}</h2>
            </div>
            <span>{evaluation ? `T+${shownTranscript.at(-1)?.gameMinute ?? 0}` : "STANDBY"}</span>
          </div>
          <RescueIncidentTheatre
            actionDetail={beatAction ? transcriptCopy(beatAction).detail : null}
            actionReason={beatAction ? (currentDecision?.reasonCode ?? activeStrategyName) : null}
            activeServices={current.activeOrders}
            availableBudget={current.available}
            chapter={currentChapter}
            currentMinute={shownTranscript.at(-1)?.gameMinute ?? 0}
            demandServed={current.demandServed}
            eventDetail={beatCopy.detail}
            eventTitle={beatCopy.title}
            evidenceDetail={beatEvidence ? transcriptCopy(beatEvidence).detail : null}
            horizonMinutes={scenario.horizonMinutes}
            modules={scenario.modules}
            paidBudget={current.spent}
            pausedModules={current.pausedModules}
            protocolActionActive={protocolActionActive}
            reservedBudget={current.reserved}
            serviceDetail={beatService ? transcriptCopy(beatService).detail : null}
            storyBeat={currentStoryBeat}
            storyBeatCount={playbackStops.length}
            suspectedModules={current.suspectedModules}
            totalDemand={current.totalDemand}
            userLossUsd={current.userLossUsd}
            visitedChapters={visitedChapters}
          />
          {evaluation ? (
            <>
              <div className="rescue-decision-cause" aria-label="Current decision explanation">
                <div>
                  <span>Decision lens · T+{latestAction?.gameMinute ?? 0}</span>
                  <strong>
                    {latestAction ? transcriptCopy(latestAction).detail : "Awaiting first action"}
                  </strong>
                </div>
                <dl>
                  <div>
                    <dt>Trigger</dt>
                    <dd>
                      {latestEvidence
                        ? transcriptCopy(latestEvidence).detail
                        : latestObservation
                          ? transcriptCopy(latestObservation).detail
                          : selectedEpisode.headline}
                    </dd>
                  </div>
                  <div>
                    <dt>Rule</dt>
                    <dd>{currentDecision?.reasonCode ?? "Awaiting a matched rule"}</dd>
                  </div>
                  <div>
                    <dt>Cost / time</dt>
                    <dd>
                      {current.spent} RC paid · {current.reserved} RC reserved · T+
                      {latestAction?.gameMinute ?? 0}
                    </dd>
                  </div>
                  <div>
                    <dt>State change</dt>
                    <dd>
                      {latestTransition
                        ? transcriptCopy(latestTransition).detail
                        : "Protocol state unchanged so far."}
                    </dd>
                  </div>
                  <div>
                    <dt>Alternatives</dt>
                    <dd>Wait · hire another specialist · narrow pause · close the incident</dd>
                  </div>
                </dl>
              </div>
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
                    setVisibleEvents(
                      playbackStops.find((stop) => stop > visibleEvents) ?? transcript.length,
                    );
                  }}
                  type="button"
                >
                  Next story beat
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
              <details className="rescue-raw-log">
                <summary>
                  Inspect raw evidence transcript · {shownTranscript.length} canonical events
                </summary>
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
                </ol>
              </details>
              {visibleEvents >= transcript.length ? (
                <button
                  className="secondary-action"
                  onClick={() => {
                    setVisibleEvents(0);
                    setIsPlaying(true);
                  }}
                  type="button"
                >
                  Replay illustrated incident
                </button>
              ) : null}
            </>
          ) : (
            <div className="rescue-empty-room">
              <span>LOCKED</span>
              <strong>{activeStrategyName}</strong>
              <p>
                Once deployed, the Commander acts without mid-run instructions. You can watch its
                trigger, rule, purchase, evidence, and protocol effect as illustrated story beats.
              </p>
            </div>
          )}
        </div>
      </section>

      <RescuePaymentJourney
        evidence={evaluation?.paymentEvidence ?? null}
        services={scenario.services}
      />

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
              <p className="eyebrow">Debrief · Step 3 of 3</p>
              <h2>Same incident. Different judgment.</h2>
            </div>
            <span
              className={
                aiEvaluation || doctrineEvaluation || referenceEvaluation?.aggregate.pareto.frontier
                  ? "status-good"
                  : "status-bad"
              }
            >
              {aiEvaluation
                ? "Action replay verified"
                : doctrineEvaluation
                  ? "Doctrine replay verified"
                  : referenceEvaluation?.aggregate.pareto.frontier
                    ? "Practice frontier"
                    : "Dominated in pack"}
            </span>
          </div>
          <div className="rescue-baseline-comparison">
            <div className="rescue-comparison-heading">
              <div>
                <p className="eyebrow">Same hidden state · independent outcomes</p>
                <h3>Your doctrine versus the obvious fixed strategies</h3>
              </div>
              <small>↓ minimize loss · ↑ maximize availability · ↓ minimize spend</small>
            </div>
            <div className="rescue-comparison-table" role="table" aria-label="Strategy outcomes">
              <div className="rescue-comparison-row rescue-comparison-labels" role="row">
                <span role="columnheader">Strategy</span>
                <span role="columnheader">User loss ↓</span>
                <span role="columnheader">Demand served ↑</span>
                <span role="columnheader">Spend ↓</span>
              </div>
              {comparisonEntries.map((entry) => {
                const values = outcomeCell(entry.evaluation);
                return (
                  <div
                    className="rescue-comparison-row"
                    data-player={entry.id === "your-commander"}
                    key={entry.id}
                    role="row"
                  >
                    <span role="cell">
                      <strong>{entry.label}</strong>
                      <small>{entry.note}</small>
                    </span>
                    <strong data-label="User loss" role="cell">
                      {values.loss}
                    </strong>
                    <strong data-label="Demand served" role="cell">
                      {values.availability}
                    </strong>
                    <strong data-label="Response spend" role="cell">
                      {values.spend}
                    </strong>
                  </div>
                );
              })}
            </div>
            <p>
              This comparison uses one identical hidden Incident. Frontier status is intentionally
              deferred until the same locked Doctrine runs across a multi-Episode pack.
            </p>
          </div>
          <div className="supply-metrics">
            <article>
              <span>User loss · this Episode</span>
              <strong>${evaluation.outcome.userLossUsd.toLocaleString()}</strong>
              <small>
                {referenceEvaluation
                  ? `Minimize · pack total $${referenceEvaluation.aggregate.totalUserLossUsd.toLocaleString()}`
                  : "Minimize · one Episode of Controlled Practice"}
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
                  : "Minimize · one Episode of Controlled Practice"}
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
            <p className="eyebrow">Revision loop</p>
            <h3>Change one rule. Predict the tradeoff. Run it again.</h3>
            <div>
              <button
                className="rescue-revise-action"
                onClick={() => {
                  rememberCurrentRun();
                  setEvaluation(null);
                  setBaselineEvaluations(null);
                  setStudioTab("basic");
                  consoleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                type="button"
              >
                Change one rule & retry
              </button>
              <button
                className="secondary-action"
                onClick={() => {
                  rememberCurrentRun();
                  setCommanderMode("ai");
                  setStudioTab("prompt");
                  const presetIndex = doctrines.findIndex(({ id }) => id === doctrineId);
                  const preset = playbookPresets[presetIndex];
                  if (preset) applyPlaybookPreset(preset);
                  setEvaluation(null);
                  consoleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                type="button"
              >
                Turn this doctrine into an AI Playbook
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
          accounting units—not ERC-20 tokens. No wallet delegation, deployed escrow, live Sepolia
          Service transaction, hidden Final, or reward settlement is claimed in this Controlled
          Practice Arena.
        </p>
        <code>
          Context {shortHash(scenario.contextHash)} · Manifest {shortHash(scenario.manifestHash)}
        </code>
      </footer>
    </div>
  );
}
