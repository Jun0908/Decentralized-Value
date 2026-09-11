/**
 * What a player actually submits.
 *
 * The original brief for this Arena said the user sets a mission and a wallet
 * policy — not per-round orders. The mission was built and the wallet policy
 * never was: every season ran on `defaultWalletPolicy`, so the half of the
 * design that decides *what an agent is allowed to do* was fixed and invisible.
 *
 * That is the half that matters most. The sailing dials move an outcome by a
 * few percent (Plan 10 §67), while the wallet changes the shape of the game:
 * strike CONSERVATION_BUYOUT off the permitted list and there is no way left to
 * buy restraint at all, so the cooperation outcome becomes a different thing.
 * Lower the per-contract ceiling and the heaviest boat is simply unaffordable,
 * so only the small ones can be stopped.
 */

import { defaultWalletPolicy, type WalletPolicy } from "./agents";
import type { PactKind } from "./types";
import type { TunableParams } from "./agents";

export const OCEAN_PACT_KINDS: readonly PactKind[] = [
  "CATCH_LIMIT",
  "CONSERVATION_BUYOUT",
  "MUTUAL_AID",
  "CONSERVATION_FUND",
  "SOUNDING_EXCHANGE",
];

/** Bounds the form and the JSON editor both hold to. */
export const OCEAN_ENTRY_LIMITS = {
  nameMaxLength: 80,
  missionMaxLength: 2_000,
  startingBudget: { min: 0, max: 1_000 },
  maxPaymentPerTransaction: { min: 0, max: 500 },
  maxAutonomousSpendPerMatch: { min: 0, max: 2_000 },
} as const;

export type OceanEntry = {
  schemaVersion: "1";
  name: string;
  /** The standing instruction a model-backed boat reads. Ignored by scripted play. */
  mission: string;
  /** What the boat is permitted to spend, and on what. Enforced by the match loop. */
  wallet: {
    startingBudget: number;
    maxPaymentPerTransaction: number;
    maxAutonomousSpendPerMatch: number;
    allowedPurposes: PactKind[];
  };
  /** How the boat works the grounds when no model is driving it. */
  sailing: TunableParams;
};

export const defaultOceanEntry: OceanEntry = {
  schemaVersion: "1",
  name: "Coastal mesh",
  mission: `Keep the crew paid: finish the season solvent and with a working boat.

You cannot see the sea. Sound a ground before you trust it, and remember that a
reading ages the moment you look away.

You may pay other boats to hold back, and take their money to hold back
yourself, when the arithmetic favours it.`,
  wallet: {
    startingBudget: defaultWalletPolicy.startingBudget,
    maxPaymentPerTransaction: defaultWalletPolicy.maxPaymentPerTransaction,
    maxAutonomousSpendPerMatch: defaultWalletPolicy.maxAutonomousSpendPerMatch,
    allowedPurposes: [...OCEAN_PACT_KINDS],
  },
  sailing: { effortFraction: 0.6, reserve: "never", contracts: "cheap" },
};

/**
 * Check an entry that may have come from a JSON editor or an uploaded file.
 *
 * Returns the failures rather than throwing, so a half-finished entry can be
 * shown back to its author with every problem at once instead of the first one.
 */
