import type { Observation, OceanAgent, PublicBoatView, WalletPolicy } from "./agents";
import { defaultWalletPolicy } from "./agents";
import { createInitialState, transition } from "./engine";
import { acceptProposal, type ValidationError } from "./negotiation";
import { stable } from "./rng";
import type { OceanScenario } from "./scenario";
import type { BoatId, FishingAction, OceanState, Proposal, RoundRecord } from "./types";

/**
 * Runs a full match: negotiate, then fish, then let the engine resolve the
 * world. The loop — not the agent — enforces the user's wallet policy, so an
 * agent cannot outspend its mandate no matter how it argues.
 */

export type RejectedProposal = {
  round: number;
  proposalId: string;
  proposer: string;
  reason: string;
  errors: ValidationError[];
};

export type MatchLog = {
  scenario: OceanScenario;
  rounds: RoundRecord[];
  finalState: OceanState;
  acceptedProposals: Proposal[];
  rejectedProposals: RejectedProposal[];
  spendByBoat: Record<string, number>;
};

export type MatchOptions = {
  /** Per-boat wallet policy; boats without an entry use the default. */
  wallets?: Record<string, WalletPolicy>;
  /** Set false to measure the same fleet with the contract layer disabled. */
  enableNegotiation?: boolean;
  /**
   * Runs the match as if this boat had never contracted with anyone: its own
   * offers are never made and it refuses every offer put to it. Everything
   * else — weather, fleet, the other boats' policies — is untouched, so the
   * difference against the full run is what this boat's agreements caused.
   * This is the counterfactual behind the cooperation axis.
   */
  excludeContractsFor?: BoatId;
};

function publicViews(
  state: OceanState,
  scenario: OceanScenario,
  lastRound: RoundRecord | undefined,
  exclude: string,
): PublicBoatView[] {
  return scenario.boats
    .filter((boat) => boat.id !== exclude)
    .map((boat) => {
      const boatState = state.boats[boat.id]!;
      const entry = lastRound?.entries.find((candidate) => candidate.boatId === boat.id);
      return {
        id: boat.id,
        name: boat.name,
        active: boatState.active,
        underRepair: boatState.repairRoundsLeft > 0,
        lastCatch: entry?.catch ?? 0,
        lastZoneId: entry?.zoneId ?? null,
        totalCatch: boatState.totalCatch,
        breaches: boatState.breaches,
        smallFleet: boat.smallFleet,
      };
    });
}

function buildObservation(
  state: OceanState,
  scenario: OceanScenario,
  boatId: string,
  history: RoundRecord[],
  incoming: Proposal[],
  wallet: WalletPolicy,
  spent: number,
): Observation {
  const boat = scenario.boats.find((candidate) => candidate.id === boatId)!;
  const boatState = state.boats[boatId]!;
  return {
    round: state.round,
    roundsRemaining: scenario.rounds - state.round + 1,
    weather: scenario.weather[state.round - 1]!,
    price: state.price,
    zones: scenario.zones,
    stocks: { ...state.stocks },
    self: { ...boat, ...boatState },
    wallet: {
      policy: wallet,
      spentThisMatch: spent,
      remaining: stable(Math.max(0, wallet.maxAutonomousSpendPerMatch - spent)),
    },
    others: publicViews(state, scenario, history[history.length - 1], boatId),
    activePacts: state.pacts,
    fund: state.fund,
    conservationFund: state.conservationFund,
    incomingProposals: incoming,
    history,
  };
}

