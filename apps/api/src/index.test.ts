import benchmark from "../../../benchmarks/evm-orderbook/results/latest.json";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import {
  createRescuePracticeSession,
  finalizeRescueCommanderPracticeEvaluation,
  rescueCommanderStarterPlaybook,
  rescueDoctrinePresets,
  rescuePublicViewHash,
  rescueRoomCommanderEpisodeTimeoutMs,
  rescueRoomCommanderMaximumModelTurns,
  rescueRoomCommanderModel,
  rescueRoomCommanderModelSettings,
  rescueRoomCommanderPromptVersion,
  rescueRoomCommanderRuntimeVersion,
  type RescueCommanderRuntimeEvidence,
} from "@frontier/rescue-room";
import {
  createApi,
  createDemoApi,
  MemoryPlan5CompetitionStore,
  MemoryPlan6CompetitionStore,
} from "./index";

function request(path: string, init?: RequestInit) {
  return new Request(`http://localhost${path}`, init);
}

describe("Frontier API contracts", () => {
  it("serves challenge, artifacts, frontier, health, and honest ENS state", async () => {
    const api = createApi(benchmark);
    const challenge = await (await api.fetch(request("/v1/challenges"))).json();
    expect(challenge.name).toBe("EVM Orderbook Frontier");
    const artifacts = await (
      await api.fetch(request(`/v1/challenges/${challenge.challengeId}/artifacts`))
    ).json();
    expect(artifacts.artifacts).toHaveLength(4);
    const frontier = await (
      await api.fetch(request(`/v1/challenges/${challenge.challengeId}/frontier`))
    ).json();
    expect(frontier.artifacts).toHaveLength(3);
    expect((await api.fetch(request("/v1/health"))).status).toBe(200);
    const runners = await (await api.fetch(request("/v1/runners"))).json();
    expect(runners.status).toBe("unconfigured");
  });

  it("creates an async idempotent evaluation and dispatches once", async () => {
    const dispatch = vi.fn(async () => undefined);
    const api = createApi(benchmark, { dispatch });
    const artifact = [...api.store.artifacts.values()][0]!;
    const init = {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "demo-1" },
      body: JSON.stringify({ artifactId: artifact.artifactId }),
    };
    const first = await api.fetch(request("/v1/evaluations", init));
    const firstJob = await first.json();
    const secondJob = await (await api.fetch(request("/v1/evaluations", init))).json();
    expect(first.status).toBe(202);
    expect(secondJob.jobId).toBe(firstJob.jobId);
    expect(dispatch).toHaveBeenCalledOnce();
    expect((await api.fetch(request(`/v1/evaluations/${firstJob.jobId}`))).status).toBe(200);
  });

  it("evaluates a user-provided emergency allocation from public data", async () => {
    const api = createApi(benchmark);
    const scenarioResponse = await api.fetch(request("/v1/emergency-supply"));
    const scenario = await scenarioResponse.json();
    const response = await api.fetch(
      request("/v1/emergency-supply/evaluations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          allocations: {
            "harbor-aid": 300,
            northstar: 150,
            "inland-works": 300,
            "local-grid": 150,
            airbridge: 100,
          },
        }),
      }),
    );
    const evaluation = await response.json();

    expect(scenario.name).toBe("Emergency Supply Allocation Frontier");
    expect(scenario.vendors).toHaveLength(5);
    expect(response.status).toBe(200);
    expect(evaluation.state).toBe("measured");
    expect(evaluation.correctness).toBe(true);
    expect(evaluation.totalProcurementCost).toBe(49_950);
    expect(evaluation.worstCaseDeliveredKits).toBe(550);
    expect(evaluation.failureOutcomes).toHaveLength(9);
    expect(evaluation.contribution.frontierExpansionPpm).toBeGreaterThan(0);
    expect(scenario.manifest.lifecycle).toBe("PRACTICE");
    expect(scenario.manifestHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(evaluation.resultHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("runs a deterministic Rescue Room Practice Episode without exposing truth beforehand", async () => {
    const api = createApi(benchmark);
    const scenarioResponse = await api.fetch(request("/v1/rescue-room"));
    const scenario = await scenarioResponse.json();
    const publicEpisodes = JSON.stringify(scenario.episodes);
    const init = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        policyId: "simple-adaptive",
        episodeId: scenario.episodes[0].id,
      }),
    };
    const firstResponse = await api.fetch(request("/v1/rescue-room/evaluations", init));
    const first = await firstResponse.json();
    const second = await (await api.fetch(request("/v1/rescue-room/evaluations", init))).json();

    expect(scenario.state).toBe("simulated");
    expect(scenario.paymentState).toBe("game-credits");
    expect(scenario.paymentRuntime.sepoliaShowcase.state).toBe("contract-implemented-not-deployed");
    expect(scenario.paymentRuntime.sepoliaShowcase.token.symbol).toBe("rUSD-DEMO");
    expect(scenario.episodes).toHaveLength(35);
    expect(publicEpisodes).not.toContain("incidentFamily");
    expect(firstResponse.status).toBe(200);
    expect(first.state).toBe("simulated");
    expect(first.paymentState).toBe("game-credits");
    expect(first.paymentEvidence.onchainMirror.paymentState).toBe("not-requested");
    expect(first.outcome.transcript.length).toBeGreaterThan(0);
    expect(first.episode.revealedAfterRun.incidentFamily).toBeTruthy();
    expect(first.evaluationHash).toBe(second.evaluationHash);
  });

  it("evaluates an editable Rescue Doctrine through the deterministic rules endpoint", async () => {
    const api = createApi(benchmark);
    const scenario = await (await api.fetch(request("/v1/rescue-room"))).json();
    const doctrine = rescueDoctrinePresets[0]!.doctrine;
    const init = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ episodeId: scenario.episodes[0].id, doctrine }),
    };
    const firstResponse = await api.fetch(request("/v1/rescue-room/doctrine-evaluations", init));
    const first = await firstResponse.json();
    const second = await (
      await api.fetch(request("/v1/rescue-room/doctrine-evaluations", init))
    ).json();

    expect(firstResponse.status).toBe(200);
    expect(first.strategyState).toBe("deterministic-rules");
    expect(first.doctrineHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(first.decisions.every(({ accepted }: { accepted: boolean }) => accepted)).toBe(true);
    expect(first.replay.matchesRecordedOutcome).toBe(true);
    expect(first.paymentEvidence.evidenceState).toBe("simulated");
    expect(first.paymentEvidence.onchainMirror.paymentState).toBe("not-requested");
    expect(first.paymentEvidence.evidenceHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(first.evaluationHash).toBe(second.evaluationHash);
  });

  it("runs a structured AI Commander adapter and returns replay evidence", async () => {
    const scenarioApi = createApi(benchmark);
    const scenario = await (await scenarioApi.fetch(request("/v1/rescue-room"))).json();
    const episodeId = scenario.episodes[0].id as string;
    const commander = vi.fn(async () => {
      const session = createRescuePracticeSession(episodeId, rescueCommanderStarterPlaybook);
      const view = session.getPublicView();
      const action = { type: "CLOSE_INCIDENT" as const };
      const step = session.takeAction(action);
      const outcome = session.finish();
      const runtime: RescueCommanderRuntimeEvidence = {
        runtimeVersion: rescueRoomCommanderRuntimeVersion,
        promptVersion: rescueRoomCommanderPromptVersion,
        sdk: { name: "@openai/agents", version: "test" },
        configuredModel: rescueRoomCommanderModel,
        modelSettings: rescueRoomCommanderModelSettings,
        maximumModelTurns: rescueRoomCommanderMaximumModelTurns,
        episodeTimeoutMs: rescueRoomCommanderEpisodeTimeoutMs,
        startedAt: "2026-09-10T00:00:00.000Z",
        completedAt: "2026-09-10T00:00:01.000Z",
        responseIds: ["response-test"],
        requestIds: ["request-test"],
        resolvedModels: [rescueRoomCommanderModel],
        usage: { requests: 1, inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      };
      return finalizeRescueCommanderPracticeEvaluation({
        playbook: rescueCommanderStarterPlaybook,
        episodeId,
        outcome,
        decisions: [
          {
            action,
            decision: 1,
            gameMinute: view.gameMinute,
            publicViewHash: rescuePublicViewHash(view),
            reasonCode: "close-alert",
            confidencePpm: 400_000,
            accepted: step.accepted,
            invalidReason: step.invalidReason,
          },
        ],
        runtime,
      });
    });
    const api = createApi(benchmark, undefined, undefined, undefined, undefined, { commander });
    const response = await api.fetch(
      request("/v1/rescue-room/commander-evaluations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ episodeId, playbook: rescueCommanderStarterPlaybook }),
      }),
    );
    const evaluation = await response.json();

    expect(response.status).toBe(200);
    expect(evaluation.inferenceState).toBe("openai-api");
    expect(evaluation.replay.matchesRecordedOutcome).toBe(true);
    expect(evaluation.paymentEvidence.evidenceState).toBe("simulated");
    expect(evaluation.paymentEvidence.onchainMirror.paymentState).toBe("not-requested");
    expect(evaluation.rewardEligibility.eligible).toBe(false);
    expect(commander).toHaveBeenCalledOnce();
  });

  it("publishes a hidden-state-safe Rescue Room Starter Kit", async () => {
    const api = createApi(benchmark);
    const response = await api.fetch(request("/v1/rescue-room/starter-kit"));
    const archive = unzipSync(new Uint8Array(await response.arrayBuffer()));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(Object.keys(archive).sort()).toEqual(
      expect.arrayContaining([
        "rescue-room-starter/README.md",
        "rescue-room-starter/doctrine-presets.json",
        "rescue-room-starter/doctrine-request.example.json",
        "rescue-room-starter/doctrine.schema.json",
        "rescue-room-starter/playbook.schema.json",
        "rescue-room-starter/payment-contract.json",
        "rescue-room-starter/public-practice-alerts.json",
        "rescue-room-starter/request.example.json",
        "rescue-room-starter/runtime-contract.json",
        "rescue-room-starter/service-agents.json",
        "rescue-room-starter/starter-playbook.json",
      ]),
    );
    const publicAlerts = strFromU8(archive["rescue-room-starter/public-practice-alerts.json"]!);
    expect(publicAlerts).not.toContain("incidentFamily");
    expect(publicAlerts).not.toContain("validPatchId");
  });

  it("rejects malformed emergency allocation payloads", async () => {
    const api = createApi(benchmark);
    const response = await api.fetch(
      request("/v1/emergency-supply/evaluations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ allocations: { "harbor-aid": -1 } }),
      }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("loads and evaluates emergency supply contexts independently", async () => {
    const api = createApi(benchmark);
    const scenario = await (
      await api.fetch(request("/v1/emergency-supply?contextId=public-port-constrained"))
    ).json();
    expect(scenario.contextId).toBe("public-port-constrained");
    expect(scenario.contexts).toHaveLength(2);
    expect(scenario.evidenceLevel).toBe(0);
  });

  it("serves a deterministic agent replay with contribution rewards", async () => {
    const api = createApi(benchmark);
    const first = await (await api.fetch(request("/v1/emergency-supply/replay"))).json();
    const second = await (await api.fetch(request("/v1/emergency-supply/replay"))).json();

    expect(first).toEqual(second);
    expect(first.participantFrontier).toEqual(["agent-a", "agent-b"]);
    expect(first.entries).toHaveLength(3);
    expect(first.entries[2]).toMatchObject({ frontier: false, rewardCredits: 0 });
    expect(
      first.entries.reduce(
        (sum: number, entry: { rewardCredits: number }) => sum + entry.rewardCredits,
        0,
      ),
    ).toBe(10_000);
  });

  it("measures calldata bytes and real EVM decoder gas", async () => {
    const api = createApi(benchmark);
    const scenarioResponse = await api.fetch(request("/v1/calldata-compression"));
    const scenario = await scenarioResponse.json();
    const response = await api.fetch(
      request("/v1/calldata-compression/evaluations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ codecId: "dictionary" }),
      }),
    );
    const evaluation = await response.json();

    expect(scenario.name).toBe("Ethereum Calldata Compression Frontier");
    expect(scenario.evmRevision).toBe("cancun");
    expect(scenario.baselinePoints).toHaveLength(3);
    expect(response.status).toBe(200);
    expect(evaluation.state).toBe("measured");
    expect(evaluation.correctness).toBe(true);
    expect(evaluation.malformedInputRejected).toBe(true);
    expect(evaluation.batchEvidence).toHaveLength(3);
    expect(evaluation.calldataGas).toBeGreaterThan(0);
    expect(evaluation.decodeExecutionGas).toBeGreaterThan(0);
    expect(evaluation.contribution.hypervolumeAfterPpm).toBeGreaterThan(0);
    expect(scenario.manifest.lifecycle).toBe("PRACTICE");
    expect(evaluation.resultHash).toMatch(/^0x[0-9a-f]{64}$/);
  }, 30_000);

  it("rejects unknown calldata codecs", async () => {
    const api = createApi(benchmark);
    const response = await api.fetch(
      request("/v1/calldata-compression/evaluations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ codecId: "magic" }),
      }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("loads calldata contexts independently", async () => {
    const api = createApi(benchmark);
    const scenario = await (
      await api.fetch(request("/v1/calldata-compression?contextId=public-low-reuse"))
    ).json();
    expect(scenario.contextId).toBe("public-low-reuse");
    expect(scenario.contexts).toHaveLength(2);
    expect(scenario.batches).toHaveLength(2);
  }, 30_000);

  it("evaluates a three-axis microgrid dispatch through the common API", async () => {
    const api = createApi(benchmark);
    const scenario = await (await api.fetch(request("/v1/microgrid-dispatch"))).json();
    const response = await api.fetch(
      request("/v1/microgrid-dispatch/evaluations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          allocations: { solar: 25, wind: 25, grid: 25, battery: 25 },
        }),
      }),
    );
    const result = await response.json();
    expect(scenario.axes).toHaveLength(3);
    expect(result.correctness).toBe(true);
    expect(result.worstCaseEnergy).toBe(75);
    expect(result.contribution.hypervolumeAfterPpm).toBeGreaterThan(0);
  });

  it("supports repeatable sandbox submissions and one selected final entry", async () => {
    const api = createApi(benchmark);
    const registration = await (
      await api.fetch(
        request("/v2/sandbox/participants/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            challengeId: "emergency-supply-v1",
            wallet: "0x1111111111111111111111111111111111111111",
          }),
        }),
      )
    ).json();
    const participantId = registration.participant.participantId;
    expect(registration.uniqueness).toBe("wallet-only-not-personhood");

    const submissionResponse = await api.fetch(
      request("/v2/sandbox/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          participantId,
          challengeId: "emergency-supply-v1",
          source: {
            method: "INLINE",
            visibility: "PUBLIC",
            filename: "allocation.ts",
            content: "export default { harborAid: 300 };\r\n",
          },
          artifactInput: {
            allocations: {
              "harbor-aid": 300,
              northstar: 150,
              "inland-works": 300,
              "local-grid": 150,
              airbridge: 100,
            },
          },
        }),
      }),
    );
    const submission = (await submissionResponse.json()).submission;
    expect(submissionResponse.status).toBe(201);
    expect(submission.revision).toBe(1);
    expect(submission.correctness).toBe(true);

    const finalResponse = await api.fetch(
      request("/v2/sandbox/final-entry", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ participantId, submissionId: submission.submissionId }),
      }),
    );
    const final = await finalResponse.json();
    expect(final.frozen).toBe(false);
    expect(final.finalEntry.submissionId).toBe(submission.submissionId);

    const history = await (
      await api.fetch(request(`/v2/sandbox/participants/${participantId}/submissions`))
    ).json();
    expect(history.storage).toBe("ephemeral-memory");
    expect(history.submissions).toHaveLength(1);
  });

  it("runs the authenticated Emergency Supply competition from join through final entry", async () => {
    const competition = new MemoryPlan5CompetitionStore();
    const identity = vi.fn(async () => ({
      userId: "did:privy:test-builder",
      wallet: "0x4444444444444444444444444444444444444444" as const,
    }));
    const settlement = vi.fn(async () => ({
      allocationRoot: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const,
      transactionHash:
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const,
      blockNumber: "12345",
    }));
    const api = createApi(benchmark, undefined, undefined, {
      store: competition,
      identity,
      settlement,
    });

    const join = await api.fetch(
      request("/v1/challenges/emergency-supply/join", { method: "POST" }),
    );
    expect(join.status).toBe(201);
    const participant = (await join.json()).participant;

    const submissionBody = JSON.stringify({
      allocations: {
        "harbor-aid": 300,
        northstar: 150,
        "inland-works": 300,
        "local-grid": 150,
        airbridge: 100,
      },
      sourceMethod: "UPLOAD",
      repositoryUrl: null,
      sourceCommit: null,
    });
    const submissionResponse = await api.fetch(
      request("/v1/challenges/emergency-supply/submissions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "plan5-test-submission-1",
        },
        body: submissionBody,
      }),
    );
    expect(submissionResponse.status).toBe(201);
    const submission = (await submissionResponse.json()).submission;
    expect(submission.evaluation.correctness).toBe(true);
    expect(submission.revision).toBe(1);

    const repeatedResponse = await api.fetch(
      request("/v1/challenges/emergency-supply/submissions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "plan5-test-submission-1",
        },
        body: submissionBody,
      }),
    );
    expect(repeatedResponse.status).toBe(200);
    expect((await repeatedResponse.json()).submission.submissionId).toBe(submission.submissionId);

    const finalResponse = await api.fetch(
      request("/v1/challenges/emergency-supply/final-entry", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ submissionId: submission.submissionId }),
      }),
    );
    expect(finalResponse.status).toBe(200);
    expect((await finalResponse.json()).finalEntry.submissionId).toBe(submission.submissionId);

    const mine = await (
      await api.fetch(request("/v1/challenges/emergency-supply/submissions/mine"))
    ).json();
    expect(mine.participant.participantId).toBe(participant.participantId);
    expect(mine.submissions).toHaveLength(1);
    expect(mine.finalEntry.submissionId).toBe(submission.submissionId);

    const leaderboard = await (
      await api.fetch(request("/v1/challenges/emergency-supply/leaderboard"))
    ).json();
    expect(leaderboard.submissionCount).toBe(1);
    const participantEntry = leaderboard.entries.find(
      (entry: { kind: string }) => entry.kind === "PARTICIPANT",
    );
    expect(participantEntry).toBeDefined();
    expect(participantEntry.frontier).toBe(true);
    expect(participantEntry.rewardPreview).toBeGreaterThan(0);

    const settlementResponse = await api.fetch(
      request("/v1/challenges/emergency-supply/demo-settlement", { method: "POST" }),
    );
    expect(settlementResponse.status).toBe(201);
    const reward = (await settlementResponse.json()).reward;
    expect(reward.status).toBe("PAID");
    expect(reward.recipient).toBe("0x4444444444444444444444444444444444444444");
    expect(BigInt(reward.amount)).toBeGreaterThan(0n);
    expect(settlement).toHaveBeenCalledTimes(1);

    const repeatedSettlement = await api.fetch(
      request("/v1/challenges/emergency-supply/demo-settlement", { method: "POST" }),
    );
    expect(repeatedSettlement.status).toBe(200);
    expect(settlement).toHaveBeenCalledTimes(1);
  });

  it("fails closed on reward until a correct Final Entry and configured settlement exist", async () => {
    const competition = new MemoryPlan5CompetitionStore();
    const identity = async () => ({
      userId: "did:privy:test-builder",
      wallet: "0x4444444444444444444444444444444444444444" as const,
    });
    const api = createApi(benchmark, undefined, undefined, { store: competition, identity });
    await api.fetch(request("/v1/challenges/emergency-supply/join", { method: "POST" }));
    const response = await api.fetch(
      request("/v1/challenges/emergency-supply/demo-settlement", { method: "POST" }),
    );
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("SETTLEMENT_UNCONFIGURED");
  });

  it("downloads a real multi-file Emergency Supply starter kit", async () => {
    const api = createApi(benchmark);
    const response = await api.fetch(request("/v1/challenges/emergency-supply/starter-kit"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(500);
  });

  it("runs the Plan 6 disaster-response competition without changing Plan 5", async () => {
    const competition = new MemoryPlan6CompetitionStore();
    const identity = vi.fn(async () => ({
      userId: "did:privy:plan6-builder",
      wallet: "0x5555555555555555555555555555555555555555" as const,
    }));
    const settlement = vi.fn(async (input: { resultHash: `0x${string}` }) => {
      void input;
      return {
        allocationRoot:
          "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as const,
        transactionHash:
          "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" as const,
        blockNumber: "67890",
      };
    });
    const api = createApi(benchmark, undefined, undefined, undefined, {
      store: competition,
      identity,
      settlement,
    });

    const scenarioResponse = await api.fetch(request("/v1/disaster-response"));
    const scenario = await scenarioResponse.json();
    expect(scenarioResponse.status).toBe(200);
    expect(scenario.durationHours).toBe(72);
    expect(scenario.trainingScenarios).toHaveLength(3);
    expect(scenario.finalScenarioCommitment).toMatch(/^0x[0-9a-f]{64}$/);
    expect(scenario.evaluatorVersion).toBe("disaster-response-evaluator-v2");
    expect(scenario.strategySchema.required).toContain("emergencyBudgetUsd");
    expect(scenario.limits).toEqual({
      practiceRunsPerMinute: 30,
      maxRevisions: 20,
      maxFinalEntries: 1,
    });

    const joinResponse = await api.fetch(
      request("/v1/challenges/disaster-response/join", { method: "POST" }),
    );
    expect(joinResponse.status).toBe(201);

    const submissionBody = JSON.stringify({
      strategy: scenario.defaultStrategy,
      sourceMethod: "VISUAL",
      repositoryUrl: null,
      sourceCommit: null,
    });
    const submissionResponse = await api.fetch(
      request("/v1/challenges/disaster-response/submissions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "plan6-test-submission-1",
        },
        body: submissionBody,
      }),
    );
    expect(submissionResponse.status).toBe(201);
    const submission = (await submissionResponse.json()).submission;
    expect(submission.evaluation.correctness).toBe(true);
    expect(submission.evaluation.scenarioOutcomes).toHaveLength(7);
    expect(submission.evaluation.worstCaseDeliveredKits).toBeGreaterThan(0);
    expect(submission.evaluation.scenarioOutcomes[0].explanation).toHaveLength(3);

    const agentStrategy = {
      ...scenario.defaultStrategy,
      name: "Agent recovery variant",
      emergencyBudgetUsd: scenario.defaultStrategy.emergencyBudgetUsd + 1_000,
    };
    const agentPractice = await (
      await api.fetch(
        request("/v1/disaster-response/evaluations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(agentStrategy),
        }),
      )
    ).json();
    const agentSubmissionResponse = await api.fetch(
      request("/v1/challenges/disaster-response/submissions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "plan7-agent-submission-2",
        },
        body: JSON.stringify({
          strategy: agentStrategy,
          sourceMethod: "AGENT_API",
          repositoryUrl: null,
          sourceCommit: null,
          agentEvidence: {
            name: "Test Agent",
            version: "1.0.0",
            objective: "Explore additional recovery capacity.",
          },
        }),
      }),
    );
    expect(agentSubmissionResponse.status).toBe(201);
    const agentSubmission = (await agentSubmissionResponse.json()).submission;
    expect(agentSubmission.evaluation.contextHash).toBe(agentPractice.contextHash);
    expect(agentSubmission.evaluation.resultHash).toBe(agentPractice.resultHash);
    expect(agentSubmission.agentEvidence).toEqual({
      name: "Test Agent",
      version: "1.0.0",
      objective: "Explore additional recovery capacity.",
    });
    expect(
      agentSubmission.evaluation.strategyDiff.map(({ field }: { field: string }) => field),
    ).toEqual(["name", "emergencyBudgetUsd"]);
    expect(agentSubmission.evaluation.outcomeDiff).not.toBeNull();

    const finalResponse = await api.fetch(
      request("/v1/challenges/disaster-response/final-entry", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ submissionId: submission.submissionId }),
      }),
    );
    expect(finalResponse.status).toBe(200);

    const leaderboard = await (
      await api.fetch(request("/v1/challenges/disaster-response/leaderboard"))
    ).json();
    const participantEntry = leaderboard.entries.find(
      (entry: { kind: string }) => entry.kind === "PARTICIPANT",
    );
    expect(leaderboard.valuePools).toHaveLength(4);
    expect(leaderboard.awards).toHaveLength(4);
    expect(participantEntry.awardIds.length).toBeGreaterThan(0);
    expect(participantEntry.valueAllocations.length).toBeGreaterThan(0);
    expect(participantEntry.valueAllocations[0].qualificationReason).toBeTruthy();
    expect(participantEntry.valueAllocations[0].allocationFormula).toBeTruthy();
    expect(participantEntry.rewardPreview).toBeGreaterThan(0);
    expect(participantEntry.settlementEligibleCredits).toBeGreaterThan(0);
    expect(
      leaderboard.valuePools.find((pool: { poolId: string }) => pool.poolId === "resilience")
        .allocations[0].entryName,
    ).toBe("Resilience Mesh");
    expect(
      leaderboard.valuePools.find((pool: { poolId: string }) => pool.poolId === "efficiency")
        .allocations[0].entryName,
    ).toBe("Budget Sprint");
    expect(
      leaderboard.valuePools.find((pool: { poolId: string }) => pool.poolId === "fairness")
        .allocations[0].entryName,
    ).toBe("Fair Reach");
    expect(
      new Set(
        leaderboard.valuePools.flatMap((pool: { allocations: { entryName: string }[] }) =>
          pool.allocations.map(({ entryName }) => entryName),
        ),
      ).size,
    ).toBeGreaterThanOrEqual(3);
    const frontierPool = leaderboard.valuePools.find(
      (pool: { poolId: string }) => pool.poolId === "frontier",
    );
    expect(frontierPool.allocations.length).toBeGreaterThan(1);
    expect(
      frontierPool.allocations.reduce(
        (sum: number, allocation: { credits: number }) => sum + allocation.credits,
        0,
      ),
    ).toBe(2_500);

    const settlementResponse = await api.fetch(
      request("/v1/challenges/disaster-response/demo-settlement", { method: "POST" }),
    );
    expect(settlementResponse.status).toBe(201);
    const reward = (await settlementResponse.json()).reward;
    expect(reward.status).toBe("PAID");
    expect(reward.awardIds.length).toBeGreaterThan(0);
    expect(reward.poolAllocations.length).toBeGreaterThan(0);
    expect(reward.allocationEvidenceHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(settlement).toHaveBeenCalledOnce();
    expect(settlement.mock.calls[0]![0]!.resultHash).toBe(reward.allocationEvidenceHash);

    const classicResponse = await api.fetch(request("/v1/challenges/emergency-supply"));
    expect(classicResponse.status).toBe(200);
    expect((await classicResponse.json()).challengeId).toBe("emergency-supply-v1");
  });

  it("publishes one practice Protect a Region Value Pool and allocates it deterministically", async () => {
    const competition = new MemoryPlan6CompetitionStore();
    const identity = vi.fn(async () => ({
      userId: "did:privy:value-funder",
      wallet: "0x6666666666666666666666666666666666666666" as const,
    }));
    const api = createApi(benchmark, undefined, undefined, undefined, {
      store: competition,
      identity,
    });
    const body = JSON.stringify({
      name: "Highland Care Pool",
      valueStatement: "Protect the clinic that is easiest for the main network to leave behind.",
      regionId: "highland",
      poolCredits: 1_200,
    });
    const first = await api.fetch(
      request("/v1/challenges/disaster-response/value-pools", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      }),
    );
    const firstPool = (await first.json()).valuePool;
    expect(first.status).toBe(201);
    expect(firstPool.status).toBe("PRACTICE");
    expect(firstPool.rule).toEqual({ type: "PROTECT_REGION", regionId: "highland" });
    expect(firstPool.manifestHash).toMatch(/^0x[0-9a-f]{64}$/);

    const repeated = await api.fetch(
      request("/v1/challenges/disaster-response/value-pools", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      }),
    );
    expect(repeated.status).toBe(200);
    expect((await repeated.json()).valuePool.manifestHash).toBe(firstPool.manifestHash);

    const leaderboard = await (
      await api.fetch(request("/v1/challenges/disaster-response/leaderboard"))
    ).json();
    const customPool = leaderboard.valuePools.find(
      (pool: { manifestHash: string }) => pool.manifestHash === firstPool.manifestHash,
    );
    expect(leaderboard.valuePools).toHaveLength(5);
    expect(leaderboard.practicePoolCredits).toBe(1_200);
    expect(customPool.allocations.length).toBeGreaterThan(0);
    expect(
      customPool.allocations.reduce(
        (sum: number, allocation: { credits: number }) => sum + allocation.credits,
        0,
      ),
    ).toBe(1_200);
  });

  it("downloads the Plan 6 disaster-response starter kit", async () => {
    const api = createApi(benchmark);
    const response = await api.fetch(request("/v1/challenges/disaster-response/starter-kit"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    const archive = new Uint8Array(await response.arrayBuffer());
    expect(archive.byteLength).toBeGreaterThan(700);
    const files = unzipSync(archive);
    expect(Object.keys(files)).toContain("disaster-response-starter/evaluation-contract.json");
    expect(Object.keys(files)).toContain("disaster-response-starter/baseline-agent.mjs");
    expect(Object.keys(files)).toContain(
      "disaster-response-starter/policy-artifact-v1.schema.json",
    );
    const contract = JSON.parse(
      strFromU8(files["disaster-response-starter/evaluation-contract.json"]!),
    );
    expect(contract.rewardBasis).toBe("measured-outcomes-only");
    expect(contract.limits.maxFinalEntries).toBe(1);
  });

  it("fails closed when World ID is not configured", async () => {
    const api = createApi(benchmark);
    const worldId = await api.fetch(
      request("/v2/participants/world-id/context", { method: "POST" }),
    );
    expect(worldId.status).toBe(503);
    expect((await worldId.json()).error.code).toBe("WORLD_ID_UNCONFIGURED");
  });

  it("completes the zero-configuration demo without claiming live evidence", async () => {
    const api = createDemoApi(benchmark);
    const artifact = [...api.store.artifacts.values()][0]!;
    const response = await api.fetch(
      request("/v1/evaluations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ artifactId: artifact.artifactId }),
      }),
    );
    const job = await response.json();

    expect(response.status).toBe(202);
    expect(job.state).toBe("simulated");
    expect(job.resultHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(job.signature).toBeNull();
    expect(job.txHash).toBeNull();
    expect(job.frontier).toBe(true);
  });

  it("returns stable error schemas for invalid, missing, and unknown input", async () => {
    const api = createApi(benchmark);
    const invalid = await api.fetch(request("/v1/evaluations", { method: "POST", body: "{}" }));
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error.code).toBe("VALIDATION_ERROR");
    expect((await api.fetch(request(`/v1/artifacts/0x${"00".repeat(32)}`))).status).toBe(404);
    expect((await api.fetch(request("/nope"))).status).toBe(404);
  });
});
