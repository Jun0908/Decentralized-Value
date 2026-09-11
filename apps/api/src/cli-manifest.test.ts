import { createHash } from "node:crypto";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  defaultDisasterResponseStrategy,
  publicDisasterResponseScenario,
} from "@frontier/disaster-response";
import { cliArenaManifestSchema } from "@frontier/shared";
import benchmark from "../../../benchmarks/evm-orderbook/results/latest.json";
import { createApi } from "./index";

const request = (path: string, init?: RequestInit) => new Request(`http://localhost${path}`, init);

describe("CLI capability manifest", () => {
  it("provides two versioned manifests and makes missing auth visible", async () => {
    const api = createApi(benchmark);
    const { arenas } = await (await api.fetch(request("/v1/cli/arenas"))).json();
    expect(arenas).toHaveLength(2);
    for (const raw of arenas) {
      const arena = cliArenaManifestSchema.parse(raw);
      expect(arena.capabilities.practice.available).toBe(true);
      expect(arena.capabilities.submit.available).toBe(false);
      expect(arena.rewardEligible).toBe(false);
      const download = await api.fetch(request(arena.starter.path));
      const bytes = new Uint8Array(await download.arrayBuffer());
      const hash = createHash("sha256").update(bytes).digest("hex");
      expect(hash).toBe(arena.starter.sha256);
      if (arena.id === "rescue-room") {
        const files = unzipSync(bytes);
        const example = JSON.parse(
          strFromU8(files["rescue-room-starter/doctrine-request.example.json"]!),
        );
        expect(example.doctrine).toEqual(arena.artifact.sample);
      }
    }
  });

  it("rejects unknown arenas and fixes single-Episode metric bounds", async () => {
    const api = createApi(benchmark);
    expect((await api.fetch(request("/v1/cli/arenas/unsupported"))).status).toBe(404);
    const arena = await (await api.fetch(request("/v1/cli/arenas/rescue-room"))).json();
    expect(arena.context.runtimeContextHash).toMatch(/^0x/);
    expect(arena.context.metrics[0].upperBound).toBe(250_000);
    expect(arena.context.evidenceState).toBe("simulated");
  });

  it("checks Context before evaluating while keeping existing web requests compatible", async () => {
    const api = createApi(benchmark);
    const init = {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-frontier-context-hash": `0x${"0".repeat(64)}`,
      },
      body: JSON.stringify(defaultDisasterResponseStrategy),
    };
    const mismatch = await api.fetch(request("/v1/disaster-response/evaluations", init));
    expect(mismatch.status).toBe(409);
    expect((await mismatch.json()).error.code).toBe("CONTEXT_MISMATCH");
    init.headers["x-frontier-context-hash"] = publicDisasterResponseScenario().contextHash;
    const matched = await (
      await api.fetch(request("/v1/disaster-response/evaluations", init))
    ).json();
    const legacy = await (
      await api.fetch(
        request("/v1/disaster-response/evaluations", { method: "POST", body: init.body }),
      )
    ).json();
    expect(matched.resultHash).toBe(legacy.resultHash);
    expect(matched.inputHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("requires the Doctrine runtime when a context precondition is requested", async () => {
    const api = createApi(benchmark);
    const arena = await (await api.fetch(request("/v1/cli/arenas/rescue-room"))).json();
    const response = await api.fetch(
      request("/v1/rescue-room/doctrine-evaluations", {
        method: "POST",
        headers: { "x-frontier-context-hash": arena.context.contextHash },
        body: JSON.stringify({ episodeId: arena.episodes[0].id, doctrine: arena.artifact.sample }),
      }),
    );
    expect(response.status).toBe(409);
  });
});
