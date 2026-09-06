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
