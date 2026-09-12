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

export {
  createRescuePaymentPolicyState,
  reserveRescuePaymentIntent,
  rescuePaymentPolicySchema,
  type RescuePaymentIntent,
  type RescuePaymentPolicy,
  type RescuePaymentPolicyState,
  type RescuePaymentPurchase,
} from "./payment-policy";

export const rescueRoomChallengeId = "rescue-room-v0" as const;
export const rescueRoomGeneratorVersion = "rescue-room-generator-v0" as const;
export const rescueRoomEvaluatorVersion = "rescue-room-evaluator-v2" as const;
export const rescueRoomInitialBudgetCredits = 100;
export const rescueRoomHorizonMinutes = 60;
export const rescueRoomMaximumDecisions = 12;
export const rescueRoomCommanderRuntimeVersion = "rescue-commander-runtime-v2" as const;
export const rescueRoomCommanderPromptVersion = "rescue-commander-prompt-v1" as const;
export const rescueDoctrineInterpreterVersion = "rescue-doctrine-interpreter-v0" as const;
export const rescueRoomCommanderModel = "gpt-5.6-luna" as const;
export const rescueRoomCommanderMaximumModelTurns = 12;
export const rescueRoomCommanderMaximumOutputTokens = 400;
export const rescueRoomCommanderModelTimeoutMs = 20_000;
export const rescueRoomCommanderEpisodeTimeoutMs = 90_000;
export const rescueUsdDemoToken = {
  name: "RescueUSD Demo",
  symbol: "rUSD-DEMO",
  decimals: 6,
  network: "sepolia",
  chainId: 11_155_111,
  monetaryValueClaim: false,
} as const;
export const rescueRoomCommanderModelSettings = {
  reasoningEffort: "none",
  textVerbosity: "low",
  parallelToolCalls: false,
  store: false,
  maximumOutputTokens: rescueRoomCommanderMaximumOutputTokens,
  modelTimeoutMs: rescueRoomCommanderModelTimeoutMs,
} as const;

const bytes32Schema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const ethereumAddressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/);

export const rescuePaymentStateSchema = z.enum([
  "not-requested",
  "submitted",
  "funded",
  "delivered",
  "released",
  "refunded",
  "failed",
]);
export type RescuePaymentState = z.infer<typeof rescuePaymentStateSchema>;

export const rescueSepoliaPaymentEvidenceSchema = z
  .object({
    schemaVersion: z.literal("rescue-sepolia-payment-evidence-v0"),
    network: z.literal("sepolia"),
    chainId: z.literal(11_155_111),
    paymentState: rescuePaymentStateSchema,
    token: z
      .object({
        symbol: z.literal("rUSD-DEMO"),
        address: ethereumAddressSchema,
        decimals: z.literal(6),
        monetaryValueClaim: z.literal(false),
      })
      .strict(),
    orderId: bytes32Schema,
    episodeContextHash: bytes32Schema,
    commanderActionHash: bytes32Schema,
    serviceManifestHash: bytes32Schema,
    commanderWallet: ethereumAddressSchema,
    serviceAgentWallet: ethereumAddressSchema,
    escrowAddress: ethereumAddressSchema,
    amount: z.string().regex(/^[1-9][0-9]*$/),
    deliverableHash: bytes32Schema.nullable(),
    receiptHash: bytes32Schema.nullable(),
    acceptanceHash: bytes32Schema.nullable(),
    depositTransactionHash: bytes32Schema.nullable(),
    releaseTransactionHash: bytes32Schema.nullable(),
    refundTransactionHash: bytes32Schema.nullable(),
    blockNumber: z.number().int().nonnegative().nullable(),
    eventLogIndex: z.number().int().nonnegative().nullable(),
    providerBalanceBefore: z
      .string()
      .regex(/^[0-9]+$/)
      .nullable(),
    providerBalanceAfter: z
      .string()
      .regex(/^[0-9]+$/)
      .nullable(),
    failureReason: z.string().trim().min(1).nullable(),
  })
  .strict()
  .superRefine((evidence, context) => {
    if (evidence.commanderWallet.toLowerCase() === evidence.serviceAgentWallet.toLowerCase()) {
      context.addIssue({
        code: "custom",
        path: ["serviceAgentWallet"],
        message: "Commander and Service Agent must use different wallets",
      });
    }
    if (
      ["submitted", "funded", "delivered", "released"].includes(evidence.paymentState) &&
      !evidence.depositTransactionHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["depositTransactionHash"],
        message: "A submitted Sepolia payment requires a deposit transaction hash",
      });
    }
    if (
      ["delivered", "released"].includes(evidence.paymentState) &&
      (!evidence.deliverableHash || !evidence.receiptHash)
    ) {
      context.addIssue({
        code: "custom",
        path: ["deliverableHash"],
        message: "Delivered payment evidence requires deliverable and receipt hashes",
      });
    }
    if (
      evidence.paymentState === "released" &&
      (!evidence.releaseTransactionHash ||
        !evidence.acceptanceHash ||
        evidence.blockNumber === null ||
        evidence.eventLogIndex === null ||
        evidence.providerBalanceBefore === null ||
        evidence.providerBalanceAfter === null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["releaseTransactionHash"],
        message: "Released payment evidence requires a confirmed event and provider balances",
      });
    }
    if (evidence.paymentState === "refunded" && !evidence.refundTransactionHash) {
      context.addIssue({
        code: "custom",
        path: ["refundTransactionHash"],
        message: "Refunded payment evidence requires a refund transaction hash",
      });
    }
    if (evidence.paymentState === "failed" && !evidence.failureReason) {
      context.addIssue({
        code: "custom",
        path: ["failureReason"],
        message: "Failed payment evidence requires a public failure reason",
      });
    }
  });
