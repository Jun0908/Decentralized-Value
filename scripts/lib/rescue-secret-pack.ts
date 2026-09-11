/** Nonproduction local commitment/reveal preparation. No CRE, TEE or Final claim.
 * Transport boundaries are bounded JSON strings: caller getters and prototypes
 * are never used as private evaluation data. No filesystem, RNG or network here.
 */
import { keccak256, stringToHex, type Hex } from "viem";
import {
  evaluateRescuePolicy,
  generateRescueEpisode,
  rescueRoomChallengeId,
  rescueRoomEvaluatorVersion,
  rescueRoomGeneratorVersion,
  rescueRoomHorizonMinutes,
  rescueRoomInitialBudgetCredits,
  rescueRoomMaximumDecisions,
  rescueRoomMetrics,
  rescueServices,
  type RescuePolicyEvaluation,
} from "../../packages/rescue-room/src/index";

const policies = [
  "always-pause",
  "never-pause",
  "monitor-first",
  "audit-everything",
  "cheapest-service",
  "spend-everything",
  "patch-immediately",
  "simple-adaptive",
] as const;
export type SecretPackPolicy = (typeof policies)[number];
export type SecretPackRuntime = { codeHash: Hex };
export const rescueSecretPackBoundary = Object.freeze({
  scope: "nonproduction-local-preparation",
  executionMode: "local",
  evaluationState: "simulated",
  creVerified: false,
  teeVerified: false,
  finalComplete: false,
  rewardEligible: false,
  paymentState: "not-requested",
} as const);

const hex32 = /^0x[0-9a-f]{64}$/;
const maxJsonLength = 100_000;

/** Error codes never embed supplied data or underlying evaluator exceptions. */
export class RescueSecretPackError extends Error {
  constructor() {
    super("RESCUE_SECRET_PACK_VERIFICATION_FAILED");
    this.name = "RescueSecretPackError";
  }
}

function guarded<T>(run: () => T): T {
  try {
    return run();
  } catch {
    throw new RescueSecretPackError();
  }
}

function check(condition: unknown): asserts condition {
  if (!condition) throw new RescueSecretPackError();
}

function parse(json: string): unknown {
  check(typeof json === "string" && json.length <= maxJsonLength);
  return JSON.parse(json);
}

/** JSON-only, locale-independent encoding; array order remains significant. */
function canonical(value: unknown, depth = 0): string {
  check(depth < 32);
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number") {
    check(Number.isFinite(value) && !Object.is(value, -0));
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item, depth + 1)).join(",")}]`;
  check(typeof value === "object" && value !== null);
  return `{${Object.keys(value)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key], depth + 1)}`,
    )
    .join(",")}}`;
}

function hash(domain: string, value: unknown): Hex {
  return keccak256(stringToHex(canonical({ domain, value })));
}

function object(value: unknown): Record<string, unknown> {
  check(typeof value === "object" && value !== null && !Array.isArray(value));
  return value as Record<string, unknown>;
}

function buildPack(salt: unknown, seeds: unknown, policy: unknown, runtime: SecretPackRuntime) {
  check(typeof salt === "string" && hex32.test(salt) && salt !== `0x${"0".repeat(64)}`);
  check(hex32.test(runtime.codeHash));
  check(Array.isArray(seeds) && seeds.length > 0 && seeds.length <= 8);
  check(seeds.every((seed) => typeof seed === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(seed)));
  check(new Set(seeds).size === seeds.length);
  check(typeof policy === "string" && policies.includes(policy as SecretPackPolicy));
  const orderedSeeds = seeds as string[];
  return {
    schemaVersion: "rescue-secret-pack-local-v1" as const,
    salt,
    generator: { version: rescueRoomGeneratorVersion, orderedSeeds },
    // Full parameters are committed, not merely a seed or a public episode ID.
    episodes: orderedSeeds.map(generateRescueEpisode),
    artifact: {
      schemaVersion: "rescue-baseline-artifact-v1",
      policyId: policy as SecretPackPolicy,
    },
    context: {
      arenaId: rescueRoomChallengeId,
      evaluatorVersion: rescueRoomEvaluatorVersion,
      evaluatorCodeHash: runtime.codeHash,
      aggregationVersion: "existing-rescue-policy-evaluation-v1",
      metrics: rescueRoomMetrics(orderedSeeds.length),
      serviceCatalog: rescueServices,
      horizonMinutes: rescueRoomHorizonMinutes,
      maximumDecisions: rescueRoomMaximumDecisions,
      initialBudgetCredits: rescueRoomInitialBudgetCredits,
    },
  };
}
type PrivatePack = ReturnType<typeof buildPack>;

