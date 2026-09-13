import { believedStock, soundingAge } from "./agents";
import type { NegotiationOutput, Observation, OceanAgent } from "./agents";
import type { OceanScenario } from "./scenario";
import type { BoatId, FishingAction, Proposal, ProposalResponse } from "./types";

/**
 * A boat run by a language model.
 *
 * Which model, and over which wire, is a backend's business — see
 * `openaiBackend`. Everything here is provider-neutral, so adding another one
 * means writing a transport, not a second agent.
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

// --- what the boat is told -------------------------------------------------

/** The rules, written once. Identical every round so it caches cleanly. */
export function systemPrompt(scenario: OceanScenario, mission: string): string {
  const zones = scenario.zones
    .map(
      (zone) =>
        `- ${zone.id} (${zone.name}): capacity ${zone.carryingCapacity}, regrowth ${zone.growthRate}, ` +
        `travel cost ${zone.travelCost}, yield per effort at full stock ${zone.catchEfficiency}, ` +
        `storm exposure ${zone.stormExposure}` +
        (zone.reserve
          ? `, RESERVE — fined ${scenario.reserveFinePerEffort} per unit of effort`
          : ""),
    )
    .join("\n");

  const season =
    scenario.seasonWindow.min === scenario.seasonWindow.max
      ? `over ${scenario.rounds} rounds`
      : `over a season that ends somewhere between round ${scenario.seasonWindow.min} and round ${scenario.seasonWindow.max} — you are not told which`;

  return `You skipper one boat in a fleet of ${scenario.boats.length} fishing a shared sea ${season}.

THE SEA
${zones}

Fish landed per unit of effort falls as a ground is drawn down, so a stripped ground pays badly for everyone on it. Below a critical stock a ground stops recovering and dies for the rest of the match. The nursery reserve feeds the other grounds: fishing it pays now and quietly starves everything later. One market buys the whole fleet's catch, so a glut lowers the price you get too.

A storm cuts the fish landed per unit of effort in proportion to a ground's storm exposure, and every boat working that ground shares the same finite stock. Note that your hull's weather limit only decides whether you are allowed out — it says nothing about whether the trip pays. You can be well inside your limit and still land almost nothing in rough water on an exposed ground.

YOU CANNOT SEE THE SEA
Nobody is told how many fish are in a ground. You learn one only by working it, and what you learn ages from the moment you look away: the ground regrows, and anyone who goes there takes fish out. Watching a rival land fish tells you roughly what was under them, but only roughly. A ground nobody has touched is dark, and the published opening survey is all you have on it.

So where the other boats go is not gossip — it is the only evidence you will ever get about water you are not in. Read it.

FUEL IS THE REAL LIMIT
You are given fuel for the whole season, not per round. Steaming to a ground costs fuel before you fish at all, and the further out the ground, the more it costs. When the tank is empty you stay in port for whatever is left of the season — and you are not told how long that is.

Roughly four rounds at full effort, against a season of seven to ten. You cannot fish every round hard. Decide which rounds are worth it.

WHAT YOU CONTROL
Each round you choose a ground and how hard to work it, and you may offer contracts to other boats:
- CATCH_LIMIT: you pay them to land no more than a cap per round.
- CONSERVATION_BUYOUT: you pay them to stay out of one ground, or out of the water entirely.
- SOUNDING_EXCHANGE: you trade readings. Both sides see the other's measurements exactly instead of guessing from a distance. Worth most with a boat that has been where you have not.

Money offered is locked in escrow when a contract is accepted. It is released round by round while the terms hold, and refunded to you if they are broken. Compliance is measured by the engine from actual catches — nobody's word counts, including yours.

YOUR OWNER'S STANDING INSTRUCTION
${mission}

Answer only through the tool. Keep declaredReason to one plain sentence about what you are doing and why; your owner reads it and it is never scored.`;
}

