import { describe, expect, it, vi } from "vitest";
import { publicRescueRoomScenario } from "../../packages/rescue-room/src/index";
import {
  experimentHash,
  recipeHash,
  runRecipeExperiment,
  type InjectedRunner,
  type PracticePort,
} from "./ab-harness";
import { localPracticeFixture } from "./local-fixture";

const recipe = "Use only the non-billable public Practice tools. Preserve independent outcomes.";
function setup() {
  const fixture = localPracticeFixture();
  fixture.config.episodeIds = fixture.config.episodeIds.slice(0, 1);
  fixture.config.seeds = [11];
  return fixture;
}
function equalRunner(): InjectedRunner {
  return async (request) => ({
    answer: "Fixture, not AI",
    doctrine: structuredClone(request.controls.manifest.artifact.sample),
  });
}
function mutatePort(
  port: PracticePort,
  mutate: (body: Record<string, unknown>) => void,
): PracticePort {
  return async (request) => {
    const response = await port(request);
    if (request.method === "POST") mutate(response.body as Record<string, unknown>);
    return response;
  };
}

describe("Bazantic local Recipe A/B readiness", () => {
  it("fixes all controls except Recipe presence, with fresh runners and bound evidence hashes", async () => {
    const f = setup();
    const makeRunner = vi.fn(equalRunner);
    const report = await runRecipeExperiment(f.config, recipe, { ...f, makeRunner });
    const { a, b, comparison } = report.pairs[0]!;
    expect(makeRunner).toHaveBeenCalledTimes(2);
    expect({ ...a.request, recipe }).toEqual(b.request);
    expect(a.requestHash).toBe(experimentHash(a.request));
    expect(b.requestHash).not.toBe(a.requestHash);
    expect(a.recipeHash).toBeNull();
    expect(b.recipeHash).toBe(recipeHash(recipe));
    expect(a.responseHash).toBe(experimentHash(a.response));
    expect(a.traces.every((trace) => trace.requestHash === experimentHash(trace.request))).toBe(
      true,
    );
    expect(a.traces.filter((trace) => trace.status === 200)).toHaveLength(3);
    expect(comparison.relation).toBe("equal");
    expect(comparison.metrics).toHaveLength(3);
    const { reportHash, ...content } = report;
    expect(reportHash).toBe(experimentHash(content));
    expect(report.liveGatewayVerified).toBe(false);
    expect(report.realModelExecutionVerified).toBe(false);
    expect(report.paymentRequested).toBe(false);
  });

  it("repeats identical deterministic evidence without timestamps or random IDs", async () => {
    const f = setup();
    const a = await runRecipeExperiment(f.config, recipe, f);
    const b = await runRecipeExperiment(f.config, recipe, f);
    expect(a).toEqual(b);
  });

  it("retains every declared failed and equal pair instead of best-of-N filtering", async () => {
    const f = setup();
    f.config.seeds = [11, 29, 41];
    const report = await runRecipeExperiment(f.config, recipe, {
      ...f,
      makeRunner: () => async (request, tools) => {
        if (request.seed === 29) throw new Error("secret exception body must not escape");
        return equalRunner()(request, tools);
      },
    });
    expect(report.pairs.map(({ comparison }) => comparison.relation)).toEqual([
      "equal",
      "not-comparable",
      "equal",
    ]);
    expect(report.pairs[1]!.a.failureCode).toBe("RUNNER_FAILURE");
    expect(JSON.stringify(report)).not.toContain("secret exception body");
  });

  it("retains an actual worse B outcome without claiming Recipe improvement", async () => {
    const f = setup();
    const presets = publicRescueRoomScenario().doctrineRuntime.presets;
    // Enumerate presets over the declared public pack, not simulated model results.
    const candidates = [];
    for (const episode of f.config.manifest.episodes) {
      for (const preset of presets)
        for (const other of presets) {
          f.config.episodeIds = [episode.id];
          const report = await runRecipeExperiment(f.config, recipe, {
            ...f,
            makeRunner: () => async (request) => ({
              answer: "Test fixture",
              doctrine: structuredClone(request.recipe === null ? preset.doctrine : other.doctrine),
            }),
          });
          candidates.push(report.pairs[0]!);
          if (candidates.at(-1)!.comparison.relation === "a-dominates") break;
        }
      if (candidates.some(({ comparison }) => comparison.relation === "a-dominates")) break;
    }
    const worse = candidates.find(({ comparison }) => comparison.relation === "a-dominates");
    expect(worse).toBeDefined();
    expect(worse!.a.status).toBe("completed");
    expect(worse!.b.status).toBe("completed");
    expect(worse!.comparison.metrics).toHaveLength(3);
  });

  it.each([401, 402, 403])(
    "fails closed on HTTP %i, never retaining auth/payment response secrets",
    async (status) => {
      const f = setup();
      const port = vi.fn<PracticePort>(async () => ({
        status,
        body: { credential: "private-do-not-copy" },
      }));
      const runner = vi.fn(equalRunner);
      const report = await runRecipeExperiment(f.config, recipe, { port, makeRunner: runner });
      expect(port).toHaveBeenCalledTimes(2); // One preflight per arm, no retries or fallback.
      expect(runner).not.toHaveBeenCalled();
      expect(report.pairs[0]!.a.failureCode).toBe(`BLOCKED_HTTP_${status}`);
      expect(report.pairs[0]!.comparison.relation).toBe("not-comparable");
      expect(JSON.stringify(report)).not.toContain("private-do-not-copy");
    },
  );

  it("keeps a tool error fatal even if the injected runner catches it", async () => {
    const f = setup();
    const port: PracticePort = async (request) =>
      request.method === "POST" ? { status: 402, body: {} } : f.port(request);
    const report = await runRecipeExperiment(f.config, recipe, {
      port,
      makeRunner: () => async (request, tools) => {
        try {
          await tools.evaluateDoctrine(request.controls.manifest.artifact.sample);
        } catch {
          /* deliberately ignored */
        }
        return equalRunner()(request, tools);
      },
    });
    expect(report.pairs[0]!.a.failureCode).toBe("BLOCKED_HTTP_402");
    expect(report.pairs[0]!.a.traces).toHaveLength(3);
  });

  it("rejects manifest context drift before invoking a runner", async () => {
    const f = setup();
    const port: PracticePort = async (request) => {
      const response = await f.port(request);
      if (request.path.includes("cli/arenas")) {
        const body = response.body as typeof f.config.manifest;
        body.context.dataVersion += "-tampered";
      }
      return response;
    };
    const runner = vi.fn(equalRunner);
    const report = await runRecipeExperiment(f.config, recipe, { port, makeRunner: runner });
    expect(runner).not.toHaveBeenCalled();
    expect(report.pairs[0]!.a.failureCode).toBe("CONTEXT_MISMATCH");
  });

  it("rejects wrong Starter bytes", async () => {
    const f = setup();
    const port: PracticePort = async (request) =>
      request.path.includes("starter-kit")
        ? { status: 200, body: new Uint8Array([1, 2]) }
        : f.port(request);
    const report = await runRecipeExperiment(f.config, recipe, { ...f, port });
    expect(report.pairs[0]!.a.failureCode).toBe("STARTER_HASH_MISMATCH");
  });

  it.each(["contextHash", "evaluationHash", "doctrineHash", "paymentState"])(
    "rejects tampered %s rather than comparing it",
    async (key) => {
      const f = setup();
      const port = mutatePort(f.port, (body) => {
        body[key] = "tampered";
      });
      const report = await runRecipeExperiment(f.config, recipe, { ...f, port });
      expect(report.pairs[0]!.a.failureCode).toBe("EVALUATION_REPLAY_MISMATCH");
      expect(report.pairs[0]!.comparison.relation).toBe("not-comparable");
    },
  );

  it("recomputes full outcome instead of trusting an intact resultHash next to forged metrics", async () => {
    const f = setup();
    const port = mutatePort(f.port, (body) => {
      (body.outcome as Record<string, unknown>).userLossUsd = -1;
    });
    const report = await runRecipeExperiment(f.config, recipe, { ...f, port });
    expect(report.pairs[0]!.a.failureCode).toBe("EVALUATION_REPLAY_MISMATCH");
  });

  it("caps tool usage and exposes no paid, Commander, token or arbitrary URL tool", async () => {
    const f = setup();
    f.config.maxToolCalls = 3;
    const report = await runRecipeExperiment(f.config, recipe, {
      ...f,
      makeRunner: () => async (request, tools) => {
        expect(Object.keys(tools).sort()).toEqual([
          "evaluateDoctrine",
          "getManifest",
          "getStarter",
        ]);
        await tools.getManifest();
        return equalRunner()(request, tools);
      },
    });
    expect(report.pairs[0]!.a.failureCode).toBe("TOOL_LIMIT");
    expect(report.pairs[0]!.a.traces).toHaveLength(3);
  });

  it("prevents runner mutation of shared settings", async () => {
    const f = setup();
    const report = await runRecipeExperiment(f.config, recipe, {
      ...f,
      makeRunner: () => async (request, tools) => {
        request.controls.settings.temperature = 99;
        return equalRunner()(request, tools);
      },
    });
    expect(report.pairs[0]!.a.status).toBe("failed");
    expect(report.controls.settings.temperature).toBe(0);
  });

  it.each(["metric", "snapshot", "episode", "seed"])(
    "rejects invalid %s controls before API access",
    async (kind) => {
      const f = setup();
      if (kind === "metric") f.config.manifest.context.metrics[0]!.direction = "MAXIMIZE";
      if (kind === "snapshot") f.config.apiSnapshotHash = "a".repeat(64);
      if (kind === "episode") f.config.episodeIds = ["hidden-final-not-allowed"];
      if (kind === "seed") f.config.seeds = [11, 11];
      if (kind === "metric") f.config.apiSnapshotHash = experimentHash(f.config.manifest);
      const port = vi.fn(f.port);
      await expect(runRecipeExperiment(f.config, recipe, { ...f, port })).rejects.toThrow();
      expect(port).not.toHaveBeenCalled();
    },
  );

  it("uses locale-independent strict JSON hashing and rejects non-JSON evidence", () => {
    expect(experimentHash({ Z: 1, a: 2 })).toBe(experimentHash({ a: 2, Z: 1 }));
    expect(() => experimentHash({ a: undefined })).toThrow("NON_JSON_EVIDENCE");
    expect(() => experimentHash({ a: Number.NaN })).toThrow("NON_JSON_EVIDENCE");
  });

  it.each([NaN, Infinity, undefined, 200.5, 99, 600, "200"])(
    "retains invalid HTTP status %s as arm failure without losing the report",
    async (status) => {
      const f = setup();
      const port = async () => ({ status, body: { secret: "never-retain" } });
      const report = await runRecipeExperiment(f.config, recipe, {
        ...f,
        port: port as PracticePort,
      });
      const { reportHash, ...content } = report;
      expect(reportHash).toBe(experimentHash(content));
      expect(report.pairs[0]!.a.failureCode).toBe("INVALID_HTTP_STATUS");
      expect(report.pairs[0]!.b.failureCode).toBe("INVALID_HTTP_STATUS");
      expect(report.pairs[0]!.a.traces[0]!.status).toBeNull();
      expect(JSON.stringify(report)).not.toContain("never-retain");
    },
  );

  it.each(["resolve", "reject"])(
    "rejects unfinished calls and preserves frozen report evidence after delayed %s",
    async (mode) => {
      const f = setup();
      const releases: Array<() => void> = [];
      let delayNextManifest = false;
      const port: PracticePort = async (request) => {
        if (request.path.includes("cli/arenas") && delayNextManifest) {
          delayNextManifest = false;
          await new Promise<void>((resolve, reject) => {
            releases.push(() =>
              mode === "resolve" ? resolve() : reject(new Error("late secret")),
            );
          });
        }
        return f.port(request);
      };
      const report = await runRecipeExperiment(f.config, recipe, {
        port,
        makeRunner: () => async (request, tools) => {
          delayNextManifest = true;
          // Intentionally abandoned: the harness must handle its late rejection internally.
          void tools.getManifest();
          return equalRunner()(request, tools);
        },
      });
      expect(releases).toHaveLength(2);
      expect(report.pairs[0]!.a.failureCode).toBe("INCOMPLETE_TOOL_CALLS");
      expect(report.pairs[0]!.b.failureCode).toBe("INCOMPLETE_TOOL_CALLS");
      expect(report.pairs[0]!.a.traces.at(-1)!.status).toBeNull();
      expect(Object.isFrozen(report)).toBe(true);
      expect(Object.isFrozen(report.pairs[0]!.a.traces.at(-1))).toBe(true);
      const before = JSON.stringify(report);
      releases.forEach((release) => release());
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(JSON.stringify(report)).toBe(before);
      const { reportHash, ...content } = report;
      expect(reportHash).toBe(experimentHash(content));
    },
  );

  it.each(["nan", "undefined", "function", "cycle"])(
    "retains malformed %s runner output as failure",
    async (kind) => {
      const f = setup();
      const malformed: Record<string, unknown> = { answer: "invalid", doctrine: {} };
      malformed.extra =
        kind === "nan"
          ? Number.NaN
          : kind === "undefined"
            ? undefined
            : kind === "function"
              ? () => {}
              : malformed;
      const report = await runRecipeExperiment(f.config, recipe, {
        ...f,
        makeRunner: () => async () => malformed as Awaited<ReturnType<InjectedRunner>>,
      });
      expect(report.pairs).toHaveLength(1);
      expect(report.pairs[0]!.a.status).toBe("failed");
      expect(report.pairs[0]!.a.response).toBeNull();
      expect(report.pairs[0]!.b.status).toBe("failed");
      expect(report.pairs[0]!.comparison.relation).toBe("not-comparable");
    },
  );
});
