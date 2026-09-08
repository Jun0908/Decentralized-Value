import {
  emergencySupplyAgentAllocations,
  emergencySupplyMetrics,
  evaluateSupplyAllocation,
  publicEmergencySupplyScenario,
  type SupplyAllocation,
  type SupplyEvaluation,
} from "@frontier/emergency-supply";
import {
  allocateContributionRewards,
  canonicalProtocolJson,
  computeContributionEvidence,
  computeOutcomeFrontier,
  dominatesOutcome,
  type OutcomePoint,
} from "@frontier/shared";
import { strToU8, zipSync } from "fflate";
import { getAddress, keccak256, stringToHex, type Address, type Hex } from "viem";
import { z } from "zod";

export const plan5ChallengeId = "emergency-supply-v1";
export const plan5PoolCredits = 10_000;

export type Plan5Identity = {
  userId: string;
  wallet: Address;
};

export type Plan5Participant = {
  participantId: Hex;
  challengeId: typeof plan5ChallengeId;
  userIdHash: Hex;
  wallet: Address;
  displayName: string;
  joinedAt: string;
};

export type Plan5Submission = {
  submissionId: Hex;
  participantId: Hex;
  challengeId: typeof plan5ChallengeId;
  revision: number;
  sourceMethod: "VISUAL" | "JSON" | "UPLOAD";
  sourceHash: Hex;
  inputHash: Hex;
  repositoryUrl: string | null;
  sourceCommit: string | null;
  artifact: {
    allocations: SupplyAllocation;
    contextId: "public-normal-operations";
  };
  evaluation: SupplyEvaluation;
  submittedAt: string;
};

export type Plan5FinalEntry = {
  participantId: Hex;
  challengeId: typeof plan5ChallengeId;
  submissionId: Hex;
  selectedAt: string;
};

export type Plan5Reward = {
  participantId: Hex;
  challengeId: typeof plan5ChallengeId;
  recipient: Address;
  amount: string;
  status: "PREVIEW" | "SENDING" | "PAID" | "FAILED";
  allocationRoot: Hex | null;
  transactionHash: Hex | null;
  blockNumber: string | null;
  createdAt: string;
  updatedAt: string;
  error: string | null;
};

export interface Plan5CompetitionStore {
  readonly durability: "durable-redis" | "ephemeral-memory";
  participantForUser(userId: string): Promise<Plan5Participant | null>;
  participant(participantId: string): Promise<Plan5Participant | null>;
  join(identity: Plan5Identity): Promise<Plan5Participant>;
  submissionsForParticipant(participantId: string): Promise<Plan5Submission[]>;
  submissionsForChallenge(): Promise<Plan5Submission[]>;
  addSubmission(
    input: Omit<Plan5Submission, "submissionId" | "revision" | "submittedAt">,
  ): Promise<Plan5Submission>;
  submissionForIdempotency(
    participantId: string,
    idempotencyKey: string,
  ): Promise<Plan5Submission | null>;
  saveSubmissionIdempotency(
    participantId: string,
    idempotencyKey: string,
    submissionId: string,
  ): Promise<void>;
  finalEntry(participantId: string): Promise<Plan5FinalEntry | null>;
  selectFinal(participantId: string, submissionId: string): Promise<Plan5FinalEntry>;
  reward(participantId: string): Promise<Plan5Reward | null>;
  saveReward(reward: Plan5Reward): Promise<void>;
}

const allocationsSchema = z.record(z.string(), z.number().int().nonnegative().max(1_000_000));

export const plan5SubmissionSchema = z
  .object({
    allocations: allocationsSchema,
    sourceMethod: z.enum(["VISUAL", "JSON", "UPLOAD"]),
    repositoryUrl: z.string().url().startsWith("https://github.com/").nullable().default(null),
    sourceCommit: z
      .string()
      .regex(/^[0-9a-f]{40}$/)
      .nullable()
      .default(null),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.repositoryUrl === null) !== (value.sourceCommit === null)) {
      context.addIssue({
        code: "custom",
        message: "GitHub repository and commit SHA must be supplied together",
      });
    }
  });

function userKey(userId: string) {
  return keccak256(stringToHex(`privy-user:${userId}`));
}

function participantId(userId: string) {
  return keccak256(stringToHex(`${plan5ChallengeId}:${userId}`));
}

function participantLabel(id: string) {
  return `Builder ${id.slice(2, 8).toUpperCase()}`;
}

export function createPlan5Participant(identity: Plan5Identity): Plan5Participant {
  const id = participantId(identity.userId);
  return {
    participantId: id,
    challengeId: plan5ChallengeId,
    userIdHash: userKey(identity.userId),
    wallet: getAddress(identity.wallet),
    displayName: participantLabel(id),
    joinedAt: new Date().toISOString(),
  };
}

