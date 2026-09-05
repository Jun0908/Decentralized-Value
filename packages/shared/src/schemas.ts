import {
  encodeAbiParameters,
  getAddress,
  hashTypedData,
  isAddress,
  keccak256,
  parseAbiParameters,
  type Address,
  type Hex,
} from "viem";
import { z } from "zod";

export const bytes32Schema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, "Expected a 32-byte hex value")
  .transform((value) => value.toLowerCase() as Hex);

export const addressSchema = z
  .string()
  .refine(isAddress, "Expected an EVM address")
  .transform((value) => getAddress(value) as Address);

export const unsignedBigIntSchema = z.bigint().nonnegative();
export const decimalBigIntSchema = z
  .string()
  .regex(/^(0|[1-9][0-9]*)$/, "Expected an unsigned base-10 integer")
  .transform(BigInt);

export const challengeSchema = z.object({
  challengeId: bytes32Schema,
  artifactType: z.string().min(1),
  contextHash: bytes32Schema,
  constraintSpecHash: bytes32Schema,
  runnerRequirementHash: bytes32Schema,
  axes: z.tuple([
    z.object({
      key: z.literal("gasPerOrder"),
      direction: z.literal("MINIMIZE"),
      unit: z.literal("gas"),
    }),
    z.object({
      key: z.literal("parallelThroughput"),
      direction: z.literal("MAXIMIZE"),
      unit: z.literal("normalized-ops-per-second"),
    }),
  ]),
  metadataUri: z.string().url(),
});

export const artifactSchema = z.object({
  artifactId: bytes32Schema,
  challengeId: bytes32Schema,
  artifactHash: bytes32Schema,
  author: addressSchema,
  sourceCommit: z.string().regex(/^[0-9a-f]{40}$/),
  version: z.string().min(1),
  license: z.string().min(1),
  metadataUri: z.string().url(),
});

export const evaluationContextSchema = z.object({
  contextHash: bytes32Schema,
  workloadVersion: z.string().min(1),
  compilerVersion: z.string().min(1),
  compilerFlags: z.array(z.string()),
  chainId: z.bigint().positive(),
});

export const runnerIdentitySchema = z.object({
  ensName: z.string().min(1).endsWith(".eth"),
  signingAddress: addressSchema,
  capability: z.string().min(1),
  endpoint: z.string().url(),
  version: z.string().min(1),
});

export const outcomeVectorSchema = z.object({
  correctness: z.boolean(),
  constraintResultHash: bytes32Schema,
  gasPerOrder: unsignedBigIntSchema,
  parallelThroughput: unsignedBigIntSchema,
});

export const outcomeAttestationSchema = z.object({
  challengeId: bytes32Schema,
  artifactId: bytes32Schema,
  artifactHash: bytes32Schema,
  contextHash: bytes32Schema,
  constraintResultHash: bytes32Schema,
  gasPerOrder: unsignedBigIntSchema,
  parallelThroughput: unsignedBigIntSchema,
  runnerEnsName: z.string().min(1).endsWith(".eth"),
  runnerAddress: addressSchema,
  resultHash: bytes32Schema,
  issuedAt: unsignedBigIntSchema,
});

export const benchmarkRecordSchema = z.object({
  schemaVersion: z.literal("1"),
  workloadVersion: z.string().min(1),
  sourceCommit: z.string().regex(/^[0-9a-f]{40}$/),
  compilerVersion: z.string().min(1),
  compilerFlags: z.array(z.string()),
  contextHash: bytes32Schema,
  measuredAt: z.string().datetime(),
  repetitions: z.number().int().positive(),
  artifacts: z.array(
    z.object({
      name: z.string().min(1),
      artifactHash: bytes32Schema,
      correctness: z.boolean(),
      constraintResultHash: bytes32Schema,
      gasPerOrder: decimalBigIntSchema,
      parallelThroughput: decimalBigIntSchema,
      frontier: z.boolean(),
    }),
  ),
});

export type Challenge = z.infer<typeof challengeSchema>;
export type Artifact = z.infer<typeof artifactSchema>;
export type EvaluationContext = z.infer<typeof evaluationContextSchema>;
export type RunnerIdentity = z.infer<typeof runnerIdentitySchema>;
export type OutcomeVector = z.infer<typeof outcomeVectorSchema>;
export type OutcomeAttestation = z.infer<typeof outcomeAttestationSchema>;
export type BenchmarkRecord = z.infer<typeof benchmarkRecordSchema>;

const resultHashParameters = parseAbiParameters(
  "bytes32 challengeId, bytes32 artifactId, bytes32 artifactHash, bytes32 contextHash, bytes32 constraintResultHash, uint256 gasPerOrder, uint256 parallelThroughput, string runnerEnsName, address runnerAddress, uint256 issuedAt",
);

export function computeOutcomeResultHash(value: Omit<OutcomeAttestation, "resultHash">): Hex {
  return keccak256(
    encodeAbiParameters(resultHashParameters, [
      value.challengeId,
      value.artifactId,
      value.artifactHash,
      value.contextHash,
      value.constraintResultHash,
      value.gasPerOrder,
      value.parallelThroughput,
      value.runnerEnsName,
      value.runnerAddress,
      value.issuedAt,
    ]),
  );
}

export const outcomeAttestationTypes = {
  OutcomeAttestation: [
    { name: "challengeId", type: "bytes32" },
    { name: "artifactId", type: "bytes32" },
    { name: "artifactHash", type: "bytes32" },
    { name: "contextHash", type: "bytes32" },
    { name: "constraintResultHash", type: "bytes32" },
    { name: "gasPerOrder", type: "uint256" },
    { name: "parallelThroughput", type: "uint256" },
    { name: "runnerEnsName", type: "string" },
    { name: "runnerAddress", type: "address" },
    { name: "resultHash", type: "bytes32" },
    { name: "issuedAt", type: "uint256" },
  ],
} as const;

export function hashOutcomeAttestation(
  value: OutcomeAttestation,
  domain: { chainId: number; verifyingContract: Address },
): Hex {
  return hashTypedData({
    domain: {
      name: "Frontier Protocol",
      version: "1",
      chainId: domain.chainId,
      verifyingContract: domain.verifyingContract,
    },
    types: outcomeAttestationTypes,
    primaryType: "OutcomeAttestation",
    message: value,
  });
}

export function stringifyProtocolJson(value: unknown, space?: number): string {
  return JSON.stringify(
    value,
    (_key, item: unknown) => (typeof item === "bigint" ? item.toString(10) : item),
    space,
  );
}
