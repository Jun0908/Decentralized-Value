import {
  benchmarkStrategies,
  compareDisasterResponseEvaluations,
  computeDisasterResponseFrontier,
  defaultDisasterResponseStrategy,
  disasterResponseChallengeId,
  disasterResponsePoolCredits,
  evaluateDisasterResponseStrategy,
  publicDisasterResponseScenario,
  type DisasterResponseEvaluation,
  type DisasterResponseStrategy,
  type SupplierId,
} from "@frontier/disaster-response";
import { canonicalProtocolJson } from "@frontier/shared";
import { strToU8, zipSync } from "fflate";
import { getAddress, keccak256, stringToHex, type Address, type Hex } from "viem";
import { z } from "zod";
import type { Plan5Identity } from "./plan5-competition";

export const plan6ChallengeId = disasterResponseChallengeId;
export const plan6PoolCredits = disasterResponsePoolCredits;

export type Plan6Participant = {
  participantId: Hex;
  challengeId: typeof plan6ChallengeId;
  userIdHash: Hex;
  wallet: Address;
  displayName: string;
  joinedAt: string;
};

export type Plan6Submission = {
  submissionId: Hex;
  participantId: Hex;
  challengeId: typeof plan6ChallengeId;
  revision: number;
  sourceMethod: "VISUAL" | "JSON" | "UPLOAD" | "AGENT_API";
  sourceHash: Hex;
  inputHash: Hex;
  repositoryUrl: string | null;
  sourceCommit: string | null;
  agentEvidence: Plan6AgentEvidence | null;
  artifact: { strategy: DisasterResponseStrategy };
  evaluation: DisasterResponseEvaluation;
  submittedAt: string;
};

export type Plan6SubmissionInput = Omit<
  Plan6Submission,
  "submissionId" | "revision" | "submittedAt"
>;

export type Plan6SubmissionCommit = {
  status: "existing" | "saved";
  submission: Plan6Submission;
};

export type Plan6SubmissionIdempotency = {
  // Legacy bindings have no request digest; compare inputHash and sourceHash instead.
  bodyDigest: string | null;
  submission: Plan6Submission;
};

export class Plan6StoreError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "Plan6StoreError";
  }
}

export function createPlan6SubmissionRecord(
  input: Plan6SubmissionInput,
  revision: number,
): Plan6Submission {
  return {
    ...input,
    revision,
    submissionId: keccak256(
      stringToHex(`${input.participantId}:${revision}:${input.sourceHash}:${input.inputHash}`),
    ),
    submittedAt: new Date().toISOString(),
  };
}

export type Plan6AgentEvidence = {
  name: string;
  version: string;
  objective: string;
};

export type Plan6FinalEntry = {
  participantId: Hex;
  challengeId: typeof plan6ChallengeId;
  submissionId: Hex;
  selectedAt: string;
};

export type Plan6Reward = {
  participantId: Hex;
  challengeId: typeof plan6ChallengeId;
  recipient: Address;
  amount: string;
  awardIds: string[];
  poolAllocations?: Plan6RewardPoolAllocation[];
  allocationEvidenceHash?: Hex | null;
  status: "PREVIEW" | "SENDING" | "PAID" | "FAILED";
  allocationRoot: Hex | null;
  transactionHash: Hex | null;
  blockNumber: string | null;
  createdAt: string;
  updatedAt: string;
  error: string | null;
};

export type Plan6ValuePoolRule =
  | { type: "MAXIMIZE_METRIC"; metric: "worstCaseDeliveredKits" | "regionalFairnessPpm" }
  | {
      type: "MINIMIZE_QUALIFIED_COST";
      metric: "totalProcurementCost";
      minWorstCaseDeliveredKits: number;
      minRegionalFairnessPpm: number;
    }
  | { type: "FRONTIER_CONTRIBUTION" }
  | { type: "PROTECT_REGION"; regionId: "coast" | "river" | "highland" | "south" };

export type Plan6ValuePoolManifest = {
  schemaVersion: "1";
  poolId: string;
  challengeId: typeof plan6ChallengeId;
  source: "BUILT_IN" | "COMMUNITY";
  funderId: Hex | null;
  funderLabel: string;
  name: string;
  valueStatement: string;
  rule: Plan6ValuePoolRule;
  ruleLabel: string;
  poolCredits: number;
  contextHash: Hex;
  status: "PRACTICE" | "COMMITTED";
  manifestHash: Hex;
};

export type Plan6ValuePoolAllocation = {
  entryId: string;
  entryName: string;
  entryKind: "BENCHMARK" | "PARTICIPANT";
  credits: number;
  evidenceValue: number;
  evidenceLabel: string;
  qualificationReason: string;
  allocationFormula: string;
};

export type Plan6ValuePoolResult = Plan6ValuePoolManifest & {
  allocations: Plan6ValuePoolAllocation[];
};

export type Plan6RewardPoolAllocation = {
  poolId: string;
  poolName: string;
  manifestHash: Hex;
  credits: number;
};

