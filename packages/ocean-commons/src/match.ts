import type { Observation, OceanAgent, PublicBoatView, WalletPolicy } from "./agents";
import { defaultWalletPolicy } from "./agents";
import { createInitialState, transition } from "./engine";
import { acceptProposal, type ValidationError } from "./negotiation";
import { stable } from "./rng";
import type { OceanScenario } from "./scenario";
import type { FishingAction, OceanState, Proposal, RoundRecord } from "./types";

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
    const pending: Proposal[] = [];

    // --- negotiation: gather offers -------------------------------------
    if (enableNegotiation) {
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
        const { proposals } = agent.negotiate(observation);
        for (const proposal of proposals) {
          const reason = walletViolation(proposal, wallet, spendByBoat[agent.id]!);
          if (reason) {
            rejectedProposals.push({
              round,
              proposalId: proposal.id,
              proposer: agent.id,
              reason,
              errors: [],
            });
            continue;
          }
          pending.push({ ...proposal, round, proposer: agent.id });
        }
      }
    }

    // --- negotiation: counterparties answer ------------------------------
    for (const proposal of pending) {
      const targets = agents.filter((agent) => proposal.counterparties.includes(agent.id));
      if (targets.length === 0) continue;

      const accepted = targets
        .filter((agent) => {
          if (!state.boats[agent.id]?.active) return false;
          const wallet = walletFor(agent.id);
          const observation = buildObservation(
            state,
            scenario,
            agent.id,
            rounds,
            [proposal],
            wallet,
            spendByBoat[agent.id]!,
          );
          const { responses } = agent.negotiate(observation);
          const response = responses.find((candidate) => candidate.proposalId === proposal.id);
          return response?.type === "ACCEPT";
        })
        .map((agent) => agent.id);

      // A catch limit is a bilateral bargain and needs its counterparty. A fund
      // and a stand-down are open offers: whoever takes the money is bound, and
      // one hold-out must not be able to veto the coalition that forms without
      // it. The escrow then splits across the boats that actually signed.
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

      // Only the boats that said yes are bound. The transcript must record the
      // settled proposal, not the original offer, or a replay would bind boats
      // that never agreed and diverge from the match it is meant to reproduce.
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
      spendByBoat[proposal.proposer] = stable(
        (spendByBoat[proposal.proposer] ?? 0) + proposal.payment,
      );
      acceptedProposals.push(settledProposal);
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
  if (proposal.payment > wallet.maxPaymentPerTransaction) return "OVER_PER_TX_LIMIT";
  if (spent + proposal.payment > wallet.maxAutonomousSpendPerMatch) return "OVER_MATCH_BUDGET";
  return null;
}
