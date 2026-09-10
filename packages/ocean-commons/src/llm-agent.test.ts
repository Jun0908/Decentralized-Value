import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { cautiousAgent, greedyAgent, type Observation } from "./agents";
import { evaluateMatch, replayTranscript, toTranscript } from "./evaluator";
import { llmAgent, type LlmTurnRecord } from "./llm-agent";
import { runMatch } from "./match";
import { generateScenario } from "./scenario";

/**
 * These run without credentials. A stub stands in for the API so the parts
 * that must hold whatever the model says — validation, fallback, replay — are
 * tested here rather than discovered during a paid match.
 */

type Reply = { tool?: string; input?: unknown; stopReason?: string; throws?: string };

/** Minimal stand-in for the client surface `llmAgent` actually uses. */
function stubClient(replies: Reply[] | (() => Reply)): {
  client: Anthropic;
  calls: { system: string; user: string; tool: string }[];
} {
  const calls: { system: string; user: string; tool: string }[] = [];
  let index = 0;
  const next = () => (typeof replies === "function" ? replies() : (replies[index++] ?? {}));

  const client = {
    messages: {
      async create(params: Record<string, unknown>) {
        const system = params["system"] as { text: string }[];
        const messages = params["messages"] as { content: string }[];
        const tools = params["tools"] as { name: string }[];
        calls.push({
          system: system[0]?.text ?? "",
          user: messages[0]?.content ?? "",
          tool: tools[0]?.name ?? "",
        });

        const reply = next();
        if (reply.throws) throw new Error(reply.throws);
        return {
          content: reply.tool
            ? [{ type: "tool_use", name: reply.tool, id: "t1", input: reply.input ?? {} }]
            : [{ type: "text", text: "no tool" }],
          stop_reason: reply.stopReason ?? "tool_use",
          usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0 },
        };
      },
    },
  } as unknown as Anthropic;

  return { client, calls };
}

const MISSION = "Keep the crew paid without emptying the sea.";

