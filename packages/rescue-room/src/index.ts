import {
  canonicalProtocolJson,
  computeContributionEvidence,
  computeOutcomeFrontier,
  hashChallengeManifest,
  parseChallengeManifest,
  type ContributionEvidence,
  type OutcomeMetric,
  type OutcomePoint,
} from "@frontier/shared";
import { keccak256, stringToHex, type Hex } from "viem";
import { z } from "zod";

export const rescueRoomChallengeId = "rescue-room-v0" as const;
export const rescueRoomGeneratorVersion = "rescue-room-generator-v0" as const;
export const rescueRoomEvaluatorVersion = "rescue-room-evaluator-v2" as const;
export const rescueRoomInitialBudgetCredits = 100;
export const rescueRoomHorizonMinutes = 60;
export const rescueRoomMaximumDecisions = 12;
export const rescueRoomCommanderRuntimeVersion = "rescue-commander-runtime-v1" as const;
export const rescueRoomCommanderPromptVersion = "rescue-commander-prompt-v1" as const;
export const rescueRoomCommanderModel = "gpt-5.6-luna" as const;
export const rescueRoomCommanderMaximumModelTurns = 12;
export const rescueRoomCommanderMaximumOutputTokens = 400;
export const rescueRoomCommanderModelTimeoutMs = 20_000;
export const rescueRoomCommanderEpisodeTimeoutMs = 90_000;
export const rescueRoomCommanderModelSettings = {
  reasoningEffort: "none",
  textVerbosity: "low",
  parallelToolCalls: false,
  store: false,
  maximumOutputTokens: rescueRoomCommanderMaximumOutputTokens,
  modelTimeoutMs: rescueRoomCommanderModelTimeoutMs,
} as const;

export const rescueModuleSchema = z.enum([
  "withdrawals",
  "borrowing",
  "liquidations",
  "oracle",
  "governance",
  "bridge",
]);
export type RescueModule = z.infer<typeof rescueModuleSchema>;

export const incidentFamilySchema = z.enum([
  "false-positive",
  "oracle-manipulation",
  "accounting-drift",
  "compromised-key",
  "liquidity-crisis",
  "contract-exploit",
  "external-dependency",
]);
export type IncidentFamily = z.infer<typeof incidentFamilySchema>;

export const patchIdSchema = z.enum([
  "no-patch",
  "restore-oracle",
  "reconcile-accounting",
  "rotate-operator-key",
  "activate-liquidity-backstop",
  "guard-execution-path",
  "isolate-external-bridge",
]);
export type PatchId = z.infer<typeof patchIdSchema>;

export const serviceIdSchema = z.enum([
  "pulse-monitor",
  "trace-audit",
  "accounting-audit",
  "second-opinion",
  "patch-builder",
  "patch-verifier",
]);
export type ServiceId = z.infer<typeof serviceIdSchema>;

export type ServiceTask =
  | "SCAN_ACTIVITY"
  | "TRACE_EXECUTION"
  | "CHECK_ACCOUNTING"
  | "SECOND_OPINION"
  | "BUILD_PATCH"
  | "VERIFY_PATCH";

export type ServiceDefinition = {
  id: ServiceId;
  name: string;
  task: ServiceTask;
  priceCredits: number;
  deliveryMinutes: number;
  description: string;
};

export const rescueServices: readonly ServiceDefinition[] = [
  {
    id: "pulse-monitor",
    name: "Pulse Monitor",
    task: "SCAN_ACTIVITY",
    priceCredits: 5,
    deliveryMinutes: 2,
    description: "Fast activity classification with broad coverage and limited precision.",
  },
  {
    id: "trace-audit",
    name: "Trace Audit",
    task: "TRACE_EXECUTION",
    priceCredits: 16,
    deliveryMinutes: 6,
    description: "Execution-trace specialist for exploits, keys, and external calls.",
  },
  {
    id: "accounting-audit",
    name: "Accounting Audit",
    task: "CHECK_ACCOUNTING",
    priceCredits: 18,
    deliveryMinutes: 7,
    description: "Invariant specialist for accounting, oracle, and liquidity failures.",
  },
  {
    id: "second-opinion",
    name: "Second Opinion",
    task: "SECOND_OPINION",
    priceCredits: 12,
    deliveryMinutes: 4,
    description: "Independent classification that can confirm or challenge an earlier finding.",
  },
  {
    id: "patch-builder",
    name: "Patch Builder",
    task: "BUILD_PATCH",
    priceCredits: 28,
    deliveryMinutes: 8,
    description: "Produces a typed patch artifact for the most likely root cause.",
  },
  {
    id: "patch-verifier",
    name: "Patch Verifier",
    task: "VERIFY_PATCH",
    priceCredits: 10,
    deliveryMinutes: 4,
    description: "Checks whether a purchased patch matches the active failure.",
  },
] as const;

const moduleDemandUnits: Readonly<Record<RescueModule, number>> = {
  withdrawals: 30,
  borrowing: 22,
  liquidations: 18,
  oracle: 8,
  governance: 7,
  bridge: 15,
};

const familyPatch: Readonly<Record<IncidentFamily, PatchId>> = {
  "false-positive": "no-patch",
  "oracle-manipulation": "restore-oracle",
  "accounting-drift": "reconcile-accounting",
  "compromised-key": "rotate-operator-key",
  "liquidity-crisis": "activate-liquidity-backstop",
  "contract-exploit": "guard-execution-path",
  "external-dependency": "isolate-external-bridge",
};

const familyModules: Readonly<Record<IncidentFamily, readonly RescueModule[]>> = {
  "false-positive": ["withdrawals", "borrowing", "bridge"],
  "oracle-manipulation": ["oracle", "borrowing"],
  "accounting-drift": ["withdrawals", "borrowing"],
  "compromised-key": ["governance", "withdrawals"],
  "liquidity-crisis": ["liquidations", "withdrawals"],
  "contract-exploit": ["withdrawals", "borrowing", "bridge"],
  "external-dependency": ["bridge", "oracle"],
};

const baseLossRates: Readonly<Record<IncidentFamily, number>> = {
  "false-positive": 0,
  "oracle-manipulation": 310,
  "accounting-drift": 250,
  "compromised-key": 430,
  "liquidity-crisis": 180,
  "contract-exploit": 540,
  "external-dependency": 220,
};

export type InitialSignal = "activity-anomaly" | "price-anomaly" | "privileged-anomaly";

export type RescueEpisodeDefinition = {
  schemaVersion: "rescue-episode-v0";
  generatorVersion: typeof rescueRoomGeneratorVersion;
  publicId: string;
  seed: string;
  incidentFamily: IncidentFamily;
  severity: 1 | 2 | 3;
  affectedModule: RescueModule;
  lossRateUsdPerMinute: number;
  demandMultiplierPpm: number;
  validPatchId: PatchId;
  initialSignal: InitialSignal;
  initialHeadline: string;
};

export type PublicObservation = {
  id: string;
  gameMinute: number;
  source: "PROTOCOL" | "SERVICE";
  headline: string;
  facts: readonly string[];
};

export type ServiceReceipt = {
  receiptId: string;
  orderId: string;
  serviceId: ServiceId;
  task: ServiceTask;
  deliveredAtMinute: number;
  classification: IncidentFamily | "inconclusive";
  likelyAffectedModule: RescueModule | null;
  severity: 1 | 2 | 3 | null;
  confidencePpm: number;
  patchId: PatchId | null;
  patchValid: boolean | null;
  summary: string;
  receiptHash: Hex;
};

export type ServiceOrder = {
  orderId: string;
  serviceId: ServiceId;
  task: ServiceTask;
  orderedAtMinute: number;
  dueAtMinute: number;
  priceCredits: number;
  targetModule: RescueModule | null;
  targetReceiptId: string | null;
  status: "RESERVED" | "DELIVERED" | "REFUNDED";
};

export const rescueActionSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("BUY_SERVICE"),
      serviceId: serviceIdSchema,
      targetModule: rescueModuleSchema.nullable().optional(),
      targetReceiptId: z.string().min(1).nullable().optional(),
    })
    .strict(),
  z.object({ type: z.literal("PAUSE_MODULE"), module: rescueModuleSchema }).strict(),
  z.object({ type: z.literal("PAUSE_PROTOCOL") }).strict(),
  z.object({ type: z.literal("APPLY_PATCH"), receiptId: z.string().min(1) }).strict(),
  z.object({ type: z.literal("RESUME_MODULE"), module: rescueModuleSchema }).strict(),
  z.object({ type: z.literal("RESUME_PROTOCOL") }).strict(),
  z.object({ type: z.literal("WAIT"), minutes: z.number().int().min(1).max(15) }).strict(),
  z.object({ type: z.literal("CLOSE_INCIDENT") }).strict(),
]);
export type RescueAction = z.infer<typeof rescueActionSchema>;

export const rescueProtocolActionTypeSchema = z.enum([
  "PAUSE_MODULE",
  "PAUSE_PROTOCOL",
  "APPLY_PATCH",
  "RESUME_MODULE",
  "RESUME_PROTOCOL",
  "WAIT",
  "CLOSE_INCIDENT",
]);
export type RescueProtocolActionType = z.infer<typeof rescueProtocolActionTypeSchema>;

