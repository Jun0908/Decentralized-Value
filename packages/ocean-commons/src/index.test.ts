import { describe, expect, it } from "vitest";
import {
  brokerAgent,
  cautiousAgent,
  defaultWalletPolicy,
  greedyAgent,
  opportunistAgent,
  reciprocatorAgent,
  type Observation,
  type OceanAgent,
  type WalletPolicy,
  takerAgent,
} from "./agents";
import { createInitialState, transition } from "./engine";
import {
  evaluateMatch,
  scoreCooperation,
  scoreRestraint,
  hashResult,
  hashTranscript,
  oceanFrontier,
  replayTranscript,
  toOutcomePoint,
  toTranscript,
} from "./evaluator";
import { runMatch } from "./match";
import { acceptProposal, settleRound } from "./negotiation";
import { createRng } from "./rng";
import { generateScenario, generateWeather } from "./scenario";
import type { Proposal } from "./types";

function mixedFleet(scenario: ReturnType<typeof generateScenario>): OceanAgent[] {
  const [a, b, c, d, e] = scenario.boats;
  return [
    brokerAgent(a!.id, a!.name, scenario),
    greedyAgent(b!.id, b!.name, scenario),
    opportunistAgent(c!.id, c!.name, scenario),
    cautiousAgent(d!.id, d!.name, scenario),
    reciprocatorAgent(e!.id, e!.name, scenario),
  ];
}

describe("determinism", async () => {
  it("produces an identical weather sequence for the same seed", async () => {
    const ids = ["a", "b", "c"];
    expect(generateWeather("seed-1", 12, ids)).toEqual(generateWeather("seed-1", 12, ids));
    expect(generateWeather("seed-1", 12, ids)).not.toEqual(generateWeather("seed-2", 12, ids));
  });

  it("draws the same random stream for the same seed", async () => {
    const left = createRng("x");
    const right = createRng("x");
    expect([left(), left(), left()]).toEqual([right(), right(), right()]);
  });

  it("returns the same final state and hash for the same scenario and agents", async () => {
    const scenario = generateScenario("determinism", { vary: true });
    const first = await runMatch(scenario, mixedFleet(scenario));
    const second = await runMatch(scenario, mixedFleet(scenario));

    expect(second.finalState).toEqual(first.finalState);
    expect(hashResult(second.finalState, evaluateMatch(second))).toEqual(
      hashResult(first.finalState, evaluateMatch(first)),
    );
  });

  it("replays a transcript to the same final state without any agent", async () => {
    const scenario = generateScenario("replay", { vary: true });
    const log = await runMatch(scenario, mixedFleet(scenario));
    const transcript = toTranscript(log);

    const replayed = replayTranscript(scenario, transcript);

    expect(replayed.stocks).toEqual(log.finalState.stocks);
    expect(replayed.price).toEqual(log.finalState.price);
    for (const boat of scenario.boats) {
      expect(replayed.boats[boat.id]!.cash).toBeCloseTo(log.finalState.boats[boat.id]!.cash, 6);
      expect(replayed.boats[boat.id]!.active).toBe(log.finalState.boats[boat.id]!.active);
    }
    expect(hashTranscript(toTranscript(log))).toEqual(hashTranscript(transcript));
  });

  it("does not leak the seed or future weather into an observation", async () => {
    const scenario = generateScenario("leak");
    const seen: Observation[] = [];
    const probe: OceanAgent = {
      id: scenario.boats[0]!.id,
      name: "probe",
      negotiate: () => ({ proposals: [], responses: [] }),
      act(observation) {
        seen.push(structuredClone(observation));
        return { boatId: observation.self.id, zoneId: observation.zones[0]!.id, effort: 1 };
      },
    };
    await runMatch(scenario, [probe]);

    expect(seen).toHaveLength(scenario.rounds);
    for (const observation of seen) {
      // The seed must never reach an agent, in any field.
      expect(JSON.stringify(observation)).not.toContain(scenario.seed);
      // Exactly one weather record is visible: this round's forecast.
      expect(observation.weather.round).toBe(observation.round);
      // History only ever reaches back, never forward.
      for (const record of observation.history) {
        expect(record.round).toBeLessThan(observation.round);
        expect(record.weather.round).toBeLessThan(observation.round);
      }
    }
  });
});

