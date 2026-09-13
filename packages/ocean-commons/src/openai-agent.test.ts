import type OpenAI from "openai";
import { describe, expect, it } from "vitest";
import { greedyAgent } from "./agents";
import { llmAgent } from "./llm-agent";
import { runMatch } from "./match";
import { openaiBackend } from "./openai-agent";
import { generateScenario } from "./scenario";

/**
 * The OpenAI backend is a transport, so what needs testing is the wire
 * handling: arguments arrive as a JSON string rather than an object, and a
 * model that answers without calling the tool must not stall a match.
 */

type Reply = { args?: string; finish?: string; throws?: string };

function stubOpenAi(reply: () => Reply): { client: OpenAI; sent: Record<string, unknown>[] } {
  const sent: Record<string, unknown>[] = [];
  const client = {
    chat: {
      completions: {
        async create(params: Record<string, unknown>) {
          sent.push(params);
          const next = reply();
          if (next.throws) throw new Error(next.throws);
          return {
            choices: [
              {
                finish_reason: next.finish ?? "tool_calls",
                message: {
                  tool_calls: next.args
                    ? [
                        {
                          id: "c1",
                          type: "function",
                          function: { name: "set_course", arguments: next.args },
                        },
                      ]
                    : undefined,
                },
              },
            ],
            usage: {
              prompt_tokens: 100,
              completion_tokens: 20,
              prompt_tokens_details: { cached_tokens: 40 },
            },
          };
        },
      },
    },
  } as unknown as OpenAI;
  return { client, sent };
}

const MISSION = "Keep the crew paid without emptying the sea.";

describe("openai backend", () => {
  it("parses tool arguments that arrive as a JSON string", async () => {
    const scenario = generateScenario("oa-basic", { rounds: 4 });
    const { client, sent } = stubOpenAi(() => ({
      args: JSON.stringify({
        zoneId: "coastal",
        effort: 7,
        offer: null,
        reasonCode: "CLOSE_AND_CHEAP",
        declaredReason: "Coastal is close and the price holds.",
      }),
    }));
    const agent = llmAgent(scenario.boats[0]!.id, "Kaiyo", scenario, {
      mission: MISSION,
      backend: openaiBackend({ client, model: "gpt-5" }),
    });

    const log = await runMatch(scenario, [agent]);
    const entry = log.rounds[0]!.entries.find((e) => e.boatId === agent.id)!;

    expect(entry.zoneId).toBe("coastal");
    expect(entry.appliedEffort).toBe(7);
    // A quiet round is one question, not two: the offer and the trip are
    // settled together, which halves what a season costs to play.
    expect(sent).toHaveLength(scenario.rounds);
    const forced = sent.map(
      (params) => (params["tool_choice"] as { function: { name: string } }).function.name,
    );
    // Always forced, so the model can never answer in prose instead.
    expect(new Set(forced)).toEqual(new Set(["take_turn"]));
  });

  it("stays in port when the arguments are not valid JSON", async () => {
    const scenario = generateScenario("oa-badjson");
    const { client } = stubOpenAi(() => ({ args: "{not json" }));
    const agent = llmAgent(scenario.boats[0]!.id, "Kaiyo", scenario, {
      mission: MISSION,
      backend: openaiBackend({ client }),
    });

    const log = await runMatch(scenario, [agent]);

    expect(log.rounds[0]!.entries[0]!.appliedEffort).toBe(0);
  });

  it("stays in port when the model answers without calling the tool", async () => {
    const scenario = generateScenario("oa-notool");
    const { client } = stubOpenAi(() => ({ finish: "stop" }));
    const agent = llmAgent(scenario.boats[0]!.id, "Kaiyo", scenario, {
      mission: MISSION,
      backend: openaiBackend({ client }),
    });

    const log = await runMatch(scenario, [agent]);

    expect(log.rounds[0]!.entries[0]!.appliedEffort).toBe(0);
    expect(log.rounds).toHaveLength(scenario.rounds);
  });

  it("keeps the match running when the API throws", async () => {
    const scenario = generateScenario("oa-throws");
    const { client } = stubOpenAi(() => ({ throws: "429 rate limit" }));
    const agent = llmAgent(scenario.boats[0]!.id, "Kaiyo", scenario, {
      mission: MISSION,
      backend: openaiBackend({ client }),
    });

    const log = await runMatch(scenario, [
      agent,
      greedyAgent(scenario.boats[1]!.id, "b", scenario),
    ]);

    expect(log.rounds).toHaveLength(scenario.rounds);
  });

  it("refuses to start without credentials", () => {
    const key = process.env["OPENAI_API_KEY"];
    delete process.env["OPENAI_API_KEY"];
    try {
      expect(() => openaiBackend()).toThrow(/OPENAI_API_KEY/);
    } finally {
      if (key !== undefined) process.env["OPENAI_API_KEY"] = key;
    }
  });
});
