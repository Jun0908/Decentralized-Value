/**
 * Ocean Commons — shared-resource arena types.
 *
 * The ocean itself is never decided by an AI. Every world transition runs
 * through the deterministic engine in `engine.ts`. Agents only choose actions
 * and negotiate contracts; the engine alone resolves what the sea does.
 */

export type ZoneId = string;
export type BoatId = string;
export type PactId = string;

/** A fishing ground. Zones differ so that "where" is a real decision. */
export type Zone = {
  id: ZoneId;
  name: string;
  /** Logistic carrying capacity. */
  carryingCapacity: number;
  /** Intrinsic regrowth rate per round. */
  growthRate: number;
  initialStock: number;
  /** Fixed cost to operate here for one round. */
  travelCost: number;
  /** Fuel burned reaching this ground, before any is spent fishing it. */
  travelFuel: number;
  /** Fish landed per unit of effort at full stock. */
  catchEfficiency: number;
  /** 0..1 — how strongly storms hit this zone. */
  stormExposure: number;
  /**
   * Fraction of capacity below which recruitment fails. Fish past it and the
   * ground does not merely thin — it dies, and no restraint later in the match
   * brings it back. This cliff is what makes restraint worth paying for.
   */
  collapseThreshold: number;
  /** Fishing a reserve is possible but carries a fine; the engine enforces it. */
  reserve: boolean;
};

/**
 * What a boat knows about one ground, and how it came to know it.
 *
 * Nobody is handed the state of the sea. Earlier versions put the true stock
 * of every zone in front of every agent each round, which made the optimum
 * computable in closed form and handed the match to whichever entrant could do
 * the arithmetic fastest (Plan 10 §50.1). Here the sea is dark: a ground is
 * known only if someone worked it, and only as well as the watcher's vantage
 * allowed.
 *
 * This is the exploration/exploitation trade the arena rests on. Steaming to a
 * ground nobody has touched costs fuel and may find nothing; going where the
 * readings are fresh means going where the fleet already is.
 */
export type Sounding = {
  zoneId: ZoneId;
  /** Stock at the time the reading was taken — not the stock now. */
  stock: number;
  /** The round it was taken in. Compare against the current round for age. */
  round: number;
  /**
   * FISHED   — this boat worked the ground and measured it from its own haul.
   * OBSERVED — inferred from watching another boat's landings. Coarse: banded
   *            to a tenth of the ground's capacity, because you are reading a
   *            rival's catch, not your own net.
   * SHARED   — handed over under a contract, and exact. That precision is what
   *            makes a reading worth paying for.
   */
  source: "FISHED" | "OBSERVED" | "SHARED";
};

/** One round as a boat remembers it. Carries no stock the boat did not earn. */
export type BoatRoundMemory = {
  round: number;
  weather: RoundWeather;
  price: number;
  /** This boat's own entry, in full. */
  self: BoatRoundEntry;
  /** Where the others went and what they landed — the whole inference channel. */
  others: { boatId: BoatId; zoneId: ZoneId | null; catch: number }[];
};

export type Boat = {
  id: BoatId;
  name: string;
  startingCash: number;
  /** Maximum effort units per round. */
  effortCapacity: number;
  /**
   * Fuel for the whole season, not per round.
   *
   * With only a per-round hull limit there was nothing to allocate: every round
   * was independent and "go as hard as you can" answered all of them, so every
   * axis was monotone in effort (Plan 10 §50.2). A budget spent across a season
   * of unknown length puts the optimum in the interior by construction — burn
   * it early and the price collapses while you are still at sea with the late
   * grounds unfished; spread it thin and upkeep eats you before the gale.
   */
  fuelBudget: number;
  /** Fixed operating cost per round, paid even when idle. */
  upkeepPerRound: number;
  /**
   * The roughest water this hull will work, as zone exposure × storm severity.
   * A small boat is driven inshore by weather a big one shrugs off — and if the
   * inshore ground has already been stripped, it has nowhere left to fish. This
   * is what ties a small operator's survival to how the fleet treated the sea.
   */
  stormLimit: number;
  /** Small boats have less buffer; used by the resilience outcome. */
  smallFleet: boolean;
};

export type BoatState = {
  id: BoatId;
  cash: number;
  /** False once the boat has gone bankrupt; it stops fishing permanently. */
  active: boolean;
  /** Rounds remaining under repair. A damaged boat cannot fish. */
  repairRoundsLeft: number;
  /** Fuel left for the rest of the season. At zero the boat cannot leave port. */
  fuelRemaining: number;
  totalCatch: number;
  totalRevenue: number;
  totalCosts: number;
  /** Payments made to other boats under contracts. */
  totalPaidOut: number;
  totalReceived: number;
  /** Rounds where this boat exceeded a cap it had agreed to. */
  breaches: number;
};

/** Pre-generated from the scenario seed, so the world is replayable. */
export type RoundWeather = {
  round: number;
  /** 0..1 storm severity applied through each zone's stormExposure. */
  stormSeverity: number;
  /** Boats hit by a mechanical failure this round. */
  breakdowns: BoatId[];
  /** Multiplier on the market price this round. */
  priceShock: number;
};

export type FishingAction = {
  boatId: BoatId;
  zoneId: ZoneId;
  /** Requested effort. The engine clamps it to capacity and to any active cap. */
  effort: number;
};

/**
 * Structured contracts. Agents never settle in free text — a contract is a
 * typed object whose compliance the engine checks against actual catches.
 */
export type PactKind =
  | "CATCH_LIMIT"
  | "CONSERVATION_BUYOUT"
  | "MUTUAL_AID"
  | "CONSERVATION_FUND"
  | "SOUNDING_EXCHANGE";

