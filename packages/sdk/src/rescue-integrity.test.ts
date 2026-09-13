import { describe, expect, it } from "vitest";
import { keccak256, stringToHex } from "viem";
import { cliContextSchema } from "@frontier/shared/cli";
import { canonicalProtocolJson } from "@frontier/shared/manifest";
import fixture from "../../../tests/fixtures/rescue-room.json";
import {
  evaluateRescueDoctrinePracticeEpisode,
  normalizeRescueDoctrine,
  rescuePublicPracticeEpisodeIds,
  rescueDoctrinePresets,
} from "../../rescue-room/src/index";
import {
  verifyRescueDoctrinePracticeIntegrity,
  type RescueDoctrineIntegrityRequest,
} from "./rescue-integrity";

const context = cliContextSchema.parse(fixture.manifest.context);
function makeInput(
  artifact: Record<string, unknown> = fixture.manifest.artifact.sample,
  episodeId = fixture.raw.episode.id,
) {
  const evaluated = evaluateRescueDoctrinePracticeEpisode(artifact, episodeId);
  const raw = {
    state: "simulated" as const,
    strategyState: "deterministic-rules" as const,
    paymentState: "game-credits" as const,
    ...evaluated,
  };
  const request: RescueDoctrineIntegrityRequest = {
    artifact: structuredClone(artifact),
    episodeId,
    context: structuredClone(context),
  };
  const run = {
    schemaVersion: "1" as const,
    runId: "run_00000000-0000-4000-8000-000000000001",
    arenaId: "rescue-room" as const,
    baseUrl: "https://local-fixture.example",
    createdAt: "2026-09-12T00:00:00.000Z",
    context: structuredClone(context),
    episodeId,
    artifact: structuredClone(artifact),
    artifactHash: raw.doctrineHash,
    resultHash: raw.evaluationHash,
    correctness: raw.outcome.correctness,
    values: {
      totalUserLossUsd: raw.outcome.userLossUsd,
      servedProtocolDemandPpm: raw.outcome.servedProtocolDemandPpm,
      netResponseSpendCredits: raw.outcome.netResponseSpendCredits,
    },
    raw,
  };
  return { request, run };
}
const hash = (value: unknown) => keccak256(stringToHex(canonicalProtocolJson(value)));
function reseal(input: ReturnType<typeof makeInput>) {
  const { evidenceHash: _paymentHash, ...payment } = input.run.raw.paymentEvidence;
  input.run.raw.paymentEvidence.evidenceHash = hash(payment);
  const { resultHash: _resultHash, ...outcome } = input.run.raw.outcome;
  input.run.raw.outcome.transcriptHash = hash(outcome.transcript);
  input.run.raw.outcome.resultHash = hash({
    ...outcome,
    transcriptHash: input.run.raw.outcome.transcriptHash,
  });
  input.run.raw.replay.resultHash = input.run.raw.outcome.resultHash;
  const {
    state,
    strategyState,
    paymentState,
    evaluationHash: _evaluationHash,
    ...evaluation
  } = input.run.raw;
  void state;
  void strategyState;
  void paymentState;
  void _paymentHash;
  void _resultHash;
  void _evaluationHash;
  input.run.raw.evaluationHash = hash(evaluation);
  input.run.resultHash = input.run.raw.evaluationHash;
}

