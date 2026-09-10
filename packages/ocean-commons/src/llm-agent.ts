import Anthropic from "@anthropic-ai/sdk";
import type { NegotiationOutput, Observation, OceanAgent } from "./agents";
import type { OceanScenario } from "./scenario";
import type { BoatId, FishingAction, Proposal, ProposalResponse } from "./types";

/**
 * A boat run by a language model.
 *
 * The model never touches the world. It answers two questions each round —
 * what to offer, and where to fish — and the engine resolves everything else.
 * Every answer arrives as a validated tool call, so a malformed or impossible
 * reply becomes a recorded refusal rather than a corrupted match; a boat whose
 * agent fails simply stays in port that round.
 *
 * Replay is unaffected. The transcript stores the actions that came back, not
 * the reasoning that produced them, so a match driven by a model reproduces
 * from its transcript exactly as one driven by a rule does.
 */

export type LlmTurnRecord = {
  round: number;
  boatId: BoatId;
  phase: "negotiate" | "act";
  /** Short machine-readable motive the model gave. Provenance only, never scored. */
  reasonCode: string;
  /** One sentence the model offered for its choice. Never fed back into the engine. */
  declaredReason: string;
  action?: FishingAction;
  proposals?: Proposal[];
  /** Set when the model's reply could not be used and the fallback ran. */
  failure?: string;
  usage?: DecisionUsage;
};

// --- the seam between "what to ask" and "who to ask" -----------------------

/**
 * Everything that keeps a bad answer from corrupting the world — the schema,
 * the validation, the fallbacks — lives on the agent side and is tested once.
 * A backend only carries the question to a model and brings back the arguments
 * it chose, so a second provider is a transport, not a second agent.
 */
export type DecisionTool = {
  name: string;
  description: string;
  schema: Record<string, unknown>;
};

export type DecisionUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
};

export type DecisionResult =
  | { ok: true; input: Record<string, unknown>; usage?: DecisionUsage }
  | { ok: false; failure: string };

export type DecisionBackend = (request: {
  /** Stable across the whole match, so a backend can cache it. */
  system: string;
  /** This round's board. */
  user: string;
  tool: DecisionTool;
}) => Promise<DecisionResult>;

const CLAUDE_MODEL = "claude-opus-5";

export type AnthropicBackendOptions = {
  client?: Anthropic;
  model?: string;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
};

/** Claude. The default when no other backend is supplied. */
export function anthropicBackend(options: AnthropicBackendOptions = {}): DecisionBackend {
  const client =
    options.client ??
    (() => {
      if (!process.env["ANTHROPIC_API_KEY"] && !process.env["ANTHROPIC_AUTH_TOKEN"]) {
        throw new Error(
          "anthropicBackend needs Claude credentials: set ANTHROPIC_API_KEY, or pass a " +
            "configured client. Scripted baselines run without any.",
        );
      }
      return new Anthropic();
    })();
  const model = options.model ?? CLAUDE_MODEL;
  const effort = options.effort ?? "medium";

  return async ({ system, user, tool }) => {
    try {
      const response = await client.messages.create({
        model,
        max_tokens: 16000,
        output_config: { effort },
        // The rules never change during a match, so they cache; the board goes
        // after the breakpoint because it changes every round.
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        tools: [
          {
            name: tool.name,
            description: tool.description,
            strict: true,
            input_schema: tool.schema as Anthropic.Tool["input_schema"],
          },
        ],
        tool_choice: { type: "tool", name: tool.name },
        messages: [{ role: "user", content: user }],
      });

      const usage: DecisionUsage = {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      };
      const call = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
      );
      if (!call) {
        return { ok: false, failure: `no tool call (stop_reason ${response.stop_reason})` };
      }
      return { ok: true, input: call.input as Record<string, unknown>, usage };
    } catch (error) {
      return { ok: false, failure: error instanceof Error ? error.message : String(error) };
    }
  };
}

// --- what the boat is told -------------------------------------------------

