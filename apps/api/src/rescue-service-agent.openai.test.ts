import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { serviceExecutionFixture } from "../../../packages/rescue-room/src/service-execution.test-fixture";
import { rescueServiceAnalysisSchema } from "../../../packages/rescue-room/src/service-execution";

const sdk = vi.hoisted(() => ({
  agent: vi.fn(),
  provider: vi.fn(),
  runner: vi.fn(),
  run: vi.fn(),
  close: vi.fn(),
}));
vi.mock("@openai/agents", () => ({
  Agent: class {
    constructor(options: unknown) {
      sdk.agent(options);
    }
  },
  OpenAIProvider: class {
    constructor(options: unknown) {
      sdk.provider(options);
    }
    close = sdk.close;
  },
  Runner: class {
    constructor(options: unknown) {
      sdk.runner(options);
    }
    run = sdk.run;
  },
}));
import { runOpenAiRescueServiceAgent } from "./rescue-service-agent";

describe("OpenAI specialist adapter offline SDK contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("OPENAI_API_KEY", "test-only-nonsecret-placeholder");
    vi.stubEnv("OPENAI_BASE_URL", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("publishes a JSON-Schema-compatible structured output contract", () => {
    expect(() => z.toJSONSchema(rescueServiceAnalysisSchema)).not.toThrow();
  });

  it("records exact assistant text, disables retries/traces/storage, and closes the provider", async () => {
    const { request, analysis } = serviceExecutionFixture();
    const rawOutput = JSON.stringify(analysis, null, 2);
    sdk.run.mockResolvedValue({
      finalOutput: analysis,
      rawResponses: [
        {
          responseId: "response-offline-1",
          output: [
            { type: "reasoning", summary: [{ type: "summary_text", text: "not retained" }] },
            {
              type: "message",
              role: "assistant",
              content: [{ type: "output_text", text: rawOutput }],
            },
          ],
        },
      ],
      runContext: { usage: { requests: 1, inputTokens: 90, outputTokens: 70, totalTokens: 160 } },
    });
    const result = await runOpenAiRescueServiceAgent(request);
    expect(result.delivery.rawOutput).toBe(rawOutput);
    expect(JSON.stringify(result)).not.toContain("not retained");
    expect(sdk.agent).toHaveBeenCalledWith(
      expect.objectContaining({
        modelSettings: expect.objectContaining({
          retry: { maxRetries: 0 },
          store: false,
          maxTokens: 700,
        }),
      }),
    );
    expect(sdk.runner).toHaveBeenCalledWith(
      expect.objectContaining({ tracingDisabled: true, traceIncludeSensitiveData: false }),
    );
    expect(sdk.run).toHaveBeenCalledTimes(1);
    expect(sdk.close).toHaveBeenCalledTimes(1);
  });

  it("fails closed before SDK invocation when key is missing or endpoint is redirected", async () => {
    const { request } = serviceExecutionFixture();
    vi.stubEnv("OPENAI_API_KEY", "");
    await expect(runOpenAiRescueServiceAgent(request)).rejects.toMatchObject({
      code: "configuration",
    });
    vi.stubEnv("OPENAI_API_KEY", "test-only-nonsecret-placeholder");
    vi.stubEnv("OPENAI_BASE_URL", "https://untrusted.example/v1");
    await expect(runOpenAiRescueServiceAgent(request)).rejects.toMatchObject({
      code: "configuration",
    });
    expect(sdk.run).not.toHaveBeenCalled();
  });

  it("does not treat parsed output without exact assistant evidence as a delivery", async () => {
    const { request, analysis } = serviceExecutionFixture();
    sdk.run.mockResolvedValue({
      finalOutput: analysis,
      rawResponses: [],
      runContext: { usage: { requests: 1, inputTokens: 90, outputTokens: 70, totalTokens: 160 } },
    });
    await expect(runOpenAiRescueServiceAgent(request)).rejects.toMatchObject({
      code: "invalid-output",
    });
    expect(sdk.close).toHaveBeenCalledTimes(1);
  });
});