export function checkOceanEntry(input: unknown): { entry: OceanEntry | null; failures: string[] } {
  const failures: string[] = [];
  const record = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : null;
  if (record === null) return { entry: null, failures: ["An entry must be a JSON object"] };

  const name = typeof record["name"] === "string" ? record["name"].trim() : "";
  if (name.length === 0 || name.length > OCEAN_ENTRY_LIMITS.nameMaxLength) {
    failures.push(`Name must be 1 to ${OCEAN_ENTRY_LIMITS.nameMaxLength} characters`);
  }

  const mission = typeof record["mission"] === "string" ? record["mission"] : "";
  if (mission.trim().length === 0 || mission.length > OCEAN_ENTRY_LIMITS.missionMaxLength) {
    failures.push(`Mission must be 1 to ${OCEAN_ENTRY_LIMITS.missionMaxLength} characters`);
  }

  const wallet =
    typeof record["wallet"] === "object" && record["wallet"] !== null
      ? (record["wallet"] as Record<string, unknown>)
      : null;
  if (wallet === null) failures.push("wallet must be an object");

  const money = (key: keyof typeof OCEAN_ENTRY_LIMITS, label: string): number => {
    const bounds = OCEAN_ENTRY_LIMITS[key] as { min: number; max: number };
    const value = wallet?.[key];
    if (!Number.isSafeInteger(value) || (value as number) < bounds.min || (value as number) > bounds.max) {
      failures.push(`${label} must be a whole number from ${bounds.min} to ${bounds.max}`);
      return bounds.min;
    }
    return value as number;
  };
  const startingBudget = money("startingBudget", "Starting budget");
  const maxPaymentPerTransaction = money("maxPaymentPerTransaction", "Per-contract ceiling");
  const maxAutonomousSpendPerMatch = money("maxAutonomousSpendPerMatch", "Season spend ceiling");

  const rawPurposes = wallet?.["allowedPurposes"];
  const allowedPurposes: PactKind[] = [];
  if (!Array.isArray(rawPurposes)) {
    failures.push("allowedPurposes must be an array");
  } else {
    for (const purpose of rawPurposes) {
      if (typeof purpose !== "string" || !OCEAN_PACT_KINDS.includes(purpose as PactKind)) {
        failures.push(`Unknown contract kind: ${String(purpose)}`);
        continue;
      }
      if (!allowedPurposes.includes(purpose as PactKind)) allowedPurposes.push(purpose as PactKind);
    }
  }

  const sailing =
    typeof record["sailing"] === "object" && record["sailing"] !== null
      ? (record["sailing"] as Record<string, unknown>)
      : null;
  if (sailing === null) failures.push("sailing must be an object");

  const effortFraction = sailing?.["effortFraction"];
  if (typeof effortFraction !== "number" || effortFraction < 0 || effortFraction > 1) {
    failures.push("effortFraction must be a number from 0 to 1");
  }
  const reserve = sailing?.["reserve"];
  if (reserve !== "never" && reserve !== "storm-only" && reserve !== "always") {
    failures.push("reserve must be never, storm-only or always");
  }
  const contracts = sailing?.["contracts"];
  if (contracts !== "none" && contracts !== "cheap" && contracts !== "fair" && contracts !== "generous") {
    failures.push("contracts must be none, cheap, fair or generous");
  }

  if (failures.length > 0) return { entry: null, failures };
  return {
    entry: {
      schemaVersion: "1",
      name,
      mission,
      wallet: {
        startingBudget,
        maxPaymentPerTransaction,
        maxAutonomousSpendPerMatch,
        allowedPurposes,
      },
      sailing: {
        effortFraction: effortFraction as number,
        reserve: reserve as TunableParams["reserve"],
        contracts: contracts as TunableParams["contracts"],
      },
    },
    failures: [],
  };
}

/** The wallet the match loop enforces for this entry's seat. */
export function walletPolicyFor(entry: OceanEntry): WalletPolicy {
  return {
    startingBudget: entry.wallet.startingBudget,
    maxPaymentPerTransaction: entry.wallet.maxPaymentPerTransaction,
    maxAutonomousSpendPerMatch: entry.wallet.maxAutonomousSpendPerMatch,
    allowedPurposes: [...entry.wallet.allowedPurposes],
    allowArbitraryTransfer: false,
  };
}

/**
 * The step each wallet slider moves in. Published because it is what decides
 * how many entries the form can express, as against the JSON editor.
 */
export const OCEAN_WALLET_STEPS = {
  startingBudget: 25,
  maxPaymentPerTransaction: 10,
  maxAutonomousSpendPerMatch: 50,
} as const;

/**
 * How many distinct entries the form can express, ignoring the prose.
 *
 * Published because "how much can a player actually change" is a fair question
 * to ask of any Arena, and because the honest answer here used to be three.
 *
 * This counts the builder only: the sliders move in fixed steps and the three
 * sailing questions offer a fixed set of answers. The JSON editor is not bound
 * by either — it takes any whole number in range and any effort fraction at
 * all — so it reaches strictly more entries than this. Counting the form is
 * the conservative claim, which is why it is the one quoted.
 */
export function oceanEntrySpaceSize(): number {
  const steps = (bounds: { min: number; max: number }, step: number) =>
    Math.floor((bounds.max - bounds.min) / step) + 1;
  return (
    2 ** OCEAN_PACT_KINDS.length *
    steps(OCEAN_ENTRY_LIMITS.startingBudget, OCEAN_WALLET_STEPS.startingBudget) *
    steps(OCEAN_ENTRY_LIMITS.maxPaymentPerTransaction, OCEAN_WALLET_STEPS.maxPaymentPerTransaction) *
    steps(
      OCEAN_ENTRY_LIMITS.maxAutonomousSpendPerMatch,
      OCEAN_WALLET_STEPS.maxAutonomousSpendPerMatch,
    ) *
    3 * // effort: sparing, steady, flat out
    3 * // reserve: never, only in a gale, whenever it pays
    4 //  contracts: none, under, fair, over
  );
}
