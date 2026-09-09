import {
  canonicalProtocolJson,
  hashChallengeManifest,
  parseChallengeManifest,
  type OutcomeMetric,
} from "@frontier/shared";
import { Group } from "@semaphore-protocol/group";
import { verifyProof, type SemaphoreProof } from "@semaphore-protocol/proof";
import { keccak256, stringToHex, type Hex } from "viem";
import { z } from "zod";

export const secretGateChallengeId = "secret-gate-v1";
export const secretGateGateId = "public-demo-gate";
export const secretGateEpoch = "2026-09-demo-1";
export const secretGateMessageLabel = "FRONTIER_SECRET_GATE_ENTER_V1";
export const secretGateScopeLabel =
  `frontier:secret-gate:${secretGateGateId}:${secretGateEpoch}` as const;
export const semaphoreVersion = "4.14.3";
export const semaphoreArtifactVersion = "4.13.0";
export const semaphoreTreeDepth = 3;
export const semaphoreArtifactHashes = {
  wasm: "0x48e15502f710be0a623d573d472edeeaf918fd5eee0b2ca9b407c4e4f20d12f2",
  zkey: "0xc36653c42784df35a01f3d93415af9ad8292a540f8deb134a6a34a01752a89d3",
} as const;

export function deriveSemaphoreSignal(label: string): string {
  return (BigInt(keccak256(stringToHex(label))) >> 8n).toString();
}

export const secretGateMessage = deriveSemaphoreSignal(secretGateMessageLabel);
export const secretGateScope = deriveSemaphoreSignal(secretGateScopeLabel);

export const secretGateCoverCommitments = [
  "9142670749322414562822507699057375395706077276302669340080270485288584595167",
  "8483910985829309174838499584318707252293863690837154163507608383494203456388",
  "21875976143879418948504595083837928074655817462571189349056892235397397600145",
  "7286495566432495919702440723775507853691350477047066083431233886802997815981",
  "12136538722312676332155688222838258388226100311382926765245941483412129476136",
  "11438026931323280012971353261823607496366757163285394233020138094815293727052",
  "20886438428231030694656390709467804593623480527488110440225106959540968445507",
] as const;

const decimalFieldSchema = z
  .string()
  .max(78)
  .regex(/^\d+$/)
  .refine((value) => BigInt(value) > 0n, "Value must be greater than zero")
  .refine(
    (value) =>
      BigInt(value) <
      21888242871839275222246405745257275088548364400416034343698204186575808495617n,
    "Value must be inside the BN254 scalar field",
  );

const proofPointSchema = z.string().max(78).regex(/^\d+$/);

export const secretGateEnrollmentSchema = z.object({ commitment: decimalFieldSchema }).strict();

export type SecretGateEnrollment = z.infer<typeof secretGateEnrollmentSchema>;

export type SecretGateGroupSnapshot = {
  schemaVersion: "1";
  gateId: typeof secretGateGateId;
  epoch: typeof secretGateEpoch;
  members: string[];
  memberIndex: number;
  root: string;
  treeDepth: typeof semaphoreTreeDepth;
  message: typeof secretGateMessage;
  scope: typeof secretGateScope;
  artifactVersion: typeof semaphoreArtifactVersion;
  artifactUrls: { wasm: string; zkey: string };
  artifactHashes: typeof semaphoreArtifactHashes;
  expiresAt: string;
  limitation: string;
};

