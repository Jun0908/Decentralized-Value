/**
 * What this Arena publishes about itself.
 *
 * The manifest is the contract with the catalog: the three outcomes, the hard
 * constraints, and the lifecycle. It is hashed, so changing any of it changes
 * the identity of the challenge rather than silently redefining a running one.
 *
 * Registered as PRACTICE deliberately. The arena's own feasibility gate — does
 * every axis hold an interior optimum that moves with the seed — passes on two
 * of three, not three (Plan 10 §56.2). Two axes separate skill; one is still
 * maximised at a dial's end. That is enough to practise against and to show
 * what a mission does to a world, and not enough to rank anyone, so nothing
 * here claims a competition.
 */

import {
  canonicalProtocolJson,
  hashChallengeManifest,
  parseChallengeManifest,
} from "@frontier/shared";
import type { OutcomeMetric } from "@frontier/shared";
import { keccak256, stringToHex, type Hex } from "viem";
import { generateScenario, SEASON_WINDOW, baseBoats, baseZones } from "./scenario";
import { defaultWalletPolicy } from "./agents";

export const oceanCommonsChallengeId = "ocean-commons-v1";

function hashValue(value: unknown): Hex {
  return keccak256(stringToHex(canonicalProtocolJson(value)));
}

/**
 * Three outcomes, never summed.
 *
 * `restraintEfficacy` is the one worth reading twice: of the fish a boat gave
 * up against a reference that takes everything, how many were still in the
 * water at the end. Leaving a ground the greedy boat is steaming towards buys
 * nothing — the fish are landed by someone else that round — so the axis
 * measures judgement about rivals rather than abstinence.
 */
export const oceanCommonsMetrics: readonly OutcomeMetric[] = [
  {
    key: "crewLivelihoodDemoUsd",
    name: "Crew livelihood",
    direction: "MAXIMIZE",
    unit: "DemoUSD",
    lowerBound: 0,
    upperBound: 4_000,
  },
  {
    key: "restraintEfficacyPpm",
    name: "Restraint efficacy",
    direction: "MAXIMIZE",
    unit: "ppm",
    lowerBound: 0,
    upperBound: 2_000_000,
  },
  {
    key: "cooperationEfficacyPpm",
    name: "Cooperation efficacy",
    direction: "MAXIMIZE",
    unit: "ppm",
    lowerBound: 0,
    upperBound: 2_000_000,
  },
];

/** The seeds a practice run is drawn from. Published, so results are checkable. */
export const oceanPracticeSeeds: readonly string[] = Array.from(
  { length: 24 },
  (_, index) => `ocean-practice-v1:${index}`,
);

const oceanPracticeContextHash = hashValue({
  seeds: oceanPracticeSeeds,
  zones: baseZones,
  boats: baseBoats,
  seasonWindow: SEASON_WINDOW,
});

export const oceanCommonsManifest = parseChallengeManifest({
  schemaVersion: "2",
  id: oceanCommonsChallengeId,
  slug: "ocean-commons",
  name: "Ocean Commons",
  lifecycle: "PRACTICE",
  sponsor: {
    name: "Frontier Protocol practice",
    wallet: null,
    statement:
      "A deterministic shared-fishery practice Arena. Boats negotiate structured contracts under escrow; the engine, never a model, resolves the sea.",
  },
  valueTension:
    "Keep a crew solvent, leave a fishery that is still worth fishing, and pay for restraint that actually holds — without combining the three into one score.",
  artifactType: "ocean-mission-v1",
  hardConstraints: [
    "Act only through the published turn schema",
    "Spend no more than the wallet policy allows, and only against a structured contract",
    "Burn no more fuel than the season budget",
    "Do not read the hidden stock of any ground you have not sounded",
    "Compliance is measured by the engine from landed catch, never from a declaration",
  ],
  metrics: oceanCommonsMetrics,
  contexts: [
    {
      id: "public-practice-pack-v1",
      version: "ocean-practice-pack-2026-09-v1",
      name: "Public deterministic practice pack",
      description:
        "Twenty-four deterministic seasons of seven to ten rounds. Season length, weather and the state of every ground are hidden; a season replays from its transcript to the same final state.",
      datasetHash: oceanPracticeContextHash,
      constraintHash: hashValue({
        seasonWindow: SEASON_WINDOW,
        wallet: defaultWalletPolicy,
        fuelBudgets: baseBoats.map((boat) => boat.fuelBudget),
      }),
      metricsHash: hashValue(oceanCommonsMetrics),
      evidenceLevel: 0,
    },
  ],
  activeContextId: "public-practice-pack-v1",
  workload: { publicHash: oceanPracticeContextHash, finalCommitment: null },
  submission: {
    methods: ["INLINE"],
    sourceVisibility: "PUBLIC",
    opensAt: null,
    closesAt: null,
    maxRevisions: 20,
  },
  reviewEndsAt: null,
  reward: { kind: "PREVIEW", poolCredits: 0 },
});

export const oceanCommonsManifestHash = hashChallengeManifest(oceanCommonsManifest);

/**
 * What the browser is allowed to know before a season runs.
 *
 * Everything here is published in the rules anyway: the grounds' biology, the
 * fleet's hulls and fuel, the season window. The weather sequence and the true
 * season length stay behind, because an entrant that could read them would be
 * playing a different game from the one being measured.
 */
export function publicOceanCommonsScenario() {
  const scenario = generateScenario("ocean-practice-v1:0");
  return {
    challengeId: oceanCommonsChallengeId,
    manifestHash: oceanCommonsManifestHash,
    seasonWindow: SEASON_WINDOW,
    zones: scenario.zones,
    boats: scenario.boats,
    price: scenario.price,
    spilloverRate: scenario.spilloverRate,
    reserveFinePerEffort: scenario.reserveFinePerEffort,
    effortCostPerUnit: scenario.effortCostPerUnit,
    fuelPerEffort: scenario.fuelPerEffort,
    repairCost: scenario.repairCost,
    repairRounds: scenario.repairRounds,
    metrics: oceanCommonsMetrics,
    walletPolicy: defaultWalletPolicy,
  };
}

export type PublicOceanCommonsScenario = ReturnType<typeof publicOceanCommonsScenario>;