export class MemoryPlan5CompetitionStore implements Plan5CompetitionStore {
  readonly durability = "ephemeral-memory" as const;
  private readonly participants = new Map<string, Plan5Participant>();
  private readonly userParticipants = new Map<string, string>();
  private readonly submissions = new Map<string, Plan5Submission>();
  private readonly submissionIdempotency = new Map<string, string>();
  private readonly finals = new Map<string, Plan5FinalEntry>();
  private readonly rewards = new Map<string, Plan5Reward>();

  async participantForUser(userId: string) {
    const id = this.userParticipants.get(userKey(userId));
    return id ? (this.participants.get(id) ?? null) : null;
  }

  async participant(id: string) {
    return this.participants.get(id) ?? null;
  }

  async join(identity: Plan5Identity) {
    const existing = await this.participantForUser(identity.userId);
    if (existing) return existing;
    const record = createPlan5Participant(identity);
    this.participants.set(record.participantId, record);
    this.userParticipants.set(userKey(identity.userId), record.participantId);
    return record;
  }

  async submissionsForParticipant(id: string) {
    return [...this.submissions.values()]
      .filter(({ participantId: owner }) => owner === id)
      .sort((left, right) => left.revision - right.revision);
  }

  async submissionsForChallenge() {
    return [...this.submissions.values()].sort((left, right) =>
      left.submittedAt.localeCompare(right.submittedAt),
    );
  }

  async addSubmission(input: Omit<Plan5Submission, "submissionId" | "revision" | "submittedAt">) {
    const participant = await this.participant(input.participantId);
    if (!participant) throw new Error("Join this challenge before submitting");
    const revisions = await this.submissionsForParticipant(input.participantId);
    if (revisions.length >= 20) throw new Error("Submission revision limit reached");
    const revision = revisions.length + 1;
    const submissionId = keccak256(
      stringToHex(`${input.participantId}:${revision}:${input.sourceHash}:${input.inputHash}`),
    );
    const record = { ...input, revision, submissionId, submittedAt: new Date().toISOString() };
    this.submissions.set(submissionId, record);
    return record;
  }

  async submissionForIdempotency(id: string, idempotencyKey: string) {
    const submissionId = this.submissionIdempotency.get(`${id}:${idempotencyKey}`);
    return submissionId ? (this.submissions.get(submissionId) ?? null) : null;
  }

  async saveSubmissionIdempotency(id: string, idempotencyKey: string, submissionId: string) {
    this.submissionIdempotency.set(`${id}:${idempotencyKey}`, submissionId);
  }

  async finalEntry(id: string) {
    return this.finals.get(id) ?? null;
  }

  async selectFinal(id: string, submissionId: string) {
    const submission = this.submissions.get(submissionId);
    if (!submission || submission.participantId !== id) {
      throw new Error("Submission does not belong to this participant");
    }
    const entry = {
      participantId: id as Hex,
      challengeId: plan5ChallengeId,
      submissionId: submissionId as Hex,
      selectedAt: new Date().toISOString(),
    } satisfies Plan5FinalEntry;
    this.finals.set(id, entry);
    return entry;
  }

  async reward(id: string) {
    return this.rewards.get(id) ?? null;
  }

  async saveReward(reward: Plan5Reward) {
    this.rewards.set(reward.participantId, reward);
  }
}

export function preparePlan5Submission(
  participant: Plan5Participant,
  raw: z.infer<typeof plan5SubmissionSchema>,
): Omit<Plan5Submission, "submissionId" | "revision" | "submittedAt"> {
  const artifact = {
    allocations: raw.allocations,
    contextId: "public-normal-operations" as const,
  };
  const provenance = {
    sourceMethod: raw.sourceMethod,
    repositoryUrl: raw.repositoryUrl,
    sourceCommit: raw.sourceCommit,
  };
  return {
    participantId: participant.participantId,
    challengeId: plan5ChallengeId,
    sourceMethod: raw.sourceMethod,
    sourceHash: keccak256(stringToHex(canonicalProtocolJson(provenance))),
    inputHash: keccak256(stringToHex(canonicalProtocolJson(artifact))),
    repositoryUrl: raw.repositoryUrl,
    sourceCommit: raw.sourceCommit,
    artifact,
    evaluation: evaluateSupplyAllocation(raw.allocations),
  };
}

function outcome(id: string, name: string, evaluation: SupplyEvaluation, baseline: boolean) {
  return {
    id,
    name,
    correctness: evaluation.correctness,
    baseline,
    values: {
      totalProcurementCost: evaluation.totalProcurementCost,
      worstCaseDeliveredKits: evaluation.worstCaseDeliveredKits,
    },
  } satisfies OutcomePoint;
}

