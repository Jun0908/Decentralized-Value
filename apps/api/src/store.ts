import type { BenchmarkRecord } from "@frontier/shared";
import { keccak256, stringToHex, type Hex } from "viem";

export type JobState = "queued" | "dispatching" | "running" | "attested" | "failed";
export type EvaluationJob = {
  jobId: string;
  artifactId: Hex;
  challengeId: Hex;
  state: JobState;
  runnerEnsName: string | null;
  resultHash: Hex | null;
  signature: Hex | null;
  txHash: Hex | null;
  frontier: boolean | null;
  error: string | null;
  createdAt: string;
};

export type ApiArtifact = BenchmarkRecord["artifacts"][number] & {
  artifactId: Hex;
  challengeId: Hex;
  sourceCommit: string;
  version: string;
  author: string | null;
};

export class FrontierStore {
  readonly challengeId: Hex;
  readonly artifacts = new Map<Hex, ApiArtifact>();
  readonly jobs = new Map<string, EvaluationJob>();
  readonly disputes: Array<{
    challengeId: Hex;
    artifactId: Hex;
    reason: string;
    createdAt: string;
  }> = [];
  readonly idempotency = new Map<string, string>();

  constructor(readonly benchmark: BenchmarkRecord) {
    this.challengeId = keccak256(stringToHex(`frontier:${benchmark.contextHash}`));
    for (const artifact of benchmark.artifacts) {
      this.artifacts.set(artifact.artifactHash, {
        ...artifact,
        artifactId: artifact.artifactHash,
        challengeId: this.challengeId,
        sourceCommit: benchmark.sourceCommit,
        version: benchmark.workloadVersion,
        author: null,
      });
    }
  }

  createJob(artifactId: Hex, idempotencyKey?: string): EvaluationJob {
    if (idempotencyKey) {
      const existingId = this.idempotency.get(idempotencyKey);
      const existing = existingId ? this.jobs.get(existingId) : undefined;
      if (existing) return existing;
    }
    const job: EvaluationJob = {
      jobId: crypto.randomUUID(),
      artifactId,
      challengeId: this.challengeId,
      state: "queued",
      runnerEnsName: null,
      resultHash: null,
      signature: null,
      txHash: null,
      frontier: null,
      error: null,
      createdAt: new Date().toISOString(),
    };
    this.jobs.set(job.jobId, job);
    if (idempotencyKey) this.idempotency.set(idempotencyKey, job.jobId);
    return job;
  }
}