/** The board as this boat can see it. */
export function renderObservation(observation: Observation): string {
  // Readings, never the sea itself. A ground nobody has worked shows as dark,
  // and an old reading shows its age. Both are conditions the boat has to
  // decide under, not facts it is handed.
  const stocks = observation.zones
    .map((zone) => {
      const age = soundingAge(observation, zone.id);
      if (age === null) {
        return `  ${zone.id}: NEVER SOUNDED — nobody has worked it. The opening survey said ${zone.initialStock}.`;
      }
      const readings = observation.soundings.filter((entry) => entry.zoneId === zone.id);
      const newest = readings.reduce((best, entry) => (entry.round > best.round ? entry : best));
      const believed = believedStock(observation, zone);
      const share = believed / zone.carryingCapacity;
      const critical = believed < zone.carryingCapacity * (zone.collapseThreshold + 0.15);
      const how =
        newest.source === "FISHED"
          ? "your own haul, exact"
          : newest.source === "SHARED"
            ? "shared under contract, exact"
            : "estimated from watching a rival, banded";
      const when = age === 0 ? "this round" : `${age} round${age === 1 ? "" : "s"} ago`;
      return (
        `  ${zone.id}: read ${newest.stock.toFixed(0)} in round ${newest.round} (${how}, ${when}). ` +
        `Grown forward that is about ${believed.toFixed(0)} (${(share * 100).toFixed(0)}% of capacity)` +
        `${critical ? " — NEAR COLLAPSE" : ""}. Anyone who fished it since has taken more than this.`
      );
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
          : proposal.terms.kind === "SOUNDING_EXCHANGE"
            ? `trade readings${proposal.terms.zoneId ? ` for ${proposal.terms.zoneId}` : " for every ground"}`
            : `pay ${proposal.terms.contributionPerRound} per round into a pool`;
    return `  ${proposal.id}: ${proposal.proposer} offers you ${proposal.payment} DemoUSD to ${terms}, for ${proposal.durationRounds} rounds`;
  });

  const self = observation.self;
  const left =
    observation.roundsRemaining === observation.maxRoundsRemaining
      ? `${observation.roundsRemaining} left`
      : `at least ${observation.roundsRemaining} more, at most ${observation.maxRoundsRemaining}`;

  return `ROUND ${observation.round} — ${left}
Weather: storm severity ${observation.weather.stormSeverity.toFixed(2)}. Fish price ${observation.price.toFixed(2)} per fish.

WHAT YOU KNOW ABOUT THE GROUNDS
${stocks}

STEAMING COSTS, BEFORE YOU FISH
${observation.zones.map((zone) => `  ${zone.id}: ${zone.travelFuel} fuel to reach`).join("\n")}

YOUR BOAT (${self.id})
  cash ${self.cash.toFixed(0)}, effort capacity ${self.effortCapacity} per round, upkeep ${self.upkeepPerRound} per round
  FUEL LEFT FOR THE WHOLE SEASON: ${self.fuelRemaining.toFixed(0)} of ${self.fuelBudget}. Empty means in port until the season ends.
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

export const TURN_TOOL: DecisionTool = {
  name: "take_turn",
  description:
    "Decide this whole round at once: any offer you want to make, and where you will fish.",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["zoneId", "effort", "offer", "reasonCode", "declaredReason"],
    properties: {
      zoneId: { type: "string", description: "Ground to work this round." },
      effort: {
        type: "number",
        description: "Units of effort, 0 to stay in port. Clamped to your capacity.",
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
          capPerRound: { type: ["number", "null"] },
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
  /** Which model answers, and over which wire. See `openaiBackend`. */
  backend: DecisionBackend;
  /** Receives one record per decision, for the replay panel and for audit. */
  onTurn?: (record: LlmTurnRecord) => void;
};

/** Turns whatever the model described into a legal proposal, or nothing. */
function readOffer(
  raw: unknown,
  observation: Observation,
  id: BoatId,
  reasonCode: string,
): Proposal[] {
  if (!raw || typeof raw !== "object") return [];
  const offer = raw as Record<string, unknown>;
  const target = String(offer["targetBoatId"] ?? "");
  const kind = String(offer["kind"] ?? "");
  const payment = Math.max(0, Math.round(Number(offer["payment"]) || 0));
  const durationRounds = Math.max(
    1,
    Math.min(Number(offer["durationRounds"]) || 1, observation.maxRoundsRemaining),
  );
  const zoneRaw = offer["zoneId"];
  const zoneId =
    typeof zoneRaw === "string" && observation.zones.some((z) => z.id === zoneRaw) ? zoneRaw : null;
  if (!observation.others.some((other) => other.id === target && other.active)) return [];
  if (payment <= 0) return [];

  const base = {
    id: `${id}-llm-r${observation.round}`,
    round: observation.round,
    proposer: id,
    counterparties: [target],
    payment,
    durationRounds,
    reasonCode,
  };
  if (kind === "CATCH_LIMIT") {
    return [
      {
        ...base,
        terms: {
          kind: "CATCH_LIMIT",
          capPerRound: Math.max(0, Number(offer["capPerRound"]) || 0),
          zoneId,
        },
      },
    ];
  }
  if (kind === "CONSERVATION_BUYOUT") {
    return [{ ...base, terms: { kind: "CONSERVATION_BUYOUT", zoneId } }];
  }
  return [];
}

function idleAction(observation: Observation): FishingAction {
  return { boatId: observation.self.id, zoneId: observation.zones[0]!.id, effort: 0 };
}

export function llmAgent(
  id: BoatId,
  name: string,
  scenario: OceanScenario,
  options: LlmAgentOptions,
): OceanAgent {
  const backend = options.backend;
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

  // One call covers the whole round. A skipper settles the offer and the trip
  // together, and asking twice doubled the bill for a decision that was always
  // made as one: a 12-round season ran 29 calls where it needs half that.
  let planned: { round: number; action: FishingAction } | null = null;

  return {
    id,
    name,

    async negotiate(observation): Promise<NegotiationOutput> {
      // Answering someone else's offer is its own question, asked as it arrives.
      if (observation.incomingProposals.length > 0) {
        return decide<NegotiationOutput>(
          observation,
          "negotiate",
          NEGOTIATE_TOOL,
          (input, record) => ({
            proposals: readOffer(input["offer"], observation, id, record.reasonCode),
            responses: readResponses(input["responses"], observation),
          }),
          { proposals: [], responses: refuseAll(observation) },
        );
      }

      return decide<NegotiationOutput>(
        observation,
        "negotiate",
        TURN_TOOL,
        (input, record) => {
          const zone = observation.zones.find(
            (candidate) => candidate.id === String(input["zoneId"] ?? ""),
          );
          const effort = zone
            ? Math.max(0, Math.min(Number(input["effort"]) || 0, observation.self.effortCapacity))
            : 0;
          const action: FishingAction = {
            boatId: id,
            zoneId: zone ? zone.id : observation.zones[0]!.id,
            effort,
          };
          planned = { round: observation.round, action };
          record.action = action;

          const proposals = readOffer(input["offer"], observation, id, record.reasonCode);
          record.proposals = proposals;
          return { proposals, responses: [] };
        },
        { proposals: [], responses: [] },
      );
    },

    async act(observation): Promise<FishingAction> {
      // Already settled when this round's offer was decided.
      if (planned && planned.round === observation.round) return planned.action;

      return decide<FishingAction>(
        observation,
        "act",
        ACT_TOOL,
        (input, record) => {
          const zone = observation.zones.find(
            (candidate) => candidate.id === String(input["zoneId"] ?? ""),
          );
          if (!zone) return idleAction(observation);
          const action: FishingAction = {
            boatId: id,
            zoneId: zone.id,
            effort: Math.max(
              0,
              Math.min(Number(input["effort"]) || 0, observation.self.effortCapacity),
            ),
          };
          record.action = action;
          return action;
        },
        idleAction(observation),
      );
    },
  };
}

/** Every offer answered; anything left unanswered is a refusal. */
function readResponses(raw: unknown, observation: Observation): ProposalResponse[] {
  const answers = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
  const responses: ProposalResponse[] = [];
  for (const entry of answers) {
    const proposalId = String(entry["proposalId"] ?? "");
    if (!observation.incomingProposals.some((p) => p.id === proposalId)) continue;
    responses.push(
      entry["accept"] === true
        ? { type: "ACCEPT", proposalId }
        : { type: "REJECT", proposalId, reasonCode: "DECLINED" },
    );
  }
  // Silence must not bind a boat, or dropping a reply would be a way to hold
  // someone to terms they never took.
  for (const proposal of observation.incomingProposals) {
    if (!responses.some((r) => r.proposalId === proposal.id)) {
      responses.push({ type: "REJECT", proposalId: proposal.id, reasonCode: "NO_ANSWER" });
    }
  }
  return responses;
}

function refuseAll(observation: Observation): ProposalResponse[] {
  return observation.incomingProposals.map((proposal) => ({
    type: "REJECT" as const,
    proposalId: proposal.id,
    reasonCode: "NO_ANSWER",
  }));
}