export async function buildPlan5Leaderboard(store: Plan5CompetitionStore) {
  const submissions = await store.submissionsForChallenge();
  const latestByParticipant = new Map<string, Plan5Submission>();
  for (const submission of submissions)
    latestByParticipant.set(submission.participantId, submission);

  const seedRecords = emergencySupplyAgentAllocations.map((seed) => ({
    id: seed.id,
    name: seed.name,
    kind: "SEED" as const,
    wallet: getAddress(seed.wallet),
    submission: null,
    evaluation: evaluateSupplyAllocation({ ...seed.allocation }),
  }));
  const userRecords = await Promise.all(
    [...latestByParticipant.values()].map(async (submission) => {
      const participant = await store.participant(submission.participantId);
      if (!participant) throw new Error("Stored submission has no participant");
      return {
        id: submission.submissionId,
        name: participant.displayName,
        kind: "PARTICIPANT" as const,
        wallet: participant.wallet,
        submission,
        evaluation: submission.evaluation,
      };
    }),
  );
  const records = [...seedRecords, ...userRecords];
  const points = records.map((record) =>
    outcome(record.id, record.name, record.evaluation, record.kind === "SEED"),
  );
  const frontierIds = new Set(
    computeOutcomeFrontier(points, emergencySupplyMetrics).map(({ id }) => id),
  );
  const contributions = new Map(
    records.map((record) => {
      const candidate = points.find(({ id }) => id === record.id)!;
      return [
        record.id,
        computeContributionEvidence(
          points.filter(({ id }) => id !== record.id),
          candidate,
          emergencySupplyMetrics,
        ),
      ];
    }),
  );
  const rewardById = new Map(
    allocateContributionRewards(
      BigInt(plan5PoolCredits),
      userRecords.map((record) => ({
        participantId: record.id,
        wallet: record.wallet,
        correctness: record.evaluation.correctness,
        baseline: false,
        exclusiveContributionPpm: contributions.get(record.id)?.exclusiveContributionPpm ?? 0,
        reproducibilityFactorPpm: 1_000_000,
        evidenceFactorPpm: 1_000_000,
      })),
    ).map(({ participantId, amount }) => [participantId, Number(amount)]),
  );

  return {
    challengeId: plan5ChallengeId,
    contextHash: publicEmergencySupplyScenario().contextHash,
    poolCredits: plan5PoolCredits,
    participantCount: latestByParticipant.size,
    submissionCount: submissions.length,
    entries: records.map((record) => {
      const point = points.find(({ id }) => id === record.id)!;
      const dominatedBy = points
        .filter(
          (candidate) =>
            candidate.id !== point.id && dominatesOutcome(candidate, point, emergencySupplyMetrics),
        )
        .map(({ name }) => name);
      return {
        id: record.id,
        name: record.name,
        kind: record.kind,
        revision: record.submission?.revision ?? null,
        totalProcurementCost: record.evaluation.totalProcurementCost,
        worstCaseDeliveredKits: record.evaluation.worstCaseDeliveredKits,
        correctness: record.evaluation.correctness,
        frontier: frontierIds.has(record.id),
        dominatedBy,
        contributionPpm: contributions.get(record.id)?.exclusiveContributionPpm ?? 0,
        rewardPreview: rewardById.get(record.id) ?? 0,
        resultHash: record.evaluation.resultHash,
        submittedAt: record.submission?.submittedAt ?? null,
      };
    }),
  };
}

export function createStarterKitZip(): Uint8Array {
  const scenario = publicEmergencySupplyScenario();
  const submission = {
    allocations: {
      "harbor-aid": 300,
      northstar: 150,
      "inland-works": 300,
      "local-grid": 150,
      airbridge: 100,
    },
  };
  const files = {
    "emergency-supply-starter/challenge-manifest.json": strToU8(
      JSON.stringify(scenario.manifest, null, 2),
    ),
    "emergency-supply-starter/vendors.json": strToU8(JSON.stringify(scenario.vendors, null, 2)),
    "emergency-supply-starter/failure-scenarios.json": strToU8(
      JSON.stringify(scenario.failures, null, 2),
    ),
    "emergency-supply-starter/sample_submission.json": strToU8(JSON.stringify(submission, null, 2)),
    "emergency-supply-starter/README.md": strToU8(
      [
        "# Emergency Supply starter kit",
        "",
        "Allocate exactly 1,000 whole kits without exceeding vendor capacity.",
        "The evaluator minimizes procurement cost and maximizes kits delivered after any one supplier or route fails.",
        "",
        "Edit `sample_submission.json`, then upload it in the Frontier workspace.",
        'The accepted shape is `{ "allocations": { "vendor-id": integer } }`.',
      ].join("\n"),
    ),
  };
  return zipSync(files, { level: 6 });
}