export type RescueSepoliaPaymentEvidence = z.infer<typeof rescueSepoliaPaymentEvidenceSchema>;

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
  orderId: Hex;
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
  deliverableHash: Hex;
  receiptHash: Hex;
};

export type ServiceOrder = {
  orderId: Hex;
  episodeHash: Hex;
  commanderActionHash: Hex;
  serviceManifestHash: Hex;
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
    investigationBudgetCredits: z
      .number()
      .int()
      .min(0)
      .max(rescueRoomInitialBudgetCredits)
      .default(rescueRoomInitialBudgetCredits),
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

export const rescueDoctrinePresetIdSchema = z.enum([
  "evidence-first",
  "user-guardian",
  "keep-running",
]);
export type RescueDoctrinePresetId = z.infer<typeof rescueDoctrinePresetIdSchema>;

export const rescueDoctrineDiagnosticServiceIdSchema = z.enum([
  "pulse-monitor",
  "trace-audit",
  "accounting-audit",
  "second-opinion",
]);
export type RescueDoctrineDiagnosticServiceId = z.infer<
  typeof rescueDoctrineDiagnosticServiceIdSchema
>;

export const rescueDoctrineSchema = z
  .object({
    schemaVersion: z.literal("rescue-doctrine-v0"),
    name: z.string().trim().min(3).max(80),
    constraints: z
      .object({
        investigationBudgetCredits: z.number().int().min(0).max(rescueRoomInitialBudgetCredits),
        maxServicePriceCredits: z.number().int().min(0).max(rescueRoomInitialBudgetCredits),
        allowedServiceIds: z.array(serviceIdSchema).min(1).max(rescueServices.length),
        allowedProtocolActions: z
          .array(rescueProtocolActionTypeSchema)
          .min(1)
          .max(rescueProtocolActionTypeSchema.options.length),
      })
      .strict(),
    rules: z
      .object({
        minimumEvidenceCount: z.number().int().min(1).max(3),
        minimumConfidencePpm: z.number().int().min(500_000).max(950_000),
        disagreementAction: z.enum(["second-opinion", "wait", "contain"]),
        containmentScope: z.enum(["none", "module", "protocol"]),
        servicePriority: z
          .array(rescueDoctrineDiagnosticServiceIdSchema)
          .min(1)
          .max(rescueDoctrineDiagnosticServiceIdSchema.options.length),
        requirePatchVerification: z.boolean(),
        budgetExhaustedAction: z.enum(["wait", "close", "contain"]),
      })
      .strict(),
  })
  .strict()
  .superRefine((doctrine, context) => {
    const { allowedProtocolActions, allowedServiceIds } = doctrine.constraints;
    if (new Set(allowedServiceIds).size !== allowedServiceIds.length) {
      context.addIssue({
        code: "custom",
        path: ["constraints", "allowedServiceIds"],
        message: "Service Agent ids must be unique",
      });
    }
    if (new Set(allowedProtocolActions).size !== allowedProtocolActions.length) {
      context.addIssue({
        code: "custom",
        path: ["constraints", "allowedProtocolActions"],
        message: "Protocol action types must be unique",
      });
    }
    for (const requiredAction of ["WAIT", "CLOSE_INCIDENT"] as const) {
      if (!allowedProtocolActions.includes(requiredAction)) {
        context.addIssue({
          code: "custom",
          path: ["constraints", "allowedProtocolActions"],
          message: `Deterministic doctrines require ${requiredAction} authorization`,
        });
      }
    }
    if (new Set(doctrine.rules.servicePriority).size !== doctrine.rules.servicePriority.length) {
      context.addIssue({
        code: "custom",
        path: ["rules", "servicePriority"],
        message: "Service priority ids must be unique",
      });
    }
    for (const serviceId of doctrine.rules.servicePriority) {
      if (!allowedServiceIds.includes(serviceId)) {
        context.addIssue({
          code: "custom",
          path: ["rules", "servicePriority"],
          message: `Service priority ${serviceId} must also be authorized`,
        });
      }
    }
    if (
      doctrine.rules.containmentScope === "module" &&
      !allowedProtocolActions.includes("PAUSE_MODULE")
    ) {
      context.addIssue({
        code: "custom",
        path: ["rules", "containmentScope"],
        message: "Module containment requires PAUSE_MODULE authorization",
      });
    }
    if (
      doctrine.rules.containmentScope === "protocol" &&
      !allowedProtocolActions.includes("PAUSE_PROTOCOL")
    ) {
      context.addIssue({
        code: "custom",
        path: ["rules", "containmentScope"],
        message: "Protocol containment requires PAUSE_PROTOCOL authorization",
      });
    }
    if (
      doctrine.rules.requirePatchVerification &&
      (!allowedServiceIds.includes("patch-builder") ||
        !allowedServiceIds.includes("patch-verifier") ||
        !allowedProtocolActions.includes("APPLY_PATCH"))
    ) {
      context.addIssue({
        code: "custom",
        path: ["rules", "requirePatchVerification"],
        message: "Verified patching requires Patch Builder, Patch Verifier, and APPLY_PATCH",
      });
    }
  });
export type RescueDoctrine = z.infer<typeof rescueDoctrineSchema>;

export const rescueDoctrineJsonSchema = JSON.parse(
  JSON.stringify(z.toJSONSchema(rescueDoctrineSchema)),
) as Record<string, unknown>;

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
  investigationBudgetCredits: 80,
};

const doctrineProtocolActions: RescueProtocolActionType[] = [
  "PAUSE_MODULE",
  "PAUSE_PROTOCOL",
  "APPLY_PATCH",
  "RESUME_MODULE",
  "RESUME_PROTOCOL",
  "WAIT",
  "CLOSE_INCIDENT",
];

export type RescueDoctrinePreset = {
  id: RescueDoctrinePresetId;
  promise: string;
  protects: string;
  accepts: string;
  doctrine: RescueDoctrine;
};