function verify(
  commitment: string,
  privatePackJson: string,
  runtime: SecretPackRuntime,
): PrivatePack {
  check(hex32.test(commitment));
  const supplied = object(parse(privatePackJson));
  const generator = object(supplied.generator);
  const artifact = object(supplied.artifact);
  const expected = buildPack(supplied.salt, generator.orderedSeeds, artifact.policyId, runtime);
  // Reject unknown fields, changed full parameters, versions, limits or metrics.
  check(canonical(supplied) === canonical(expected));
  check(hash("frontier:rescue-secret-pack:local:v1", expected) === commitment);
  return expected;
}

/** Input: {salt, seeds, policyId}. Salt must be 32 fresh cryptographically random
 * bytes from the host. This pure helper validates shape, not entropy/provenance.
 * The returned privatePackJson MUST NOT enter public logs before explicit reveal.
 */
export function commitRescueSecretPack(inputJson: string, runtime: SecretPackRuntime) {
  return guarded(() => {
    const input = object(parse(inputJson));
    check(Object.keys(input).sort().join(",") === "policyId,salt,seeds");
    const pack = buildPack(input.salt, input.seeds, input.policyId, runtime);
    return {
      commitment: hash("frontier:rescue-secret-pack:local:v1", pack),
      privatePackJson: canonical(pack),
    };
  });
}

export function verifyRescueSecretPack(
  commitment: string,
  privatePackJson: string,
  runtime: SecretPackRuntime,
): true {
  return guarded(() => {
    verify(commitment, privatePackJson, runtime);
    return true;
  });
}

function evaluated(pack: PrivatePack) {
  // No evaluator or aggregation duplication: use the existing exported path.
  return evaluateRescuePolicy(pack.artifact.policyId, pack.generator.orderedSeeds);
}

function receipt(commitment: string, pack: PrivatePack, evaluation: RescuePolicyEvaluation) {
  return {
    schemaVersion: "rescue-secret-pack-receipt-local-v1",
    boundary: rescueSecretPackBoundary,
    commitment,
    // Even unsalted context/result hashes can permit guessing a tiny scenario
    // space. Do not publish them (or scores) before this local reveal boundary.
    evaluationCommitment: hash("frontier:rescue-secret-pack:result:local:v1", {
      salt: pack.salt,
      commitment,
      evaluation,
    }),
  };
}

/** Public-safe receipt; no seeds, parameters, salt, scores or legacy hashes. */
export function evaluateRescueSecretPack(
  commitment: string,
  privatePackJson: string,
  runtime: SecretPackRuntime,
) {
  return guarded(() => {
    const pack = verify(commitment, privatePackJson, runtime);
    return receipt(commitment, pack, evaluated(pack));
  });
}

function checkedReceipt(receiptJson: string, privatePackJson: string, runtime: SecretPackRuntime) {
  const supplied = object(parse(receiptJson));
  check(typeof supplied.commitment === "string");
  const pack = verify(supplied.commitment, privatePackJson, runtime);
  const evaluation = evaluated(pack);
  check(canonical(supplied) === canonical(receipt(supplied.commitment, pack, evaluation)));
  return { pack, evaluation };
}

/** Explicitly discloses the complete pack and salt. This is a stateless LOCAL
 * helper, not a scheduler: it cannot enforce a submission freeze or reveal date.
 */
export function revealRescueSecretPack(
  receiptJson: string,
  privatePackJson: string,
  runtime: SecretPackRuntime,
): string {
  return guarded(() => {
    const { pack, evaluation } = checkedReceipt(receiptJson, privatePackJson, runtime);
    return canonical({ schemaVersion: "rescue-secret-pack-reveal-local-v1", pack, evaluation });
  });
}

/** The receipt must be the previously retained commitment, not one chosen by
 * the revealer. Recomputes generator, full parameters and original evaluator.
 */
export function replayRescueSecretPack(
  receiptJson: string,
  revealJson: string,
  runtime: SecretPackRuntime,
) {
  return guarded(() => {
    const reveal = object(parse(revealJson));
    const { pack, evaluation } = checkedReceipt(receiptJson, canonical(reveal.pack), runtime);
    check(
      canonical(reveal) ===
        canonical({ schemaVersion: "rescue-secret-pack-reveal-local-v1", pack, evaluation }),
    );
    return { verified: true as const, evaluation, boundary: rescueSecretPackBoundary };
  });
}
