import { describe, expect, it } from "vitest";
import { cautiousAgent, greedyAgent } from "./agents";
import { evaluateMatch, replayTranscript, toTranscript } from "./evaluator";
import { llmAgent, type DecisionBackend, type LlmTurnRecord } from "./llm-agent";
import { runMatch } from "./match";
import { generateScenario } from "./scenario";

/**
 * These stub the backend rather than any provider's client, so what is tested
 * is the part that has to hold whatever a model says: validation, fallback and
 * replay. No credentials, no network, and nothing here changes when a new
 * provider is added.
 */

type Reply = { input?: Record<string, unknown>; failure?: string };

function stubBackend(reply: () => Reply): {
  backend: DecisionBackend;
  calls: { system: string; user: string; tool: string }[];
} {
  const calls: { system: string; user: string; tool: string }[] = [];
  const backend: DecisionBackend = async ({ system, user, tool }) => {
    calls.push({ system, user, tool: tool.name });
    const next = reply();
    if (next.failure) return { ok: false, failure: next.failure };
    return {
      ok: true,
      input: next.input ?? {},
      usage: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 40 },
    };
  };
  return { backend, calls };
}

const MISSION = "Keep the crew paid without emptying the sea.";

describe("llm agent", () => {
  it("turns a decision into a legal action", async () => {
    const scenario = generateScenario("llm-basic");
    const { backend } = stubBackend(() => ({
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
      backend,
      onTurn: (record) => records.push(record),
    });

    const log = await runMatch(scenario, [agent]);
    const entry = log.rounds[0]!.entries.find((e) => e.boatId === agent.id)!;

    expect(entry.zoneId).toBe("offshore");
    expect(entry.appliedEffort).toBe(5);
    expect(records.some((record) => record.reasonCode === "PRICE_HIGH")).toBe(true);
  });

  it("clamps an effort the hull cannot deliver", async () => {
    const scenario = generateScenario("llm-clamp");
    const boat = scenario.boats[0]!;
    const { backend } = stubBackend(() => ({
      input: {
        zoneId: "coastal",
        effort: 9999,
        reasonCode: "GREED",
        declaredReason: "Everything, right now.",
      },
    }));
    const agent = llmAgent(boat.id, "Kaiyo", scenario, { mission: MISSION, backend });

    const log = await runMatch(scenario, [agent]);
    const entry = log.rounds[0]!.entries.find((e) => e.boatId === boat.id)!;

    expect(entry.appliedEffort).toBeLessThanOrEqual(boat.effortCapacity);
  });

  it("keeps the boat in port when the model names a ground that does not exist", async () => {
    const scenario = generateScenario("llm-bogus-zone");
    const { backend } = stubBackend(() => ({
      input: {
        zoneId: "atlantis",
        effort: 10,
        reasonCode: "CONFUSED",
        declaredReason: "Heading somewhere that is not on the chart.",
      },
    }));
    const agent = llmAgent(scenario.boats[0]!.id, "Kaiyo", scenario, { mission: MISSION, backend });

    const log = await runMatch(scenario, [agent]);
    const entry = log.rounds[0]!.entries.find((e) => e.boatId === agent.id)!;

    expect(entry.catch).toBe(0);
    expect(entry.appliedEffort).toBe(0);
  });

  it("stays in port and records the failure when the backend fails", async () => {
    const scenario = generateScenario("llm-fails");
    const { backend } = stubBackend(() => ({ failure: "connection reset" }));
    const records: LlmTurnRecord[] = [];
    const agent = llmAgent(scenario.boats[0]!.id, "Kaiyo", scenario, {
      mission: MISSION,
      backend,
      onTurn: (record) => records.push(record),
    });

    const log = await runMatch(scenario, [agent]);

    expect(log.rounds).toHaveLength(scenario.rounds);
    expect(log.rounds[0]!.entries[0]!.appliedEffort).toBe(0);
    expect(records[0]!.failure).toContain("connection reset");
  });

  it("treats an unanswered offer as a refusal", async () => {
    const scenario = generateScenario("llm-silence");
    const [a, b] = scenario.boats;
    const { backend } = stubBackend(() => ({
      // Answers nothing and offers nothing, round after round.
      input: { responses: [], offer: null, reasonCode: "SILENT", declaredReason: "No comment." },
    }));
    const quiet = llmAgent(b!.id, "Hokuto", scenario, { mission: MISSION, backend });

    const log = await runMatch(scenario, [cautiousAgent(a!.id, "Kaiyo", scenario), quiet]);
    const bound = log.finalState.pacts.filter((pact) => pact.counterparties.includes(quiet.id));

    // Silence must never bind a boat: dropping a reply cannot become a way to
    // hold someone to terms they never took.
    expect(bound).toHaveLength(0);
  });

  it("ignores an offer aimed at a boat that is not in the fleet", async () => {
    const scenario = generateScenario("llm-ghost");
    const { backend } = stubBackend(() => ({
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
    const agent = llmAgent(scenario.boats[0]!.id, "Kaiyo", scenario, { mission: MISSION, backend });

    const log = await runMatch(scenario, [agent, greedyAgent(scenario.boats[1]!.id, "b", scenario)]);

    expect(log.acceptedProposals).toHaveLength(0);
  });

  it("replays a model-driven match to the same final state", async () => {
    const scenario = generateScenario("llm-replay", { vary: true });
    let round = 0;
    const { backend } = stubBackend(() => {
      round += 1;
      return {
        input: {
          // Varies per call, so the transcript is not trivially constant.
          zoneId: round % 2 === 0 ? "coastal" : "offshore",
          effort: 3 + (round % 4),
          reasonCode: "ROTATING",
          declaredReason: "Working the grounds in turn.",
        },
      };
    });
    const agent = llmAgent(scenario.boats[0]!.id, "Kaiyo", scenario, { mission: MISSION, backend });

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
    const { backend, calls } = stubBackend(() => ({
      input: { zoneId: "coastal", effort: 1, reasonCode: "X", declaredReason: "y" },
    }));
    const agent = llmAgent(scenario.boats[0]!.id, "Kaiyo", scenario, { mission: MISSION, backend });

    await runMatch(scenario, [agent]);

    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call.system).toContain(MISSION);
      expect(`${call.system}${call.user}`).not.toContain(scenario.seed);
    }
    // The rules are identical every round, so a backend can cache them.
    expect(new Set(calls.map((call) => call.system)).size).toBe(1);
  });

  it("tells the boat that a weather limit is not a profit test", async () => {
    const scenario = generateScenario("llm-storm-rule");
    const { backend, calls } = stubBackend(() => ({
      input: { zoneId: "coastal", effort: 1, reasonCode: "X", declaredReason: "y" },
    }));
    const agent = llmAgent(scenario.boats[0]!.id, "Kaiyo", scenario, { mission: MISSION, backend });

    await runMatch(scenario, [agent]);

    // A live match had the boat sail into a storm because it was "within
    // limits" and land almost nothing; the mechanism has to be stated.
    expect(calls[0]!.system).toContain("says nothing about whether the trip pays");
  });

  it("scores a model-driven match on the same three axes as any other", async () => {
    const scenario = generateScenario("llm-scored", { vary: true });
    const { backend } = stubBackend(() => ({
      input: { zoneId: "coastal", effort: 6, reasonCode: "STEADY", declaredReason: "Steady work." },
    }));
    const agent = llmAgent(scenario.boats[0]!.id, "Kaiyo", scenario, { mission: MISSION, backend });

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