export const rescueDoctrinePresets: readonly RescueDoctrinePreset[] = [
  {
    id: "evidence-first",
    promise: "Corroborate the incident before committing the protocol.",
    protects: "Decision confidence",
    accepts: "Higher spend and slower containment",
    doctrine: {
      schemaVersion: "rescue-doctrine-v0",
      name: "Evidence First",
      constraints: {
        investigationBudgetCredits: 90,
        maxServicePriceCredits: 30,
        allowedServiceIds: [
          "pulse-monitor",
          "trace-audit",
          "accounting-audit",
          "second-opinion",
          "patch-builder",
          "patch-verifier",
        ],
        allowedProtocolActions: [...doctrineProtocolActions],
      },
      rules: {
        minimumEvidenceCount: 2,
        minimumConfidencePpm: 700_000,
        disagreementAction: "second-opinion",
        containmentScope: "module",
        servicePriority: ["trace-audit", "accounting-audit", "second-opinion", "pulse-monitor"],
        requirePatchVerification: true,
        budgetExhaustedAction: "contain",
      },
    },
  },
  {
    id: "user-guardian",
    promise: "Contain credible loss, then verify the recovery path.",
    protects: "User assets",
    accepts: "Selective downtime and specialist cost",
    doctrine: {
      schemaVersion: "rescue-doctrine-v0",
      name: "User Guardian",
      constraints: {
        investigationBudgetCredits: 80,
        maxServicePriceCredits: 30,
        allowedServiceIds: [
          "trace-audit",
          "accounting-audit",
          "second-opinion",
          "patch-builder",
          "patch-verifier",
        ],
        allowedProtocolActions: [...doctrineProtocolActions],
      },
      rules: {
        minimumEvidenceCount: 1,
        minimumConfidencePpm: 650_000,
        disagreementAction: "contain",
        containmentScope: "module",
        servicePriority: ["trace-audit", "accounting-audit", "second-opinion"],
        requirePatchVerification: true,
        budgetExhaustedAction: "contain",
      },
    },
  },
  {
    id: "keep-running",
    promise: "Start cheap and fast; restrict service only after a strong signal.",
    protects: "Protocol availability",
    accepts: "More exposure while evidence arrives",
    doctrine: {
      schemaVersion: "rescue-doctrine-v0",
      name: "Keep It Running",
      constraints: {
        investigationBudgetCredits: 50,
        maxServicePriceCredits: 28,
        allowedServiceIds: ["pulse-monitor", "second-opinion", "patch-builder"],
        allowedProtocolActions: [...doctrineProtocolActions],
      },
      rules: {
        minimumEvidenceCount: 1,
        minimumConfidencePpm: 800_000,
        disagreementAction: "wait",
        containmentScope: "module",
        servicePriority: ["pulse-monitor", "second-opinion"],
        requirePatchVerification: false,
        budgetExhaustedAction: "close",
      },
    },
  },
];

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

export type RescueGamePaymentOrderEvidence = {
  orderId: Hex;
  episodeContextHash: Hex;
  episodeHash: Hex;
  commanderActionHash: Hex;
  serviceManifestHash: Hex;
  serviceId: ServiceId;
  amountCredits: number;
  orderedAtMinute: number;
  dueAtMinute: number;
  resolvedAtMinute: number | null;
  gamePaymentState: "reserved" | "released" | "refunded";
  deliverableHash: Hex | null;
  receiptHash: Hex | null;
  acceptanceHash: Hex | null;
};