export type CatchLimitTerms = {
  kind: "CATCH_LIMIT";
  /** The constrained boat must not land more than this per round. */
  capPerRound: number;
  /** Applies to this zone only, or to all zones when null. */
  zoneId: ZoneId | null;
};

export type ConservationBuyoutTerms = {
  kind: "CONSERVATION_BUYOUT";
  /**
   * The paid boat gives up catch rights: it must not fish this zone at all,
   * or — when null — must not fish anywhere for the term. Only a full stand
   * down actually removes effort from the sea; closing one ground merely
   * sends the boat somewhere else.
   */
  zoneId: ZoneId | null;
};

export type MutualAidTerms = {
  kind: "MUTUAL_AID";
  /** Contribution each member pays into the fund per round. */
  contributionPerRound: number;
  /** Maximum payout to a member per incident. */
  payoutCap: number;
};

/**
 * A pooled war chest for buying restraint.
 *
 * One boat's wallet can idle roughly one rival for a few rounds, which is a
 * few percent of the fleet's effort — too little to turn a commons around.
 * A fund is the same contract mechanics at a scale that can.
 */
export type ConservationFundTerms = {
  kind: "CONSERVATION_FUND";
  /** Paid in by every member, every round. */
  contributionPerRound: number;
  /** Ceiling on what the fund may commit to any single stand-down. */
  standDownCap: number;
};

/**
 * Buying someone else's eyes.
 *
 * Every other contract here moves fish or money. This one moves knowledge: for
 * the term of the deal, each side receives the other's readings at full
 * precision instead of the banded estimate watching would give. In a dark sea
 * that is worth paying for, and it is the only contract whose value depends on
 * the counterparty having been somewhere you have not.
 */
export type SoundingExchangeTerms = {
  kind: "SOUNDING_EXCHANGE";
  /** Readings for this ground only, or for every ground when null. */
  zoneId: ZoneId | null;
};

export type PactTerms =
  | CatchLimitTerms
  | ConservationBuyoutTerms
  | MutualAidTerms
  | ConservationFundTerms
  | SoundingExchangeTerms;

export type Proposal = {
  id: PactId;
  round: number;
  /** Who pays. */
  proposer: BoatId;
  /** Who takes on the obligation. Mutual aid uses every member. */
  counterparties: BoatId[];
  terms: PactTerms;
  /** Total escrowed amount, released across the pact's rounds. */
  payment: number;
  durationRounds: number;
  /** Short machine-readable motive, kept as provenance only. Never scored. */
  reasonCode: string;
  /**
   * Where the escrow comes from. A fund-financed offer draws on the pool
   * rather than the proposer's own cash, which is the whole point of pooling:
   * no single boat has to carry the cost of protecting water everyone fishes.
   */
  fundedBy?: "SELF" | "CONSERVATION_FUND";
};

export type ProposalResponse =
  | { type: "ACCEPT"; proposalId: PactId }
  | { type: "REJECT"; proposalId: PactId; reasonCode: string }
  | { type: "COUNTER"; proposalId: PactId; counter: Proposal };

/** An accepted pact with funds locked. */
export type ActivePact = {
  id: PactId;
  terms: PactTerms;
  proposer: BoatId;
  /** Set when the conservation fund, not the proposer, put up the escrow. */
  fundFinanced: boolean;
  counterparties: BoatId[];
  startRound: number;
  endRound: number;
  /** Still locked, not yet released to counterparties. */
  escrowRemaining: number;
  perRoundRelease: number;
  status: "ACTIVE" | "COMPLETED" | "BREACHED";
};

export type MutualAidFund = {
  balance: number;
  members: BoatId[];
  contributionPerRound: number;
  payoutCap: number;
};

export type ConservationFund = {
  balance: number;
  members: BoatId[];
  contributionPerRound: number;
  standDownCap: number;
};

export type OceanState = {
  round: number;
  stocks: Record<ZoneId, number>;
  boats: Record<BoatId, BoatState>;
  pacts: ActivePact[];
  fund: MutualAidFund | null;
  conservationFund: ConservationFund | null;
  /** Current market price per fish, moved by total landings. */
  price: number;
};

/** One round of fully resolved history — the replay record. */
export type RoundRecord = {
  round: number;
  weather: RoundWeather;
  priceBefore: number;
  priceAfter: number;
  stocksBefore: Record<ZoneId, number>;
  stocksAfter: Record<ZoneId, number>;
  entries: BoatRoundEntry[];
  escrowReleases: EscrowRelease[];
  aidPayouts: AidPayout[];
  newPacts: PactId[];
  breachedPacts: PactId[];
};

export type BoatRoundEntry = {
  boatId: BoatId;
  zoneId: ZoneId | null;
  requestedEffort: number;
  appliedEffort: number;
  /** Cap in force this round, if the boat was under a contract. */
  capInForce: number | null;
  catch: number;
  revenue: number;
  costs: number;
  /** Fine charged for fishing a reserve. */
  fine: number;
  cashAfter: number;
  breached: boolean;
  /** Why the engine reduced effort, if it did. */
  clampReason: string | null;
  /** Fuel burned this round, and what was left after. */
  fuelBurned: number;
  fuelAfter: number;
};

export type EscrowRelease = {
  pactId: PactId;
  /** The payer, or "conservation-fund" when the pool financed the deal. */
  from: BoatId | "conservation-fund";
  to: BoatId | "conservation-fund";
  amount: number;
  /** RELEASE pays the obligated boat; REFUND returns funds on breach. */
  type: "RELEASE" | "REFUND";
};

export type AidPayout = {
  to: BoatId;
  amount: number;
  reason: "REPAIR" | "INSOLVENCY";
};