export interface Plan6CompetitionStore {
  readonly durability: "durable-redis" | "ephemeral-memory";
  participantForUser(userId: string): Promise<Plan6Participant | null>;
  participant(participantId: string): Promise<Plan6Participant | null>;
  join(identity: Plan5Identity): Promise<Plan6Participant>;
  submissionsForParticipant(participantId: string): Promise<Plan6Submission[]>;
  submissionsForChallenge(): Promise<Plan6Submission[]>;
  // Supply the prior revision when input.evaluation includes a prior-evaluation diff.
  commitSubmission(
    input: Plan6SubmissionInput,
    idempotencyKey: string | null,
    bodyDigest: string,
    expectedPreviousRevision?: number,
  ): Promise<Plan6SubmissionCommit>;
  lookupSubmissionIdempotency(
    participantId: string,
    idempotencyKey: string,
  ): Promise<Plan6SubmissionIdempotency | null>;
  /** @deprecated Use commitSubmission for atomic idempotent writes. */
  addSubmission(
    input: Omit<Plan6Submission, "submissionId" | "revision" | "submittedAt">,
  ): Promise<Plan6Submission>;
  submissionForIdempotency(
    participantId: string,
    idempotencyKey: string,
  ): Promise<Plan6Submission | null>;
  /** @deprecated Compatibility binding only; cannot make a prior addSubmission atomic. */
  saveSubmissionIdempotency(
    participantId: string,
    idempotencyKey: string,
    submissionId: string,
  ): Promise<void>;
  finalEntry(participantId: string): Promise<Plan6FinalEntry | null>;
  selectFinal(participantId: string, submissionId: string): Promise<Plan6FinalEntry>;
  reward(participantId: string): Promise<Plan6Reward | null>;
  saveReward(reward: Plan6Reward): Promise<void>;
  valuePools(): Promise<Plan6ValuePoolManifest[]>;
  valuePoolForFunder(funderId: string): Promise<Plan6ValuePoolManifest | null>;
  saveValuePool(pool: Plan6ValuePoolManifest): Promise<void>;
}

const supplierIdSchema = z.enum([
  "harbor-aid",
  "northstar",
  "inland-works",
  "local-grid",
  "airbridge",
]);

export const disasterResponseStrategySchema = z
  .object({
    schemaVersion: z.literal("2"),
    name: z.string().trim().min(1).max(80),
    primarySupplierOrder: z.array(supplierIdSchema).length(5),
    emergencySupplierOrder: z.array(supplierIdSchema).length(5),
    regionPolicy: z.enum(["deadline-first", "highest-need", "equalize-coverage"]),
    reserveKits: z.number().int().min(0).max(300),
    emergencyBudgetUsd: z.number().int().min(0).max(25_000),
  })
  .strict();

export const plan6SubmissionSchema = z
  .object({
    strategy: disasterResponseStrategySchema,
    sourceMethod: z.enum(["VISUAL", "JSON", "UPLOAD", "AGENT_API"]),
    repositoryUrl: z.string().url().startsWith("https://github.com/").nullable().default(null),
    sourceCommit: z
      .string()
      .regex(/^[0-9a-f]{40}$/)
      .nullable()
      .default(null),
    agentEvidence: z
      .object({
        name: z.string().trim().min(1).max(80),
        version: z.string().trim().min(1).max(40),
        objective: z.string().trim().min(3).max(240),
      })
      .strict()
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
    if (value.sourceMethod === "AGENT_API" && !value.agentEvidence) {
      context.addIssue({
        code: "custom",
        message: "Agent submissions must include agent name, version, and objective",
      });
    }
  });

export const plan6ValuePoolSchema = z
  .object({
    name: z.string().trim().min(3).max(60),
    valueStatement: z.string().trim().min(10).max(180),
    regionId: z.enum(["coast", "river", "highland", "south"]),
    poolCredits: z.number().int().min(100).max(2_500),
  })
  .strict();

function userKey(userId: string) {
  return keccak256(stringToHex(`privy-user:${userId}`));
}

function participantId(userId: string) {
  return keccak256(stringToHex(`${plan6ChallengeId}:${userId}`));
}

export function createPlan6Participant(identity: Plan5Identity): Plan6Participant {
  const id = participantId(identity.userId);
  return {
    participantId: id,
    challengeId: plan6ChallengeId,
    userIdHash: userKey(identity.userId),
    wallet: getAddress(identity.wallet),
    displayName: `Builder ${id.slice(2, 8).toUpperCase()}`,
    joinedAt: new Date().toISOString(),
  };
}