export function createSecretGateSnapshot(
  commitment: string,
  artifactBaseUrl = `/semaphore/${semaphoreArtifactVersion}`,
  expiresAt = new Date(Date.now() + 30 * 60_000).toISOString(),
): SecretGateGroupSnapshot {
  const parsed = secretGateEnrollmentSchema.parse({ commitment });
  const members = [...secretGateCoverCommitments, parsed.commitment];
  const group = new Group(members);
  if (group.depth !== semaphoreTreeDepth) {
    throw new Error(`Secret Gate group must have tree depth ${semaphoreTreeDepth}`);
  }
  return {
    schemaVersion: "1",
    gateId: secretGateGateId,
    epoch: secretGateEpoch,
    members,
    memberIndex: members.length - 1,
    root: group.root.toString(),
    treeDepth: semaphoreTreeDepth,
    message: secretGateMessage,
    scope: secretGateScope,
    artifactVersion: semaphoreArtifactVersion,
    artifactUrls: {
      wasm: `${artifactBaseUrl}/semaphore-${semaphoreTreeDepth}.wasm`,
      zkey: `${artifactBaseUrl}/semaphore-${semaphoreTreeDepth}.zkey`,
    },
    artifactHashes: semaphoreArtifactHashes,
    expiresAt,
    limitation:
      "This synthetic eight-member cohort demonstrates Semaphore membership only. It is not identity, personhood, or production authorization.",
  };
}

export const semaphoreProofSchema = z
  .object({
    merkleTreeDepth: z.number().int().min(1).max(32),
    merkleTreeRoot: decimalFieldSchema,
    message: decimalFieldSchema,
    nullifier: decimalFieldSchema,
    scope: decimalFieldSchema,
    points: z.array(proofPointSchema).length(8),
  })
  .strict();

export const secretGateEntrySchema = z
  .object({
    gateId: z.literal(secretGateGateId),
    epoch: z.literal(secretGateEpoch),
    proof: semaphoreProofSchema,
  })
  .strict();

export type SecretGateEntry = z.infer<typeof secretGateEntrySchema>;

export type SecretGateVerification = {
  valid: boolean;
  failures: string[];
  proofHash: Hex;
  nullifier: string;
};

export async function verifySecretGateEntry(
  entry: SecretGateEntry,
  trustedRoot: string,
): Promise<SecretGateVerification> {
  const parsed = secretGateEntrySchema.parse(entry);
  const failures: string[] = [];
  if (parsed.proof.merkleTreeDepth !== semaphoreTreeDepth) failures.push("WRONG_TREE_DEPTH");
  if (parsed.proof.merkleTreeRoot !== trustedRoot) failures.push("UNTRUSTED_GROUP_ROOT");
  if (parsed.proof.message !== secretGateMessage) failures.push("WRONG_MESSAGE");
  if (parsed.proof.scope !== secretGateScope) failures.push("WRONG_SCOPE");
  if (failures.length === 0) {
    try {
      if (!(await verifyProof(parsed.proof as SemaphoreProof))) failures.push("INVALID_PROOF");
    } catch {
      failures.push("INVALID_PROOF");
    }
  }
  return {
    valid: failures.length === 0,
    failures,
    proofHash: keccak256(stringToHex(canonicalProtocolJson(parsed.proof))),
    nullifier: parsed.proof.nullifier,
  };
}

export const proofExecutionStrategySchema = z
  .object({
    schemaVersion: z.literal("proof-execution-strategy-v0"),
    maxParallelProofs: z.number().int().min(1).max(4),
    engineThreads: z.literal("sdk-default"),
    artifactLoad: z.enum(["eager", "on-demand"]),
    workerLifecycle: z.enum(["reuse", "per-request"]),
  })
  .strict();

export type ProofExecutionStrategy = z.infer<typeof proofExecutionStrategySchema>;

export const baselineProofExecutionStrategy: ProofExecutionStrategy = {
  schemaVersion: "proof-execution-strategy-v0",
  maxParallelProofs: 1,
  engineThreads: "sdk-default",
  artifactLoad: "on-demand",
  workerLifecycle: "reuse",
};

export const secretGateWorkloads = [
  {
    id: "cold-start",
    name: "Cold start",
    arrivalsMs: [0],
    description: "One request from an uninitialized browser state.",
  },
  {
    id: "burst-6",
    name: "Burst",
    arrivalsMs: [0, 0, 0, 0, 0, 0],
    description: "Six proof requests arrive together.",
  },
  {
    id: "periodic-6",
    name: "Periodic",
    arrivalsMs: [0, 750, 1500, 2250, 3000, 3750],
    description: "Six proof requests arrive 750 milliseconds apart.",
  },
  {
    id: "burst-idle-burst",
    name: "Burst, idle, burst",
    arrivalsMs: [0, 0, 0, 0, 5000, 5000, 5000, 5000],
    description: "Four requests, five seconds idle, then four requests.",
  },
] as const;

