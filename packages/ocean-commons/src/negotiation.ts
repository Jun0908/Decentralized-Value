import { stable } from "./rng";
import type {
  ActivePact,
  BoatId,
  EscrowRelease,
  OceanState,
  Proposal,
  ZoneId,
} from "./types";

/**
 * Contracts between agents. Two rules hold everywhere in this file:
 *
 * 1. A promise is only real once its money is locked. Accepting a proposal
 *    moves cash out of the proposer immediately, into escrow.
 * 2. Compliance is decided by the engine against measured catches, never by
 *    what an agent says it did.
 */

export type ValidationError = { code: string; detail: string };

export function validateProposal(
  proposal: Proposal,
  state: OceanState,
  zoneIds: readonly ZoneId[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  const proposer = state.boats[proposal.proposer];

  if (!proposer) {
    errors.push({ code: "UNKNOWN_PROPOSER", detail: proposal.proposer });
  } else if (!proposer.active) {
    errors.push({ code: "INACTIVE_PROPOSER", detail: proposal.proposer });
  }
  if (proposal.counterparties.length === 0) {
    errors.push({ code: "NO_COUNTERPARTY", detail: proposal.id });
  }
  if (proposal.counterparties.includes(proposal.proposer)) {
    errors.push({ code: "SELF_CONTRACT", detail: proposal.proposer });
  }
  for (const boatId of proposal.counterparties) {
    const boat = state.boats[boatId];
    if (!boat) errors.push({ code: "UNKNOWN_COUNTERPARTY", detail: boatId });
    else if (!boat.active) errors.push({ code: "INACTIVE_COUNTERPARTY", detail: boatId });
  }
  if (proposal.payment < 0) {
    errors.push({ code: "NEGATIVE_PAYMENT", detail: String(proposal.payment) });
  }
  if (proposal.durationRounds < 1) {
    errors.push({ code: "INVALID_DURATION", detail: String(proposal.durationRounds) });
  }
  // The whole point of escrow: an agent cannot promise money it does not hold.
  if (proposer && proposal.payment > proposer.cash) {
    errors.push({
      code: "INSUFFICIENT_FUNDS",
      detail: `needs ${proposal.payment}, holds ${stable(proposer.cash)}`,
    });
  }
  if (proposal.terms.kind === "CATCH_LIMIT") {
    if (proposal.terms.capPerRound < 0) {
      errors.push({ code: "INVALID_CAP", detail: String(proposal.terms.capPerRound) });
    }
    if (proposal.terms.zoneId !== null && !zoneIds.includes(proposal.terms.zoneId)) {
      errors.push({ code: "UNKNOWN_ZONE", detail: proposal.terms.zoneId });
    }
  }
  if (
    proposal.terms.kind === "CONSERVATION_BUYOUT" &&
    proposal.terms.zoneId !== null &&
    !zoneIds.includes(proposal.terms.zoneId)
  ) {
    errors.push({ code: "UNKNOWN_ZONE", detail: proposal.terms.zoneId });
  }
  if (proposal.terms.kind === "MUTUAL_AID" && proposal.terms.contributionPerRound < 0) {
    errors.push({
      code: "INVALID_CONTRIBUTION",
      detail: String(proposal.terms.contributionPerRound),
    });
  }
  return errors;
}

/**
 * Locks the payment and starts the pact. Returns a null pact when the proposal
 * does not validate — a rejected proposal must never move money.
 */
export function acceptProposal(
  state: OceanState,
  proposal: Proposal,
  zoneIds: readonly ZoneId[],
): { pact: ActivePact | null; errors: ValidationError[] } {
  const errors = validateProposal(proposal, state, zoneIds);
  if (errors.length > 0) return { pact: null, errors };

  const proposer = state.boats[proposal.proposer]!;

  if (proposal.terms.kind === "MUTUAL_AID") {
    // A fund is joined, not escrowed: contributions flow in every round.
    const members = [proposal.proposer, ...proposal.counterparties];
    state.fund = {
      balance: state.fund?.balance ?? 0,
      members: [...new Set([...(state.fund?.members ?? []), ...members])],
      contributionPerRound: proposal.terms.contributionPerRound,
      payoutCap: proposal.terms.payoutCap,
    };
  } else {
    proposer.cash = stable(proposer.cash - proposal.payment);
  }

  const pact: ActivePact = {
    id: proposal.id,
    terms: proposal.terms,
    proposer: proposal.proposer,
    counterparties: [...proposal.counterparties],
    startRound: proposal.round,
    endRound: proposal.round + proposal.durationRounds - 1,
    escrowRemaining: proposal.terms.kind === "MUTUAL_AID" ? 0 : proposal.payment,
    perRoundRelease:
      proposal.terms.kind === "MUTUAL_AID"
        ? 0
        : stable(proposal.payment / (proposal.durationRounds * proposal.counterparties.length)),
    status: "ACTIVE",
  };
  state.pacts.push(pact);
  return { pact, errors: [] };
}

function isLive(pact: ActivePact, round: number): boolean {
  return pact.status === "ACTIVE" && round >= pact.startRound && round <= pact.endRound;
}

/**
 * The tightest catch cap this boat has agreed to for this zone, or null when
 * it is unconstrained. Overlapping pacts bind simultaneously.
 */
export function capInForce(state: OceanState, boatId: BoatId, zoneId: ZoneId): number | null {
  let cap: number | null = null;
  for (const pact of state.pacts) {
    if (!isLive(pact, state.round)) continue;
    if (!pact.counterparties.includes(boatId)) continue;
    if (pact.terms.kind !== "CATCH_LIMIT") continue;
    if (pact.terms.zoneId !== null && pact.terms.zoneId !== zoneId) continue;
    cap = cap === null ? pact.terms.capPerRound : Math.min(cap, pact.terms.capPerRound);
  }
  return cap;
}

/** Zones this boat has been paid to stay out of. */
export function closedZones(state: OceanState, boatId: BoatId): Set<ZoneId> {
  const closed = new Set<ZoneId>();
  for (const pact of state.pacts) {
    if (!isLive(pact, state.round)) continue;
    if (!pact.counterparties.includes(boatId)) continue;
    if (pact.terms.kind === "CONSERVATION_BUYOUT" && pact.terms.zoneId !== null) {
      closed.add(pact.terms.zoneId);
    }
  }
  return closed;
}

/** True when this boat has sold its catch rights outright for the round. */
export function standDownRequired(state: OceanState, boatId: BoatId): boolean {
  return state.pacts.some(
    (pact) =>
      isLive(pact, state.round) &&
      pact.counterparties.includes(boatId) &&
      pact.terms.kind === "CONSERVATION_BUYOUT" &&
      pact.terms.zoneId === null,
  );
}

export type ComplianceInput = {
  boatId: BoatId;
  zoneId: ZoneId | null;
  catch: number;
};

/**
 * Settles every live pact against what actually happened this round.
 *
 * Honouring a pact releases that round of escrow to the constrained boat.
 * Breaking it terminates the pact and refunds the remainder to the payer, so
 * defecting costs an agent the rest of the money it was owed.
 */
export function settleRound(
  state: OceanState,
  results: readonly ComplianceInput[],
): { releases: EscrowRelease[]; breached: string[] } {
  const releases: EscrowRelease[] = [];
  const breached: string[] = [];
  const byBoat = new Map(results.map((result) => [result.boatId, result]));

  for (const pact of state.pacts) {
    if (!isLive(pact, state.round)) continue;
    if (pact.terms.kind === "MUTUAL_AID") continue;

    const terms = pact.terms;
    const offenders = pact.counterparties.filter((boatId) => {
      const result = byBoat.get(boatId);
      if (!result) return false;
      if (terms.kind === "CATCH_LIMIT") {
        const applies = terms.zoneId === null || terms.zoneId === result.zoneId;
        return applies && result.catch > terms.capPerRound + 1e-9;
      }
      // A full stand down is breached by landing anything, anywhere.
      const applies = terms.zoneId === null || terms.zoneId === result.zoneId;
      return applies && result.catch > 1e-9;
    });

    if (offenders.length > 0) {
      pact.status = "BREACHED";
      breached.push(pact.id);
      for (const boatId of offenders) state.boats[boatId]!.breaches += 1;
      if (pact.escrowRemaining > 0) {
        const proposer = state.boats[pact.proposer]!;
        proposer.cash = stable(proposer.cash + pact.escrowRemaining);
        releases.push({
          pactId: pact.id,
          from: pact.proposer,
          to: pact.proposer,
          amount: pact.escrowRemaining,
          type: "REFUND",
        });
        pact.escrowRemaining = 0;
      }
      continue;
    }

    for (const boatId of pact.counterparties) {
      const amount = Math.min(pact.perRoundRelease, pact.escrowRemaining);
      if (amount <= 0) continue;
      const payee = state.boats[boatId]!;
      const proposer = state.boats[pact.proposer]!;
      payee.cash = stable(payee.cash + amount);
      payee.totalReceived = stable(payee.totalReceived + amount);
      proposer.totalPaidOut = stable(proposer.totalPaidOut + amount);
      pact.escrowRemaining = stable(pact.escrowRemaining - amount);
      releases.push({ pactId: pact.id, from: pact.proposer, to: boatId, amount, type: "RELEASE" });
    }

    if (state.round === pact.endRound) pact.status = "COMPLETED";
  }

  return { releases, breached };
}