export class MemoryPlan6CompetitionStore implements Plan6CompetitionStore {
  readonly durability = "ephemeral-memory" as const;
  private readonly participants = new Map<string, Plan6Participant>();
  private readonly userParticipants = new Map<string, string>();
  private readonly submissions = new Map<string, Plan6Submission>();
  private readonly submissionIdempotency = new Map<
    string,
    { submissionId: string; bodyDigest: string | null }
  >();
  private readonly finals = new Map<string, Plan6FinalEntry>();
  private readonly rewards = new Map<string, Plan6Reward>();
  private readonly communityValuePools = new Map<string, Plan6ValuePoolManifest>();
  private readonly valuePoolByFunder = new Map<string, string>();

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
    const record = createPlan6Participant(identity);
    this.participants.set(record.participantId, record);
    this.userParticipants.set(record.userIdHash, record.participantId);
    return record;
  }

  async submissionsForParticipant(id: string) {
    return structuredClone(
      [...this.submissions.values()]
        .filter(({ participantId: owner }) => owner === id)
        .sort((left, right) => left.revision - right.revision),
    );
  }

  async submissionsForChallenge() {
    return structuredClone(
      [...this.submissions.values()].sort((left, right) =>
        left.submittedAt.localeCompare(right.submittedAt),
      ),
    );
  }

  async commitSubmission(
    input: Plan6SubmissionInput,
    idempotencyKey: string | null,
    bodyDigest: string,
    expectedPreviousRevision?: number,
  ): Promise<Plan6SubmissionCommit> {
    // No await between reading the binding/revision and committing all state.
    const bindingKey = idempotencyKey === null ? null : `${input.participantId}:${idempotencyKey}`;
    const binding = bindingKey === null ? undefined : this.submissionIdempotency.get(bindingKey);
    if (binding) {
      const submission = this.submissions.get(binding.submissionId);
      if (!submission || submission.participantId !== input.participantId) {
        throw new Plan6StoreError(500, "STORE_INCONSISTENT", "Invalid submission binding");
      }
      if (
        (binding.bodyDigest !== null && binding.bodyDigest !== bodyDigest) ||
        submission.inputHash !== input.inputHash ||
        submission.sourceHash !== input.sourceHash
      ) {
        throw new Plan6StoreError(
          409,
          "IDEMPOTENCY_CONFLICT",
          "Idempotency key is bound to another body",
        );
      }
      return { status: "existing", submission: structuredClone(submission) };
    }
    if (!this.participants.has(input.participantId)) {
      throw new Plan6StoreError(
        403,
        "PARTICIPANT_REQUIRED",
        "Join this challenge before submitting",
      );
    }
    const previousRevision = Math.max(
      0,
      ...[...this.submissions.values()]
        .filter(({ participantId }) => participantId === input.participantId)
        .map(({ revision }) => revision),
    );
    if (previousRevision >= 20) {
      throw new Plan6StoreError(409, "REVISION_LIMIT", "Submission revision limit reached");
    }
    if (expectedPreviousRevision !== undefined && expectedPreviousRevision !== previousRevision) {
      throw new Plan6StoreError(
        409,
        "REVISION_CONFLICT",
        "Submission revision changed; prepare again",
      );
    }
    const record = structuredClone(createPlan6SubmissionRecord(input, previousRevision + 1));
    this.submissions.set(record.submissionId, record);
    if (bindingKey !== null) {
      this.submissionIdempotency.set(bindingKey, { submissionId: record.submissionId, bodyDigest });
    }
    return { status: "saved", submission: structuredClone(record) };
  }

  async addSubmission(input: Plan6SubmissionInput) {
    return (await this.commitSubmission(input, null, "")).submission;
  }

  async lookupSubmissionIdempotency(id: string, idempotencyKey: string) {
    const binding = this.submissionIdempotency.get(`${id}:${idempotencyKey}`);
    if (!binding) return null;
    const submission = this.submissions.get(binding.submissionId);
    if (!submission || submission.participantId !== id) {
      throw new Plan6StoreError(500, "STORE_INCONSISTENT", "Invalid submission binding");
    }
    return { bodyDigest: binding.bodyDigest, submission: structuredClone(submission) };
  }

  async submissionForIdempotency(id: string, idempotencyKey: string) {
    return (await this.lookupSubmissionIdempotency(id, idempotencyKey))?.submission ?? null;
  }

  async saveSubmissionIdempotency(id: string, idempotencyKey: string, submissionId: string) {
    const submission = this.submissions.get(submissionId);
    if (!submission || submission.participantId !== id) {
      throw new Plan6StoreError(
        404,
        "SUBMISSION_NOT_FOUND",
        "Submission does not belong to this participant",
      );
    }
    const bindingKey = `${id}:${idempotencyKey}`;
    const existing = this.submissionIdempotency.get(bindingKey);
    if (existing && existing.submissionId !== submissionId) {
      throw new Plan6StoreError(409, "IDEMPOTENCY_CONFLICT", "Idempotency key is already bound");
    }
    if (!existing) this.submissionIdempotency.set(bindingKey, { submissionId, bodyDigest: null });
  }

  async finalEntry(id: string) {
    return this.finals.get(id) ?? null;
  }

  async selectFinal(id: string, submissionId: string) {
    const submission = this.submissions.get(submissionId);
    if (!submission || submission.participantId !== id)
      throw new Plan6StoreError(
        404,
        "SUBMISSION_NOT_FOUND",
        "Submission does not belong to this participant",
      );
    const entry = {
      participantId: id as Hex,
      challengeId: plan6ChallengeId,
      submissionId: submissionId as Hex,
      selectedAt: new Date().toISOString(),
    } satisfies Plan6FinalEntry;
    this.finals.set(id, entry);
    return entry;
  }

  async reward(id: string) {
    return this.rewards.get(id) ?? null;
  }

  async saveReward(reward: Plan6Reward) {
    this.rewards.set(reward.participantId, reward);
  }

  async valuePools() {
    return [...this.communityValuePools.values()].sort((left, right) =>
      left.poolId.localeCompare(right.poolId),
    );
  }

  async valuePoolForFunder(funderId: string) {
    const poolId = this.valuePoolByFunder.get(funderId);
    return poolId ? (this.communityValuePools.get(poolId) ?? null) : null;
  }

  async saveValuePool(pool: Plan6ValuePoolManifest) {
    if (!pool.funderId) throw new Error("Community Value Pool requires a funder");
    this.communityValuePools.set(pool.poolId, pool);
    this.valuePoolByFunder.set(pool.funderId, pool.poolId);
  }
}