export type SecretGateWorkloadId = (typeof secretGateWorkloads)[number]["id"];

export const secretGateMetrics = [
  {
    key: "p95LatencyMs",
    name: "P95 request-to-proof latency",
    direction: "MINIMIZE",
    unit: "ms",
    lowerBound: 0,
    upperBound: 120_000,
  },
  {
    key: "peakIncrementalMemoryMb",
    name: "Peak incremental memory",
    direction: "MINIMIZE",
    unit: "MiB",
    lowerBound: 0,
    upperBound: 4_096,
  },
] as const satisfies readonly OutcomeMetric[];

export const secretGateBenchmarkContext = {
  schemaVersion: "1",
  challengeId: secretGateChallengeId,
  evidenceLevel: 0,
  measurementClass: "controlled-observational",
  semaphoreVersion,
  semaphoreArtifactVersion,
  semaphoreArtifactHashes,
  treeDepth: semaphoreTreeDepth,
  groupSize: 8,
  message: secretGateMessage,
  scopeRule: "unique synthetic scope per benchmark request",
  strategySchemaVersion: "proof-execution-strategy-v0",
  workloadVersion: "secret-gate-workloads-v1",
  timer: "performance.now",
  officialMemoryRule: "baseline-subtracted browser-process-tree RSS",
  personalMemoryRule: "browser-supported estimate; never mixed with official results",
  aggregation: { latency: "nearest-rank-p95", memory: "maximum-incremental-mebibytes" },
} as const;

export const secretGateContextHash = keccak256(
  stringToHex(canonicalProtocolJson(secretGateBenchmarkContext)),
);

export const secretGateManifest = parseChallengeManifest({
  schemaVersion: "2",
  id: secretGateChallengeId,
  slug: "secret-gate",
  name: "Secret Gate",
  lifecycle: "PRACTICE",
  sponsor: {
    name: "Frontier Protocol practice",
    wallet: null,
    statement: "A real Semaphore gate with controlled observational benchmark evidence.",
  },
  valueTension: "Reduce proof waiting time without hiding client memory cost.",
  artifactType: "proof-execution-strategy-v0",
  hardConstraints: [
    "Generate and verify every required Semaphore proof",
    "Keep the circuit, public signals, artifacts, and workload fixed",
    "Use only the published bounded Strategy schema",
    "Do not drop, duplicate, cache, or reuse proof requests",
  ],
  metrics: secretGateMetrics,
  contexts: [
    {
      id: "controlled-browser-v1",
      version: "secret-gate-context-v1",
      name: "Controlled browser benchmark",
      description:
        "Empirical measurements from one pinned browser environment; raw values are observational, while aggregation is deterministic.",
      datasetHash: secretGateContextHash,
      constraintHash: keccak256(stringToHex("secret-gate-correctness-gates-v1")),
      metricsHash: keccak256(stringToHex(canonicalProtocolJson(secretGateMetrics))),
      evidenceLevel: 0,
    },
  ],
  activeContextId: "controlled-browser-v1",
  workload: { publicHash: secretGateContextHash, finalCommitment: null },
  submission: {
    methods: ["INLINE"],
    sourceVisibility: "PUBLIC",
    opensAt: null,
    closesAt: null,
    maxRevisions: 20,
  },
  reviewEndsAt: null,
  reward: { kind: "PREVIEW", poolCredits: 0 },
});

export const secretGateManifestHash = hashChallengeManifest(secretGateManifest);

