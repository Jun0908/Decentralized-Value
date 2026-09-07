import { Common, Hardfork, Mainnet } from "@ethereumjs/common";
import { createEVM } from "@ethereumjs/evm";
import { bytesToHex, hexToBytes } from "@ethereumjs/util";
import {
  hashChallengeManifest,
  parseChallengeManifest,
  computeContributionEvidence,
  type ContributionEvidence,
  type OutcomeMetric,
  type OutcomePoint,
} from "@frontier/shared";
import {
  concatHex,
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  stringToHex,
  toHex,
  type Address,
  type Hex,
} from "viem";
import { codecCompiler, codecRuntimeBytecode } from "./runtime-bytecode";

export type CalldataAction = {
  recipient: Address;
  amount: bigint;
  nonce: number;
};

export type CalldataBatch = {
  id: string;
  name: string;
  actions: readonly CalldataAction[];
};

export type CodecId = "abi" | "packed" | "dictionary";
export type CalldataContextId = "public-transfer-mix" | "public-low-reuse";

export type CodecPoint = {
  id: CodecId;
  name: string;
  calldataGas: number;
  decodeExecutionGas: number;
};

export type BatchEvidence = {
  batchId: string;
  batchName: string;
  actionCount: number;
  encodedBytes: number;
  zeroBytes: number;
  nonZeroBytes: number;
  calldataGas: number;
  decodeExecutionGas: number;
  digest: Hex;
  correctness: boolean;
};

export type CodecEvaluation = {
  schemaVersion: "1";
  arenaId: string;
  workloadVersion: string;
  contextId: CalldataContextId;
  contextHash: Hex;
  manifestHash: Hex;
  resultHash: Hex;
  codecId: CodecId;
  codecName: string;
  calldataGas: number;
  decodeExecutionGas: number;
  correctness: boolean;
  malformedInputRejected: boolean;
  constraintFailures: string[];
  batchEvidence: BatchEvidence[];
  pareto: {
    frontier: boolean;
    dominatedBy: CodecPoint[];
    improvesOver: CodecPoint[];
  };
  contribution: ContributionEvidence;
};

export const calldataCompressionMetrics = [
  {
    key: "calldataGas",
    name: "Calldata gas",
    direction: "MINIMIZE",
    unit: "gas",
    lowerBound: 0,
    upperBound: 40_000,
  },
  {
    key: "decodeExecutionGas",
    name: "Decoder execution",
    direction: "MINIMIZE",
    unit: "gas",
    lowerBound: 0,
    upperBound: 100_000,
  },
] as const satisfies readonly OutcomeMetric[];

function codecOutcomePoint(point: CodecPoint, baseline: boolean): OutcomePoint {
  return {
    id: point.id,
    name: point.name,
    correctness: true,
    baseline,
    values: {
      calldataGas: point.calldataGas,
      decodeExecutionGas: point.decodeExecutionGas,
    },
  };
}

const addresses = {
  alice: "0x1111111111111111111111111111111111111111",
  bob: "0x2222222222222222222222222222222222222222",
  carol: "0x3333333333333333333333333333333333333333",
  dave: "0x4444444444444444444444444444444444444444",
  erin: "0x5555555555555555555555555555555555555555",
  frank: "0x6666666666666666666666666666666666666666",
} as const satisfies Record<string, Address>;