describe("engine", async () => {
  it("never lands more fish than a zone holds", async () => {
    const scenario = generateScenario("exhaust");
    const state = createInitialState(scenario);
    const zone = scenario.zones[0]!;
    state.stocks[zone.id] = 5;

    const actions = scenario.boats.map((boat) => ({
      boatId: boat.id,
      zoneId: zone.id,
      effort: boat.effortCapacity,
    }));
    const { record } = transition(state, actions, scenario);
    const landed = record.entries.reduce((sum, entry) => sum + entry.catch, 0);

    expect(landed).toBeLessThanOrEqual(5 + 1e-6);
  });

  it("keeps a bankrupt boat out of every later round", async () => {
    const scenario = generateScenario("bankrupt");
    const state = createInitialState(scenario);
    const victim = scenario.boats[0]!;
    state.boats[victim.id]!.cash = -1;

    const first = transition(state, [], scenario);
    expect(first.state.boats[victim.id]!.active).toBe(false);

    const second = transition(
      first.state,
      [{ boatId: victim.id, zoneId: scenario.zones[0]!.id, effort: 10 }],
      scenario,
    );
    const entry = second.record.entries.find((candidate) => candidate.boatId === victim.id)!;
    expect(entry.appliedEffort).toBe(0);
    expect(entry.catch).toBe(0);
    expect(entry.clampReason).toBe("BANKRUPT");
  });

  it("clamps effort to the hull capacity", async () => {
    const scenario = generateScenario("capacity");
    const state = createInitialState(scenario);
    const boat = scenario.boats[0]!;

    const { record } = transition(
      state,
      [{ boatId: boat.id, zoneId: scenario.zones[0]!.id, effort: boat.effortCapacity + 50 }],
      scenario,
    );
    const entry = record.entries.find((candidate) => candidate.boatId === boat.id)!;

    expect(entry.appliedEffort).toBe(boat.effortCapacity);
    expect(entry.clampReason).toBe("OVER_CAPACITY");
  });
});