export const rescueCommanderPlaybookSchema = z
  .object({
    schemaVersion: z.literal("rescue-commander-playbook-v0"),
    name: z.string().trim().min(3).max(80),
    instructions: z.string().trim().min(40).max(4_000),
    allowedServiceIds: z.array(serviceIdSchema).max(rescueServices.length),
    allowedProtocolActions: z
      .array(rescueProtocolActionTypeSchema)
      .min(1)
      .max(rescueProtocolActionTypeSchema.options.length),
    maxServicePriceCredits: z.number().int().min(0).max(rescueRoomInitialBudgetCredits),
  })
  .strict()
  .superRefine((playbook, context) => {
    if (new Set(playbook.allowedServiceIds).size !== playbook.allowedServiceIds.length) {
      context.addIssue({
        code: "custom",
        path: ["allowedServiceIds"],
        message: "Service Agent ids must be unique",
      });
    }
    if (new Set(playbook.allowedProtocolActions).size !== playbook.allowedProtocolActions.length) {
      context.addIssue({
        code: "custom",
        path: ["allowedProtocolActions"],
        message: "Protocol action types must be unique",
      });
    }
  });
export type RescueCommanderPlaybook = z.infer<typeof rescueCommanderPlaybookSchema>;

export const rescueCommanderPlaybookJsonSchema = JSON.parse(
  JSON.stringify(z.toJSONSchema(rescueCommanderPlaybookSchema)),
) as Record<string, unknown>;

export const rescueCommanderDecisionSchema = z
  .object({
    action: rescueActionSchema,
    reasonCode: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9-]+$/),
    confidencePpm: z.number().int().min(0).max(1_000_000),
  })
  .strict();
export type RescueCommanderDecision = z.infer<typeof rescueCommanderDecisionSchema>;

export type RescueCommanderDecisionEvidence = RescueCommanderDecision & {
  decision: number;
  gameMinute: number;
  publicViewHash: Hex;
  accepted: boolean;
  invalidReason: string | null;
};