export function runMatch(
  scenario: OceanScenario,
  agents: readonly OceanAgent[],
  options: MatchOptions = {},
): MatchLog {
  const enableNegotiation = options.enableNegotiation ?? true;
  let state = createInitialState(scenario);
  const rounds: RoundRecord[] = [];
  const acceptedProposals: Proposal[] = [];
  const rejectedProposals: RejectedProposal[] = [];
  const spendByBoat: Record<string, number> = {};
  const zoneIds = scenario.zones.map((zone) => zone.id);
  for (const boat of scenario.boats) spendByBoat[boat.id] = 0;

  const walletFor = (boatId: string): WalletPolicy =>
    options.wallets?.[boatId] ?? defaultWalletPolicy;

  for (let round = 1; round <= scenario.rounds; round += 1) {
    // --- negotiation -----------------------------------------------------
    //
    // Each boat proposes and settles before the next one is asked. Gathering
    // every offer first and settling afterwards let two members of the same
    // conservation fund each commit the whole balance against a stale reading,
    // and the loser's offer bounced as underfunded — 1.4 wasted offers per
    // match. Settling in turn lets the second proposer price against what is
    // actually left. Agent order is fixed, so replay is unaffected.
    if (enableNegotiation) {
      for (const proposer of agents) {
        if (!state.boats[proposer.id]?.active) continue;
        if (proposer.id === options.excludeContractsFor) continue;
        const proposerWallet = walletFor(proposer.id);
        const { proposals } = proposer.negotiate(
          buildObservation(
            state,
            scenario,
            proposer.id,
            rounds,
            [],
            proposerWallet,
            spendByBoat[proposer.id]!,
          ),
        );

        for (const raw of proposals) {
          const proposal: Proposal = { ...raw, round, proposer: proposer.id };

          const violation = walletViolation(proposal, proposerWallet, spendByBoat[proposer.id]!);
          if (violation) {
            rejectedProposals.push({
              round,
              proposalId: proposal.id,
              proposer: proposer.id,
              reason: violation,
              errors: [],
            });
            continue;
          }

          const targets = agents.filter((agent) => proposal.counterparties.includes(agent.id));
          if (targets.length === 0) continue;

          const accepted = targets
            .filter((agent) => {
              if (!state.boats[agent.id]?.active) return false;
              if (agent.id === options.excludeContractsFor) return false;
              const wallet = walletFor(agent.id);
              const { responses } = agent.negotiate(
                buildObservation(
                  state,
                  scenario,
                  agent.id,
                  rounds,
                  [proposal],
                  wallet,
                  spendByBoat[agent.id]!,
                ),
              );
              const response = responses.find((candidate) => candidate.proposalId === proposal.id);
              return response?.type === "ACCEPT";
            })
            .map((agent) => agent.id);

          // A catch limit is a bilateral bargain and needs its counterparty. A
          // fund and a stand-down are open offers: whoever takes the money is
          // bound, and one hold-out must not veto the coalition that forms
          // without it. The escrow then splits across the boats that signed.
          const settled =
            proposal.terms.kind === "CATCH_LIMIT"
              ? accepted.length === proposal.counterparties.length
              : accepted.length >= 1;

          if (!settled) {
            rejectedProposals.push({
              round,
              proposalId: proposal.id,
              proposer: proposal.proposer,
              reason: "COUNTERPARTY_REJECTED",
              errors: [],
            });
            continue;
          }

          // Only the boats that said yes are bound. The transcript records the
          // settled proposal, not the original offer, or a replay would bind
          // boats that never agreed and diverge from the match it reproduces.
          const settledProposal = { ...proposal, counterparties: accepted };

          const { pact, errors } = acceptProposal(state, settledProposal, zoneIds);
          if (!pact) {
            rejectedProposals.push({
              round,
              proposalId: proposal.id,
              proposer: proposal.proposer,
              reason: "INVALID",
              errors,
            });
            continue;
          }

          // A fund-financed deal spends the pool, not this boat's own mandate.
          // The mandate governed the subscription when it joined.
          if (proposal.fundedBy !== "CONSERVATION_FUND") {
            spendByBoat[proposal.proposer] = stable(
              (spendByBoat[proposal.proposer] ?? 0) + proposal.payment,
            );
          }
          acceptedProposals.push(settledProposal);
        }
      }
    }

    // --- action ----------------------------------------------------------
    const actions: FishingAction[] = [];
    for (const agent of agents) {
      if (!state.boats[agent.id]?.active) continue;
      const wallet = walletFor(agent.id);
      const observation = buildObservation(
        state,
        scenario,
        agent.id,
        rounds,
        [],
        wallet,
        spendByBoat[agent.id]!,
      );
      actions.push(agent.act(observation));
    }

    const result = transition(state, actions, scenario);
    result.record.newPacts = acceptedProposals
      .filter((proposal) => proposal.round === round)
      .map((proposal) => proposal.id);
    rounds.push(result.record);
    state = result.state;
  }

  return { scenario, rounds, finalState: state, acceptedProposals, rejectedProposals, spendByBoat };
}

/** Returns a violation code when a proposal exceeds the user's mandate. */
function walletViolation(
  proposal: Proposal,
  wallet: WalletPolicy,
  spent: number,
): string | null {
  if (!wallet.allowedPurposes.includes(proposal.terms.kind)) return "PURPOSE_NOT_ALLOWED";
  // Personal spend limits apply to a boat's own money. Pool money is governed
  // by the fund's own ceiling, which every member agreed to when it joined.
  if (proposal.fundedBy === "CONSERVATION_FUND") return null;
  if (proposal.payment > wallet.maxPaymentPerTransaction) return "OVER_PER_TX_LIMIT";
  if (spent + proposal.payment > wallet.maxAutonomousSpendPerMatch) return "OVER_MATCH_BUDGET";
  return null;
}