export const benchmarkObservationSchema = z
  .object({
    requestId: z.string().min(1).max(100),
    workloadId: z.enum(["cold-start", "burst-6", "periodic-6", "burst-idle-burst"]),
    arrivalMs: z.number().nonnegative().finite(),
    dispatchMs: z.number().nonnegative().finite(),
    completedMs: z.number().nonnegative().finite(),
    proofVerified: z.boolean(),
    proofHash: z.string().regex(/^0x[0-9a-f]{64}$/),
  })
  .strict()
  .refine((value) => value.arrivalMs <= value.dispatchMs, "Dispatch must follow arrival")
  .refine((value) => value.dispatchMs <= value.completedMs, "Completion must follow dispatch");

export const benchmarkRunSchema = z
  .object({
    strategy: proofExecutionStrategySchema,
    contextHash: z.literal(secretGateContextHash),
    observations: z.array(benchmarkObservationSchema).min(1).max(100),
    memoryBaselineBytes: z.number().int().nonnegative(),
    memorySamplesBytes: z.array(z.number().int().nonnegative()).min(1).max(100_000),
  })
  .strict();

export type SecretGateBenchmarkRun = z.infer<typeof benchmarkRunSchema>;

function nearestRankP95(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)]!;
}

export function aggregateSecretGateRun(input: SecretGateBenchmarkRun) {
  const run = benchmarkRunSchema.parse(input);
  const failures: string[] = [];
  if (run.observations.some(({ proofVerified }) => !proofVerified)) {
    failures.push("Every generated proof must verify");
  }
  const requestIds = new Set(run.observations.map(({ requestId }) => requestId));
  if (requestIds.size !== run.observations.length) failures.push("Request ids must be unique");
  const latencies = run.observations.map(
    ({ arrivalMs, completedMs }) => Math.round((completedMs - arrivalMs) * 1_000) / 1_000,
  );
  const peakBytes = Math.max(...run.memorySamplesBytes);
  const resultWithoutHash = {
    schemaVersion: "1" as const,
    state: "measured" as const,
    measurementClass: "controlled-observational" as const,
    contextHash: secretGateContextHash,
    strategyHash: keccak256(stringToHex(canonicalProtocolJson(run.strategy))),
    workloadHash: keccak256(
      stringToHex(
        canonicalProtocolJson(
          run.observations.map(({ requestId, workloadId, arrivalMs }) => ({
            requestId,
            workloadId,
            arrivalMs,
          })),
        ),
      ),
    ),
    evidenceHash: keccak256(stringToHex(canonicalProtocolJson(run))),
    correctness: failures.length === 0,
    constraintFailures: failures,
    outcomes: {
      p95LatencyMs: nearestRankP95(latencies),
      peakIncrementalMemoryMb:
        Math.round((Math.max(0, peakBytes - run.memoryBaselineBytes) / 1024 / 1024) * 1_000) /
        1_000,
    },
    diagnostics: {
      requestCount: run.observations.length,
      queueTimeMs: run.observations.map(({ arrivalMs, dispatchMs }) => dispatchMs - arrivalMs),
      provingTimeMs: run.observations.map(
        ({ dispatchMs, completedMs }) => completedMs - dispatchMs,
      ),
      memoryBaselineBytes: run.memoryBaselineBytes,
      peakMemoryBytes: peakBytes,
    },
  };
  return {
    ...resultWithoutHash,
    resultHash: keccak256(stringToHex(canonicalProtocolJson(resultWithoutHash))),
  };
}

export function publicSecretGateScenario() {
  return {
    arenaId: secretGateChallengeId,
    name: "Secret Gate",
    evidenceLevel: 0 as const,
    verificationState: "off-chain" as const,
    competitionState: "feasibility" as const,
    contextHash: secretGateContextHash,
    manifest: secretGateManifest,
    manifestHash: secretGateManifestHash,
    metrics: secretGateMetrics,
    workloads: secretGateWorkloads,
    baselineStrategy: baselineProofExecutionStrategy,
    gate: {
      gateId: secretGateGateId,
      epoch: secretGateEpoch,
      groupSize: 8,
      message: secretGateMessage,
      scope: secretGateScope,
      treeDepth: semaphoreTreeDepth,
      limitation:
        "This is a synthetic demo group. It proves membership in this cohort, not identity or personhood.",
    },
  };
}