export type RescueCommanderRuntimeEvidence = {
  runtimeVersion: typeof rescueRoomCommanderRuntimeVersion;
  promptVersion: typeof rescueRoomCommanderPromptVersion;
  sdk: { name: "@openai/agents"; version: string };
  configuredModel: typeof rescueRoomCommanderModel;
  modelSettings: typeof rescueRoomCommanderModelSettings;
  maximumModelTurns: number;
  episodeTimeoutMs: number;
  startedAt: string;
  completedAt: string;
  responseIds: readonly string[];
  requestIds: readonly string[];
  resolvedModels: readonly string[];
  usage: {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
};

export const rescueCommanderStarterPlaybook: RescueCommanderPlaybook = {
  schemaVersion: "rescue-commander-playbook-v0",
  name: "Evidence-aware Commander",
  instructions:
    "Treat the initial alert as uncertain. Buy targeted evidence when it can change the intervention, prefer module-level containment over a full pause, verify risky patches, and preserve enough budget to recover from a misleading finding.",
  allowedServiceIds: [
    "pulse-monitor",
    "trace-audit",
    "accounting-audit",
    "second-opinion",
    "patch-builder",
    "patch-verifier",
  ],
  allowedProtocolActions: [
    "PAUSE_MODULE",
    "PAUSE_PROTOCOL",
    "APPLY_PATCH",
    "RESUME_MODULE",
    "RESUME_PROTOCOL",
    "WAIT",
    "CLOSE_INCIDENT",
  ],
  maxServicePriceCredits: 30,
};

export type TranscriptEvent = {
  sequence: number;
  gameMinute: number;
  type:
    | "OBSERVATION"
    | "ACTION"
    | "PAYMENT_RESERVED"
    | "PAYMENT_RELEASED"
    | "PAYMENT_REFUNDED"
    | "SERVICE_RECEIPT"
    | "STATE_TRANSITION"
    | "EPISODE_END"
    | "INVALID_ACTION";
  data: Record<string, unknown>;
};

export type RescuePublicView = {
  episodeId: string;
  gameMinute: number;
  horizonMinutes: number;
  availableBudgetCredits: number;
  reservedBudgetCredits: number;
  netResponseSpendCredits: number;
  pausedModules: readonly RescueModule[];
  incidentResolved: boolean;
  observations: readonly PublicObservation[];
  serviceOrders: readonly ServiceOrder[];
  serviceReceipts: readonly ServiceReceipt[];
  actions: readonly RescueAction[];
};

type MutableEpisodeState = {
  episode: RescueEpisodeDefinition;
  minute: number;
  availableBudgetCredits: number;
  reservedBudgetCredits: number;
  netResponseSpendCredits: number;
  userLossUsd: number;
  servedDemandUnits: number;
  totalDemandUnits: number;
  pausedModules: Set<RescueModule>;
  resolved: boolean;
  closed: boolean;
  valid: boolean;
  invalidReason: string | null;
  orders: ServiceOrder[];
  receipts: ServiceReceipt[];
  observations: PublicObservation[];
  actions: RescueAction[];
  transcript: TranscriptEvent[];
};

export type RescueEpisodeOutcome = {
  episodeId: string;
  episodeHash: Hex;
  correctness: boolean;
  invalidReason: string | null;
  userLossUsd: number;
  servedProtocolDemandPpm: number;
  netResponseSpendCredits: number;
  incidentResolved: boolean;
  finalMinute: number;
  actionCount: number;
  servicePurchaseCount: number;
  transcript: readonly TranscriptEvent[];
  transcriptHash: Hex;
  resultHash: Hex;
};

export type RescuePolicy = {
  id: string;
  name: string;
  decide(view: RescuePublicView): RescueAction;
};

export type RescuePolicyEvaluation = {
  policyId: string;
  policyName: string;
  correctness: boolean;
  episodeCount: number;
  totalUserLossUsd: number;
  worstEpisodeUserLossUsd: number;
  servedProtocolDemandPpm: number;
  netResponseSpendCredits: number;
  resolvedEpisodeCount: number;
  servicePurchaseCount: number;
  episodeResultHashes: readonly Hex[];
  contextHash: Hex;
  resultHash: Hex;
};

const incidentFamilies = incidentFamilySchema.options;
const rescueModules = rescueModuleSchema.options;
const patchIds = patchIdSchema.options.filter((value) => value !== "no-patch");

function hashValue(value: unknown): Hex {
  return keccak256(stringToHex(canonicalProtocolJson(value)));
}

function lexicalSort<T extends string>(values: readonly T[]): T[] {
  return [...values].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

export function normalizeRescueCommanderPlaybook(input: unknown): RescueCommanderPlaybook {
  const parsed = rescueCommanderPlaybookSchema.parse(input);
  return {
    ...parsed,
    allowedServiceIds: lexicalSort(parsed.allowedServiceIds),
    allowedProtocolActions: lexicalSort(parsed.allowedProtocolActions),
  };
}

export function rescueCommanderPlaybookHash(input: unknown): Hex {
  return hashValue(normalizeRescueCommanderPlaybook(input));
}

export function rescuePublicViewHash(view: RescuePublicView): Hex {
  return hashValue(view);
}

export function hashRescueCommanderPlaybook(input: unknown): Hex {
  return rescueCommanderPlaybookHash(input);
}

export function hashRescuePublicView(view: RescuePublicView): Hex {
  return rescuePublicViewHash(view);
}

function draw(seed: string, key: string, maximumExclusive: number): number {
  if (!Number.isInteger(maximumExclusive) || maximumExclusive <= 0) {
    throw new Error("maximumExclusive must be a positive integer");
  }
  const hash = keccak256(stringToHex(`${rescueRoomGeneratorVersion}:${seed}:${key}`));
  return Number(BigInt(`0x${hash.slice(2, 14)}`) % BigInt(maximumExclusive));
}

function select<T>(values: readonly T[], seed: string, key: string): T {
  const value = values[draw(seed, key, values.length)];
  if (value === undefined) throw new Error("Cannot select from an empty collection");
  return value;
}

function initialSignalFor(family: IncidentFamily): InitialSignal {
  if (family === "oracle-manipulation" || family === "external-dependency") {
    return "price-anomaly";
  }
  if (family === "compromised-key" || family === "contract-exploit") {
    return "privileged-anomaly";
  }
  return "activity-anomaly";
}

function initialHeadline(signal: InitialSignal, intensity: number): string {
  const prefix = intensity === 3 ? "Rapid" : intensity === 2 ? "Elevated" : "Unusual";
  if (signal === "price-anomaly") return `${prefix} price divergence detected`;
  if (signal === "privileged-anomaly") return `${prefix} privileged call activity detected`;
  return `${prefix} withdrawal and address activity detected`;
}

export function generateRescueEpisode(seed: string): RescueEpisodeDefinition {
  if (seed.length < 1) throw new Error("Episode seed is required");
  const incidentFamily = select(incidentFamilies, seed, "incident-family");
  const severity = (draw(seed, "severity", 3) + 1) as 1 | 2 | 3;
  const affectedModule = select(familyModules[incidentFamily], seed, "affected-module");
  const rateVariationPpm = 850_000 + draw(seed, "loss-rate", 300_001);
  const lossRateUsdPerMinute = Math.round(
    (baseLossRates[incidentFamily] * severity * rateVariationPpm) / 1_000_000,
  );
  const demandMultiplierPpm = 800_000 + draw(seed, "demand", 600_001);
  const initialSignal = initialSignalFor(incidentFamily);
  return {
    schemaVersion: "rescue-episode-v0",
    generatorVersion: rescueRoomGeneratorVersion,
    publicId: `episode-${hashValue({ seed }).slice(2, 14)}`,
    seed,
    incidentFamily,
    severity,
    affectedModule,
    lossRateUsdPerMinute,
    demandMultiplierPpm,
    validPatchId: familyPatch[incidentFamily],
    initialSignal,
    initialHeadline: initialHeadline(initialSignal, severity),
  };
}

export function rescueEpisodeHash(episode: RescueEpisodeDefinition): Hex {
  return hashValue(episode);
}

function pushEvent(
  state: MutableEpisodeState,
  type: TranscriptEvent["type"],
  data: Record<string, unknown>,
): void {
  state.transcript.push({
    sequence: state.transcript.length,
    gameMinute: state.minute,
    type,
    data,
  });
}

function initialObservation(episode: RescueEpisodeDefinition): PublicObservation {
  const facts =
    episode.initialSignal === "price-anomaly"
      ? ["Two price sources disagree", "Cause unknown", "No confirmed exploit path"]
      : episode.initialSignal === "privileged-anomaly"
        ? ["Several unusual calls succeeded", "Caller intent unknown", "Loss not confirmed"]
        : ["Withdrawal volume increased", "Several new addresses appeared", "Cause unknown"];
  return {
    id: "initial-alert",
    gameMinute: 0,
    source: "PROTOCOL",
    headline: episode.initialHeadline,
    facts,
  };
}

function createState(episode: RescueEpisodeDefinition): MutableEpisodeState {
  const observation = initialObservation(episode);
  const state: MutableEpisodeState = {
    episode,
    minute: 0,
    availableBudgetCredits: rescueRoomInitialBudgetCredits,
    reservedBudgetCredits: 0,
    netResponseSpendCredits: 0,
    userLossUsd: 0,
    servedDemandUnits: 0,
    totalDemandUnits: 0,
    pausedModules: new Set(),
    resolved: episode.incidentFamily === "false-positive",
    closed: false,
    valid: true,
    invalidReason: null,
    orders: [],
    receipts: [],
    observations: [observation],
    actions: [],
    transcript: [],
  };
  pushEvent(state, "OBSERVATION", { observation });
  return state;
}

function sortedModules(modules: ReadonlySet<RescueModule>): RescueModule[] {
  return rescueModules.filter((module) => modules.has(module));
}

function publicView(state: MutableEpisodeState): RescuePublicView {
  return {
    episodeId: state.episode.publicId,
    gameMinute: state.minute,
    horizonMinutes: rescueRoomHorizonMinutes,
    availableBudgetCredits: state.availableBudgetCredits,
    reservedBudgetCredits: state.reservedBudgetCredits,
    netResponseSpendCredits: state.netResponseSpendCredits,
    pausedModules: sortedModules(state.pausedModules),
    // A false-positive episode is internally safe from the start, but that fact is part of the
    // hidden state. Expose resolution only after the Commander closes the response so policies
    // cannot identify false positives without buying evidence or making a judgment.
    incidentResolved: state.closed && state.resolved,
    observations: state.observations.map((value) => ({ ...value, facts: [...value.facts] })),
    serviceOrders: state.orders.map((value) => ({ ...value })),
    serviceReceipts: state.receipts.map((value) => ({ ...value })),
    actions: state.actions.map((value) => ({ ...value })),
  };
}

export function getInitialRescuePublicView(episode: RescueEpisodeDefinition): RescuePublicView {
  return publicView(createState(episode));
}

function classificationAccuracy(episode: RescueEpisodeDefinition, serviceId: ServiceId): number {
  if (serviceId === "pulse-monitor") return 680_000;
  if (serviceId === "second-opinion") return 800_000;
  if (serviceId === "trace-audit") {
    return ["contract-exploit", "compromised-key", "external-dependency"].includes(
      episode.incidentFamily,
    )
      ? 930_000
      : 520_000;
  }
  if (serviceId === "accounting-audit") {
    return ["accounting-drift", "liquidity-crisis", "oracle-manipulation"].includes(
      episode.incidentFamily,
    )
      ? 930_000
      : 500_000;
  }
  return 0;
}

function alternateFamily(episode: RescueEpisodeDefinition, key: string): IncidentFamily {
  const alternatives = incidentFamilies.filter((family) => family !== episode.incidentFamily);
  return select(alternatives, episode.seed, key);
}

function buildServiceReceipt(state: MutableEpisodeState, order: ServiceOrder): ServiceReceipt {
  const { episode } = state;
  const targetReceipt = state.receipts.find(({ receiptId }) => receiptId === order.targetReceiptId);
  const evidenceKey = [
    "service-evidence-v0",
    order.serviceId,
    order.targetModule ?? "all-modules",
    targetReceipt?.patchId ?? "no-target-patch",
  ].join(":");
  const base = {
    receiptId: `receipt-${order.orderId}`,
    orderId: order.orderId,
    serviceId: order.serviceId,
    task: order.task,
    deliveredAtMinute: state.minute,
  };
  let classification: IncidentFamily | "inconclusive" = "inconclusive";
  let likelyAffectedModule: RescueModule | null = null;
  let severity: 1 | 2 | 3 | null = null;
  let confidencePpm = 0;
  let patchId: PatchId | null = null;
  let patchValid: boolean | null = null;
  let summary: string;

  if (order.task === "BUILD_PATCH") {
    const correct = draw(episode.seed, `${evidenceKey}:patch-correct`, 1_000_000) < 820_000;
    patchId = correct
      ? episode.validPatchId
      : select(
          patchIds.filter((candidate) => candidate !== episode.validPatchId),
          episode.seed,
          `${evidenceKey}:wrong-patch`,
        );
    classification = correct ? episode.incidentFamily : alternateFamily(episode, evidenceKey);
    likelyAffectedModule = episode.affectedModule;
    severity = episode.severity;
    confidencePpm = correct ? 820_000 : 610_000;
    summary = `Patch Builder delivered ${patchId} for ${likelyAffectedModule}.`;
  } else if (order.task === "VERIFY_PATCH") {
    const actualValidity = targetReceipt?.patchId === episode.validPatchId;
    const accurate = draw(episode.seed, `${evidenceKey}:verify`, 1_000_000) < 950_000;
    patchValid = accurate ? actualValidity : !actualValidity;
    patchId = targetReceipt?.patchId ?? null;
    confidencePpm = accurate ? 950_000 : 550_000;
    summary = patchValid
      ? `Patch Verifier accepted ${patchId ?? "the submitted artifact"}.`
      : `Patch Verifier rejected ${patchId ?? "the submitted artifact"}.`;
  } else {
    const accuracy = classificationAccuracy(episode, order.serviceId);
    const conclusive = draw(episode.seed, `${evidenceKey}:conclusive`, 1_000_000) < 900_000;
    const accurate = draw(episode.seed, `${evidenceKey}:accurate`, 1_000_000) < accuracy;
    classification = conclusive
      ? accurate
        ? episode.incidentFamily
        : alternateFamily(episode, `${evidenceKey}:alternate`)
      : "inconclusive";
    likelyAffectedModule =
      classification === "inconclusive"
        ? null
        : accurate
          ? episode.affectedModule
          : select(familyModules[classification], episode.seed, `${evidenceKey}:module`);
    severity = classification === "inconclusive" ? null : episode.severity;
    confidencePpm = classification === "inconclusive" ? 350_000 : accurate ? accuracy : 520_000;
    summary =
      classification === "inconclusive"
        ? `${rescueServices.find(({ id }) => id === order.serviceId)?.name} found no conclusive root cause.`
        : `${rescueServices.find(({ id }) => id === order.serviceId)?.name} classified the event as ${classification}.`;
  }

  const receiptWithoutHash = {
    ...base,
    classification,
    likelyAffectedModule,
    severity,
    confidencePpm,
    patchId,
    patchValid,
    summary,
  };
  return { ...receiptWithoutHash, receiptHash: hashValue(receiptWithoutHash) };
}

function currentLossRate(state: MutableEpisodeState): number {
  const { episode } = state;
  if (state.resolved || episode.incidentFamily === "false-positive") return 0;
  const fullPause = state.pausedModules.size === rescueModules.length;
  const affectedPaused = state.pausedModules.has(episode.affectedModule);

  if (episode.incidentFamily === "liquidity-crisis") {
    if (fullPause || state.pausedModules.has("liquidations")) {
      return Math.round(episode.lossRateUsdPerMinute * 1.8);
    }
    if (state.pausedModules.has("borrowing") || state.pausedModules.has("withdrawals")) {
      return Math.round(episode.lossRateUsdPerMinute * 0.65);
    }
    return episode.lossRateUsdPerMinute;
  }
  return fullPause || affectedPaused ? 0 : episode.lossRateUsdPerMinute;
}

function demandForMinute(state: MutableEpisodeState): { total: number; served: number } {
  let total = 0;
  let served = 0;
  for (const protocolModule of rescueModules) {
    const demand = Math.max(
      1,
      Math.round(
        (moduleDemandUnits[protocolModule] * state.episode.demandMultiplierPpm) / 1_000_000,
      ),
    );
    total += demand;
    if (!state.pausedModules.has(protocolModule)) served += demand;
  }
  return { total, served };
}

function deliverDueOrders(state: MutableEpisodeState): void {
  for (const order of state.orders) {
    if (order.status !== "RESERVED" || order.dueAtMinute > state.minute) continue;
    const delivered = draw(state.episode.seed, `${order.orderId}:delivery`, 1_000_000) < 960_000;
    state.reservedBudgetCredits -= order.priceCredits;
    if (!delivered) {
      order.status = "REFUNDED";
      state.availableBudgetCredits += order.priceCredits;
      pushEvent(state, "PAYMENT_REFUNDED", {
        orderId: order.orderId,
        serviceId: order.serviceId,
        credits: order.priceCredits,
      });
      continue;
    }
    order.status = "DELIVERED";
    state.netResponseSpendCredits += order.priceCredits;
    pushEvent(state, "PAYMENT_RELEASED", {
      orderId: order.orderId,
      serviceId: order.serviceId,
      credits: order.priceCredits,
    });
    const receipt = buildServiceReceipt(state, order);
    state.receipts.push(receipt);
    pushEvent(state, "SERVICE_RECEIPT", { receipt });
    const observation: PublicObservation = {
      id: `observation-${receipt.receiptId}`,
      gameMinute: state.minute,
      source: "SERVICE",
      headline: receipt.summary,
      facts: [
        `Service: ${receipt.serviceId}`,
        `Confidence: ${receipt.confidencePpm} ppm`,
        `Receipt: ${receipt.receiptHash}`,
      ],
    };
    state.observations.push(observation);
    pushEvent(state, "OBSERVATION", { observation });
  }
}

function advanceTo(state: MutableEpisodeState, requestedMinute: number): void {
  const fromMinute = state.minute;
  const targetMinute = Math.min(rescueRoomHorizonMinutes, Math.max(fromMinute, requestedMinute));
  const lossBefore = state.userLossUsd;
  const servedBefore = state.servedDemandUnits;
  const demandBefore = state.totalDemandUnits;
  while (state.minute < targetMinute) {
    state.userLossUsd += currentLossRate(state);
    const demand = demandForMinute(state);
    state.servedDemandUnits += demand.served;
    state.totalDemandUnits += demand.total;
    state.minute += 1;
    deliverDueOrders(state);
  }
  if (targetMinute > fromMinute) {
    pushEvent(state, "STATE_TRANSITION", {
      fromMinute,
      toMinute: targetMinute,
      userLossDeltaUsd: state.userLossUsd - lossBefore,
      servedDemandDelta: state.servedDemandUnits - servedBefore,
      totalDemandDelta: state.totalDemandUnits - demandBefore,
      pausedModules: sortedModules(state.pausedModules),
      incidentResolved: state.closed && state.resolved,
    });
  }
}

function invalidate(state: MutableEpisodeState, reason: string): void {
  state.valid = false;
  state.invalidReason = reason;
  pushEvent(state, "INVALID_ACTION", { reason });
}

function applyAction(state: MutableEpisodeState, input: unknown): void {
  if (!state.valid || state.closed || state.minute >= rescueRoomHorizonMinutes) return;
  const parsed = rescueActionSchema.safeParse(input);
  if (!parsed.success) {
    invalidate(state, "Action does not match the Rescue Room schema");
    return;
  }
  const action = parsed.data;
  state.actions.push(action);
  pushEvent(state, "ACTION", { action });

  if (action.type === "BUY_SERVICE") {
    const service = rescueServices.find(({ id }) => id === action.serviceId);
    if (!service) {
      invalidate(state, "Unknown Service Agent");
      return;
    }
    if (service.task === "VERIFY_PATCH") {
      const target = state.receipts.find(({ receiptId }) => receiptId === action.targetReceiptId);
      if (!target?.patchId) {
        invalidate(state, "Patch verification requires a purchased Patch Receipt");
        return;
      }
    }
    if (state.availableBudgetCredits < service.priceCredits) {
      invalidate(state, "Service purchase exceeds the available Rescue Credits");
      return;
    }
    const order: ServiceOrder = {
      orderId: `order-${state.orders.length + 1}`,
      serviceId: service.id,
      task: service.task,
      orderedAtMinute: state.minute,
      dueAtMinute: state.minute + service.deliveryMinutes,
      priceCredits: service.priceCredits,
      targetModule: action.targetModule ?? null,
      targetReceiptId: action.targetReceiptId ?? null,
      status: "RESERVED",
    };
    state.orders.push(order);
    state.availableBudgetCredits -= service.priceCredits;
    state.reservedBudgetCredits += service.priceCredits;
    pushEvent(state, "PAYMENT_RESERVED", {
      orderId: order.orderId,
      serviceId: order.serviceId,
      credits: order.priceCredits,
      dueAtMinute: order.dueAtMinute,
    });
    advanceTo(state, state.minute + 1);
    return;
  }

  if (action.type === "PAUSE_MODULE") {
    state.pausedModules.add(action.module);
    advanceTo(state, state.minute + 1);
    return;
  }
  if (action.type === "PAUSE_PROTOCOL") {
    for (const protocolModule of rescueModules) state.pausedModules.add(protocolModule);
    advanceTo(state, state.minute + 1);
    return;
  }
  if (action.type === "RESUME_MODULE") {
    state.pausedModules.delete(action.module);
    advanceTo(state, state.minute + 1);
    return;
  }
  if (action.type === "RESUME_PROTOCOL") {
    state.pausedModules.clear();
    advanceTo(state, state.minute + 1);
    return;
  }
  if (action.type === "WAIT") {
    advanceTo(state, state.minute + action.minutes);
    return;
  }
  if (action.type === "APPLY_PATCH") {
    const receipt = state.receipts.find(({ receiptId }) => receiptId === action.receiptId);
    if (!receipt?.patchId) {
      invalidate(state, "Patch application requires a delivered Patch Receipt");
      return;
    }
    if (receipt.patchId === state.episode.validPatchId) {
      state.resolved = true;
    } else {
      state.userLossUsd += state.episode.severity * 5_000;
    }
    advanceTo(state, state.minute + 2);
    return;
  }
  state.closed = true;
  advanceTo(state, rescueRoomHorizonMinutes);
}

function finalizeState(state: MutableEpisodeState): RescueEpisodeOutcome {
  if (state.minute < rescueRoomHorizonMinutes) advanceTo(state, rescueRoomHorizonMinutes);
  pushEvent(state, "EPISODE_END", {
    correctness: state.valid,
    userLossUsd: state.userLossUsd,
    servedDemandUnits: state.servedDemandUnits,
    totalDemandUnits: state.totalDemandUnits,
    netResponseSpendCredits: state.netResponseSpendCredits,
    incidentResolved: state.resolved,
  });
  const transcriptHash = hashValue(state.transcript);
  const resultWithoutHash = {
    episodeId: state.episode.publicId,
    episodeHash: rescueEpisodeHash(state.episode),
    correctness: state.valid,
    invalidReason: state.invalidReason,
    userLossUsd: state.userLossUsd,
    servedProtocolDemandPpm:
      state.totalDemandUnits === 0
        ? 0
        : Math.floor((state.servedDemandUnits * 1_000_000) / state.totalDemandUnits),
    netResponseSpendCredits: state.netResponseSpendCredits,
    incidentResolved: state.resolved,
    finalMinute: state.minute,
    actionCount: state.actions.length,
    servicePurchaseCount: state.orders.length,
    transcript: state.transcript,
    transcriptHash,
  };
  return { ...resultWithoutHash, resultHash: hashValue(resultWithoutHash) };
}

export function replayRescueEpisode(
  episode: RescueEpisodeDefinition,
  actions: readonly RescueAction[],
): RescueEpisodeOutcome {
  const state = createState(episode);
  for (const action of actions.slice(0, rescueRoomMaximumDecisions)) applyAction(state, action);
  if (actions.length > rescueRoomMaximumDecisions) {
    invalidate(state, "Commander exceeded the maximum decision count");
  }
  return finalizeState(state);
}

export function runRescuePolicy(
  episode: RescueEpisodeDefinition,
  policy: RescuePolicy,
): RescueEpisodeOutcome {
  const state = createState(episode);
  for (
    let decision = 0;
    decision < rescueRoomMaximumDecisions &&
    state.valid &&
    !state.closed &&
    state.minute < rescueRoomHorizonMinutes;
    decision += 1
  ) {
    applyAction(state, policy.decide(publicView(state)));
  }
  return finalizeState(state);
}

export type RescueEpisodeSessionStep = {
  accepted: boolean;
  complete: boolean;
  invalidReason: string | null;
  publicView: RescuePublicView;
};

export type RescueEpisodeSession = {
  readonly episodeId: string;
  getPublicView(): RescuePublicView;
  takeAction(input: unknown): RescueEpisodeSessionStep;
  isComplete(): boolean;
  finish(): RescueEpisodeOutcome;
};

function playbookViolation(playbook: RescueCommanderPlaybook, action: RescueAction): string | null {
  if (action.type === "BUY_SERVICE") {
    if (!playbook.allowedServiceIds.includes(action.serviceId)) {
      return `Playbook does not authorize Service Agent ${action.serviceId}`;
    }
    const service = rescueServices.find(({ id }) => id === action.serviceId)!;
    if (service.priceCredits > playbook.maxServicePriceCredits) {
      return `Service Agent ${action.serviceId} exceeds the Playbook price ceiling`;
    }
    return null;
  }
  if (!playbook.allowedProtocolActions.includes(action.type)) {
    return `Playbook does not authorize protocol action ${action.type}`;
  }
  return null;
}

export function createRescueEpisodeSession(
  episode: RescueEpisodeDefinition,
  playbookInput?: RescueCommanderPlaybook,
): RescueEpisodeSession {
  const state = createState(episode);
  const playbook = playbookInput ? normalizeRescueCommanderPlaybook(playbookInput) : null;
  let completedOutcome: RescueEpisodeOutcome | null = null;
  const complete = () =>
    completedOutcome !== null ||
    !state.valid ||
    state.closed ||
    state.minute >= rescueRoomHorizonMinutes ||
    state.actions.length >= rescueRoomMaximumDecisions;

  return {
    episodeId: episode.publicId,
    getPublicView: () => publicView(state),
    isComplete: complete,
    takeAction(input: unknown) {
      if (complete()) {
        return {
          accepted: false,
          complete: true,
          invalidReason: state.invalidReason ?? "Episode is complete",
          publicView: publicView(state),
        };
      }
      const beforeActions = state.actions.length;
      const parsed = rescueActionSchema.safeParse(input);
      if (parsed.success && playbook) {
        const violation = playbookViolation(playbook, parsed.data);
        if (violation) invalidate(state, violation);
        else applyAction(state, parsed.data);
      } else {
        applyAction(state, input);
      }
      return {
        accepted: state.valid && state.actions.length === beforeActions + 1,
        complete: complete(),
        invalidReason: state.invalidReason,
        publicView: publicView(state),
      };
    },
    finish() {
      completedOutcome ??= finalizeState(state);
      return completedOutcome;
    },
  };
}

function outstanding(view: RescuePublicView): ServiceOrder[] {
  return view.serviceOrders.filter(({ status }) => status === "RESERVED");
}

function waitForNextService(view: RescuePublicView): RescueAction {
  const next = Math.min(...outstanding(view).map(({ dueAtMinute }) => dueAtMinute));
  return { type: "WAIT", minutes: Math.max(1, Math.min(15, next - view.gameMinute)) };
}

function latestClassification(view: RescuePublicView): ServiceReceipt | undefined {
  return [...view.serviceReceipts]
    .reverse()
    .find(({ classification }) => classification !== "inconclusive");
}

function latestPatch(view: RescuePublicView): ServiceReceipt | undefined {
  return [...view.serviceReceipts].reverse().find(({ patchId }) => patchId !== null);
}

function bought(view: RescuePublicView, serviceId: ServiceId): boolean {
  return view.serviceOrders.some((order) => order.serviceId === serviceId);
}

function pauseTarget(view: RescuePublicView): RescueAction {
  const receipt = latestClassification(view);
  return receipt?.likelyAffectedModule
    ? { type: "PAUSE_MODULE", module: receipt.likelyAffectedModule }
    : { type: "PAUSE_PROTOCOL" };
}

function createAlwaysPausePolicy(): RescuePolicy {
  return {
    id: "always-pause",
    name: "Always Pause",
    decide: (view) =>
      view.actions.length === 0 ? { type: "PAUSE_PROTOCOL" } : { type: "CLOSE_INCIDENT" },
  };
}

function createNeverPausePolicy(): RescuePolicy {
  return {
    id: "never-pause",
    name: "Never Pause",
    decide: () => ({ type: "CLOSE_INCIDENT" }),
  };
}

function createMonitorFirstPolicy(): RescuePolicy {
  return {
    id: "monitor-first",
    name: "Monitor First",
    decide(view) {
      if (!bought(view, "pulse-monitor")) {
        return { type: "BUY_SERVICE", serviceId: "pulse-monitor", targetModule: null };
      }
      if (outstanding(view).length > 0) return waitForNextService(view);
      const finding = latestClassification(view);
      if (!finding || finding.classification === "false-positive") {
        return { type: "CLOSE_INCIDENT" };
      }
      if (view.pausedModules.length === 0) return pauseTarget(view);
      if (!bought(view, "patch-builder")) {
        return {
          type: "BUY_SERVICE",
          serviceId: "patch-builder",
          targetModule: finding.likelyAffectedModule,
        };
      }
      const patch = latestPatch(view);
      if (!patch) return { type: "CLOSE_INCIDENT" };
      if (!view.actions.some((action) => action.type === "APPLY_PATCH")) {
        return { type: "APPLY_PATCH", receiptId: patch.receiptId };
      }
      if (view.pausedModules.length > 0) return { type: "RESUME_PROTOCOL" };
      return { type: "CLOSE_INCIDENT" };
    },
  };
}

function createAuditEverythingPolicy(): RescuePolicy {
  return {
    id: "audit-everything",
    name: "Audit Everything",
    decide(view) {
      for (const serviceId of ["trace-audit", "accounting-audit", "second-opinion"] as const) {
        if (!bought(view, serviceId)) return { type: "BUY_SERVICE", serviceId, targetModule: null };
      }
      if (outstanding(view).length > 0) return waitForNextService(view);
      const classifications = view.serviceReceipts.filter(
        ({ classification }) => classification !== "inconclusive",
      );
      const benign = classifications.filter(
        ({ classification }) => classification === "false-positive",
      ).length;
      if (benign >= 2) return { type: "CLOSE_INCIDENT" };
      if (view.pausedModules.length === 0) return pauseTarget(view);
      if (!bought(view, "patch-builder")) {
        return { type: "BUY_SERVICE", serviceId: "patch-builder", targetModule: null };
      }
      if (outstanding(view).length > 0) return waitForNextService(view);
      const patch = latestPatch(view);
      if (patch && !view.actions.some(({ type }) => type === "APPLY_PATCH")) {
        return { type: "APPLY_PATCH", receiptId: patch.receiptId };
      }
      return { type: "CLOSE_INCIDENT" };
    },
  };
}

function createCheapestServicePolicy(): RescuePolicy {
  return {
    id: "cheapest-service",
    name: "Cheapest Service Only",
    decide(view) {
      if (!bought(view, "pulse-monitor")) {
        return { type: "BUY_SERVICE", serviceId: "pulse-monitor", targetModule: null };
      }
      if (outstanding(view).length > 0) return waitForNextService(view);
      const finding = latestClassification(view);
      if (finding && finding.classification !== "false-positive") {
        if (view.pausedModules.length === 0) return pauseTarget(view);
      }
      return { type: "CLOSE_INCIDENT" };
    },
  };
}

function createSpendEverythingPolicy(): RescuePolicy {
  return {
    id: "spend-everything",
    name: "Spend Everything",
    decide(view) {
      for (const serviceId of [
        "pulse-monitor",
        "trace-audit",
        "accounting-audit",
        "second-opinion",
        "patch-builder",
      ] as const) {
        if (!bought(view, serviceId)) return { type: "BUY_SERVICE", serviceId, targetModule: null };
      }
      if (outstanding(view).length > 0) return waitForNextService(view);
      const patch = latestPatch(view);
      if (patch && !bought(view, "patch-verifier")) {
        return {
          type: "BUY_SERVICE",
          serviceId: "patch-verifier",
          targetReceiptId: patch.receiptId,
        };
      }
      if (outstanding(view).length > 0) return waitForNextService(view);
      const verification = [...view.serviceReceipts]
        .reverse()
        .find(({ serviceId }) => serviceId === "patch-verifier");
      if (
        patch &&
        verification?.patchValid &&
        !view.actions.some(({ type }) => type === "APPLY_PATCH")
      ) {
        return { type: "APPLY_PATCH", receiptId: patch.receiptId };
      }
      return { type: "CLOSE_INCIDENT" };
    },
  };
}

function createPatchImmediatelyPolicy(): RescuePolicy {
  return {
    id: "patch-immediately",
    name: "Patch Immediately",
    decide(view) {
      if (!bought(view, "patch-builder")) {
        return { type: "BUY_SERVICE", serviceId: "patch-builder", targetModule: null };
      }
      if (outstanding(view).length > 0) return waitForNextService(view);
      const patch = latestPatch(view);
      if (patch && !view.actions.some(({ type }) => type === "APPLY_PATCH")) {
        return { type: "APPLY_PATCH", receiptId: patch.receiptId };
      }
      if (view.pausedModules.length > 0) return { type: "RESUME_PROTOCOL" };
      return { type: "CLOSE_INCIDENT" };
    },
  };
}

function createSimpleAdaptivePolicy(): RescuePolicy {
  return {
    id: "simple-adaptive",
    name: "Simple Adaptive",
    decide(view) {
      const initial = view.observations[0]?.headline ?? "";
      const specialist: ServiceId = initial.includes("privileged")
        ? "trace-audit"
        : "accounting-audit";
      if (!bought(view, specialist)) {
        return { type: "BUY_SERVICE", serviceId: specialist, targetModule: null };
      }
      if (outstanding(view).length > 0) return waitForNextService(view);
      const finding = latestClassification(view);
      if (!finding || finding.classification === "false-positive") {
        return { type: "CLOSE_INCIDENT" };
      }
      if (view.pausedModules.length === 0 && finding.classification !== "liquidity-crisis") {
        return pauseTarget(view);
      }
      if (!bought(view, "patch-builder")) {
        return {
          type: "BUY_SERVICE",
          serviceId: "patch-builder",
          targetModule: finding.likelyAffectedModule,
        };
      }
      if (outstanding(view).length > 0) return waitForNextService(view);
      const patch = latestPatch(view);
      if (!patch) return { type: "CLOSE_INCIDENT" };
      if (!bought(view, "patch-verifier")) {
        return {
          type: "BUY_SERVICE",
          serviceId: "patch-verifier",
          targetReceiptId: patch.receiptId,
        };
      }
      if (outstanding(view).length > 0) return waitForNextService(view);
      const verification = [...view.serviceReceipts]
        .reverse()
        .find(({ serviceId }) => serviceId === "patch-verifier");
      if (verification?.patchValid && !view.actions.some(({ type }) => type === "APPLY_PATCH")) {
        return { type: "APPLY_PATCH", receiptId: patch.receiptId };
      }
      if (view.incidentResolved && view.pausedModules.length > 0) {
        return { type: "RESUME_PROTOCOL" };
      }
      return { type: "CLOSE_INCIDENT" };
    },
  };
}

function createOraclePolicy(episode: RescueEpisodeDefinition): RescuePolicy {
  return {
    id: "oracle",
    name: "Hidden-state Oracle",
    decide(view) {
      if (episode.incidentFamily === "false-positive") return { type: "CLOSE_INCIDENT" };
      const shouldPause = episode.incidentFamily !== "liquidity-crisis";
      if (shouldPause && view.pausedModules.length === 0) {
        return { type: "PAUSE_MODULE", module: episode.affectedModule };
      }
      if (!bought(view, "patch-builder")) {
        return {
          type: "BUY_SERVICE",
          serviceId: "patch-builder",
          targetModule: episode.affectedModule,
        };
      }
      if (outstanding(view).length > 0) return waitForNextService(view);
      const correctPatch = [...view.serviceReceipts]
        .reverse()
        .find(({ patchId }) => patchId === episode.validPatchId);
      if (correctPatch && !view.actions.some(({ type }) => type === "APPLY_PATCH")) {
        return { type: "APPLY_PATCH", receiptId: correctPatch.receiptId };
      }
      if (view.incidentResolved && view.pausedModules.length > 0) {
        return { type: "RESUME_PROTOCOL" };
      }
      return { type: "CLOSE_INCIDENT" };
    },
  };
}

function createSeededRandomPolicy(episode: RescueEpisodeDefinition): RescuePolicy {
  return {
    id: "seeded-random",
    name: "Seeded Random",
    decide(view) {
      const choice = draw(episode.seed, `random-policy:${view.actions.length}`, 5);
      if (choice === 0 && !bought(view, "pulse-monitor")) {
        return { type: "BUY_SERVICE", serviceId: "pulse-monitor", targetModule: null };
      }
      if (choice === 1 && view.pausedModules.length === 0) return { type: "PAUSE_PROTOCOL" };
      if (choice === 2 && view.pausedModules.length > 0) return { type: "RESUME_PROTOCOL" };
      if (choice === 3) return { type: "WAIT", minutes: 5 };
      return { type: "CLOSE_INCIDENT" };
    },
  };
}

export const rescueBaselinePolicyIds = [
  "always-pause",
  "never-pause",
  "monitor-first",
  "audit-everything",
  "cheapest-service",
  "spend-everything",
  "patch-immediately",
  "simple-adaptive",
  "oracle",
  "seeded-random",
] as const;
export type RescueBaselinePolicyId = (typeof rescueBaselinePolicyIds)[number];

export function createRescueBaselinePolicy(
  id: RescueBaselinePolicyId,
  episode: RescueEpisodeDefinition,
): RescuePolicy {
  if (id === "always-pause") return createAlwaysPausePolicy();
  if (id === "never-pause") return createNeverPausePolicy();
  if (id === "monitor-first") return createMonitorFirstPolicy();
  if (id === "audit-everything") return createAuditEverythingPolicy();
  if (id === "cheapest-service") return createCheapestServicePolicy();
  if (id === "spend-everything") return createSpendEverythingPolicy();
  if (id === "patch-immediately") return createPatchImmediatelyPolicy();
  if (id === "simple-adaptive") return createSimpleAdaptivePolicy();
  if (id === "oracle") return createOraclePolicy(episode);
  return createSeededRandomPolicy(episode);
}

export function rescueRoomMetrics(episodeCount: number): readonly OutcomeMetric[] {
  if (!Number.isInteger(episodeCount) || episodeCount <= 0) {
    throw new Error("episodeCount must be a positive integer");
  }
  return [
    {
      key: "totalUserLossUsd",
      name: "Total user loss",
      direction: "MINIMIZE",
      unit: "USD",
      lowerBound: 0,
      upperBound: 250_000 * episodeCount,
    },
    {
      key: "servedProtocolDemandPpm",
      name: "Served protocol demand",
      direction: "MAXIMIZE",
      unit: "ppm",
      lowerBound: 0,
      upperBound: 1_000_000,
    },
    {
      key: "netResponseSpendCredits",
      name: "Net response spend",
      direction: "MINIMIZE",
      unit: "Rescue Credits",
      lowerBound: 0,
      upperBound: rescueRoomInitialBudgetCredits * episodeCount,
    },
  ] as const;
}

export function evaluateRescuePolicy(
  policyId: RescueBaselinePolicyId,
  seeds: readonly string[],
): RescuePolicyEvaluation {
  if (seeds.length === 0) throw new Error("At least one Episode seed is required");
  const episodes = seeds.map(generateRescueEpisode);
  const results = episodes.map((episode) =>
    runRescuePolicy(episode, createRescueBaselinePolicy(policyId, episode)),
  );
  const context = {
    challengeId: rescueRoomChallengeId,
    generatorVersion: rescueRoomGeneratorVersion,
    evaluatorVersion: rescueRoomEvaluatorVersion,
    episodeHashes: episodes.map(rescueEpisodeHash),
    serviceCatalog: rescueServices,
    horizonMinutes: rescueRoomHorizonMinutes,
    maximumDecisions: rescueRoomMaximumDecisions,
    initialBudgetCredits: rescueRoomInitialBudgetCredits,
    metrics: rescueRoomMetrics(episodes.length),
  };
  const contextHash = hashValue(context);
  const resultWithoutHash = {
    policyId,
    policyName: createRescueBaselinePolicy(policyId, episodes[0]!).name,
    correctness: results.every(({ correctness }) => correctness),
    episodeCount: results.length,
    totalUserLossUsd: results.reduce((sum, { userLossUsd }) => sum + userLossUsd, 0),
    worstEpisodeUserLossUsd: Math.max(...results.map(({ userLossUsd }) => userLossUsd)),
    servedProtocolDemandPpm: Math.floor(
      results.reduce((sum, { servedProtocolDemandPpm }) => sum + servedProtocolDemandPpm, 0) /
        results.length,
    ),
    netResponseSpendCredits: results.reduce(
      (sum, { netResponseSpendCredits }) => sum + netResponseSpendCredits,
      0,
    ),
    resolvedEpisodeCount: results.filter(({ incidentResolved }) => incidentResolved).length,
    servicePurchaseCount: results.reduce(
      (sum, { servicePurchaseCount }) => sum + servicePurchaseCount,
      0,
    ),
    episodeResultHashes: results.map(({ resultHash }) => resultHash),
    contextHash,
  };
  return { ...resultWithoutHash, resultHash: hashValue(resultWithoutHash) };
}

export function rescueEvaluationPoint(evaluation: RescuePolicyEvaluation): OutcomePoint {
  return {
    id: evaluation.policyId,
    name: evaluation.policyName,
    correctness: evaluation.correctness,
    baseline: true,
    values: {
      totalUserLossUsd: evaluation.totalUserLossUsd,
      servedProtocolDemandPpm: evaluation.servedProtocolDemandPpm,
      netResponseSpendCredits: evaluation.netResponseSpendCredits,
    },
  };
}

export type RescueFeasibilityDiagnostics = {
  replayDeterministic: boolean;
  serviceHelpfulEpisodeCount: number;
  serviceWastefulEpisodeCount: number;
  distinctOracleFirstActions: number;
  familyCoverage: number;
  packFrontierSets: readonly (readonly string[])[];
};

export function assessRescueRoomFeasibility(
  evaluations: readonly RescuePolicyEvaluation[],
  diagnostics: RescueFeasibilityDiagnostics,
) {
  if (evaluations.length < 3) throw new Error("At least three policy evaluations are required");
  const episodeCount = evaluations[0]!.episodeCount;
  if (evaluations.some((evaluation) => evaluation.episodeCount !== episodeCount)) {
    throw new Error("All policy evaluations must use the same Episode count");
  }
  const metrics = rescueRoomMetrics(episodeCount);
  const points = evaluations.map(rescueEvaluationPoint);
  const frontier = computeOutcomeFrontier(points, metrics);
  const adaptiveOnFrontier = frontier.some(({ id }) => id === "simple-adaptive");
  const simpleIds = new Set([
    "always-pause",
    "never-pause",
    "audit-everything",
    "cheapest-service",
    "spend-everything",
    "patch-immediately",
  ]);
  const simpleUniversalWinner = points.some(
    (candidate) =>
      simpleIds.has(candidate.id) &&
      points.every(
        (other) =>
          other.id === candidate.id ||
          metrics.every((metric) => {
            const candidateValue = candidate.values[metric.key]!;
            const otherValue = other.values[metric.key]!;
            return metric.direction === "MINIMIZE"
              ? candidateValue <= otherValue
              : candidateValue >= otherValue;
          }),
      ),
  );
  const commonPackFrontierPolicyCount = diagnostics.packFrontierSets.reduce<Set<string>>(
    (common, ids, index) =>
      index === 0 ? new Set(ids) : new Set([...common].filter((id) => new Set(ids).has(id))),
    new Set(),
  ).size;
  const criteria = {
    replayDeterministic: diagnostics.replayDeterministic,
    noSimpleUniversalWinner: !simpleUniversalWinner,
    multipleFrontierPolicies: frontier.length >= 2,
    adaptivePolicyOnFrontier: adaptiveOnFrontier,
    informationSometimesHelpful: diagnostics.serviceHelpfulEpisodeCount > 0,
    informationSometimesWasteful: diagnostics.serviceWastefulEpisodeCount > 0,
    incidentDependentFirstAction: diagnostics.distinctOracleFirstActions >= 2,
    allIncidentFamiliesCovered: diagnostics.familyCoverage === incidentFamilies.length,
    packFrontierHasStableCore: commonPackFrontierPolicyCount >= 2,
    allPoliciesCorrect: evaluations.every(({ correctness }) => correctness),
  };
  const decision = Object.values(criteria).every(Boolean) ? "GO" : "PIVOT";
  const resultWithoutHash = {
    schemaVersion: "rescue-room-feasibility-v0",
    decision,
    rationale:
      decision === "GO"
        ? "The deterministic simulator produced multiple non-dominated policies, an adaptive frontier policy, incident-dependent actions, and both useful and wasteful information purchases."
        : "One or more predeclared Rescue Room feasibility conditions did not hold.",
    episodeCount,
    metrics,
    criteria,
    diagnostics,
    frontierPolicyIds: frontier.map(({ id }) => id),
    evaluations,
  };
  return { ...resultWithoutHash, evidenceHash: hashValue(resultWithoutHash) };
}

export const rescuePracticePolicyIds = [
  "always-pause",
  "never-pause",
  "monitor-first",
  "audit-everything",
  "cheapest-service",
  "spend-everything",
  "patch-immediately",
  "simple-adaptive",
] as const satisfies readonly RescueBaselinePolicyId[];
export type RescuePracticePolicyId = (typeof rescuePracticePolicyIds)[number];

const practiceFamilyNames: Record<IncidentFamily, string> = {
  "false-positive": "False positive",
  "oracle-manipulation": "Oracle manipulation",
  "accounting-drift": "Accounting drift",
  "compromised-key": "Compromised operator key",
  "liquidity-crisis": "Liquidity crisis",
  "contract-exploit": "Contract exploit",
  "external-dependency": "External dependency failure",
};

function practiceSeeds(): string[] {
  return incidentFamilies.flatMap((family) => {
    const seeds: string[] = [];
    for (let candidate = 0; seeds.length < 5; candidate += 1) {
      const seed = `rescue-practice-v0:${family}:${candidate}`;
      if (generateRescueEpisode(seed).incidentFamily === family) seeds.push(seed);
    }
    return seeds;
  });
}

const rescuePracticeSeeds = practiceSeeds();
const rescuePracticeEpisodes = rescuePracticeSeeds.map(generateRescueEpisode);
const rescuePracticeMetrics = rescueRoomMetrics(rescuePracticeEpisodes.length);

const rescuePracticeContext = {
  challengeId: rescueRoomChallengeId,
  generatorVersion: rescueRoomGeneratorVersion,
  evaluatorVersion: rescueRoomEvaluatorVersion,
  episodeHashes: rescuePracticeEpisodes.map(rescueEpisodeHash),
  serviceCatalog: rescueServices,
  horizonMinutes: rescueRoomHorizonMinutes,
  maximumDecisions: rescueRoomMaximumDecisions,
  initialBudgetCredits: rescueRoomInitialBudgetCredits,
  metrics: rescuePracticeMetrics,
};

export const rescuePracticeContextHash = hashValue(rescuePracticeContext);

export const rescueRoomCommanderContext = {
  practiceContextHash: rescuePracticeContextHash,
  runtimeVersion: rescueRoomCommanderRuntimeVersion,
  promptVersion: rescueRoomCommanderPromptVersion,
  configuredModel: rescueRoomCommanderModel,
  modelSettings: rescueRoomCommanderModelSettings,
  maximumModelTurns: rescueRoomCommanderMaximumModelTurns,
  episodeTimeoutMs: rescueRoomCommanderEpisodeTimeoutMs,
  decisionInterface: "one-structured-action-per-stateless-model-turn",
  actionSchemaVersion: "rescue-action-v0",
  playbookSchemaVersion: rescueCommanderStarterPlaybook.schemaVersion,
} as const;

export const rescueRoomCommanderContextHash = hashValue(rescueRoomCommanderContext);

export const rescueRoomManifest = parseChallengeManifest({
  schemaVersion: "2",
  id: rescueRoomChallengeId,
  slug: "rescue-room",
  name: "Rescue Room",
  lifecycle: "PRACTICE",
  sponsor: {
    name: "Frontier Protocol practice",
    wallet: null,
    statement: "A deterministic incident-response practice Arena with simulated service purchases.",
  },
  valueTension:
    "Protect users, keep the protocol available, and steward the response treasury without combining the outcomes into one score.",
  artifactType: "rescue-commander-policy-v0",
  hardConstraints: [
    "Use only the published Commander action schema",
    "Do not spend more than the 100 Rescue Credit Episode budget",
    "Make at most 12 decisions within the 60-minute game clock",
    "Do not access the hidden incident state during evaluation",
    `AI Commander entries use ${rescueRoomCommanderModel} and the committed runtime settings`,
  ],
  metrics: rescuePracticeMetrics,
  contexts: [
    {
      id: "public-practice-pack-v0",
      version: "rescue-practice-pack-2026-09-v0",
      name: "Public deterministic practice pack",
      description:
        "Thirty-five deterministic Episodes spanning seven incident families. Hidden state is revealed only after each practice run.",
      datasetHash: rescuePracticeContextHash,
      constraintHash: hashValue({
        budget: rescueRoomInitialBudgetCredits,
        horizon: rescueRoomHorizonMinutes,
        maximumDecisions: rescueRoomMaximumDecisions,
      }),
      metricsHash: hashValue(rescuePracticeMetrics),
      evidenceLevel: 0,
    },
  ],
  activeContextId: "public-practice-pack-v0",
  workload: { publicHash: rescuePracticeContextHash, finalCommitment: null },
  submission: {
    methods: ["INLINE"],
    sourceVisibility: "PUBLIC",
    opensAt: null,
    closesAt: null,
    maxRevisions: 20,
  },
  reviewEndsAt: null,
  reward: { kind: "PREVIEW", poolCredits: 10_000 },
});

export const rescueRoomManifestHash = hashChallengeManifest(rescueRoomManifest);

export type RescueValuePoolAllocation = {
  poolId: "user-protection" | "availability" | "treasury-stewardship" | "frontier-expansion";
  name: string;
  valueStatement: string;
  rule: string;
  budgetCredits: number;
  allocations: readonly { policyId: RescuePracticePolicyId; credits: number }[];
};

export type RescuePracticePolicyResult = RescuePolicyEvaluation & {
  pareto: {
    frontier: boolean;
    dominatedBy: readonly RescuePracticePolicyId[];
  };
  contribution: ContributionEvidence;
};

function allocateEvenly(
  policyIds: readonly RescuePracticePolicyId[],
  budgetCredits = 2_500,
): { policyId: RescuePracticePolicyId; credits: number }[] {
  if (policyIds.length === 0) return [];
  const sorted = [...policyIds].sort();
  const base = Math.floor(budgetCredits / sorted.length);
  let remainder = budgetCredits - base * sorted.length;
  return sorted.map((policyId) => ({
    policyId,
    credits: base + (remainder-- > 0 ? 1 : 0),
  }));
}

function allocateProportionally(
  entries: readonly { policyId: RescuePracticePolicyId; weight: number }[],
  budgetCredits = 2_500,
): { policyId: RescuePracticePolicyId; credits: number }[] {
  const eligible = entries
    .filter(({ weight }) => weight > 0)
    .sort((left, right) => left.policyId.localeCompare(right.policyId));
  const total = eligible.reduce((sum, { weight }) => sum + weight, 0);
  if (total === 0) return [];
  const provisional = eligible.map((entry) => {
    const exact = (entry.weight * budgetCredits) / total;
    return { ...entry, credits: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  const remaining = budgetCredits - provisional.reduce((sum, { credits }) => sum + credits, 0);
  const remainderOrder = [...provisional].sort(
    (left, right) =>
      right.remainder - left.remainder || left.policyId.localeCompare(right.policyId),
  );
  for (let index = 0; index < remaining; index += 1) remainderOrder[index]!.credits += 1;
  return provisional.map(({ policyId, credits }) => ({ policyId, credits }));
}

const rescuePracticeEvaluations = rescuePracticePolicyIds.map((policyId) =>
  evaluateRescuePolicy(policyId, rescuePracticeSeeds),
);
const rescuePracticePoints = rescuePracticeEvaluations.map(rescueEvaluationPoint);
const rescuePracticeFrontier = computeOutcomeFrontier(rescuePracticePoints, rescuePracticeMetrics);

function dominates(left: OutcomePoint, right: OutcomePoint): boolean {
  return (
    computeOutcomeFrontier([left, right], rescuePracticeMetrics).length === 1 &&
    computeOutcomeFrontier([left, right], rescuePracticeMetrics)[0]!.id === left.id
  );
}

const rescuePracticePolicyResults: readonly RescuePracticePolicyResult[] =
  rescuePracticeEvaluations.map((evaluation) => {
    const point = rescueEvaluationPoint(evaluation);
    return {
      ...evaluation,
      pareto: {
        frontier: rescuePracticeFrontier.some(({ id }) => id === evaluation.policyId),
        dominatedBy: rescuePracticePoints
          .filter((other) => other.id !== point.id && dominates(other, point))
          .map(({ id }) => id as RescuePracticePolicyId),
      },
      contribution: computeContributionEvidence(
        rescuePracticePoints.filter(({ id }) => id !== point.id),
        point,
        rescuePracticeMetrics,
      ),
    };
  });

function bestPolicyIds(
  eligible: readonly RescuePracticePolicyResult[],
  key: "totalUserLossUsd" | "servedProtocolDemandPpm" | "netResponseSpendCredits",
  direction: "MINIMIZE" | "MAXIMIZE",
): RescuePracticePolicyId[] {
  if (eligible.length === 0) return [];
  const best =
    direction === "MINIMIZE"
      ? Math.min(...eligible.map((entry) => entry[key]))
      : Math.max(...eligible.map((entry) => entry[key]));
  return eligible
    .filter((entry) => entry[key] === best)
    .map(({ policyId }) => policyId as RescuePracticePolicyId);
}

export const rescuePracticeValuePools: readonly RescueValuePoolAllocation[] = [
  {
    poolId: "user-protection",
    name: "User Protection Pool",
    valueStatement: "Support Commanders that minimize user loss without broadly freezing use.",
    rule: "Lowest total user loss among entries serving at least 80% of demand.",
    budgetCredits: 2_500,
    allocations: allocateEvenly(
      bestPolicyIds(
        rescuePracticePolicyResults.filter(
          ({ servedProtocolDemandPpm }) => servedProtocolDemandPpm >= 800_000,
        ),
        "totalUserLossUsd",
        "MINIMIZE",
      ),
    ),
  },
  {
    poolId: "availability",
    name: "Availability Pool",
    valueStatement: "Support Commanders that preserve protocol access within a safety budget.",
    rule: "Highest served demand among entries losing no more than 20,000 USD per Episode.",
    budgetCredits: 2_500,
    allocations: allocateEvenly(
      bestPolicyIds(
        rescuePracticePolicyResults.filter(
          ({ totalUserLossUsd, episodeCount }) => totalUserLossUsd <= 20_000 * episodeCount,
        ),
        "servedProtocolDemandPpm",
        "MAXIMIZE",
      ),
    ),
  },
  {
    poolId: "treasury-stewardship",
    name: "Treasury Stewardship Pool",
    valueStatement: "Support efficient response spending after safety and availability gates pass.",
    rule: "Lowest spend among entries losing no more than 15,000 USD per Episode and serving at least 80% of demand.",
    budgetCredits: 2_500,
    allocations: allocateEvenly(
      bestPolicyIds(
        rescuePracticePolicyResults.filter(
          ({ totalUserLossUsd, episodeCount, servedProtocolDemandPpm }) =>
            totalUserLossUsd <= 15_000 * episodeCount && servedProtocolDemandPpm >= 800_000,
        ),
        "netResponseSpendCredits",
        "MINIMIZE",
      ),
    ),
  },
  {
    poolId: "frontier-expansion",
    name: "Frontier Expansion Pool",
    valueStatement: "Support independently useful tradeoffs added to the three-axis frontier.",
    rule: "Among entries losing no more than 20,000 USD per Episode and serving at least 75% of demand, split by positive exclusive three-axis hypervolume contribution.",
    budgetCredits: 2_500,
    allocations: allocateProportionally(
      rescuePracticePolicyResults
        .filter(
          ({ totalUserLossUsd, episodeCount, servedProtocolDemandPpm }) =>
            totalUserLossUsd <= 20_000 * episodeCount && servedProtocolDemandPpm >= 750_000,
        )
        .map(({ policyId, contribution }) => ({
          policyId: policyId as RescuePracticePolicyId,
          weight: contribution.exclusiveContributionPpm,
        })),
    ),
  },
];

export function publicRescueRoomScenario() {
  return {
    arenaId: rescueRoomChallengeId,
    name: "Rescue Room",
    contextId: "public-practice-pack-v0" as const,
    dataVersion: "rescue-practice-pack-2026-09-v0",
    contextHash: rescuePracticeContextHash,
    manifest: rescueRoomManifest,
    manifestHash: rescueRoomManifestHash,
    evidenceLevel: 0 as const,
    state: "simulated" as const,
    paymentState: "game-credits" as const,
    initialBudgetCredits: rescueRoomInitialBudgetCredits,
    horizonMinutes: rescueRoomHorizonMinutes,
    maximumDecisions: rescueRoomMaximumDecisions,
    modules: rescueModules,
    commanderRuntime: {
      mode: "openai-agents-sdk" as const,
      status: "local-practice" as const,
      contextHash: rescueRoomCommanderContextHash,
      runtimeVersion: rescueRoomCommanderRuntimeVersion,
      promptVersion: rescueRoomCommanderPromptVersion,
      model: rescueRoomCommanderModel,
      modelSettings: rescueRoomCommanderModelSettings,
      maximumModelTurns: rescueRoomCommanderMaximumModelTurns,
      episodeTimeoutMs: rescueRoomCommanderEpisodeTimeoutMs,
      playbookSchema: rescueCommanderPlaybookJsonSchema,
      starterPlaybook: rescueCommanderStarterPlaybook,
      replayBoundary:
        "The recorded Action sequence is replayable; a fresh LLM run is not claimed to be identical.",
    },
    axes: rescuePracticeMetrics,
    services: rescueServices,
    policies: rescuePracticePolicyResults.map(({ policyId, policyName }) => ({
      id: policyId as RescuePracticePolicyId,
      name: policyName,
    })),
    episodes: rescuePracticeEpisodes.map((episode) => {
      const view = getInitialRescuePublicView(episode);
      return {
        id: episode.publicId,
        headline: view.observations[0]!.headline,
        facts: view.observations[0]!.facts,
      };
    }),
    policyResults: rescuePracticePolicyResults,
    frontierPolicyIds: rescuePracticeFrontier.map(({ id }) => id as RescuePracticePolicyId),
    valuePools: rescuePracticeValuePools,
  };
}

export function evaluateRescuePracticeEpisode(policyId: RescuePracticePolicyId, episodeId: string) {
  const episodeIndex = rescuePracticeEpisodes.findIndex(({ publicId }) => publicId === episodeId);
  if (episodeIndex < 0) throw new Error("Unknown Rescue Room practice Episode");
  const episode = rescuePracticeEpisodes[episodeIndex]!;
  const policy = createRescueBaselinePolicy(policyId, episode);
  const outcome = runRescuePolicy(episode, policy);
  const aggregate = rescuePracticePolicyResults.find((entry) => entry.policyId === policyId)!;
  const resultWithoutHash = {
    schemaVersion: "rescue-practice-evaluation-v0" as const,
    arenaId: rescueRoomChallengeId,
    contextId: "public-practice-pack-v0" as const,
    contextHash: rescuePracticeContextHash,
    manifestHash: rescueRoomManifestHash,
    policy: { id: policyId, name: policy.name },
    episode: {
      id: episode.publicId,
      initialHeadline: episode.initialHeadline,
      revealedAfterRun: {
        incidentFamily: episode.incidentFamily,
        incidentName: practiceFamilyNames[episode.incidentFamily],
        severity: episode.severity,
        affectedModule: episode.affectedModule,
        validPatchId: episode.validPatchId,
      },
    },
    outcome,
    aggregate,
    valuePoolAllocations: rescuePracticeValuePools.map((pool) => ({
      poolId: pool.poolId,
      credits:
        pool.allocations.find((allocation) => allocation.policyId === policyId)?.credits ?? 0,
    })),
  };
  return { ...resultWithoutHash, evaluationHash: hashValue(resultWithoutHash) };
}

function rescuePracticeEpisode(episodeId: string): RescueEpisodeDefinition {
  const episode = rescuePracticeEpisodes.find(({ publicId }) => publicId === episodeId);
  if (!episode) throw new Error("Unknown Rescue Room practice Episode");
  return episode;
}

export function createRescuePracticeSession(
  episodeId: string,
  playbookInput: unknown,
): RescueEpisodeSession {
  return createRescueEpisodeSession(
    rescuePracticeEpisode(episodeId),
    normalizeRescueCommanderPlaybook(playbookInput),
  );
}

export function replayRescuePracticeCommander(
  episodeId: string,
  playbookInput: unknown,
  decisions: readonly RescueCommanderDecisionEvidence[],
): RescueEpisodeOutcome {
  const playbook = normalizeRescueCommanderPlaybook(playbookInput);
  const session = createRescuePracticeSession(episodeId, playbook);
  decisions.forEach((evidence, index) => {
    const decision = rescueCommanderDecisionSchema.parse({
      action: evidence.action,
      reasonCode: evidence.reasonCode,
      confidencePpm: evidence.confidencePpm,
    });
    const view = session.getPublicView();
    if (evidence.decision !== index + 1) {
      throw new Error("Commander decision sequence is not contiguous");
    }
    if (evidence.gameMinute !== view.gameMinute) {
      throw new Error("Commander decision game time does not match the replay");
    }
    if (evidence.publicViewHash !== rescuePublicViewHash(view)) {
      throw new Error("Commander decision public view does not match the replay");
    }
    const step = session.takeAction(decision.action);
    if (evidence.accepted !== step.accepted || evidence.invalidReason !== step.invalidReason) {
      throw new Error("Commander decision acceptance evidence does not match the replay");
    }
  });
  return session.finish();
}

export function finalizeRescueCommanderPracticeEvaluation(input: {
  playbook: unknown;
  episodeId: string;
  outcome: RescueEpisodeOutcome;
  decisions: readonly RescueCommanderDecisionEvidence[];
  runtime: RescueCommanderRuntimeEvidence;
}) {
  const playbook = normalizeRescueCommanderPlaybook(input.playbook);
  const episode = rescuePracticeEpisode(input.episodeId);
  const replayedOutcome = replayRescuePracticeCommander(input.episodeId, playbook, input.decisions);
  if (replayedOutcome.resultHash !== input.outcome.resultHash) {
    throw new Error("Recorded Commander decisions do not reproduce the supplied outcome");
  }
  const resultWithoutHash = {
    schemaVersion: "rescue-ai-practice-evaluation-v0" as const,
    arenaId: rescueRoomChallengeId,
    contextId: "public-practice-pack-v0" as const,
    contextHash: rescuePracticeContextHash,
    commanderContextHash: rescueRoomCommanderContextHash,
    manifestHash: rescueRoomManifestHash,
    playbook,
    playbookHash: rescueCommanderPlaybookHash(playbook),
    runtime: input.runtime,
    runtimeHash: hashValue(input.runtime),
    decisions: input.decisions,
    scoringBoundary: {
      included: ["totalUserLossUsd", "servedProtocolDemandPpm", "netResponseSpendCredits"],
      excluded: [
        "playbook prose",
        "reasonCode",
        "confidencePpm",
        "model token usage",
        "model request count",
      ],
    },
    episode: {
      id: episode.publicId,
      initialHeadline: episode.initialHeadline,
      revealedAfterRun: {
        incidentFamily: episode.incidentFamily,
        incidentName: practiceFamilyNames[episode.incidentFamily],
        severity: episode.severity,
        affectedModule: episode.affectedModule,
        validPatchId: episode.validPatchId,
      },
    },
    outcome: input.outcome,
    replay: {
      deterministic: true as const,
      actionCount: input.decisions.length,
      resultHash: replayedOutcome.resultHash,
      matchesRecordedOutcome: true as const,
    },
    rewardEligibility: {
      eligible: false as const,
      reason: "Controlled Practice only; hidden multi-Episode Final is not implemented.",
    },
  };
  return { ...resultWithoutHash, evaluationHash: hashValue(resultWithoutHash) };
}