export const calldataCompressionScenario = {
  arenaId: "calldata-compression-v1",
  name: "Ethereum Calldata Compression Frontier",
  workloadVersion: "transfer-batches-2026-09-v1",
  evmRevision: "cancun",
  calldataRule: "EIP-2028",
  zeroByteGas: 4,
  nonZeroByteGas: 16,
  codecs: [
    {
      id: "abi",
      name: "Standard ABI",
      description: "Large, padded encoding with the simplest Solidity decoder.",
      decoderContract: "AbiDecoder",
    },
    {
      id: "packed",
      name: "Fixed-width packed",
      description: "Removes ABI padding; the decoder reads each field from calldata.",
      decoderContract: "PackedDecoder",
    },
    {
      id: "dictionary",
      name: "Address dictionary",
      description:
        "Stores each address once and replaces repeated addresses with one-byte indexes.",
      decoderContract: "DictionaryDecoder",
    },
  ] as const,
  batches: [
    {
      id: "repeated-recipients",
      name: "Repeated recipients",
      actions: Array.from({ length: 10 }, (_, index) => ({
        recipient: index % 2 === 0 ? addresses.alice : addresses.bob,
        amount: BigInt(1_000 + index * 25),
        nonce: index,
      })),
    },
    {
      id: "mixed-recipients",
      name: "Mixed recipients",
      actions: [
        addresses.alice,
        addresses.bob,
        addresses.carol,
        addresses.dave,
        addresses.erin,
        addresses.frank,
      ].map((recipient, index) => ({
        recipient,
        amount: BigInt(50_000 + index * 7_777),
        nonce: 100 + index,
      })),
    },
    {
      id: "boundary-values",
      name: "Boundary values",
      actions: [
        { recipient: addresses.alice, amount: 0n, nonce: 0 },
        { recipient: addresses.alice, amount: 1n, nonce: 1 },
        { recipient: addresses.bob, amount: 18_446_744_073_709_551_615n, nonce: 4_294_967_295 },
        { recipient: addresses.bob, amount: 4_294_967_296n, nonce: 65_536 },
      ],
    },
  ] as const satisfies readonly CalldataBatch[],
} as const;