export function disasterResponseInputHash(strategy: DisasterResponseStrategy): Hex {
  return keccak256(stringToHex(canonicalProtocolJson({ strategy })));
}

export function preparePlan6Submission(
  participant: Plan6Participant,
  raw: z.infer<typeof plan6SubmissionSchema>,
  previousEvaluation: DisasterResponseEvaluation | null = null,
): Omit<Plan6Submission, "submissionId" | "revision" | "submittedAt"> {
  const strategy = raw.strategy as DisasterResponseStrategy;
  const artifact = { strategy };
  const provenance = {
    sourceMethod: raw.sourceMethod,
    repositoryUrl: raw.repositoryUrl,
    sourceCommit: raw.sourceCommit,
    agentEvidence: raw.agentEvidence,
  };
  return {
    participantId: participant.participantId,
    challengeId: plan6ChallengeId,
    sourceMethod: raw.sourceMethod,
    sourceHash: keccak256(stringToHex(canonicalProtocolJson(provenance))),
    inputHash: disasterResponseInputHash(strategy),
    repositoryUrl: raw.repositoryUrl,
    sourceCommit: raw.sourceCommit,
    agentEvidence: raw.agentEvidence,
    artifact,
    evaluation: compareDisasterResponseEvaluations(
      evaluateDisasterResponseStrategy(strategy),
      previousEvaluation,
    ),
  };
}

type ValuePoolWithoutIdentity = Omit<Plan6ValuePoolManifest, "poolId" | "manifestHash">;

function valuePoolWithHash(
  poolId: string | null,
  valuePool: ValuePoolWithoutIdentity,
): Plan6ValuePoolManifest {
  const manifestHash = keccak256(stringToHex(canonicalProtocolJson(valuePool)));
  return { ...valuePool, poolId: poolId ?? manifestHash, manifestHash };
}

const valuePoolContextHash = publicDisasterResponseScenario().contextHash;

export const initialPlan6ValuePools: Plan6ValuePoolManifest[] = [
  valuePoolWithHash("resilience", {
    schemaVersion: "1",
    challengeId: plan6ChallengeId,
    source: "BUILT_IN",
    funderId: null,
    funderLabel: "Emergency coordinators",
    name: "Global Relief Fund",
    valueStatement: "Keep the largest amount of aid moving through the worst disruption.",
    rule: { type: "MAXIMIZE_METRIC", metric: "worstCaseDeliveredKits" },
    ruleLabel: "Highest worst-case delivery",
    poolCredits: 2_500,
    contextHash: valuePoolContextHash,
    status: "COMMITTED",
  }),
  valuePoolWithHash("efficiency", {
    schemaVersion: "1",
    challengeId: plan6ChallengeId,
    source: "BUILT_IN",
    funderId: null,
    funderLabel: "Public donors",
    name: "Donor Efficiency Pool",
    valueStatement: "Spend the least while respecting every public strategy constraint.",
    rule: {
      type: "MINIMIZE_QUALIFIED_COST",
      metric: "totalProcurementCost",
      minWorstCaseDeliveredKits: 0,
      minRegionalFairnessPpm: 0,
    },
    ruleLabel: "Lowest valid total cost",
    poolCredits: 2_500,
    contextHash: valuePoolContextHash,
    status: "COMMITTED",
  }),
  valuePoolWithHash("fairness", {
    schemaVersion: "1",
    challengeId: plan6ChallengeId,
    source: "BUILT_IN",
    funderId: null,
    funderLabel: "Regional communities",
    name: "Local Communities Pool",
    valueStatement: "Raise the coverage of the community that would otherwise receive the least.",
    rule: { type: "MAXIMIZE_METRIC", metric: "regionalFairnessPpm" },
    ruleLabel: "Highest worst-region coverage",
    poolCredits: 2_500,
    contextHash: valuePoolContextHash,
    status: "COMMITTED",
  }),
  valuePoolWithHash("frontier", {
    schemaVersion: "1",
    challengeId: plan6ChallengeId,
    source: "BUILT_IN",
    funderId: null,
    funderLabel: "Frontier builders",
    name: "Frontier Expansion Pool",
    valueStatement: "Reward every solution that adds a useful trade-off missing from the field.",
    rule: { type: "FRONTIER_CONTRIBUTION" },
    ruleLabel: "Proportional exclusive frontier contribution",
    poolCredits: 2_500,
    contextHash: valuePoolContextHash,
    status: "COMMITTED",
  }),
];