describe("Rescue Doctrine SDK integrity verifier", () => {
  it("verifies the checked-in response without claiming replay, signatures or real payment", () => {
    const input = makeInput();
    expect(input.run.raw).toEqual(fixture.raw);
    const before = structuredClone(input);
    const report = verifyRescueDoctrinePracticeIntegrity(input);
    expect(report).toMatchObject({
      verification: "hash-consistency",
      integrityVerified: true,
      evaluatorReplay: false,
      correctnessVerified: false,
      signatureVerified: false,
      paymentVerified: false,
      commitmentPreimagesVerified: false,
    });
    expect(report.hashes.evaluation).toBe(fixture.raw.evaluationHash);
    expect(report.checkedOrders).toBe(fixture.raw.paymentEvidence.orders.length);
    expect(input).toEqual(before);
  });

  // Keep every combination, with an independent default timeout and useful failure name.
  // Reading public IDs also avoids computing an unrelated reference leaderboard.
  it.each(
    rescuePublicPracticeEpisodeIds().flatMap((episodeId) =>
      rescueDoctrinePresets.map((preset) => ({
        episodeId,
        presetId: preset.id,
        doctrine: preset.doctrine,
      })),
    ),
  )("agrees with public Episode $episodeId / Doctrine $presetId", ({ episodeId, doctrine }) => {
    const input = makeInput(doctrine, episodeId);
    expect(verifyRescueDoctrinePracticeIntegrity(input).hashes.evaluation).toBe(
      input.run.raw.evaluationHash,
    );
  });

  it("matches name trimming and lexical set sorting while preserving priority order", () => {
    const artifact = structuredClone(fixture.manifest.artifact.sample);
    artifact.name = "  救助 Commander é  ";
    artifact.constraints.allowedServiceIds.reverse();
    artifact.constraints.allowedProtocolActions.reverse();
    const input = makeInput(artifact);
    expect(input.run.raw.doctrine).toEqual(normalizeRescueDoctrine(artifact));
    expect(verifyRescueDoctrinePracticeIntegrity(input).integrityVerified).toBe(true);
    input.request.artifact = {
      ...artifact,
      rules: { ...artifact.rules, servicePriority: [...artifact.rules.servicePriority].reverse() },
    };
    expect(() => verifyRescueDoctrinePracticeIntegrity(input)).toThrow(/integrity/);
  });

  it("binds the independently retained artifact, episode and context rather than trusting response copies", () => {
    const badArtifact = makeInput();
    badArtifact.request.artifact = { ...badArtifact.request.artifact, name: "Another artifact" };
    expect(() => verifyRescueDoctrinePracticeIntegrity(badArtifact)).toThrow(/integrity/);
    const badEpisode = makeInput();
    badEpisode.request.episodeId = "different-public-episode";
    expect(() => verifyRescueDoctrinePracticeIntegrity(badEpisode)).toThrow(/integrity/);
    const badContext = makeInput();
    badContext.request.context.contextHash = `0x${"ab".repeat(32)}`;
    expect(() => verifyRescueDoctrinePracticeIntegrity(badContext)).toThrow(/integrity/);
  });

  it("rejects SDK projection, correctness, metric direction and context tampering", () => {
    const mutations: ((input: ReturnType<typeof makeInput>) => void)[] = [
      (input) => {
        input.run.values.totalUserLossUsd++;
      },
      (input) => {
        input.run.correctness = !input.run.correctness;
      },
      (input) => {
        input.run.resultHash = `0x${"ab".repeat(32)}`;
      },
      (input) => {
        input.run.artifactHash = `0x${"ab".repeat(32)}`;
      },
      (input) => {
        input.run.context.metrics[0]!.direction = "MAXIMIZE";
      },
      (input) => {
        input.run.context.runtimeContextHash = `0x${"ab".repeat(32)}`;
      },
      (input) => {
        input.run.raw.manifestHash = `0x${"ab".repeat(32)}`;
        reseal(input);
      },
      (input) => {
        input.run.raw.replay.actionCount++;
        reseal(input);
      },
    ];
    for (const mutate of mutations) {
      const input = makeInput();
      mutate(input);
      expect(() => verifyRescueDoctrinePracticeIntegrity(input)).toThrow(/integrity/);
    }
  });

  it("rejects aggregate hash tampering across evaluation, outcome, transcript and payment evidence", () => {
    const mutations: ((input: ReturnType<typeof makeInput>) => void)[] = [
      (input) => {
        input.run.raw.episode.initialHeadline += "tampered";
      },
      (input) => {
        input.run.raw.outcome.userLossUsd++;
      },
      (input) => {
        input.run.raw.outcome.transcript[0]!.gameMinute++;
      },
      (input) => {
        input.run.raw.paymentEvidence.gameLedger.availableBalance++;
      },
      (input) => {
        input.run.raw.doctrine.name = ` ${input.run.raw.doctrine.name}`;
      },
    ];
    for (const mutate of mutations) {
      const input = makeInput();
      mutate(input);
      expect(() => verifyRescueDoctrinePracticeIntegrity(input)).toThrow(/integrity/);
    }
  });

  it("checks nested hash and cross-record bindings even when an attacker recomputes aggregate hashes", () => {
    const mutations: ((input: ReturnType<typeof makeInput>) => void)[] = [
      (input) => {
        input.run.raw.paymentEvidence.orders[0]!.commanderActionHash = `0x${"ab".repeat(32)}`;
      },
      (input) => {
        input.run.raw.paymentEvidence.orders[0]!.episodeContextHash = `0x${"ab".repeat(32)}`;
      },
      (input) => {
        input.run.raw.paymentEvidence.orders[0]!.receiptHash = `0x${"ab".repeat(32)}`;
      },
      (input) => {
        input.run.raw.paymentEvidence.orders[0]!.deliverableHash = `0x${"ab".repeat(32)}`;
      },
      (input) => {
        input.run.raw.paymentEvidence.orders[0]!.acceptanceHash = `0x${"ab".repeat(32)}`;
      },
      (input) => {
        input.run.raw.paymentEvidence.gameLedger.spentBalance++;
      },
      (input) => {
        input.run.raw.decisions[0]!.publicViewHash = `0x${"ab".repeat(32)}`;
      },
      (input) => {
        const event = input.run.raw.outcome.transcript.find(
          (item) => item.type === "SERVICE_RECEIPT",
        )!;
        (event.data.receipt as Record<string, unknown>).summary = "Altered finding";
      },
    ];
    for (const mutate of mutations) {
      const input = makeInput();
      mutate(input);
      reseal(input);
      expect(() => verifyRescueDoctrinePracticeIntegrity(input)).toThrow(/integrity/);
    }
  });

  it("rejects duplicate orders and duplicate payment resolution despite recomputed aggregates", () => {
    const duplicate = makeInput();
    duplicate.run.raw.paymentEvidence.orders = [
      ...duplicate.run.raw.paymentEvidence.orders,
      structuredClone(duplicate.run.raw.paymentEvidence.orders[0]!),
    ];
    reseal(duplicate);
    expect(() => verifyRescueDoctrinePracticeIntegrity(duplicate)).toThrow(/integrity/);
    const double = makeInput();
    double.run.raw.outcome.transcript = [
      ...double.run.raw.outcome.transcript,
      structuredClone(
        double.run.raw.outcome.transcript.find((event) => event.type === "PAYMENT_RELEASED")!,
      ),
    ];
    reseal(double);
    expect(() => verifyRescueDoctrinePracticeIntegrity(double)).toThrow(/integrity/);
  });

  it("rejects unsupported schema/runtime/dataset versions and paid-state substitutions", () => {
    for (const mutate of [
      (input: ReturnType<typeof makeInput>) => {
        input.run.raw.schemaVersion = "rescue-doctrine-practice-evaluation-v99" as never;
      },
      (input: ReturnType<typeof makeInput>) => {
        input.request.context.evaluatorVersion = "rescue-doctrine-interpreter-v99";
      },
      (input: ReturnType<typeof makeInput>) => {
        input.request.context.dataVersion = "unknown-dataset";
      },
      (input: ReturnType<typeof makeInput>) => {
        input.run.raw.paymentState = "paid" as never;
      },
      (input: ReturnType<typeof makeInput>) => {
        input.run.raw.paymentEvidence.onchainMirror.paymentState = "paid" as never;
      },
      (input: ReturnType<typeof makeInput>) => {
        input.run.raw.rewardEligibility.eligible = true as never;
      },
    ]) {
      const input = makeInput();
      mutate(input);
      expect(() => verifyRescueDoctrinePracticeIntegrity(input)).toThrow(/integrity/);
    }
  });

  it("rejects accessors without invoking them, non-finite numbers, cycles, hidden fields and unknown properties", () => {
    let reads = 0;
    const getter = makeInput();
    Object.defineProperty(getter.run.raw, "outcome", {
      enumerable: true,
      get() {
        reads++;
        throw new Error("PRIVATE");
      },
    });
    expect(() => verifyRescueDoctrinePracticeIntegrity(getter)).toThrow(/integrity/);
    expect(reads).toBe(0);
    const nonfinite = makeInput();
    nonfinite.run.values.totalUserLossUsd = Infinity;
    expect(() => verifyRescueDoctrinePracticeIntegrity(nonfinite)).toThrow(/integrity/);
    const hidden = makeInput();
    Object.defineProperty(hidden.run, "PRIVATE", { value: true });
    expect(() => verifyRescueDoctrinePracticeIntegrity(hidden)).toThrow(/integrity/);
    const cyclic = makeInput();
    cyclic.request.artifact.self = cyclic.request.artifact;
    expect(() => verifyRescueDoctrinePracticeIntegrity(cyclic)).toThrow(/integrity/);
    const extra = makeInput();
    Object.assign(extra.run.raw, { PRIVATE: "not-in-v0" });
    expect(() => verifyRescueDoctrinePracticeIntegrity(extra)).toThrow(/integrity/);
  });

  it("does not claim to authenticate a fully self-consistent fabricated hidden-state statement", () => {
    const input = makeInput();
    input.run.raw.episode.revealedAfterRun.incidentName = "A fabricated hidden incident label";
    reseal(input);
    const report = verifyRescueDoctrinePracticeIntegrity(input);
    expect(report.integrityVerified).toBe(true);
    expect(report.commitmentPreimagesVerified).toBe(false);
    expect(report.evaluatorReplay).toBe(false);
    expect(report.correctnessVerified).toBe(false);
    expect(report.signatureVerified).toBe(false);
  });
});