describe("llm agent", () => {
  it("turns a tool call into a legal action", async () => {
    const scenario = generateScenario("llm-basic");
    const { client } = stubClient(() => ({
      tool: "set_course",
      input: {
        zoneId: "offshore",
        effort: 5,
        reasonCode: "PRICE_HIGH",
        declaredReason: "Offshore is still full and the price is good.",
      },
    }));
    const records: LlmTurnRecord[] = [];
    const agent = llmAgent(scenario.boats[0]!.id, "Kaiyo", scenario, {
      mission: MISSION,
      client,
      onTurn: (record) => records.push(record),
    });

    const log = await runMatch(scenario, [agent]);
    const entry = log.rounds[0]!.entries.find((e) => e.boatId === agent.id)!;

    expect(entry.zoneId).toBe("offshore");
    expect(entry.appliedEffort).toBe(5);
    expect(records[0]!.reasonCode).toBe("PRICE_HIGH");
    expect(records[0]!.failure).toBeUndefined();
  });

  it("clamps an effort the hull cannot deliver", async () => {
    const scenario = generateScenario("llm-clamp");
    const boat = scenario.boats[0]!;
    const { client } = stubClient(() => ({
      tool: "set_course",
      input: {
        zoneId: "coastal",
        effort: 9999,
        reasonCode: "GREED",
        declaredReason: "Everything, right now.",
      },
    }));
    const agent = llmAgent(boat.id, "Kaiyo", scenario, { mission: MISSION, client });

    const log = await runMatch(scenario, [agent]);
    const entry = log.rounds[0]!.entries.find((e) => e.boatId === boat.id)!;

    expect(entry.appliedEffort).toBeLessThanOrEqual(boat.effortCapacity);
  });

  it("keeps the boat in port when the model names a ground that does not exist", async () => {
    const scenario = generateScenario("llm-bogus-zone");
    const { client } = stubClient(() => ({
      tool: "set_course",
      input: {
        zoneId: "atlantis",
        effort: 10,
        reasonCode: "CONFUSED",
        declaredReason: "Heading somewhere that is not on the chart.",
      },
    }));
    const agent = llmAgent(scenario.boats[0]!.id, "Kaiyo", scenario, {
      mission: MISSION,
      client,
    });

    const log = await runMatch(scenario, [agent]);
    const entry = log.rounds[0]!.entries.find((e) => e.boatId === agent.id)!;

    expect(entry.catch).toBe(0);
    expect(entry.appliedEffort).toBe(0);
  });

  it("stays in port and records the failure when the API call throws", async () => {
    const scenario = generateScenario("llm-throws");
    const { client } = stubClient(() => ({ throws: "connection reset" }));
    const records: LlmTurnRecord[] = [];
    const agent = llmAgent(scenario.boats[0]!.id, "Kaiyo", scenario, {
      mission: MISSION,
      client,
      onTurn: (record) => records.push(record),
    });

    const log = await runMatch(scenario, [agent]);

    expect(log.rounds).toHaveLength(scenario.rounds);
    expect(log.rounds[0]!.entries[0]!.appliedEffort).toBe(0);
    expect(records[0]!.failure).toContain("connection reset");
  });

  it("stays in port when the model answers without calling the tool", async () => {
    const scenario = generateScenario("llm-no-tool");
    const { client } = stubClient(() => ({ stopReason: "end_turn" }));
    const records: LlmTurnRecord[] = [];
    const agent = llmAgent(scenario.boats[0]!.id, "Kaiyo", scenario, {
      mission: MISSION,
      client,
      onTurn: (record) => records.push(record),
    });

    await runMatch(scenario, [agent]);

    expect(records[0]!.failure).toContain("no tool call");
  });

  it("treats an unanswered offer as a refusal", async () => {
    const scenario = generateScenario("llm-silence");
    const [a, b] = scenario.boats;
    const { client } = stubClient(() => ({
      // Answers nothing and offers nothing, round after round.
      tool: "answer_offers",
      input: { responses: [], offer: null, reasonCode: "SILENT", declaredReason: "No comment." },
    }));
    const quiet = llmAgent(b!.id, "Hokuto", scenario, { mission: MISSION, client });
    const broker = cautiousAgent(a!.id, "Kaiyo", scenario);

    const log = await runMatch(scenario, [broker, quiet]);
    const boundToQuiet = log.finalState.pacts.filter((pact) =>
      pact.counterparties.includes(quiet.id),
    );

    // Silence must never bind a boat to a contract.
    expect(boundToQuiet).toHaveLength(0);
  });

  it("ignores an offer aimed at a boat that is not in the fleet", async () => {
    const scenario = generateScenario("llm-ghost");
    const { client } = stubClient(() => ({
      tool: "answer_offers",
      input: {
        responses: [],
        offer: {
          targetBoatId: "flying-dutchman",
          kind: "CATCH_LIMIT",
          payment: 50,
          durationRounds: 2,
          capPerRound: 5,
          zoneId: null,
        },
        reasonCode: "GHOST",
        declaredReason: "Offering a deal to nobody.",
      },
    }));
    const agent = llmAgent(scenario.boats[0]!.id, "Kaiyo", scenario, {
      mission: MISSION,
      client,
    });

    const log = await runMatch(scenario, [agent, greedyAgent(scenario.boats[1]!.id, "b", scenario)]);

    expect(log.acceptedProposals).toHaveLength(0);
  });

  it("replays a model-driven match to the same final state", async () => {
    const scenario = generateScenario("llm-replay", { vary: true });
    let round = 0;
    const { client } = stubClient(() => {
      round += 1;
      return {
        tool: "set_course",
        input: {
          // Varies with the call, so the transcript is not trivially constant.
          zoneId: round % 2 === 0 ? "coastal" : "offshore",
          effort: 3 + (round % 4),
          reasonCode: "ROTATING",
          declaredReason: "Working the grounds in turn.",
        },
      };
    });
    const agent = llmAgent(scenario.boats[0]!.id, "Kaiyo", scenario, {
      mission: MISSION,
      client,
    });

    const log = await runMatch(scenario, [
      agent,
      greedyAgent(scenario.boats[1]!.id, "b", scenario),
      cautiousAgent(scenario.boats[2]!.id, "c", scenario),
    ]);
    const replayed = replayTranscript(scenario, toTranscript(log));

    // The engine only ever saw actions, so the world reproduces without a model.
    expect(replayed.stocks).toEqual(log.finalState.stocks);
    for (const boat of scenario.boats) {
      expect(replayed.boats[boat.id]!.cash).toBeCloseTo(log.finalState.boats[boat.id]!.cash, 6);
    }
  });

  it("shows the boat its own board and never the seed", async () => {
    const scenario = generateScenario("llm-leak", { vary: true });
    const { client, calls } = stubClient(() => ({
      tool: "set_course",
      input: { zoneId: "coastal", effort: 1, reasonCode: "X", declaredReason: "y" },
    }));
    const agent = llmAgent(scenario.boats[0]!.id, "Kaiyo", scenario, {
      mission: MISSION,
      client,
    });

    await runMatch(scenario, [agent]);

    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call.system).toContain(MISSION);
      expect(`${call.system}${call.user}`).not.toContain(scenario.seed);
    }
    // The rules are identical every round, so they cache instead of being re-read.
    expect(new Set(calls.map((call) => call.system)).size).toBe(1);
  });

  it("refuses to start without credentials rather than failing mid-match", () => {
    const scenario = generateScenario("llm-nokey");
    const key = process.env["ANTHROPIC_API_KEY"];
    const token = process.env["ANTHROPIC_AUTH_TOKEN"];
    delete process.env["ANTHROPIC_API_KEY"];
    delete process.env["ANTHROPIC_AUTH_TOKEN"];
    try {
      expect(() =>
        llmAgent(scenario.boats[0]!.id, "Kaiyo", scenario, { mission: MISSION }),
      ).toThrow(/ANTHROPIC_API_KEY/);
    } finally {
      if (key !== undefined) process.env["ANTHROPIC_API_KEY"] = key;
      if (token !== undefined) process.env["ANTHROPIC_AUTH_TOKEN"] = token;
    }
  });

  it("scores a model-driven match on the same three axes as any other", async () => {
    const scenario = generateScenario("llm-scored", { vary: true });
    const { client } = stubClient(() => ({
      tool: "set_course",
      input: { zoneId: "coastal", effort: 6, reasonCode: "STEADY", declaredReason: "Steady work." },
    }));
    const agent = llmAgent(scenario.boats[0]!.id, "Kaiyo", scenario, {
      mission: MISSION,
      client,
    });

    const outcomes = evaluateMatch(
      await runMatch(scenario, [
        agent,
        greedyAgent(scenario.boats[1]!.id, "b", scenario),
        cautiousAgent(scenario.boats[2]!.id, "c", scenario),
      ]),
    );

    expect(outcomes.stewardship).toBeGreaterThan(0);
    expect(outcomes.stewardship).toBeLessThanOrEqual(1);
    expect(Number.isFinite(outcomes.livelihood)).toBe(true);
  });
});

/** Referenced so the Observation type stays part of this file's contract. */
export type _ObservationUsed = Observation;
