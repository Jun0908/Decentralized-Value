import { describe, expect, it } from "vitest";
import { CompetitionSandboxStore } from "./competition-store";

const result = {
  resultHash: `0x${"22".repeat(32)}`,
  correctness: true,
};

describe("CompetitionSandboxStore", () => {
  it("is idempotent per challenge and wallet", () => {
    const store = new CompetitionSandboxStore();
    const first = store.register(
      "emergency-supply-v1",
      "0x1111111111111111111111111111111111111111",
    );
    const second = store.register(
      "emergency-supply-v1",
      "0x1111111111111111111111111111111111111111",
    );
    expect(second.participantId).toBe(first.participantId);
  });

  it("normalizes source and rejects private content without encrypted storage", () => {
    const store = new CompetitionSandboxStore();
    const participant = store.register(
      "emergency-supply-v1",
      "0x1111111111111111111111111111111111111111",
    );
    expect(() =>
      store.addSubmission({
        participantId: participant.participantId,
        challengeId: participant.challengeId,
        source: {
          method: "INLINE",
          visibility: "PRIVATE",
          filename: "entry.ts",
          content: "secret",
        },
        artifactInput: {},
        evaluation: result,
      }),
    ).toThrow(/encrypted durable storage/);
  });

  it("allows revisions and only selects submissions owned by the participant", () => {
    const store = new CompetitionSandboxStore();
    const participant = store.register(
      "emergency-supply-v1",
      "0x1111111111111111111111111111111111111111",
    );
    const submission = store.addSubmission({
      participantId: participant.participantId,
      challengeId: participant.challengeId,
      source: {
        method: "INLINE",
        visibility: "PUBLIC",
        filename: "entry.ts",
        content: "export default {};\r\n",
      },
      artifactInput: {},
      evaluation: result,
    });
    expect(submission.revision).toBe(1);
    expect(
      store.selectFinal(participant.participantId, submission.submissionId).frozenAt,
    ).toBeNull();
    expect(() => store.selectFinal(`0x${"33".repeat(32)}`, submission.submissionId)).toThrow(
      /does not belong/,
    );
  });
});
