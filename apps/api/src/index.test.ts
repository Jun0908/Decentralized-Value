import benchmark from "../../../benchmarks/evm-orderbook/results/latest.json";
import { describe, expect, it, vi } from "vitest";
import { createApi, createDemoApi } from "./index";

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