function valueFunderId(userId: string) {
  return keccak256(stringToHex(`plan6-value-funder:${userId}`));
}

export function createPlan6CommunityValuePool(
  identity: Plan5Identity,
  input: z.infer<typeof plan6ValuePoolSchema>,
): Plan6ValuePoolManifest {
  const funderId = valueFunderId(identity.userId);
  const region = publicDisasterResponseScenario().regions.find(({ id }) => id === input.regionId)!;
  return valuePoolWithHash(null, {
    schemaVersion: "1",
    challengeId: plan6ChallengeId,
    source: "COMMUNITY",
    funderId,
    funderLabel: `Community ${funderId.slice(2, 8).toUpperCase()}`,
    name: input.name,
    valueStatement: input.valueStatement,
    rule: { type: "PROTECT_REGION", regionId: input.regionId },
    ruleLabel: `Highest minimum coverage for ${region.name}`,
    poolCredits: input.poolCredits,
    contextHash: valuePoolContextHash,
    status: "PRACTICE",
  });
}

export function plan6ValueFunderId(userId: string) {
  return valueFunderId(userId);
}

export type Plan6Award = {
  id: "resilience" | "efficiency" | "fairness" | "frontier";
  name: string;
  explanation: string;
  poolCredits: number;
  winnerIds: string[];
  winnerNames: string[];
};

function awardWinners<T>(records: T[], value: (record: T) => number, direction: "MIN" | "MAX") {
  if (records.length === 0) return [];
  const target =
    direction === "MIN" ? Math.min(...records.map(value)) : Math.max(...records.map(value));
  return records.filter((record) => value(record) === target);
}

type Plan6LeaderboardRecord = {
  id: string;
  name: string;
  approach: string;
  kind: "BENCHMARK" | "PARTICIPANT";
  wallet: Address | null;
  submission: Plan6Submission | null;
  evaluation: DisasterResponseEvaluation;
};

function deterministicRecordOrder(records: Plan6LeaderboardRecord[]) {
  return [...records].sort(
    (left, right) =>
      left.evaluation.resultHash.localeCompare(right.evaluation.resultHash) ||
      (left.wallet ?? left.id).localeCompare(right.wallet ?? right.id),
  );
}

function equalPoolAllocations(
  pool: Plan6ValuePoolManifest,
  winners: Plan6LeaderboardRecord[],
  evidenceValue: (record: Plan6LeaderboardRecord) => number,
  evidenceLabel: (record: Plan6LeaderboardRecord) => string,
  qualificationReason: (record: Plan6LeaderboardRecord) => string,
): Plan6ValuePoolAllocation[] {
  const ordered = deterministicRecordOrder(winners);
  if (ordered.length === 0) return [];
  const share = Math.floor(pool.poolCredits / ordered.length);
  const remainder = pool.poolCredits - share * ordered.length;
  return ordered.map((record, index) => ({
    entryId: record.id,
    entryName: record.name,
    entryKind: record.kind,
    credits: share + (index < remainder ? 1 : 0),
    evidenceValue: evidenceValue(record),
    evidenceLabel: evidenceLabel(record),
    qualificationReason: qualificationReason(record),
    allocationFormula: `${pool.poolCredits} credits / ${ordered.length} exact winner${ordered.length === 1 ? "" : "s"}; deterministic hash order receives any remainder`,
  }));
}

function proportionalFrontierAllocations(
  pool: Plan6ValuePoolManifest,
  records: Plan6LeaderboardRecord[],
  frontierById: Map<string, ReturnType<typeof computeDisasterResponseFrontier>[number]>,
): Plan6ValuePoolAllocation[] {
  const contributors = deterministicRecordOrder(records)
    .map((record) => ({
      record,
      weight: frontierById.get(record.id)?.contribution.exclusiveContributionPpm ?? 0,
    }))
    .filter(({ weight }) => weight > 0);
  const totalWeight = contributors.reduce((sum, { weight }) => sum + weight, 0);
  if (totalWeight === 0) return [];
  const base = contributors.map(({ record, weight }) => ({
    entryId: record.id,
    entryName: record.name,
    entryKind: record.kind,
    credits: Math.floor((pool.poolCredits * weight) / totalWeight),
    evidenceValue: weight,
    evidenceLabel: `${(weight / 10_000).toFixed(2)}% exclusive frontier`,
    qualificationReason: `Positive exclusive frontier contribution of ${(weight / 10_000).toFixed(2)}%`,
    allocationFormula: `floor(${pool.poolCredits} × ${weight} / ${totalWeight}); deterministic result-hash order receives any remainder`,
  }));
  let remainder = pool.poolCredits - base.reduce((sum, allocation) => sum + allocation.credits, 0);
  for (const allocation of base) {
    if (remainder === 0) break;
    allocation.credits += 1;
    remainder -= 1;
  }
  return base;
}