export type RescueRunPaymentEvidence = {
  schemaVersion: "rescue-run-payment-evidence-v0";
  evidenceState: "simulated";
  gameLedger: {
    unit: "Rescue Credits";
    initialBalance: number;
    availableBalance: number;
    reservedBalance: number;
    spentBalance: number;
  };
  orders: readonly RescueGamePaymentOrderEvidence[];
  onchainMirror: {
    network: "sepolia";
    chainId: 11_155_111;
    paymentState: "not-requested";
    token: typeof rescueUsdDemoToken & { address: null };
    escrowAddress: null;
    reason: "Sepolia payment mirror is not deployed for Controlled Practice.";
  };
  evidenceHash: Hex;
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

export function rescueServiceManifestHash(serviceId: ServiceId): Hex {
  const service = rescueServices.find(({ id }) => id === serviceId);
  if (!service) throw new Error("Unknown Rescue Room Service Agent");
  return hashValue({ schemaVersion: "rescue-service-manifest-v0", service });
}

export function rescueCommanderPaymentActionHash(input: {
  episodeHash: Hex;
  decision: number;
  gameMinute: number;
  publicViewHash: Hex;
  action: RescueAction;
}): Hex {
  return hashValue({
    schemaVersion: "rescue-payment-action-v0",
    evaluatorVersion: rescueRoomEvaluatorVersion,
    ...input,
  });
}

export function rescueServiceOrderId(input: {
  episodeHash: Hex;
  commanderActionHash: Hex;
  serviceManifestHash: Hex;
}): Hex {
  return hashValue({
    schemaVersion: "rescue-service-order-v0",
    evaluatorVersion: rescueRoomEvaluatorVersion,
    ...input,
  });
}

export function rescuePaymentEpisodeContextHash(evaluationContextHash: Hex, episodeHash: Hex): Hex {
  return hashValue({
    schemaVersion: "rescue-payment-episode-context-v0",
    evaluatorVersion: rescueRoomEvaluatorVersion,
    evaluationContextHash,
    episodeHash,
  });
}

export function rescueServiceDeliverableHash(input: { orderId: Hex; receiptHash: Hex }): Hex {
  return hashValue({ schemaVersion: "rescue-service-deliverable-v0", ...input });
}

export function rescueServiceAcceptanceHash(input: {
  orderId: Hex;
  episodeContextHash: Hex;
  deliverableHash: Hex;
  receiptHash: Hex;
}): Hex {
  return hashValue({ schemaVersion: "rescue-service-acceptance-v0", ...input });
}

export function buildRescueRunPaymentEvidence(
  outcome: Pick<RescueEpisodeOutcome, "episodeHash" | "transcript">,
  evaluationContextHash: Hex,
): RescueRunPaymentEvidence {
  const episodeContextHash = rescuePaymentEpisodeContextHash(
    evaluationContextHash,
    outcome.episodeHash,
  );
  const orders = new Map<Hex, RescueGamePaymentOrderEvidence>();
  let availableBalance = rescueRoomInitialBudgetCredits;
  let reservedBalance = 0;
  let spentBalance = 0;

  for (const event of outcome.transcript) {
    if (event.type === "PAYMENT_RESERVED") {
      const orderId = event.data.orderId as Hex;
      const episodeHash = event.data.episodeHash as Hex;
      const serviceId = event.data.serviceId as ServiceId;
      const amountCredits = Number(event.data.credits);
      if (episodeHash !== outcome.episodeHash) {
        throw new Error("Payment Order Episode hash does not match the evaluated Episode");
      }
      if (event.data.serviceManifestHash !== rescueServiceManifestHash(serviceId)) {
        throw new Error("Payment Order Service Manifest does not match the published catalog");
      }
      availableBalance -= amountCredits;
      reservedBalance += amountCredits;
      orders.set(orderId, {
        orderId,
        episodeContextHash,
        episodeHash,
        commanderActionHash: event.data.commanderActionHash as Hex,
        serviceManifestHash: event.data.serviceManifestHash as Hex,
        serviceId,
        amountCredits,
        orderedAtMinute: event.gameMinute,
        dueAtMinute: Number(event.data.dueAtMinute),
        resolvedAtMinute: null,
        gamePaymentState: "reserved",
        deliverableHash: null,
        receiptHash: null,
        acceptanceHash: null,
      });
      continue;
    }
    if (event.type === "PAYMENT_RELEASED" || event.type === "PAYMENT_REFUNDED") {
      const orderId = event.data.orderId as Hex;
      const order = orders.get(orderId);
      if (!order) throw new Error("Payment resolution is missing its reserved Service Order");
      reservedBalance -= order.amountCredits;
      if (event.type === "PAYMENT_RELEASED") spentBalance += order.amountCredits;
      else availableBalance += order.amountCredits;
      orders.set(orderId, {
        ...order,
        resolvedAtMinute: event.gameMinute,
        gamePaymentState: event.type === "PAYMENT_RELEASED" ? "released" : "refunded",
      });
      continue;
    }
    if (event.type === "SERVICE_RECEIPT") {
      const receipt = event.data.receipt as ServiceReceipt;
      const order = orders.get(receipt.orderId);
      if (!order) throw new Error("Service Receipt is missing its Payment Order");
      orders.set(receipt.orderId, {
        ...order,
        deliverableHash: receipt.deliverableHash,
        receiptHash: receipt.receiptHash,
        acceptanceHash: rescueServiceAcceptanceHash({
          orderId: receipt.orderId,
          episodeContextHash,
          deliverableHash: receipt.deliverableHash,
          receiptHash: receipt.receiptHash,
        }),
      });
    }
  }

  const evidenceWithoutHash = {
    schemaVersion: "rescue-run-payment-evidence-v0" as const,
    evidenceState: "simulated" as const,
    gameLedger: {
      unit: "Rescue Credits" as const,
      initialBalance: rescueRoomInitialBudgetCredits,
      availableBalance,
      reservedBalance,
      spentBalance,
    },
    orders: [...orders.values()],
    onchainMirror: {
      network: "sepolia" as const,
      chainId: rescueUsdDemoToken.chainId,
      paymentState: "not-requested" as const,
      token: { ...rescueUsdDemoToken, address: null },
      escrowAddress: null,
      reason: "Sepolia payment mirror is not deployed for Controlled Practice." as const,
    },
  };
  return { ...evidenceWithoutHash, evidenceHash: hashValue(evidenceWithoutHash) };
}

export function reconcileRescueSepoliaPaymentEvidence(
  gameEvidence: RescueRunPaymentEvidence,
  input: unknown,
): RescueSepoliaPaymentEvidence {
  const evidence = rescueSepoliaPaymentEvidenceSchema.parse(input);
  const order = gameEvidence.orders.find(({ orderId }) => orderId === evidence.orderId);
  if (!order) throw new Error("Sepolia payment does not match a Game Ledger Order");
  if (order.episodeContextHash !== evidence.episodeContextHash) {
    throw new Error("Sepolia payment Episode context does not match the Game Ledger");
  }
  if (order.commanderActionHash !== evidence.commanderActionHash) {
    throw new Error("Sepolia payment Commander Action does not match the Game Ledger");
  }
  if (order.serviceManifestHash !== evidence.serviceManifestHash) {
    throw new Error("Sepolia payment Service Manifest does not match the Game Ledger");
  }
  const expectedAmount = BigInt(order.amountCredits) * 10n ** BigInt(rescueUsdDemoToken.decimals);
  if (BigInt(evidence.amount) !== expectedAmount) {
    throw new Error("Sepolia token amount does not match the Game Ledger price");
  }
  if (
    ["delivered", "released"].includes(evidence.paymentState) &&
    (order.deliverableHash !== evidence.deliverableHash ||
      order.receiptHash !== evidence.receiptHash)
  ) {
    throw new Error("Sepolia deliverable does not match the deterministic Service Receipt");
  }
  if (evidence.paymentState === "released" && order.acceptanceHash !== evidence.acceptanceHash) {
    throw new Error("Sepolia acceptance does not match the deterministic Service Receipt");
  }
  if (evidence.paymentState === "released") {
    const before = BigInt(evidence.providerBalanceBefore!);
    const after = BigInt(evidence.providerBalanceAfter!);
    if (after - before !== expectedAmount) {
      throw new Error("Service Agent balance increase does not match the released amount");
    }
  }
  return evidence;
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

export function normalizeRescueDoctrine(input: unknown): RescueDoctrine {
  const parsed = rescueDoctrineSchema.parse(input);
  return {
    ...parsed,
    constraints: {
      ...parsed.constraints,
      allowedServiceIds: lexicalSort(parsed.constraints.allowedServiceIds),
      allowedProtocolActions: lexicalSort(parsed.constraints.allowedProtocolActions),
    },
    rules: {
      ...parsed.rules,
      servicePriority: [...parsed.rules.servicePriority],
    },
  };
}

export function rescueDoctrineHash(input: unknown): Hex {
  return hashValue(normalizeRescueDoctrine(input));
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
  const receiptHash = hashValue(receiptWithoutHash);
  return {
    ...receiptWithoutHash,
    deliverableHash: rescueServiceDeliverableHash({ orderId: order.orderId, receiptHash }),
    receiptHash,
  };
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
        episodeHash: order.episodeHash,
        commanderActionHash: order.commanderActionHash,
        serviceManifestHash: order.serviceManifestHash,
      });
      continue;
    }
    order.status = "DELIVERED";
    state.netResponseSpendCredits += order.priceCredits;
    const receipt = buildServiceReceipt(state, order);
    state.receipts.push(receipt);
    pushEvent(state, "SERVICE_RECEIPT", { receipt });
    pushEvent(state, "PAYMENT_RELEASED", {
      orderId: order.orderId,
      serviceId: order.serviceId,
      credits: order.priceCredits,
      episodeHash: order.episodeHash,
      commanderActionHash: order.commanderActionHash,
      serviceManifestHash: order.serviceManifestHash,
      deliverableHash: receipt.deliverableHash,
      receiptHash: receipt.receiptHash,
    });
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
  const decision = state.actions.length + 1;
  const episodeHash = rescueEpisodeHash(state.episode);
  const publicViewHashBeforeAction = rescuePublicViewHash(publicView(state));
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
    const commanderActionHash = rescueCommanderPaymentActionHash({
      episodeHash,
      decision,
      gameMinute: state.minute,
      publicViewHash: publicViewHashBeforeAction,
      action,
    });
    const serviceManifestHash = rescueServiceManifestHash(service.id);
    const order: ServiceOrder = {
      orderId: rescueServiceOrderId({ episodeHash, commanderActionHash, serviceManifestHash }),
      episodeHash,
      commanderActionHash,
      serviceManifestHash,
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
      episodeHash: order.episodeHash,
      commanderActionHash: order.commanderActionHash,
      serviceManifestHash: order.serviceManifestHash,
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

function playbookViolation(
  playbook: RescueCommanderPlaybook,
  action: RescueAction,
  view: RescuePublicView,
): string | null {
  if (action.type === "BUY_SERVICE") {
    if (!playbook.allowedServiceIds.includes(action.serviceId)) {
      return `Playbook does not authorize Service Agent ${action.serviceId}`;
    }
    const service = rescueServices.find(({ id }) => id === action.serviceId)!;
    if (service.priceCredits > playbook.maxServicePriceCredits) {
      return `Service Agent ${action.serviceId} exceeds the Playbook price ceiling`;
    }
    if (
      view.netResponseSpendCredits + view.reservedBudgetCredits + service.priceCredits >
      playbook.investigationBudgetCredits
    ) {
      return `Service Agent ${action.serviceId} exceeds the Playbook investigation budget`;
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
        const violation = playbookViolation(playbook, parsed.data, publicView(state));
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

function doctrineAuthorizationPlaybook(doctrine: RescueDoctrine): RescueCommanderPlaybook {
  return normalizeRescueCommanderPlaybook({
    schemaVersion: "rescue-commander-playbook-v0",
    name: doctrine.name,
    instructions:
      "Execute the committed deterministic Rescue Doctrine. Only public observations and purchased Service Agent evidence may affect an action.",
    allowedServiceIds: doctrine.constraints.allowedServiceIds,
    allowedProtocolActions: doctrine.constraints.allowedProtocolActions,
    maxServicePriceCredits: doctrine.constraints.maxServicePriceCredits,
    investigationBudgetCredits: doctrine.constraints.investigationBudgetCredits,
  });
}

function diagnosticReceipts(view: RescuePublicView): ServiceReceipt[] {
  return view.serviceReceipts.filter(({ task }) =>
    ["SCAN_ACTIVITY", "TRACE_EXECUTION", "CHECK_ACCOUNTING", "SECOND_OPINION"].includes(task),
  );
}

function credibleDiagnosticReceipts(
  doctrine: RescueDoctrine,
  view: RescuePublicView,
): ServiceReceipt[] {
  return diagnosticReceipts(view).filter(
    ({ classification, confidencePpm }) =>
      classification !== "inconclusive" && confidencePpm >= doctrine.rules.minimumConfidencePpm,
  );
}

function consensusFinding(
  doctrine: RescueDoctrine,
  view: RescuePublicView,
): { receipt: ServiceReceipt; count: number } | null {
  const groups = new Map<IncidentFamily, ServiceReceipt[]>();
  for (const receipt of credibleDiagnosticReceipts(doctrine, view)) {
    if (receipt.classification === "inconclusive") continue;
    const group = groups.get(receipt.classification) ?? [];
    group.push(receipt);
    groups.set(receipt.classification, group);
  }
  const ranked = [...groups.entries()].sort((left, right) => {
    const countDifference = right[1].length - left[1].length;
    if (countDifference !== 0) return countDifference;
    const rightConfidence = right[1].reduce((sum, receipt) => sum + receipt.confidencePpm, 0);
    const leftConfidence = left[1].reduce((sum, receipt) => sum + receipt.confidencePpm, 0);
    return rightConfidence - leftConfidence || left[0].localeCompare(right[0]);
  });
  const best = ranked[0];
  if (!best || best[1].length < doctrine.rules.minimumEvidenceCount) return null;
  return { receipt: best[1].at(-1)!, count: best[1].length };
}

function hasCredibleDisagreement(doctrine: RescueDoctrine, view: RescuePublicView): boolean {
  return (
    new Set(credibleDiagnosticReceipts(doctrine, view).map(({ classification }) => classification))
      .size > 1
  );
}

function canDoctrineBuy(
  doctrine: RescueDoctrine,
  view: RescuePublicView,
  serviceId: ServiceId,
): boolean {
  const service = rescueServices.find(({ id }) => id === serviceId)!;
  const committedSpend = view.netResponseSpendCredits + view.reservedBudgetCredits;
  return (
    doctrine.constraints.allowedServiceIds.includes(serviceId) &&
    service.priceCredits <= doctrine.constraints.maxServicePriceCredits &&
    service.priceCredits <= view.availableBudgetCredits &&
    committedSpend + service.priceCredits <= doctrine.constraints.investigationBudgetCredits
  );
}

function doctrineContainmentAction(
  doctrine: RescueDoctrine,
  view: RescuePublicView,
  receipt?: ServiceReceipt,
): RescueAction | null {
  if (doctrine.rules.containmentScope === "none" || view.pausedModules.length > 0) return null;
  if (doctrine.rules.containmentScope === "protocol") return { type: "PAUSE_PROTOCOL" };
  return receipt?.likelyAffectedModule
    ? { type: "PAUSE_MODULE", module: receipt.likelyAffectedModule }
    : null;
}

function doctrineFallbackDecision(
  doctrine: RescueDoctrine,
  view: RescuePublicView,
  receipt?: ServiceReceipt,
): RescueCommanderDecision {
  if (doctrine.rules.budgetExhaustedAction === "contain") {
    const action = doctrineContainmentAction(doctrine, view, receipt);
    if (action) return { action, reasonCode: "budget-fallback-contain", confidencePpm: 500_000 };
  }
  if (doctrine.rules.budgetExhaustedAction === "wait" && view.actions.at(-1)?.type !== "WAIT") {
    return {
      action: { type: "WAIT", minutes: 5 },
      reasonCode: "budget-fallback-wait",
      confidencePpm: 400_000,
    };
  }
  return {
    action: { type: "CLOSE_INCIDENT" },
    reasonCode: "budget-fallback-close",
    confidencePpm: 400_000,
  };
}

export function decideRescueDoctrine(
  doctrineInput: unknown,
  view: RescuePublicView,
): RescueCommanderDecision {
  const doctrine = normalizeRescueDoctrine(doctrineInput);
  const credible = credibleDiagnosticReceipts(doctrine, view);
  const latestCredible = credible.at(-1);

  if (outstanding(view).length > 0) {
    return {
      action: waitForNextService(view),
      reasonCode: "await-service-evidence",
      confidencePpm: latestCredible?.confidencePpm ?? 300_000,
    };
  }

  if (view.actions.some(({ type }) => type === "APPLY_PATCH")) {
    if (
      view.pausedModules.length > 0 &&
      doctrine.constraints.allowedProtocolActions.includes("RESUME_PROTOCOL")
    ) {
      return {
        action: { type: "RESUME_PROTOCOL" },
        reasonCode: "resume-after-patch",
        confidencePpm: 850_000,
      };
    }
    return {
      action: { type: "CLOSE_INCIDENT" },
      reasonCode: "close-after-patch",
      confidencePpm: 850_000,
    };
  }

  const patch = latestPatch(view);
  if (patch && doctrine.rules.requirePatchVerification) {
    const verification = [...view.serviceReceipts]
      .reverse()
      .find(
        ({ serviceId, patchId }) => serviceId === "patch-verifier" && patchId === patch.patchId,
      );
    if (!verification && canDoctrineBuy(doctrine, view, "patch-verifier")) {
      return {
        action: {
          type: "BUY_SERVICE",
          serviceId: "patch-verifier",
          targetReceiptId: patch.receiptId,
        },
        reasonCode: "verify-patch-before-apply",
        confidencePpm: patch.confidencePpm,
      };
    }
    if (verification?.patchValid) {
      return {
        action: { type: "APPLY_PATCH", receiptId: patch.receiptId },
        reasonCode: "apply-verified-patch",
        confidencePpm: verification.confidencePpm,
      };
    }
    return doctrineFallbackDecision(doctrine, view, latestCredible);
  }

  if (
    patch &&
    !doctrine.rules.requirePatchVerification &&
    doctrine.constraints.allowedProtocolActions.includes("APPLY_PATCH")
  ) {
    return {
      action: { type: "APPLY_PATCH", receiptId: patch.receiptId },
      reasonCode: "apply-direct-patch",
      confidencePpm: patch.confidencePpm,
    };
  }

  const consensus = consensusFinding(doctrine, view);
  if (consensus?.receipt.classification === "false-positive") {
    if (
      view.pausedModules.length > 0 &&
      doctrine.constraints.allowedProtocolActions.includes("RESUME_PROTOCOL")
    ) {
      return {
        action: { type: "RESUME_PROTOCOL" },
        reasonCode: "resume-after-benign-consensus",
        confidencePpm: consensus.receipt.confidencePpm,
      };
    }
    return {
      action: { type: "CLOSE_INCIDENT" },
      reasonCode: "close-benign-consensus",
      confidencePpm: consensus.receipt.confidencePpm,
    };
  }

  if (consensus) {
    const containment = doctrineContainmentAction(doctrine, view, consensus.receipt);
    if (containment) {
      return {
        action: containment,
        reasonCode: "contain-confirmed-incident",
        confidencePpm: consensus.receipt.confidencePpm,
      };
    }
    if (!bought(view, "patch-builder") && canDoctrineBuy(doctrine, view, "patch-builder")) {
      return {
        action: {
          type: "BUY_SERVICE",
          serviceId: "patch-builder",
          targetModule: consensus.receipt.likelyAffectedModule,
        },
        reasonCode: "build-patch-after-consensus",
        confidencePpm: consensus.receipt.confidencePpm,
      };
    }
    return doctrineFallbackDecision(doctrine, view, consensus.receipt);
  }

  if (hasCredibleDisagreement(doctrine, view)) {
    if (
      doctrine.rules.disagreementAction === "second-opinion" &&
      !bought(view, "second-opinion") &&
      canDoctrineBuy(doctrine, view, "second-opinion")
    ) {
      return {
        action: { type: "BUY_SERVICE", serviceId: "second-opinion" },
        reasonCode: "resolve-evidence-disagreement",
        confidencePpm: latestCredible?.confidencePpm ?? 500_000,
      };
    }
    if (doctrine.rules.disagreementAction === "contain") {
      const containment = doctrineContainmentAction(doctrine, view, latestCredible);
      if (containment) {
        return {
          action: containment,
          reasonCode: "contain-on-disagreement",
          confidencePpm: latestCredible?.confidencePpm ?? 500_000,
        };
      }
    }
    if (doctrine.rules.disagreementAction === "wait" && view.actions.at(-1)?.type !== "WAIT") {
      return {
        action: { type: "WAIT", minutes: 5 },
        reasonCode: "wait-on-disagreement",
        confidencePpm: latestCredible?.confidencePpm ?? 500_000,
      };
    }
  }

  const nextServiceId = doctrine.rules.servicePriority.find(
    (serviceId) => !bought(view, serviceId) && canDoctrineBuy(doctrine, view, serviceId),
  );
  if (nextServiceId) {
    return {
      action: { type: "BUY_SERVICE", serviceId: nextServiceId },
      reasonCode: `gather-${nextServiceId}`,
      confidencePpm: latestCredible?.confidencePpm ?? 300_000,
    };
  }

  return doctrineFallbackDecision(doctrine, view, latestCredible);
}

export function createRescueDoctrinePolicy(doctrineInput: unknown): RescuePolicy {
  const doctrine = normalizeRescueDoctrine(doctrineInput);
  const doctrineHash = rescueDoctrineHash(doctrine);
  return {
    id: `doctrine-${doctrineHash.slice(2, 14)}`,
    name: doctrine.name,
    decide: (view) => decideRescueDoctrine(doctrine, view).action,
  };
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

export const rescueDoctrineContext = {
  practiceContextHash: rescuePracticeContextHash,
  interpreterVersion: rescueDoctrineInterpreterVersion,
  doctrineSchemaVersion: "rescue-doctrine-v0",
  decisionInterface: "public-view-to-one-structured-action",
  actionSchemaVersion: "rescue-action-v0",
} as const;

export const rescueDoctrineContextHash = hashValue(rescueDoctrineContext);

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
  artifactType: "rescue-doctrine-v0",
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

// Single-episode evaluators must not run all 280 reference episodes on import.
// The overview is still computed by the same evaluator when a caller asks for it.
let practiceOverview: ReturnType<typeof computePracticeOverview> | undefined;
function getPracticeOverview() {
  return (practiceOverview ??= computePracticeOverview());
}

function computePracticeOverview() {
  const rescuePracticeEvaluations = rescuePracticePolicyIds.map((policyId) =>
    evaluateRescuePolicy(policyId, rescuePracticeSeeds),
  );
  const rescuePracticePoints = rescuePracticeEvaluations.map(rescueEvaluationPoint);
  const rescuePracticeFrontier = computeOutcomeFrontier(
    rescuePracticePoints,
    rescuePracticeMetrics,
  );

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
  return { rescuePracticePolicyResults, rescuePracticeFrontier };
}

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
    get allocations() {
      return allocateEvenly(
        bestPolicyIds(
          getPracticeOverview().rescuePracticePolicyResults.filter(
            ({ servedProtocolDemandPpm }) => servedProtocolDemandPpm >= 800_000,
          ),
          "totalUserLossUsd",
          "MINIMIZE",
        ),
      );
    },
  },
  {
    poolId: "availability",
    name: "Availability Pool",
    valueStatement: "Support Commanders that preserve protocol access within a safety budget.",
    rule: "Highest served demand among entries losing no more than 20,000 USD per Episode.",
    budgetCredits: 2_500,
    get allocations() {
      return allocateEvenly(
        bestPolicyIds(
          getPracticeOverview().rescuePracticePolicyResults.filter(
            ({ totalUserLossUsd, episodeCount }) => totalUserLossUsd <= 20_000 * episodeCount,
          ),
          "servedProtocolDemandPpm",
          "MAXIMIZE",
        ),
      );
    },
  },
  {
    poolId: "treasury-stewardship",
    name: "Treasury Stewardship Pool",
    valueStatement: "Support efficient response spending after safety and availability gates pass.",
    rule: "Lowest spend among entries losing no more than 15,000 USD per Episode and serving at least 80% of demand.",
    budgetCredits: 2_500,
    get allocations() {
      return allocateEvenly(
        bestPolicyIds(
          getPracticeOverview().rescuePracticePolicyResults.filter(
            ({ totalUserLossUsd, episodeCount, servedProtocolDemandPpm }) =>
              totalUserLossUsd <= 15_000 * episodeCount && servedProtocolDemandPpm >= 800_000,
          ),
          "netResponseSpendCredits",
          "MINIMIZE",
        ),
      );
    },
  },
  {
    poolId: "frontier-expansion",
    name: "Frontier Expansion Pool",
    valueStatement: "Support independently useful tradeoffs added to the three-axis frontier.",
    rule: "Among entries losing no more than 20,000 USD per Episode and serving at least 75% of demand, split by positive exclusive three-axis hypervolume contribution.",
    budgetCredits: 2_500,
    get allocations() {
      return allocateProportionally(
        getPracticeOverview()
          .rescuePracticePolicyResults.filter(
            ({ totalUserLossUsd, episodeCount, servedProtocolDemandPpm }) =>
              totalUserLossUsd <= 20_000 * episodeCount && servedProtocolDemandPpm >= 750_000,
          )
          .map(({ policyId, contribution }) => ({
            policyId: policyId as RescuePracticePolicyId,
            weight: contribution.exclusiveContributionPpm,
          })),
      );
    },
  },
];

export function publicRescueRoomScenario() {
  const { rescuePracticePolicyResults, rescuePracticeFrontier } = getPracticeOverview();
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
    paymentRuntime: {
      gameLedger: {
        state: "simulated" as const,
        unit: "Rescue Credits" as const,
        initialEpisodeBudget: rescueRoomInitialBudgetCredits,
      },
      sepoliaShowcase: {
        state: "contract-implemented-not-deployed" as const,
        token: { ...rescueUsdDemoToken, address: null },
        escrowAddress: null,
        maximumOrderAmount: 50,
        maximumEpisodeAmount: rescueRoomInitialBudgetCredits,
        orderStates: ["NONE", "FUNDED", "DELIVERED", "RELEASED", "REFUNDED"] as const,
        evidenceSchemaVersion: "rescue-sepolia-payment-evidence-v0" as const,
        claimBoundary:
          "Paid requires a confirmed release event and verified Service Agent balance increase.",
      },
    },
    initialBudgetCredits: rescueRoomInitialBudgetCredits,
    horizonMinutes: rescueRoomHorizonMinutes,
    maximumDecisions: rescueRoomMaximumDecisions,
    modules: rescueModules,
    doctrineRuntime: {
      mode: "deterministic-rules" as const,
      contextHash: rescueDoctrineContextHash,
      interpreterVersion: rescueDoctrineInterpreterVersion,
      doctrineSchema: rescueDoctrineJsonSchema,
      presets: rescueDoctrinePresets.map((preset) => ({
        ...preset,
        doctrine: normalizeRescueDoctrine(preset.doctrine),
        doctrineHash: rescueDoctrineHash(preset.doctrine),
      })),
      replayBoundary:
        "The normalized Doctrine, public view, reason code, Action sequence, and outcome are deterministic.",
    },
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
  const aggregate = getPracticeOverview().rescuePracticePolicyResults.find(
    (entry) => entry.policyId === policyId,
  )!;
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
    paymentEvidence: buildRescueRunPaymentEvidence(outcome, rescuePracticeContextHash),
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

/** Public identifiers only; no hidden state and no full leaderboard computation. */
export function rescuePublicPracticeEpisodeIds(): string[] {
  return rescuePracticeEpisodes.map(({ publicId }) => publicId);
}

function runRescueDoctrineEpisode(
  episode: RescueEpisodeDefinition,
  doctrineInput: unknown,
): { outcome: RescueEpisodeOutcome; decisions: RescueCommanderDecisionEvidence[] } {
  const doctrine = normalizeRescueDoctrine(doctrineInput);
  const session = createRescueEpisodeSession(episode, doctrineAuthorizationPlaybook(doctrine));
  const decisions: RescueCommanderDecisionEvidence[] = [];
  while (!session.isComplete() && decisions.length < rescueRoomMaximumDecisions) {
    const view = session.getPublicView();
    const decision = decideRescueDoctrine(doctrine, view);
    const step = session.takeAction(decision.action);
    decisions.push({
      ...decision,
      decision: decisions.length + 1,
      gameMinute: view.gameMinute,
      publicViewHash: rescuePublicViewHash(view),
      accepted: step.accepted,
      invalidReason: step.invalidReason,
    });
  }
  return { outcome: session.finish(), decisions };
}

export function replayRescueDoctrinePractice(
  episodeId: string,
  doctrineInput: unknown,
  decisions: readonly RescueCommanderDecisionEvidence[],
): RescueEpisodeOutcome {
  const doctrine = normalizeRescueDoctrine(doctrineInput);
  return replayRescuePracticeCommander(
    episodeId,
    doctrineAuthorizationPlaybook(doctrine),
    decisions,
  );
}

export function evaluateRescueDoctrinePracticeEpisode(doctrineInput: unknown, episodeId: string) {
  const doctrine = normalizeRescueDoctrine(doctrineInput);
  const episode = rescuePracticeEpisode(episodeId);
  const { outcome, decisions } = runRescueDoctrineEpisode(episode, doctrine);
  const replayedOutcome = replayRescueDoctrinePractice(episodeId, doctrine, decisions);
  if (replayedOutcome.resultHash !== outcome.resultHash) {
    throw new Error("Recorded Doctrine decisions do not reproduce the supplied outcome");
  }
  const resultWithoutHash = {
    schemaVersion: "rescue-doctrine-practice-evaluation-v0" as const,
    arenaId: rescueRoomChallengeId,
    contextId: "public-practice-pack-v0" as const,
    contextHash: rescuePracticeContextHash,
    doctrineContextHash: rescueDoctrineContextHash,
    manifestHash: rescueRoomManifestHash,
    doctrine,
    doctrineHash: rescueDoctrineHash(doctrine),
    interpreterVersion: rescueDoctrineInterpreterVersion,
    decisions,
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
    paymentEvidence: buildRescueRunPaymentEvidence(outcome, rescuePracticeContextHash),
    outcome,
    replay: {
      deterministic: true as const,
      actionCount: decisions.length,
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
    paymentEvidence: buildRescueRunPaymentEvidence(input.outcome, rescuePracticeContextHash),
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