describe("contracts", async () => {
  function catchLimitProposal(
    scenario: ReturnType<typeof generateScenario>,
    overrides: Partial<Proposal> = {},
  ): Proposal {
    return {
      id: "pact-1",
      round: 1,
      proposer: scenario.boats[0]!.id,
      counterparties: [scenario.boats[1]!.id],
      terms: { kind: "CATCH_LIMIT", capPerRound: 5, zoneId: null },
      payment: 20,
      durationRounds: 2,
      reasonCode: "TEST",
      ...overrides,
    };
  }

  it("locks the payment out of the proposer's cash on acceptance", async () => {
    const scenario = generateScenario("escrow");
    const state = createInitialState(scenario);
    const before = state.boats[scenario.boats[0]!.id]!.cash;

    const { pact } = acceptProposal(state, catchLimitProposal(scenario), ["coastal"]);

    expect(pact).not.toBeNull();
    expect(state.boats[scenario.boats[0]!.id]!.cash).toBeCloseTo(before - 20, 6);
    expect(pact!.escrowRemaining).toBe(20);
  });

  it("refuses a promise the proposer cannot fund", async () => {
    const scenario = generateScenario("underfunded");
    const state = createInitialState(scenario);
    state.boats[scenario.boats[0]!.id]!.cash = 5;

    const { pact, errors } = acceptProposal(state, catchLimitProposal(scenario), ["coastal"]);

    expect(pact).toBeNull();
    expect(errors.map((error) => error.code)).toContain("INSUFFICIENT_FUNDS");
  });

  it("releases escrow round by round while the cap is honoured", async () => {
    const scenario = generateScenario("release");
    const state = createInitialState(scenario);
    const payee = scenario.boats[1]!.id;
    acceptProposal(state, catchLimitProposal(scenario), ["coastal"]);
    const before = state.boats[payee]!.cash;

    const { releases } = settleRound(state, [{ boatId: payee, zoneId: "coastal", catch: 4 }]);

    expect(releases).toHaveLength(1);
    expect(releases[0]!.type).toBe("RELEASE");
    expect(state.boats[payee]!.cash).toBeCloseTo(before + 10, 6);
    expect(state.pacts[0]!.escrowRemaining).toBeCloseTo(10, 6);
  });

  it("refunds the remaining escrow to the payer on a breach", async () => {
    const scenario = generateScenario("breach");
    const state = createInitialState(scenario);
    const payer = scenario.boats[0]!.id;
    const payee = scenario.boats[1]!.id;
    acceptProposal(state, catchLimitProposal(scenario), ["coastal"]);
    const payerCash = state.boats[payer]!.cash;

    const { releases, breached } = settleRound(state, [
      { boatId: payee, zoneId: "coastal", catch: 99 },
    ]);

    expect(breached).toEqual(["pact-1"]);
    expect(releases[0]!.type).toBe("REFUND");
    expect(state.boats[payer]!.cash).toBeCloseTo(payerCash + 20, 6);
    expect(state.boats[payee]!.breaches).toBe(1);
    expect(state.pacts[0]!.status).toBe("BREACHED");
    expect(state.pacts[0]!.escrowRemaining).toBe(0);
  });

  it("never lets escrow go negative across a full match", async () => {
    const scenario = generateScenario("escrow-floor", { vary: true });
    const log = await runMatch(scenario, mixedFleet(scenario));
    for (const pact of log.finalState.pacts) {
      expect(pact.escrowRemaining).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("wallet policy", async () => {
  it("rejects a proposal above the per-transaction limit", async () => {
    const scenario = generateScenario("wallet-tx");
    const tight: WalletPolicy = { ...defaultWalletPolicy, maxPaymentPerTransaction: 5 };
    const spender: OceanAgent = {
      id: scenario.boats[0]!.id,
      name: "spender",
      negotiate: (observation) => ({
        responses: [],
        proposals: [
          {
            id: `over-${observation.round}`,
            round: observation.round,
            proposer: observation.self.id,
            counterparties: [scenario.boats[1]!.id],
            terms: { kind: "CATCH_LIMIT", capPerRound: 1, zoneId: null },
            payment: 25,
            durationRounds: 1,
            reasonCode: "TEST",
          },
        ],
      }),
      act: (observation) => ({
        boatId: observation.self.id,
        zoneId: observation.zones[0]!.id,
        effort: 1,
      }),
    };

    const log = await runMatch(scenario, [spender], { wallets: { [spender.id]: tight } });

    expect(log.acceptedProposals).toHaveLength(0);
    expect(log.rejectedProposals.every((entry) => entry.reason === "OVER_PER_TX_LIMIT")).toBe(true);
  });

  it("stops an agent once the match budget is exhausted", async () => {
    const scenario = generateScenario("wallet-budget");
    const capped: WalletPolicy = {
      ...defaultWalletPolicy,
      maxPaymentPerTransaction: 10,
      maxAutonomousSpendPerMatch: 20,
    };
    const spender: OceanAgent = {
      id: scenario.boats[0]!.id,
      name: "spender",
      negotiate: (observation) => ({
        responses: observation.incomingProposals.map((proposal) => ({
          type: "ACCEPT" as const,
          proposalId: proposal.id,
        })),
        proposals: [
          {
            id: `spend-${observation.round}`,
            round: observation.round,
            proposer: observation.self.id,
            counterparties: [scenario.boats[1]!.id],
            terms: { kind: "CATCH_LIMIT", capPerRound: 100, zoneId: null },
            payment: 10,
            durationRounds: 1,
            reasonCode: "TEST",
          },
        ],
      }),
      act: (observation) => ({
        boatId: observation.self.id,
        zoneId: observation.zones[0]!.id,
        effort: 1,
      }),
    };
    const acceptor = cautiousAgent(scenario.boats[1]!.id, "acceptor", scenario);

    const log = await runMatch(scenario, [spender, acceptor], {
      wallets: { [spender.id]: capped },
    });

    expect(log.spendByBoat[spender.id]).toBeLessThanOrEqual(20);
    expect(log.rejectedProposals.some((entry) => entry.reason === "OVER_MATCH_BUDGET")).toBe(true);
  });

  it("refuses a purpose the user did not allow", async () => {
    const scenario = generateScenario("wallet-purpose");
    const noAid: WalletPolicy = { ...defaultWalletPolicy, allowedPurposes: ["CATCH_LIMIT"] };
    const proposer: OceanAgent = {
      id: scenario.boats[0]!.id,
      name: "proposer",
      negotiate: (observation) => ({
        responses: [],
        proposals: [
          {
            id: `aid-${observation.round}`,
            round: observation.round,
            proposer: observation.self.id,
            counterparties: [scenario.boats[1]!.id],
            terms: { kind: "MUTUAL_AID", contributionPerRound: 3, payoutCap: 40 },
            payment: 0,
            durationRounds: 1,
            reasonCode: "TEST",
          },
        ],
      }),
      act: (observation) => ({
        boatId: observation.self.id,
        zoneId: observation.zones[0]!.id,
        effort: 1,
      }),
    };

    const log = await runMatch(scenario, [proposer], { wallets: { [proposer.id]: noAid } });

    expect(log.finalState.fund).toBeNull();
    expect(log.rejectedProposals.every((entry) => entry.reason === "PURPOSE_NOT_ALLOWED")).toBe(
      true,
    );
  });
});

describe("sounding exchange", async () => {
  it("is offered for a ground this boat has only watched, to the boat that worked it", async () => {
    // Only a banded reading is worth upgrading: nobody can sell a reading of
    // water they never worked either, so an unseen ground has no seller.
    const seeds = Array.from({ length: 25 }, (_, index) => `ocean-practice-v1:${index}`);
    const deals = [];
    for (const seed of seeds) {
      const scenario = generateScenario(seed, { vary: true });
      const [a, b, c, d, e] = scenario.boats;
      const log = await runMatch(scenario, [
        brokerAgent(a!.id, a!.name, scenario),
        brokerAgent(b!.id, b!.name, scenario),
        greedyAgent(c!.id, c!.name, scenario),
        opportunistAgent(d!.id, d!.name, scenario),
        cautiousAgent(e!.id, e!.name, scenario),
      ]);
      deals.push(
        ...log.acceptedProposals.filter((proposal) => proposal.terms.kind === "SOUNDING_EXCHANGE"),
      );
    }

    // The contract existed for a while without any agent ever offering it,
    // which left the whole point of a dark sea untested.
    expect(deals.length).toBeGreaterThan(0);
    for (const deal of deals) {
      expect(deal.counterparties).toHaveLength(1);
      expect(deal.counterparties[0]).not.toBe(deal.proposer);
      expect(deal.payment).toBeGreaterThan(0);
    }
  });

  it("never hands a boat an exact reading it did not earn or buy", async () => {
    const scenario = generateScenario("sounding-precision", { vary: true });
    const [a, b, c, d, e] = scenario.boats;

    // Watch one boat's observations from the inside. A SHARED reading may only
    // reach a boat that is actually party to a sounding contract; otherwise the
    // dark sea leaks precision it never sold.
    const seen: { round: number; shared: string[] }[] = [];
    const watched = cautiousAgent(e!.id, e!.name, scenario);
    const spy: OceanAgent = {
      id: watched.id,
      name: watched.name,
      negotiate(observation) {
        seen.push({
          round: observation.round,
          shared: observation.soundings
            .filter((sounding) => sounding.source === "SHARED")
            .map((sounding) => sounding.zoneId),
        });
        return watched.negotiate(observation);
      },
      act: (observation) => watched.act(observation),
    };

    const log = await runMatch(scenario, [
      brokerAgent(a!.id, a!.name, scenario),
      brokerAgent(b!.id, b!.name, scenario),
      greedyAgent(c!.id, c!.name, scenario),
      opportunistAgent(d!.id, d!.name, scenario),
      spy,
    ]);

    const partnered = new Set(
      log.acceptedProposals
        .filter(
          (proposal) =>
            proposal.terms.kind === "SOUNDING_EXCHANGE" &&
            (proposal.proposer === e!.id || proposal.counterparties.includes(e!.id)),
        )
        .map((proposal) => proposal.id),
    );

    expect(seen.length).toBeGreaterThan(0);
    for (const round of seen) {
      if (partnered.size === 0) expect(round.shared).toHaveLength(0);
    }
  });
});

describe("restraint axis", async () => {
  it("scores zero for a boat that gave up nothing", async () => {
    const scenario = generateScenario("gave-nothing", { vary: true });
    const seat = scenario.boats[0]!;
    // The entrant IS the reference, so there is no restraint to measure and no
    // near-zero denominator to divide by either.
    const fleet = (): OceanAgent[] => [
      takerAgent(seat.id, seat.name, scenario),
      ...mixedFleet(scenario).slice(1),
    ];
    const full = evaluateMatch(await runMatch(scenario, fleet()));
    const ifTaken = evaluateMatch(await runMatch(scenario, fleet()));
    const score = scoreRestraint(full, ifTaken, seat.id);

    expect(score.forgone).toBe(0);
    expect(score.efficacy).toBe(0);
  });

  it("measures fish left in the water against fish given up", async () => {
    const scenario = generateScenario("held-back", { vary: true });
    const seat = scenario.boats[0]!;
    const full = evaluateMatch(await runMatch(scenario, mixedFleet(scenario)));
    const ifTaken = evaluateMatch(
      await runMatch(scenario, [
        takerAgent(seat.id, seat.name, scenario),
        ...mixedFleet(scenario).slice(1),
      ]),
    );
    const score = scoreRestraint(full, ifTaken, seat.id);

    // The reference takes at least as much as the entrant did.
    const played = full.boats.find((boat) => boat.boatId === seat.id)!;
    const taken = ifTaken.boats.find((boat) => boat.boatId === seat.id)!;
    expect(taken.totalCatch).toBeGreaterThanOrEqual(played.totalCatch);
    expect(score.forgone).toBeCloseTo(taken.totalCatch - played.totalCatch, 6);
    expect(score.efficacy).toBeGreaterThanOrEqual(0);
  });

  it("never pays a boat for out-fishing the boat that takes everything", async () => {
    const outcomes = (catchTotal: number, finalStock: number) =>
      ({
        boats: [{ boatId: "kaiyo", totalCatch: catchTotal }],
        evidence: { finalTotalStock: finalStock },
      }) as never;
    // Landed more than the reference and left less sea: both terms negative.
    const score = scoreRestraint(outcomes(300, 100), outcomes(200, 140), "kaiyo");
    expect(score.efficacy).toBe(0);
  });
});

describe("cooperation axis", async () => {
  it("credits a boat only for what its own contracts changed", async () => {
    const scenario = generateScenario("attribution", { vary: true });
    const broker = scenario.boats[0]!.id;

    const full = evaluateMatch(await runMatch(scenario, mixedFleet(scenario)));
    const without = evaluateMatch(
      await runMatch(scenario, mixedFleet(scenario), { excludeContractsFor: broker }),
    );
    const score = scoreCooperation(full, without, broker);

    // Excluding the broker must remove its pacts and nothing else.
    expect(without.contracts.accepted).toBeLessThan(full.contracts.accepted);
    expect(score.spent).toBeGreaterThan(0);
    expect(score.efficacy).toBeCloseTo((score.stewardshipDelta * 1000) / score.spent, 6);
  });

  it("credits the payer, not the boat that was paid to stand down", async () => {
    const scenario = generateScenario("hostage", { vary: true });
    const paid = scenario.boats[1]!.id;
    const full = evaluateMatch(await runMatch(scenario, mixedFleet(scenario)));
    const without = evaluateMatch(
      await runMatch(scenario, mixedFleet(scenario), { excludeContractsFor: paid }),
    );

    // A boat that only ever received money has spent nothing, so however much
    // stopping it helped the sea, the credit belongs to whoever bought it out.
    const receiver = {
      ...full,
      boats: full.boats.map((boat) =>
        boat.boatId === paid ? { ...boat, paidOut: 0, received: 200 } : boat,
      ),
    };

    expect(scoreCooperation(receiver, without, paid).efficacy).toBe(0);
  });

  it("scores a boat that never contracted at zero, not at infinity", async () => {
    const scenario = generateScenario("abstainer", { vary: true });
    const loner = scenario.boats[1]!.id;
    const full = evaluateMatch(await runMatch(scenario, mixedFleet(scenario)));
    const without = evaluateMatch(
      await runMatch(scenario, mixedFleet(scenario), { excludeContractsFor: loner }),
    );

    const score = scoreCooperation(
      {
        ...full,
        boats: full.boats.map((b) => (b.boatId === loner ? { ...b, paidOut: 0, received: 0 } : b)),
      },
      without,
      loner,
    );

    expect(score.efficacy).toBe(0);
  });
});

describe("outcomes", async () => {
  it("keeps the three outcomes separate and never aggregates them", async () => {
    const scenario = generateScenario("outcomes", { vary: true });
    const outcomes = evaluateMatch(await runMatch(scenario, mixedFleet(scenario)));
    const point = toOutcomePoint("mixed", "Mixed fleet", outcomes, {
      restraint: 0.4,
      cooperation: 0.1,
    });

    expect(Object.keys(point.values).sort()).toEqual(["cooperation", "livelihood", "restraint"]);
    expect(point.values).not.toHaveProperty("total");
    expect(point.values).not.toHaveProperty("score");
  });

  it("scores stewardship on the lowest stock, not the final stock", async () => {
    const scenario = generateScenario("min-stock", { vary: true });
    const outcomes = evaluateMatch(await runMatch(scenario, mixedFleet(scenario)));

    expect(outcomes.stewardship).toBeCloseTo(
      outcomes.evidence.minTotalStock / outcomes.evidence.totalCapacity,
      6,
    );
    expect(outcomes.evidence.minTotalStock).toBeLessThanOrEqual(
      outcomes.evidence.finalTotalStock + 1e-6,
    );
  });

  it("builds a frontier that is independent of submission order", async () => {
    const scenario = generateScenario("frontier", { vary: true });
    const points = [];
    for (const [index, tag] of ["a", "b", "c"].entries()) {
      const agents = mixedFleet(scenario);
      const log = await runMatch(scenario, agents, { enableNegotiation: index !== 1 });
      points.push(
        toOutcomePoint(tag, tag, evaluateMatch(log), {
          restraint: index * 0.1,
          cooperation: index * 0.05,
        }),
      );
    }

    const forward = oceanFrontier(points).map((point) => point.id);
    const reversed = oceanFrontier([...points].reverse()).map((point) => point.id);

    expect(reversed).toEqual(forward);
  });
});