function minimumRegionCoverage(evaluation: DisasterResponseEvaluation, regionId: string) {
  return Math.min(
    ...evaluation.scenarioOutcomes.map(
      (outcome) =>
        outcome.regionOutcomes.find(({ regionId: outcomeRegionId }) => outcomeRegionId === regionId)
          ?.coveragePpm ?? 0,
    ),
  );
}

function evaluateValuePool(
  pool: Plan6ValuePoolManifest,
  records: Plan6LeaderboardRecord[],
  frontierById: Map<string, ReturnType<typeof computeDisasterResponseFrontier>[number]>,
): Plan6ValuePoolResult {
  const correct = records.filter(({ evaluation }) => evaluation.correctness);
  const rule = pool.rule;
  if (rule.type === "FRONTIER_CONTRIBUTION") {
    return {
      ...pool,
      allocations: proportionalFrontierAllocations(pool, correct, frontierById),
    };
  }
  if (rule.type === "MINIMIZE_QUALIFIED_COST") {
    const eligible = correct.filter(
      ({ evaluation }) =>
        evaluation.worstCaseDeliveredKits >= rule.minWorstCaseDeliveredKits &&
        evaluation.regionalFairnessPpm >= rule.minRegionalFairnessPpm,
    );
    const winners = awardWinners(
      eligible,
      ({ evaluation }) => evaluation.totalProcurementCost,
      "MIN",
    );
    return {
      ...pool,
      allocations: equalPoolAllocations(
        pool,
        winners,
        ({ evaluation }) => evaluation.totalProcurementCost,
        ({ evaluation }) => `$${evaluation.totalProcurementCost.toLocaleString("en-US")} cost`,
        ({ evaluation }) =>
          `Lowest cost among valid entries: $${evaluation.totalProcurementCost.toLocaleString("en-US")}`,
      ),
    };
  }
  if (rule.type === "PROTECT_REGION") {
    const winners = awardWinners(
      correct,
      ({ evaluation }) => minimumRegionCoverage(evaluation, rule.regionId),
      "MAX",
    );
    return {
      ...pool,
      allocations: equalPoolAllocations(
        pool,
        winners,
        ({ evaluation }) => minimumRegionCoverage(evaluation, rule.regionId),
        ({ evaluation }) =>
          `${(minimumRegionCoverage(evaluation, rule.regionId) / 10_000).toFixed(1)}% minimum coverage`,
        ({ evaluation }) =>
          `Highest minimum ${rule.regionId} coverage: ${(minimumRegionCoverage(evaluation, rule.regionId) / 10_000).toFixed(1)}%`,
      ),
    };
  }
  const metric = rule.metric;
  const winners = awardWinners(correct, ({ evaluation }) => evaluation[metric], "MAX");
  return {
    ...pool,
    allocations: equalPoolAllocations(
      pool,
      winners,
      ({ evaluation }) => evaluation[metric],
      ({ evaluation }) =>
        metric === "worstCaseDeliveredKits"
          ? `${evaluation.worstCaseDeliveredKits} kits in the worst case`
          : `${(evaluation.regionalFairnessPpm / 10_000).toFixed(1)}% worst-region coverage`,
      ({ evaluation }) =>
        metric === "worstCaseDeliveredKits"
          ? `Highest valid worst-case delivery: ${evaluation.worstCaseDeliveredKits} kits`
          : `Highest valid worst-region coverage: ${(evaluation.regionalFairnessPpm / 10_000).toFixed(1)}%`,
    ),
  };
}

