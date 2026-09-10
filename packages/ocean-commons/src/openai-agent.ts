import OpenAI from "openai";
import type { DecisionBackend, DecisionUsage } from "./llm-agent";

/**
 * An OpenAI transport for the same fishing agent.
 *
 * Only the wire format differs. The prompt, the schema, the validation and the
 * fallbacks all live in `llm-agent.ts` and are shared, so a match run on this
 * backend is scored, replayed and audited exactly like one run on Claude — and
 * the two can sit in the same fleet, which is the point: a tournament wants
 * entrants that differ in judgement, not in plumbing.
 */

export type OpenAiBackendOptions = {
  client?: OpenAI;
  /** Defaults to `OPENAI_MODEL`, then to gpt-5. */
  model?: string;
  /** Passed through when the model accepts it; ignored otherwise. */
  temperature?: number;
  /**
   * How much the model is allowed to think before answering.
   *
   * Reasoning is billed as output, and a 12-round match spent 87k output
   * tokens against 33k of input — so this, not the prompt, is where the cost
   * of a season actually sits.
   */
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
};

export function openaiBackend(options: OpenAiBackendOptions = {}): DecisionBackend {
  const client =
    options.client ??
    (() => {
      if (!process.env["OPENAI_API_KEY"]) {
        throw new Error(
          "openaiBackend needs OPENAI_API_KEY, or a configured client. " +
            "Scripted baselines run without any credentials.",
        );
      }
      return new OpenAI();
    })();

  const model = options.model ?? process.env["OPENAI_MODEL"] ?? "gpt-5";

  return async ({ system, user, tool }) => {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: tool.name,
              description: tool.description,
              // Strict mode makes the arguments schema-valid, which removes a
              // whole class of failure before our own validation sees it.
              strict: true,
              parameters: tool.schema as Record<string, unknown>,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: tool.name } },
        ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
        ...(options.reasoningEffort === undefined
          ? {}
          : { reasoning_effort: options.reasoningEffort }),
      });

      const usage: DecisionUsage = {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        cacheReadTokens: response.usage?.prompt_tokens_details?.cached_tokens ?? 0,
      };

      const call = response.choices[0]?.message?.tool_calls?.[0];
      if (!call || call.type !== "function") {
        return {
          ok: false,
          failure: `no tool call (finish_reason ${response.choices[0]?.finish_reason ?? "unknown"})`,
        };
      }

      // Never string-match the arguments; they are JSON and escaping varies.
      let parsed: unknown;
      try {
        parsed = JSON.parse(call.function.arguments);
      } catch {
        return { ok: false, failure: "tool arguments were not valid JSON" };
      }
      if (typeof parsed !== "object" || parsed === null) {
        return { ok: false, failure: "tool arguments were not an object" };
      }
      return { ok: true, input: parsed as Record<string, unknown>, usage };
    } catch (error) {
      return { ok: false, failure: error instanceof Error ? error.message : String(error) };
    }
  };
}