/** The rules, written once. Identical every round so it caches cleanly. */
export function systemPrompt(scenario: OceanScenario, mission: string): string {
  const zones = scenario.zones
    .map(
      (zone) =>
        `- ${zone.id} (${zone.name}): capacity ${zone.carryingCapacity}, regrowth ${zone.growthRate}, ` +
        `travel cost ${zone.travelCost}, yield per effort at full stock ${zone.catchEfficiency}, ` +
        `storm exposure ${zone.stormExposure}` +
        (zone.reserve ? `, RESERVE — fined ${scenario.reserveFinePerEffort} per unit of effort` : ""),
    )
    .join("\n");

  return `You skipper one boat in a fleet of ${scenario.boats.length} fishing a shared sea over ${scenario.rounds} rounds.

THE SEA
${zones}

Fish landed per unit of effort falls as a ground is drawn down, so a stripped ground pays badly for everyone on it. Below a critical stock a ground stops recovering and dies for the rest of the match. The nursery reserve feeds the other grounds: fishing it pays now and quietly starves everything later. One market buys the whole fleet's catch, so a glut lowers the price you get too.

WHAT YOU CONTROL
Each round you choose a ground and how hard to work it, and you may offer contracts to other boats:
- CATCH_LIMIT: you pay them to land no more than a cap per round.
- CONSERVATION_BUYOUT: you pay them to stay out of one ground, or out of the water entirely.

Money offered is locked in escrow when a contract is accepted. It is released round by round while the terms hold, and refunded to you if they are broken. Compliance is measured by the engine from actual catches — nobody's word counts, including yours.

YOUR OWNER'S STANDING INSTRUCTION
${mission}

Answer only through the tool. Keep declaredReason to one plain sentence about what you are doing and why; your owner reads it and it is never scored.`;
}

/** The board as this boat can see it. */
export function renderObservation(observation: Observation): string {
  const stocks = observation.zones
    .map((zone) => {
      const stock = observation.stocks[zone.id] ?? 0;
      const share = stock / zone.carryingCapacity;
      const critical = stock < zone.carryingCapacity * (zone.collapseThreshold + 0.15);
      return `  ${zone.id}: ${stock.toFixed(0)} (${(share * 100).toFixed(0)}% of capacity)${critical ? " — NEAR COLLAPSE" : ""}`;
    })
    .join("\n");

  const others = observation.others
    .map(
      (other) =>
        `  ${other.id}: ${other.active ? (other.underRepair ? "under repair" : "fishing") : "bankrupt"}, ` +
        `landed ${other.lastCatch.toFixed(0)} last round in ${other.lastZoneId ?? "port"}, ` +
        `${other.totalCatch.toFixed(0)} in total, ${other.breaches} broken contracts` +
        (other.smallFleet ? ", small boat" : ""),
    )
    .join("\n");

  const pacts = observation.activePacts
    .filter((pact) => pact.status === "ACTIVE")
    .map(
      (pact) =>
        `  ${pact.id}: ${pact.terms.kind} — ${pact.proposer} pays ${pact.counterparties.join(", ")}, ` +
        `${pact.escrowRemaining.toFixed(0)} still in escrow, ends round ${pact.endRound}`,
    );

  const offers = observation.incomingProposals.map((proposal) => {
    const terms =
      proposal.terms.kind === "CATCH_LIMIT"
        ? `cap ${proposal.terms.capPerRound} per round${proposal.terms.zoneId ? ` in ${proposal.terms.zoneId}` : " everywhere"}`
        : proposal.terms.kind === "CONSERVATION_BUYOUT"
          ? proposal.terms.zoneId
            ? `stay out of ${proposal.terms.zoneId}`
            : "stay in port entirely"
          : `pay ${proposal.terms.contributionPerRound} per round into a pool`;
    return `  ${proposal.id}: ${proposal.proposer} offers you ${proposal.payment} DemoUSD to ${terms}, for ${proposal.durationRounds} rounds`;
  });

  const self = observation.self;
  return `ROUND ${observation.round} of ${observation.round + observation.roundsRemaining - 1} (${observation.roundsRemaining} left)
Weather: storm severity ${observation.weather.stormSeverity.toFixed(2)}. Fish price ${observation.price.toFixed(2)} per fish.

STOCKS
${stocks}

YOUR BOAT (${self.id})
  cash ${self.cash.toFixed(0)}, effort capacity ${self.effortCapacity}, upkeep ${self.upkeepPerRound} per round
  landed ${self.totalCatch.toFixed(0)} so far, paid out ${self.totalPaidOut.toFixed(0)}, received ${self.totalReceived.toFixed(0)}
  this hull cannot work water rougher than ${self.stormLimit} (zone storm exposure x storm severity)

BUDGET YOUR OWNER ALLOWS
  at most ${observation.wallet.policy.maxPaymentPerTransaction} per contract, ${observation.wallet.remaining.toFixed(0)} left to spend this match

OTHER BOATS
${others}

ACTIVE CONTRACTS
${pacts.length > 0 ? pacts.join("\n") : "  none"}

OFFERS ON THE TABLE FOR YOU
${offers.length > 0 ? offers.join("\n") : "  none"}`;
}