export async function buildPlan6Leaderboard(store: Plan6CompetitionStore) {
  const submissions = await store.submissionsForChallenge();
  const submissionsByParticipant = new Map<string, Plan6Submission[]>();
  for (const submission of submissions) {
    const values = submissionsByParticipant.get(submission.participantId) ?? [];
    values.push(submission);
    submissionsByParticipant.set(submission.participantId, values);
  }

  const selectedSubmissions: Plan6Submission[] = [];
  for (const [id, values] of submissionsByParticipant) {
    const finalEntry = await store.finalEntry(id);
    const selected = finalEntry
      ? values.find(({ submissionId }) => submissionId === finalEntry.submissionId)
      : values.sort((left, right) => left.revision - right.revision).at(-1);
    if (selected) selectedSubmissions.push(selected);
  }

  const seedRecords: Plan6LeaderboardRecord[] = benchmarkStrategies.map(
    ({ id, name, approach, strategy }) => ({
      id,
      name,
      approach,
      kind: "BENCHMARK" as const,
      wallet: null,
      submission: null,
      evaluation: evaluateDisasterResponseStrategy(strategy),
    }),
  );
  const userRecords: Plan6LeaderboardRecord[] = await Promise.all(
    selectedSubmissions.map(async (submission) => {
      const participant = await store.participant(submission.participantId);
      if (!participant) throw new Error("Stored submission has no participant");
      return {
        id: submission.submissionId,
        name: participant.displayName,
        approach: submission.artifact.strategy.name,
        kind: "PARTICIPANT" as const,
        wallet: participant.wallet,
        submission,
        evaluation: submission.evaluation,
      };
    }),
  );
  const records: Plan6LeaderboardRecord[] = [...seedRecords, ...userRecords];
  const frontierRecords = computeDisasterResponseFrontier(
    records.map((record) => ({
      id: record.id,
      name: record.name,
      baseline: record.kind === "BENCHMARK",
      evaluation: record.evaluation,
    })),
  );
  const frontierById = new Map(frontierRecords.map((record) => [record.id, record]));
  const communityPools = await store.valuePools();
  const poolManifests = [
    ...initialPlan6ValuePools,
    ...communityPools.sort((left, right) => left.poolId.localeCompare(right.poolId)),
  ];
  const valuePools = poolManifests.map((pool) => evaluateValuePool(pool, records, frontierById));
  const awards: Plan6Award[] = valuePools
    .filter(({ source }) => source === "BUILT_IN")
    .map((pool) => ({
      id: pool.poolId as Plan6Award["id"],
      name: pool.name,
      explanation: pool.valueStatement,
      poolCredits: pool.poolCredits,
      winnerIds: pool.allocations.map(({ entryId }) => entryId),
      winnerNames: pool.allocations.map(({ entryName }) => entryName),
    }));
  const poolCredits = valuePools.reduce((sum, pool) => sum + pool.poolCredits, 0);
  const committedPoolCredits = valuePools
    .filter(({ status }) => status === "COMMITTED")
    .reduce((sum, pool) => sum + pool.poolCredits, 0);

  return {
    challengeId: plan6ChallengeId,
    contextHash: publicDisasterResponseScenario().contextHash,
    finalScenarioCommitment: publicDisasterResponseScenario().finalScenarioCommitment,
    poolCredits,
    committedPoolCredits,
    practicePoolCredits: poolCredits - committedPoolCredits,
    participantCount: submissionsByParticipant.size,
    submissionCount: submissions.length,
    valuePools,
    awards,
    entries: records.map((record) => {
      const frontierRecord = frontierById.get(record.id)!;
      const valueAllocations = valuePools.flatMap((pool) =>
        pool.allocations
          .filter(({ entryId, credits }) => entryId === record.id && credits > 0)
          .map((allocation) => ({
            poolId: pool.poolId,
            poolName: pool.name,
            poolStatus: pool.status,
            manifestHash: pool.manifestHash,
            credits: allocation.credits,
            evidenceValue: allocation.evidenceValue,
            evidenceLabel: allocation.evidenceLabel,
            qualificationReason: allocation.qualificationReason,
            allocationFormula: allocation.allocationFormula,
          })),
      );
      const rewardPreview = valueAllocations.reduce(
        (sum, allocation) => sum + allocation.credits,
        0,
      );
      const settlementEligibleCredits = valueAllocations
        .filter(({ poolStatus }) => poolStatus === "COMMITTED")
        .reduce((sum, allocation) => sum + allocation.credits, 0);
      return {
        id: record.id,
        name: record.name,
        approach: record.approach,
        kind: record.kind,
        revision: record.submission?.revision ?? null,
        totalProcurementCost: record.evaluation.totalProcurementCost,
        worstCaseDeliveredKits: record.evaluation.worstCaseDeliveredKits,
        regionalFairnessPpm: record.evaluation.regionalFairnessPpm,
        correctness: record.evaluation.correctness,
        frontier: frontierRecord.frontier,
        dominatedBy: frontierRecord.dominatedBy,
        contributionPpm: frontierRecord.contribution.exclusiveContributionPpm,
        awardIds: valueAllocations
          .filter(({ poolStatus }) => poolStatus === "COMMITTED")
          .map(({ poolId }) => poolId),
        valueAllocations,
        rewardPreview,
        settlementEligibleCredits,
        resultHash: record.evaluation.resultHash,
        submittedAt: record.submission?.submittedAt ?? null,
      };
    }),
  };
}

