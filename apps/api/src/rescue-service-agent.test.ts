import { describe, expect, it, vi } from "vitest";
import { serviceExecutionFixture } from "../../../packages/rescue-room/src/service-execution.test-fixture";
import {
  createRescueCommanderHireRequest,
  replayRescueServiceAnalysis,
} from "../../../packages/rescue-room/src/service-execution";
import { rescueCommanderStarterPlaybook } from "@frontier/rescue-room";
import {
  executeRescueCommanderHire,
  executeRescueServiceAgent,
  rescueServiceAgentLimits,
  type RescueAgentModel,
} from "./rescue-service-agent";

const usage = { requests: 1, inputTokens: 100, outputTokens: 80, totalTokens: 180 };
const response = (rawOutput: string) => ({
  rawOutput,
  provider: "injected-test-model" as const,
  configuredModel: "offline-fixture",
  responseIds: [],
  usage,
});

describe("bounded real-service runtime with offline model injection", () => {
  it("executes one separate specialist call and records replayable output with usage", async () => {
    const { request, analysis, episode } = serviceExecutionFixture();
    const model: RescueAgentModel = vi.fn(async (input) => {
      expect(input.role).toBe("specialist-analysis");
      expect(input.input).not.toContain(episode.seed);
      expect(input.instructions).toContain("untrusted data");
      expect(input.limits.maximumModelTurns).toBe(1);
      return response(JSON.stringify(analysis, null, 2));
    });
    const result = await executeRescueServiceAgent(request, { model });
    expect(model).toHaveBeenCalledTimes(1);
    expect(result.runtime.usage).toEqual(usage);
    expect(result.runtime.provider).toBe("injected-test-model");
    expect(result.runtime.rawReasoningStored).toBe(false);
    expect(replayRescueServiceAnalysis(request, result.delivery)).toEqual(result.delivery);
  });

  it("does not call model on invalid binding", async () => {
    const { request } = serviceExecutionFixture();
    const model = vi.fn();
    await expect(
      executeRescueServiceAgent({ ...request, requestHash: `0x${"2".repeat(64)}` }, { model }),
    ).rejects.toThrow();
    expect(model).not.toHaveBeenCalled();
  });

  it("aborts and returns within deadline even when injected callback ignores cancellation", async () => {
    const { request } = serviceExecutionFixture();
    let signal: AbortSignal | undefined;
    const model: RescueAgentModel = (input) => {
      signal = input.signal;
      return new Promise(() => undefined);
    };
    await expect(
      executeRescueServiceAgent(request, { model, timeoutMs: 10 }),
    ).rejects.toMatchObject({ code: "timeout" });
    expect(signal?.aborted).toBe(true);
  });

  it("does not spend on a pre-cancelled call", async () => {
    const { request } = serviceExecutionFixture();
    const controller = new AbortController();
    controller.abort();
    const model = vi.fn();
    await expect(
      executeRescueServiceAgent(request, { model, signal: controller.signal }),
    ).rejects.toMatchObject({ code: "cancelled" });
    expect(model).not.toHaveBeenCalled();
  });

  it("redacts provider errors and does not retry", async () => {
    const { request } = serviceExecutionFixture();
    const model = vi.fn(async () => {
      throw new Error("sensitive-api-key-in-provider-error");
    });
    await expect(executeRescueServiceAgent(request, { model })).rejects.toThrow(
      "Agent model execution failed",
    );
    expect(model).toHaveBeenCalledTimes(1);
  });

  it.each([
    { rawOutput: "not json" },
    { rawOutput: JSON.stringify({ transferFunds: true }) },
    { usage: { ...usage, outputTokens: 701, totalTokens: 801 } },
    { usage: { ...usage, requests: 2 } },
    { usage: { ...usage, totalTokens: 1 } },
  ])("fails closed on malformed output or unbounded usage %j", async (change) => {
    const { request, analysis } = serviceExecutionFixture();
    await expect(
      executeRescueServiceAgent(request, {
        model: async () => ({ ...response(JSON.stringify(analysis)), ...change }),
      }),
    ).rejects.toMatchObject({ code: "invalid-output" });
  });

  it("rejects unaffordable Commander output after inference without claiming an accepted order", async () => {
    const { input } = serviceExecutionFixture();
    const request = createRescueCommanderHireRequest({
      publicView: input.publicView,
      playbook: {
        ...rescueCommanderStarterPlaybook,
        allowedServiceIds: ["pulse-monitor"],
        maxServicePriceCredits: 5,
      },
    });
    const model: RescueAgentModel = async () =>
      response(
        JSON.stringify({
          action: { type: "BUY_SERVICE", serviceId: "trace-audit" },
          reasonCode: "audit",
          confidencePpm: 500_000,
        }),
      );
    await expect(executeRescueCommanderHire(request, { model })).rejects.toMatchObject({
      code: "invalid-output",
    });
  });

  it("records a bounded real Commander hiring decision independently of service delivery", async () => {
    const { input } = serviceExecutionFixture();
    const request = createRescueCommanderHireRequest({
      publicView: input.publicView,
      playbook: rescueCommanderStarterPlaybook,
    });
    const result = await executeRescueCommanderHire(request, {
      model: async () =>
        response(
          JSON.stringify({
            action: { type: "BUY_SERVICE", serviceId: "pulse-monitor" },
            reasonCode: "check-signal",
            confidencePpm: 500_000,
          }),
        ),
    });
    expect(result.decision.decision.action).toEqual({
      type: "BUY_SERVICE",
      serviceId: "pulse-monitor",
    });
    expect(result.decision.actionAcceptance).toBe("requires-evaluator");
    expect(result.runtime.role).toBe("commander-hire");
    expect(rescueServiceAgentLimits.maximumRetries).toBe(0);
  });
});
