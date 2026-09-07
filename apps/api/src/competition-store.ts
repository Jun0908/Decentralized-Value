import {
  canonicalProtocolJson,
  participantRecordSchema,
  sourceBundleSchema,
  type FinalEntry,
  type ParticipantRecord,
  type SourceBundle,
  type SubmissionRevision,
} from "@frontier/shared";
import { getAddress, keccak256, stringToHex } from "viem";

export type StoredSubmission = SubmissionRevision & {
  evaluation: Record<string, unknown>;
};

const MAX_REVISIONS = 20;

function sourceDocument(source: SourceBundle) {
  if (source.visibility === "PRIVATE") {
    throw new Error(
      "Private source requires encrypted durable storage and is unavailable in sandbox mode",
    );
  }
  if (source.method === "GITHUB") {
    return {
      method: source.method,
      visibility: source.visibility,
      repositoryUrl: source.repositoryUrl.replace(/\/$/, ""),
      sourceCommit: source.sourceCommit.toLowerCase(),
    };
  }
  const filename = source.filename.replaceAll("\\", "/");
  if (filename.startsWith("/") || filename.split("/").includes("..")) {
    throw new Error("Source filename must be a safe relative path");
  }
  return {
    method: source.method,
    visibility: source.visibility,
    filename,
    content: source.content.replaceAll("\r\n", "\n").replaceAll("\r", "\n"),
  };
}

export class CompetitionSandboxStore {
  readonly participants = new Map<string, ParticipantRecord>();
  readonly submissions = new Map<string, StoredSubmission>();
  readonly finalEntries = new Map<string, FinalEntry>();

  register(challengeId: string, wallet: string): ParticipantRecord {
    const normalizedWallet = getAddress(wallet);
    const key = `${challengeId}:${normalizedWallet.toLowerCase()}`;
    const existing = this.participants.get(key);
    if (existing) return existing;
    const participantId = keccak256(stringToHex(`sandbox-participant:${key}`));
    const record = participantRecordSchema.parse({
      participantId,
      challengeId,
      wallet: normalizedWallet,
      identityPolicy: "WALLET_ONLY",
      identityReferenceHash: keccak256(stringToHex(normalizedWallet.toLowerCase())),
      registeredAt: new Date().toISOString(),
    });
    this.participants.set(key, record);
    return record;
  }

  participant(participantId: string): ParticipantRecord | undefined {
    return [...this.participants.values()].find((record) => record.participantId === participantId);
  }

  addSubmission(input: {
    participantId: string;
    challengeId: string;
    source: unknown;
    artifactInput: unknown;
    evaluation: Record<string, unknown> & { resultHash: string; correctness: boolean };
  }): StoredSubmission {
    const participant = this.participant(input.participantId);
    if (!participant || participant.challengeId !== input.challengeId) {
      throw new Error("Participant is not registered for this challenge");
    }
    const revisions = this.forParticipant(input.participantId);
    if (revisions.length >= MAX_REVISIONS) throw new Error("Submission revision limit reached");
    const source = sourceBundleSchema.parse(input.source);
    const normalizedSource = sourceDocument(source);
    const sourceHash = keccak256(stringToHex(canonicalProtocolJson(normalizedSource)));
    const inputHash = keccak256(stringToHex(canonicalProtocolJson(input.artifactInput)));
    const revision = revisions.length + 1;
    const submissionId = keccak256(
      stringToHex(`${input.participantId}:${revision}:${sourceHash}:${inputHash}`),
    );
    const submission: StoredSubmission = {
      submissionId,
      participantId: input.participantId as `0x${string}`,
      challengeId: input.challengeId,
      revision,
      sourceMethod: source.method,
      sourceVisibility: source.visibility,
      sourceHash,
      inputHash,
      evaluationResultHash: input.evaluation.resultHash as `0x${string}`,
      correctness: input.evaluation.correctness,
      submittedAt: new Date().toISOString(),
      evaluation: input.evaluation,
    };
    this.submissions.set(submissionId, submission);
    return submission;
  }

  forParticipant(participantId: string): StoredSubmission[] {
    return [...this.submissions.values()]
      .filter((submission) => submission.participantId === participantId)
      .sort((left, right) => left.revision - right.revision);
  }

  selectFinal(participantId: string, submissionId: string): FinalEntry {
    const submission = this.submissions.get(submissionId);
    if (!submission || submission.participantId !== participantId) {
      throw new Error("Submission does not belong to this participant");
    }
    const key = `${submission.challengeId}:${participantId}`;
    const existing = this.finalEntries.get(key);
    if (existing?.frozenAt) throw new Error("Final entry is frozen");
    const entry: FinalEntry = {
      participantId: participantId as `0x${string}`,
      challengeId: submission.challengeId,
      submissionId: submissionId as `0x${string}`,
      selectedAt: new Date().toISOString(),
      frozenAt: null,
    };
    this.finalEntries.set(key, entry);
    return entry;
  }
}