export function createPlan6StarterKitZip(): Uint8Array {
  const scenario = publicDisasterResponseScenario();
  const files = {
    "disaster-response-starter/challenge-manifest.json": strToU8(
      JSON.stringify(scenario.manifest, null, 2),
    ),
    "disaster-response-starter/network.json": strToU8(
      JSON.stringify({ suppliers: scenario.suppliers, regions: scenario.regions }, null, 2),
    ),
    "disaster-response-starter/training-scenarios.json": strToU8(
      JSON.stringify(scenario.trainingScenarios, null, 2),
    ),
    "disaster-response-starter/value-pools.json": strToU8(
      JSON.stringify(initialPlan6ValuePools, null, 2),
    ),
    "disaster-response-starter/sample_strategy.json": strToU8(
      JSON.stringify({ strategy: defaultDisasterResponseStrategy }, null, 2),
    ),
    "disaster-response-starter/submission-schema.json": strToU8(
      JSON.stringify(scenario.strategySchema, null, 2),
    ),
    "disaster-response-starter/evaluation-contract.json": strToU8(
      JSON.stringify(
        {
          challengeId: scenario.challengeId,
          evaluatorVersion: scenario.evaluatorVersion,
          dataVersion: scenario.dataVersion,
          contextHash: scenario.contextHash,
          finalScenarioCommitment: scenario.finalScenarioCommitment,
          trainingScenarios: scenario.trainingScenarios,
          metrics: scenario.metrics,
          constraints: scenario.constraints,
          limits: scenario.limits,
          practiceEndpoint: "/v1/disaster-response/evaluations",
          submissionEndpoint: "/v1/challenges/disaster-response/submissions",
          rewardBasis: "measured-outcomes-only",
        },
        null,
        2,
      ),
    ),
    "disaster-response-starter/agent-submission.example.json": strToU8(
      JSON.stringify(
        {
          strategy: defaultDisasterResponseStrategy,
          sourceMethod: "AGENT_API",
          repositoryUrl: null,
          sourceCommit: null,
          agentEvidence: {
            name: "Baseline Priority Agent",
            version: "1.0.0",
            objective: "Explore a balanced cost, resilience, and regional fairness trade-off.",
          },
        },
        null,
        2,
      ),
    ),
    "disaster-response-starter/policy-artifact-v1.schema.json": strToU8(
      JSON.stringify(
        {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          title: "Disaster Response Policy Artifact v1 (design only)",
          description:
            "A declarative future artifact for post-disruption decisions. The current instant demo does not accept or execute this artifact.",
          "x-frontier-status": "DESIGN_ONLY_NOT_ACCEPTED",
          type: "object",
          additionalProperties: false,
          required: ["schemaVersion", "name", "rules"],
          properties: {
            schemaVersion: { const: "1" },
            name: { type: "string", minLength: 1, maxLength: 80 },
            rules: {
              type: "array",
              maxItems: 32,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["when", "then"],
                properties: {
                  when: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      disabledSupplierId: {
                        enum: scenario.suppliers.map(({ id }) => id as SupplierId),
                      },
                      disabledRouteId: {
                        enum: [...new Set(scenario.suppliers.map(({ routeId }) => routeId))],
                      },
                      minimumRemainingBudgetUsd: { type: "integer", minimum: 0, maximum: 72_000 },
                    },
                  },
                  then: {
                    type: "object",
                    additionalProperties: false,
                    required: ["emergencySupplierOrder", "regionPolicy"],
                    properties: {
                      emergencySupplierOrder:
                        scenario.strategySchema.properties.emergencySupplierOrder,
                      regionPolicy: scenario.strategySchema.properties.regionPolicy,
                    },
                  },
                },
              },
            },
          },
        },
        null,
        2,
      ),
    ),
    "disaster-response-starter/baseline-agent.mjs": strToU8(
      [
        'import { readFile } from "node:fs/promises";',
        "",
        'const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";',
        'const sample = JSON.parse(await readFile(new URL("./sample_strategy.json", import.meta.url), "utf8"));',
        "const response = await fetch(`${baseUrl}/v1/disaster-response/evaluations`, {",
        '  method: "POST",',
        '  headers: { "content-type": "application/json" },',
        "  body: JSON.stringify(sample.strategy),",
        "});",
        "const result = await response.json();",
        "if (!response.ok) throw new Error(JSON.stringify(result));",
        "console.log(JSON.stringify({",
        "  evaluatorVersion: result.evaluatorVersion,",
        "  contextHash: result.contextHash,",
        "  resultHash: result.resultHash,",
        "  outcomes: {",
        "    totalProcurementCost: result.totalProcurementCost,",
        "    worstCaseDeliveredKits: result.worstCaseDeliveredKits,",
        "    regionalFairnessPpm: result.regionalFairnessPpm,",
        "  },",
        "}, null, 2));",
      ].join("\n"),
    ),
    "disaster-response-starter/README.md": strToU8(
      [
        "# 72-Hour Disaster Response starter kit",
        "",
        "Build a deterministic strategy for supplier priority, emergency procurement, and regional dispatch.",
        "The evaluator replays public training scenarios and a precommitted instant-demo final set.",
        "Cost, worst-case delivery, and worst-region coverage remain independent metrics.",
        "Independent Value Pools fund different outcomes instead of creating one overall score.",
        "",
        "## Reproduce a practice evaluation",
        "",
        "1. Start the web app with `pnpm dev` from the repository root.",
        "2. Run `node baseline-agent.mjs http://127.0.0.1:3000` from this directory.",
        "3. Edit `sample_strategy.json`, rerun the command, and compare the deterministic result hash.",
        "",
        "`evaluation-contract.json` publishes the evaluator/data versions, context, metrics, constraints, scenarios, endpoints, and equal limits used by the Human UI and Agent API.",
        "Use `agent-submission.example.json` as the authenticated submission body. Agent name, version, objective, Strategy JSON, and each saved revision become evidence; only measured outcomes affect allocation.",
        "`policy-artifact-v1.schema.json` is a design-only future contract. It is not accepted or executed by the current instant demo.",
      ].join("\n"),
    ),
  };
  return zipSync(files, { level: 6, mtime: new Date(2026, 0, 1) });
}