export const ACT_TOOL: DecisionTool = {
  name: "set_course",
  description: "Choose where to fish this round and how hard.",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["zoneId", "effort", "reasonCode", "declaredReason"],
    properties: {
      zoneId: { type: "string", description: "Ground to work this round." },
      effort: {
        type: "number",
        description: "Units of effort, 0 to stay in port. Clamped to your capacity.",
      },
      reasonCode: {
        type: "string",
        description: "Short motive, e.g. STOCK_LOW, PRICE_HIGH, HONOURING_PACT, STORM.",
      },
      declaredReason: { type: "string", description: "One sentence for your owner." },
    },
  },
};

export const NEGOTIATE_TOOL: DecisionTool = {
  name: "answer_offers",
  description: "Accept or refuse the offers on the table, and optionally make one of your own.",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["responses", "offer", "reasonCode", "declaredReason"],
    properties: {
      responses: {
        type: "array",
        description: "One entry per offer on the table.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["proposalId", "accept"],
          properties: {
            proposalId: { type: "string" },
            accept: { type: "boolean" },
          },
        },
      },
      offer: {
        type: ["object", "null"],
        description: "A contract to offer another boat, or null to offer nothing.",
        additionalProperties: false,
        required: ["targetBoatId", "kind", "payment", "durationRounds", "capPerRound", "zoneId"],
        properties: {
          targetBoatId: { type: "string" },
          kind: { type: "string", enum: ["CATCH_LIMIT", "CONSERVATION_BUYOUT"] },
          payment: { type: "number", description: "DemoUSD locked in escrow." },
          durationRounds: { type: "number" },
          capPerRound: {
            type: ["number", "null"],
            description: "For CATCH_LIMIT only; null otherwise.",
          },
          zoneId: {
            type: ["string", "null"],
            description: "Ground the terms apply to, or null for all grounds.",
          },
        },
      },
      reasonCode: { type: "string" },
      declaredReason: { type: "string", description: "One sentence for your owner." },
    },
  },
};

// --- the agent -------------------------------------------------------------

export type LlmAgentOptions = {
  /**
   * The user's standing instruction to this boat — the whole of what a player
   * writes. Not a per-round order: the model decides each round itself.
   */
  mission: string;
  /** Which model answers. Defaults to Claude; see `openaiBackend` for the other. */
  backend?: DecisionBackend;
  model?: string;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  /** Injectable so a test can drive the agent without reaching the network. */
  client?: Anthropic;
  /** Receives one record per decision, for the replay panel and for audit. */
  onTurn?: (record: LlmTurnRecord) => void;
};

function idleAction(observation: Observation): FishingAction {
  return { boatId: observation.self.id, zoneId: observation.zones[0]!.id, effort: 0 };
}