function canonicalJson(value: unknown): string {
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashCalldataContext(workloadVersion: string, batches: readonly CalldataBatch[]) {
  return keccak256(
    stringToHex(
      canonicalJson({
        arenaId: calldataCompressionScenario.arenaId,
        workloadVersion,
        evmRevision: calldataCompressionScenario.evmRevision,
        calldataRule: calldataCompressionScenario.calldataRule,
        compiler: codecCompiler,
        codecs: calldataCompressionScenario.codecs,
        batches,
      }),
    ),
  );
}

const lowReuseBatches = calldataCompressionScenario.batches.filter(
  ({ id }) => id !== "repeated-recipients",
);
const lowReuseWorkloadVersion = "transfer-batches-2026-09-low-reuse-v1";
export const calldataCompressionContextHash = hashCalldataContext(
  calldataCompressionScenario.workloadVersion,
  calldataCompressionScenario.batches,
);
const lowReuseContextHash = hashCalldataContext(lowReuseWorkloadVersion, lowReuseBatches);

export const calldataCompressionContexts = [
  {
    id: "public-transfer-mix",
    name: "Mixed recipient reuse",
    description: "Repeated recipients, mixed recipients, and integer boundary values.",
    workloadVersion: calldataCompressionScenario.workloadVersion,
    batches: calldataCompressionScenario.batches,
    contextHash: calldataCompressionContextHash,
    evidenceLevel: 0,
  },
  {
    id: "public-low-reuse",
    name: "Low recipient reuse",
    description: "Only mixed-recipient and boundary batches, reducing dictionary reuse.",
    workloadVersion: lowReuseWorkloadVersion,
    batches: lowReuseBatches,
    contextHash: lowReuseContextHash,
    evidenceLevel: 0,
  },
] as const;

export const calldataCompressionManifest = parseChallengeManifest({
  schemaVersion: "2",
  id: calldataCompressionScenario.arenaId,
  slug: "calldata-compression",
  name: calldataCompressionScenario.name,
  lifecycle: "PRACTICE",
  sponsor: {
    name: "Frontier Protocol practice",
    wallet: null,
    statement: "Demonstrating transparent funding rules without claiming a funded sponsor.",
  },
  valueTension: "Lower calldata gas versus lower Solidity decoder execution gas.",
  artifactType: "calldata-codec-v1",
  hardConstraints: [
    "Decode every action to the reference state digest",
    "Reject malformed input",
    "Use the pinned compiler and Cancun EVM context",
  ],
  metrics: calldataCompressionMetrics,
  contexts: [
    {
      id: "public-transfer-mix",
      version: calldataCompressionScenario.workloadVersion,
      name: "Public transfer mix",
      description: "Repeated recipients, mixed recipients, and integer boundary values.",
      datasetHash: calldataCompressionContextHash,
      constraintHash: keccak256(
        stringToHex(
          canonicalJson({
            digest: "reference-state-digest",
            malformedInput: "must-revert",
            evmRevision: calldataCompressionScenario.evmRevision,
          }),
        ),
      ),
      metricsHash: keccak256(stringToHex(canonicalJson(calldataCompressionMetrics))),
      evidenceLevel: 0,
    },
    {
      id: "public-low-reuse",
      version: lowReuseWorkloadVersion,
      name: "Low recipient reuse",
      description: "Mixed-recipient and boundary batches without the repeated-recipient batch.",
      datasetHash: lowReuseContextHash,
      constraintHash: keccak256(
        stringToHex(
          canonicalJson({
            digest: "reference-state-digest",
            malformedInput: "must-revert",
            evmRevision: calldataCompressionScenario.evmRevision,
          }),
        ),
      ),
      metricsHash: keccak256(stringToHex(canonicalJson(calldataCompressionMetrics))),
      evidenceLevel: 0,
    },
  ],
  activeContextId: "public-transfer-mix",
  workload: { publicHash: calldataCompressionContextHash, finalCommitment: null },
  submission: {
    methods: ["INLINE", "UPLOAD"],
    sourceVisibility: "PUBLIC",
    opensAt: null,
    closesAt: null,
    maxRevisions: 20,
  },
  reviewEndsAt: null,
  reward: { kind: "PREVIEW", poolCredits: 10_000 },
});

export const calldataCompressionManifestHash = hashChallengeManifest(calldataCompressionManifest);

const decodeAbi = [
  {
    type: "function",
    name: "decodeAndExecute",
    stateMutability: "pure",
    inputs: [{ name: "encoded", type: "bytes" }],
    outputs: [{ name: "digest", type: "bytes32" }],
  },
] as const;

function encodeAbi(batch: CalldataBatch): Hex {
  return encodeAbiParameters(
    [
      {
        type: "tuple[]",
        components: [
          { name: "recipient", type: "address" },
          { name: "amount", type: "uint64" },
          { name: "nonce", type: "uint32" },
        ],
      },
    ],
    [batch.actions],
  );
}

function encodePacked(batch: CalldataBatch): Hex {
  const fields: Hex[] = [toHex(batch.actions.length, { size: 1 })];
  for (const action of batch.actions) {
    fields.push(
      action.recipient,
      toHex(action.amount, { size: 8 }),
      toHex(action.nonce, { size: 4 }),
    );
  }
  return concatHex(fields);
}

function encodeDictionary(batch: CalldataBatch): Hex {
  const dictionary = [...new Set(batch.actions.map((action) => action.recipient))];
  const fields: Hex[] = [
    toHex(dictionary.length, { size: 1 }),
    ...dictionary,
    toHex(batch.actions.length, { size: 1 }),
  ];
  for (const action of batch.actions) {
    const index = dictionary.indexOf(action.recipient);
    fields.push(
      toHex(index, { size: 1 }),
      toHex(action.amount, { size: 8 }),
      toHex(action.nonce, { size: 4 }),
    );
  }
  return concatHex(fields);
}

const encoders: Record<CodecId, (batch: CalldataBatch) => Hex> = {
  abi: encodeAbi,
  packed: encodePacked,
  dictionary: encodeDictionary,
};

const runtimeByCodec: Record<CodecId, Hex> = {
  abi: codecRuntimeBytecode.AbiDecoder as Hex,
  packed: codecRuntimeBytecode.PackedDecoder as Hex,
  dictionary: codecRuntimeBytecode.DictionaryDecoder as Hex,
};

const malformedByCodec: Record<CodecId, Hex> = {
  abi: "0x01",
  packed: "0x0100",
  dictionary: "0x0100",
};

function expectedDigest(batch: CalldataBatch): Hex {
  let digest = `0x${"00".repeat(32)}` as Hex;
  for (const action of batch.actions) {
    digest = keccak256(
      concatHex([
        digest,
        action.recipient,
        toHex(action.amount, { size: 8 }),
        toHex(action.nonce, { size: 4 }),
      ]),
    );
  }
  return digest;
}

export function measureCalldataGas(encoded: Hex) {
  const bytes = hexToBytes(encoded);
  let zeroBytes = 0;
  for (const byte of bytes) if (byte === 0) zeroBytes += 1;
  const nonZeroBytes = bytes.length - zeroBytes;
  return {
    encodedBytes: bytes.length,
    zeroBytes,
    nonZeroBytes,
    calldataGas:
      zeroBytes * calldataCompressionScenario.zeroByteGas +
      nonZeroBytes * calldataCompressionScenario.nonZeroByteGas,
  };
}

async function execute(runtime: Hex, encoded: Hex) {
  const evm = await createEVM({
    common: new Common({ chain: Mainnet, hardfork: Hardfork.Cancun }),
  });
  const calldata = encodeFunctionData({
    abi: decodeAbi,
    functionName: "decodeAndExecute",
    args: [encoded],
  });
  return evm.runCode({
    code: hexToBytes(runtime),
    data: hexToBytes(calldata),
    gasLimit: 10_000_000n,
    isStatic: true,
  });
}

function dominatesCodec(left: CodecPoint, right: CodecPoint): boolean {
  const noWorse =
    left.calldataGas <= right.calldataGas && left.decodeExecutionGas <= right.decodeExecutionGas;
  const strictlyBetter =
    left.calldataGas < right.calldataGas || left.decodeExecutionGas < right.decodeExecutionGas;
  return noWorse && strictlyBetter;
}

async function measureCodec(codecId: CodecId, batches: readonly CalldataBatch[]) {
  const codec = calldataCompressionScenario.codecs.find((item) => item.id === codecId);
  if (!codec) throw new Error(`Unknown codec: ${codecId}`);
  const batchEvidence: BatchEvidence[] = [];
  const failures: string[] = [];

  for (const batch of batches) {
    const encoded = encoders[codecId](batch);
    const byteMetrics = measureCalldataGas(encoded);
    const execution = await execute(runtimeByCodec[codecId], encoded);
    const digest = bytesToHex(execution.returnValue) as Hex;
    const correctness = execution.exceptionError === undefined && digest === expectedDigest(batch);
    if (!correctness) failures.push(`${batch.name} did not reproduce the reference state digest`);
    batchEvidence.push({
      batchId: batch.id,
      batchName: batch.name,
      actionCount: batch.actions.length,
      ...byteMetrics,
      decodeExecutionGas: Number(execution.executionGasUsed),
      digest,
      correctness,
    });
  }

  const malformedExecution = await execute(runtimeByCodec[codecId], malformedByCodec[codecId]);
  const malformedInputRejected = malformedExecution.exceptionError !== undefined;
  if (!malformedInputRejected) failures.push("Malformed encoding was accepted");
  return {
    codec,
    batchEvidence,
    calldataGas: batchEvidence.reduce((sum, batch) => sum + batch.calldataGas, 0),
    decodeExecutionGas: batchEvidence.reduce((sum, batch) => sum + batch.decodeExecutionGas, 0),
    malformedInputRejected,
    failures,
  };
}

export async function measureCodecPoints(
  contextId: CalldataContextId = "public-transfer-mix",
): Promise<CodecPoint[]> {
  const context = calldataContext(contextId);
  return Promise.all(
    calldataCompressionScenario.codecs.map(async (codec) => {
      const measurement = await measureCodec(codec.id, context.batches);
      return {
        id: codec.id,
        name: codec.name,
        calldataGas: measurement.calldataGas,
        decodeExecutionGas: measurement.decodeExecutionGas,
      };
    }),
  );
}

function calldataContext(contextId: string) {
  const context = calldataCompressionContexts.find(({ id }) => id === contextId);
  if (!context) throw new Error(`Unknown calldata context: ${contextId}`);
  return context;
}

export async function evaluateCalldataCodec(
  codecId: CodecId,
  contextId: CalldataContextId = "public-transfer-mix",
): Promise<CodecEvaluation> {
  const context = calldataContext(contextId);
  const [measurement, baselinePoints] = await Promise.all([
    measureCodec(codecId, context.batches),
    measureCodecPoints(contextId),
  ]);
  const candidate = baselinePoints.find((point) => point.id === codecId);
  if (!candidate) throw new Error(`Unknown codec: ${codecId}`);
  const comparisonPoints = baselinePoints.filter((point) => point.id !== codecId);
  const correctness = measurement.failures.length === 0;
  const dominatedBy = correctness
    ? comparisonPoints.filter((point) => dominatesCodec(point, candidate))
    : [];
  const improvesOver = correctness
    ? comparisonPoints.filter((point) => dominatesCodec(candidate, point))
    : [];
  const contribution = computeContributionEvidence(
    comparisonPoints.map((point) => codecOutcomePoint(point, true)),
    { ...codecOutcomePoint(candidate, false), correctness },
    calldataCompressionMetrics,
  );
  const resultWithoutHash = {
    schemaVersion: "1" as const,
    arenaId: calldataCompressionScenario.arenaId,
    workloadVersion: context.workloadVersion,
    contextId,
    contextHash: context.contextHash,
    manifestHash: calldataCompressionManifestHash,
    codecId,
    codecName: measurement.codec.name,
    calldataGas: measurement.calldataGas,
    decodeExecutionGas: measurement.decodeExecutionGas,
    correctness,
    malformedInputRejected: measurement.malformedInputRejected,
    constraintFailures: measurement.failures,
    batchEvidence: measurement.batchEvidence,
    pareto: {
      frontier: correctness && dominatedBy.length === 0,
      dominatedBy,
      improvesOver,
    },
    contribution,
  };
  return {
    ...resultWithoutHash,
    resultHash: keccak256(stringToHex(canonicalJson(resultWithoutHash))),
  };
}

export async function publicCalldataCompressionScenario(
  contextId: CalldataContextId = "public-transfer-mix",
) {
  const context = calldataContext(contextId);
  return {
    arenaId: calldataCompressionScenario.arenaId,
    name: calldataCompressionScenario.name,
    workloadVersion: context.workloadVersion,
    contextId,
    contextName: context.name,
    contextDescription: context.description,
    contextHash: context.contextHash,
    evidenceLevel: context.evidenceLevel,
    manifest: calldataCompressionManifest,
    manifestHash: calldataCompressionManifestHash,
    axes: calldataCompressionMetrics,
    evmRevision: calldataCompressionScenario.evmRevision,
    compiler: codecCompiler,
    calldataRule: calldataCompressionScenario.calldataRule,
    batches: context.batches.map((batch) => ({
      id: batch.id,
      name: batch.name,
      actionCount: batch.actions.length,
    })),
    codecs: calldataCompressionScenario.codecs,
    baselinePoints: await measureCodecPoints(contextId),
    contexts: calldataCompressionContexts.map(
      ({ id, name, description, contextHash, evidenceLevel }) => ({
        id,
        name,
        description,
        contextHash,
        evidenceLevel,
      }),
    ),
    settlement: { state: "not-configured", network: "sepolia", rewardToken: null },
  } as const;
}