export function llmAgent(
  id: BoatId,
  name: string,
  scenario: OceanScenario,
  options: LlmAgentOptions,
): OceanAgent {
  // Built here rather than on first use: a fleet that dies on round 4 for want
  // of a key has already wasted the rounds before it.
  const backend =
    options.backend ??
    anthropicBackend({
      ...(options.client ? { client: options.client } : {}),
      ...(options.model ? { model: options.model } : {}),
      ...(options.effort ? { effort: options.effort } : {}),
    });

  const system = systemPrompt(scenario, options.mission);

  async function decide<T>(
    observation: Observation,
    phase: "negotiate" | "act",
    tool: DecisionTool,
    apply: (input: Record<string, unknown>, record: LlmTurnRecord) => T,
    fallback: T,
  ): Promise<T> {
    const record: LlmTurnRecord = {
      round: observation.round,
      boatId: id,
      phase,
      reasonCode: "NONE",
      declaredReason: "",
    };

    const result = await backend({ system, user: renderObservation(observation), tool });
    if (!result.ok) {
      record.failure = result.failure;
      options.onTurn?.(record);
      return fallback;
    }
    if (result.usage) record.usage = result.usage;

    record.reasonCode = String(result.input["reasonCode"] ?? "NONE");
    record.declaredReason = String(result.input["declaredReason"] ?? "");
    try {
      const applied = apply(result.input, record);
      options.onTurn?.(record);
      return applied;
    } catch (error) {
      // A model can satisfy the schema and still describe something impossible.
      record.failure = error instanceof Error ? error.message : String(error);
      options.onTurn?.(record);
      return fallback;
    }
  }

  return {
    id,
    name,

    async negotiate(observation): Promise<NegotiationOutput> {
      const nothing: NegotiationOutput = { proposals: [], responses: [] };
      const canOffer =
        observation.wallet.remaining > 0 && observation.self.cash > observation.self.upkeepPerRound;
      // Skip the call entirely when there is nothing to decide.
      if (observation.incomingProposals.length === 0 && !canOffer) return nothing;

      return decide<NegotiationOutput>(
        observation,
        "negotiate",
        NEGOTIATE_TOOL,
        (input, record) => {
          const answers = Array.isArray(input["responses"]) ? input["responses"] : [];
          const responses: ProposalResponse[] = [];
          for (const raw of answers as Record<string, unknown>[]) {
            const proposalId = String(raw["proposalId"] ?? "");
            if (!observation.incomingProposals.some((p) => p.id === proposalId)) continue;
            responses.push(
              raw["accept"] === true
                ? { type: "ACCEPT", proposalId }
                : { type: "REJECT", proposalId, reasonCode: "DECLINED" },
            );
          }
          // Anything left unanswered is a refusal: silence must not bind a boat,
          // or dropping a reply would be a way to hold someone to terms.
          for (const proposal of observation.incomingProposals) {
            if (!responses.some((r) => r.proposalId === proposal.id)) {
              responses.push({ type: "REJECT", proposalId: proposal.id, reasonCode: "NO_ANSWER" });
            }
          }

          const proposals: Proposal[] = [];
          const offer = input["offer"] as Record<string, unknown> | null | undefined;
          if (offer && typeof offer === "object") {
            const target = String(offer["targetBoatId"] ?? "");
            const kind = String(offer["kind"] ?? "");
            const payment = Math.max(0, Math.round(Number(offer["payment"]) || 0));
            const durationRounds = Math.max(
              1,
              Math.min(Number(offer["durationRounds"]) || 1, observation.roundsRemaining),
            );
            const zoneRaw = offer["zoneId"];
            const zoneId =
              typeof zoneRaw === "string" && observation.zones.some((z) => z.id === zoneRaw)
                ? zoneRaw
                : null;
            const targetExists = observation.others.some(
              (other) => other.id === target && other.active,
            );

            if (targetExists && payment > 0) {
              if (kind === "CATCH_LIMIT") {
                proposals.push({
                  id: `${id}-llm-r${observation.round}`,
                  round: observation.round,
                  proposer: id,
                  counterparties: [target],
                  terms: {
                    kind: "CATCH_LIMIT",
                    capPerRound: Math.max(0, Number(offer["capPerRound"]) || 0),
                    zoneId,
                  },
                  payment,
                  durationRounds,
                  reasonCode: record.reasonCode,
                });
              } else if (kind === "CONSERVATION_BUYOUT") {
                proposals.push({
                  id: `${id}-llm-r${observation.round}`,
                  round: observation.round,
                  proposer: id,
                  counterparties: [target],
                  terms: { kind: "CONSERVATION_BUYOUT", zoneId },
                  payment,
                  durationRounds,
                  reasonCode: record.reasonCode,
                });
              }
            }
          }
          record.proposals = proposals;
          return { proposals, responses };
        },
        nothing,
      );
    },

    async act(observation): Promise<FishingAction> {
      return decide<FishingAction>(
        observation,
        "act",
        ACT_TOOL,
        (input, record) => {
          const zone = observation.zones.find(
            (candidate) => candidate.id === String(input["zoneId"] ?? ""),
          );
          if (!zone) return idleAction(observation);
          const effort = Math.max(
            0,
            Math.min(Number(input["effort"]) || 0, observation.self.effortCapacity),
          );
          const action: FishingAction = { boatId: id, zoneId: zone.id, effort };
          record.action = action;
          return action;
        },
        idleAction(observation),
      );
    },
  };
}
