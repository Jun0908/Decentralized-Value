import { bytesToHex } from "@ethereumjs/util";
import { keccak256, stringToHex, type Hex } from "viem";
import {
  calldataCompressionContexts,
  calldataCompressionMetrics,
  calldataCompressionScenario,
  encodeCalldataBatch,
  executeCalldataDecoder,
  expectedDigest,
  measureCalldataGas,
  type CalldataBatch,
  type CalldataContextId,
  type CodecId,
} from "./index";
import {
  calldataRulePresets,
  CalldataRuleValidationError,
  parseCalldataRuleArtifact,
  selectCalldataRule,
  type CalldataRuleArtifact,
} from "./rules";
import { codecCompiler, codecRuntimeBytecode } from "./runtime-bytecode";

function canonical(value: unknown): string {
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hash(value: unknown): Hex {
  return keccak256(stringToHex(canonical(value)));
}

export function hashCalldataRuleArtifact(artifact: unknown): Hex {
  return hash(parseCalldataRuleArtifact(artifact));
}

export function parseCalldataLabRequest(value: unknown): {
  artifact: CalldataRuleArtifact;
  contextId: CalldataContextId;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CalldataRuleValidationError("Expected an artifact and contextId object.");
  }
  const request = value as Record<string, unknown>;
  if (Object.keys(request).length !== 2 || !("artifact" in request) || !("contextId" in request)) {
    throw new CalldataRuleValidationError("Request must contain exactly artifact and contextId.");
  }
  if (request.contextId !== "public-transfer-mix" && request.contextId !== "public-low-reuse") {
    throw new CalldataRuleValidationError("Unknown Calldata Practice context.");
  }
  return { artifact: parseCalldataRuleArtifact(request.artifact), contextId: request.contextId };
}

function malformedCases(codecId: CodecId, batch: CalldataBatch) {
  const encoded = encodeCalldataBatch(codecId, batch);
  return [
    { id: "empty-payload", encoded: "0x" as Hex },
    { id: "published-short-payload", encoded: (codecId === "abi" ? "0x01" : "0x0100") as Hex },
    { id: "truncated-last-byte", encoded: encoded.slice(0, -2) as Hex },
    ...(codecId === "dictionary"
      ? [
          {
            id: "out-of-range-dictionary-index",
            // First dictionary index follows dictionary length, addresses, and action count.
            encoded: (() => {
              const count = Number.parseInt(encoded.slice(2, 4), 16);
              const offset = 2 + (2 + count * 20) * 2;
              return `${encoded.slice(0, offset)}ff${encoded.slice(offset + 2)}` as Hex;
            })(),
          },
        ]
      : []),
  ];
}

export function calldataLabContext(contextId: CalldataContextId) {
  const workload = calldataCompressionContexts.find(({ id }) => id === contextId);
  if (!workload) throw new CalldataRuleValidationError("Unknown Calldata Practice context.");
  const context = {
    evaluator: "calldata-rule-lab-v1",
    artifactKind: "calldata-rules-v1",
    contextId,
    contextName: workload.name,
    workloadVersion: workload.workloadVersion,
    referenceContextHash: workload.contextHash,
    evidenceState: "measured" as const,
    evidenceLevel: 0,
    compiler: codecCompiler,
    evm: {
      library: "@ethereumjs/evm",
      version: "10.1.3",
      revision: "cancun",
      gasLimit: "10000000",
      static: true,
    },
    runtimeHashes: Object.fromEntries(
      Object.entries(codecRuntimeBytecode).map(([name, code]) => [name, keccak256(code)]),
    ),
    selection: {
      order: "First matching rule, otherwise fallback; zero to four ordered rules.",
      condition:
        "minActions <= count <= maxActions AND 100 * (count - uniqueRecipients) >= minReusePercent * count",
      uniqueRecipients: "Case-insensitive address equality",
      execution:
        "Host selects the codec before encoding. The selected decoder is called directly; no onchain dispatcher.",
    },
    encodings: {
      abi: "Solidity ABI tuple(address,uint64,uint32)[]; 64-byte header + 96 bytes per action",
      packed: "1-byte count + (20-byte recipient, 8-byte amount, 4-byte nonce) per action",
      dictionary:
        "1-byte unique count + first-occurrence addresses (20 bytes each) + 1-byte action count + (1-byte index, 8-byte amount, 4-byte nonce) per action",
    },
    correctnessGate:
      "Every batch returns the exact reference digest without reverting; every published malformed test reverts. Malformed tests are a bounded corpus, not exhaustive validation.",
    digest:
      "Start bytes32(0); append each action using keccak256(previousDigest || address20 || uint64bigEndian || uint32bigEndian).",
    axes: calldataCompressionMetrics,
    accounting: {
      calldata: "Encoded payload only; zero byte 4 gas, nonzero byte 16 gas (EIP-2028).",
      decoder:
        "EthereumJS executionGasUsed for decodeAndExecute(bytes), including prescribed digest work.",
      exclusions:
        "Transaction base gas, function-call envelope calldata gas, deployment, host rule selection, host encoding and wall-clock time are excluded. Malformed-test gas is not scored.",
    },
    batches: workload.batches.map((batch) => ({
      ...batch,
      actions: batch.actions.map((action) => ({ ...action, amount: action.amount.toString() })),
    })),
    malformedCorpus: calldataCompressionScenario.codecs.map(({ id }) => ({
      codecId: id,
      cases: malformedCases(id, workload.batches[0]!),
    })),
  };
  return structuredClone({ ...context, contextHash: hash(context) });
}

export type CalldataLabPoint = {
  id: string;
  name: string;
  artifactHash: Hex;
  contextHash: Hex;
  correctness: boolean;
  calldataGas: number;
  decodeExecutionGas: number;
};

/** Reference point order cannot alter the comparison or its serialized evidence. */
export function compareCalldataLabPoints(
  candidate: CalldataLabPoint,
  points: readonly CalldataLabPoint[],
) {
  const allPoints = [candidate, ...points];
  if (
    allPoints.some(
      (point) =>
        !Number.isSafeInteger(point.calldataGas) ||
        point.calldataGas < 0 ||
        !Number.isSafeInteger(point.decodeExecutionGas) ||
        point.decodeExecutionGas < 0,
    )
  ) {
    throw new CalldataRuleValidationError("Gas values must be nonnegative safe integers.");
  }
  if (new Set(allPoints.map(({ id }) => id)).size !== allPoints.length) {
    throw new CalldataRuleValidationError("Comparison point IDs must be unique.");
  }
  if (points.some((point) => point.contextHash !== candidate.contextHash)) {
    throw new CalldataRuleValidationError(
      "Only points from the exact same context can be compared.",
    );
  }
  const dominates = (a: CalldataLabPoint, b: CalldataLabPoint) =>
    a.correctness &&
    b.correctness &&
    a.calldataGas <= b.calldataGas &&
    a.decodeExecutionGas <= b.decodeExecutionGas &&
    (a.calldataGas < b.calldataGas || a.decodeExecutionGas < b.decodeExecutionGas);
  const ordered = [...points].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const dominatedBy = ordered.filter((point) => dominates(point, candidate));
  return {
    frontier: candidate.correctness && dominatedBy.length === 0,
    dominatedBy,
    improvesOver: ordered.filter((point) => dominates(candidate, point)),
  };
}

async function measureBatch(codecId: CodecId, batch: CalldataBatch) {
  const encoded = encodeCalldataBatch(codecId, batch);
  const execution = await executeCalldataDecoder(codecId, encoded);
  const digest = bytesToHex(execution.returnValue) as Hex;
  const referenceDigest = expectedDigest(batch);
  return {
    batchId: batch.id,
    batchName: batch.name,
    codecId,
    encoded,
    ...measureCalldataGas(encoded),
    decodeExecutionGas: Number(execution.executionGasUsed),
    digest,
    referenceDigest,
    correctness: execution.exceptionError === undefined && digest === referenceDigest,
    actions: batch.actions.map((action) => ({ ...action, amount: action.amount.toString() })),
    dictionary:
      codecId === "dictionary" ? [...new Set(batch.actions.map(({ recipient }) => recipient))] : [],
  };
}

export async function evaluateCalldataRules(
  artifactValue: unknown,
  contextId: CalldataContextId = "public-transfer-mix",
) {
  const artifact = parseCalldataRuleArtifact(artifactValue);
  const context = calldataLabContext(contextId);
  const workload = calldataCompressionContexts.find(({ id }) => id === contextId)!;
  // Every request performs fresh EVM measurements. No user-artifact cache accumulates.
  const codecMeasurements = await Promise.all(
    calldataCompressionScenario.codecs.map(async (codec) => {
      const [batches, malformedTests] = await Promise.all([
        Promise.all(workload.batches.map((batch) => measureBatch(codec.id, batch))),
        Promise.all(
          malformedCases(codec.id, workload.batches[0]!).map(async (test) => ({
            ...test,
            rejected:
              (await executeCalldataDecoder(codec.id, test.encoded)).exceptionError !== undefined,
          })),
        ),
      ]);
      return { codecId: codec.id, batches, malformedTests };
    }),
  );

  function summarize(rules: CalldataRuleArtifact, id: string, name: string) {
    const batchEvidence = workload.batches.map((batch) => {
      const selection = selectCalldataRule(rules, batch);
      const measurement = codecMeasurements.find(({ codecId }) => codecId === selection.codecId)!;
      return { ...measurement.batches.find(({ batchId }) => batchId === batch.id)!, selection };
    });
    const selectedCodecs = new Set(batchEvidence.map(({ codecId }) => codecId));
    const malformedEvidence = codecMeasurements
      .filter(({ codecId }) => selectedCodecs.has(codecId))
      .map(({ codecId, malformedTests }) => ({ codecId, tests: malformedTests }));
    const malformedInputRejected = malformedEvidence.every(({ tests }) =>
      tests.every(({ rejected }) => rejected),
    );
    const constraintFailures = [
      ...batchEvidence
        .filter(({ correctness }) => !correctness)
        .map(({ batchName }) => `${batchName} failed the reference digest gate.`),
      ...malformedEvidence.flatMap(({ codecId, tests }) =>
        tests.filter(({ rejected }) => !rejected).map(({ id }) => `${codecId} accepted ${id}.`),
      ),
    ];
    const point: CalldataLabPoint = {
      id,
      name,
      artifactHash: hashCalldataRuleArtifact(rules),
      contextHash: context.contextHash,
      correctness: constraintFailures.length === 0,
      calldataGas: batchEvidence.reduce((sum, batch) => sum + batch.calldataGas, 0),
      decodeExecutionGas: batchEvidence.reduce((sum, batch) => sum + batch.decodeExecutionGas, 0),
    };
    return { point, batchEvidence, malformedEvidence, malformedInputRejected, constraintFailures };
  }

  const baselines = calldataCompressionScenario.codecs.map(({ id, name }) => ({
    ...summarize(calldataRulePresets[id], `reference-${id}`, name),
    artifact: parseCalldataRuleArtifact(calldataRulePresets[id]),
  }));
  const artifactHash = hashCalldataRuleArtifact(artifact);
  const candidate = summarize(artifact, artifactHash, "Your rules");
  const result = {
    schemaVersion: "1",
    kind: "calldata-rule-evidence-v1",
    state: "measured",
    artifact,
    artifactHash,
    context,
    contextId,
    contextHash: context.contextHash,
    ...candidate,
    pareto: compareCalldataLabPoints(
      candidate.point,
      baselines.map(({ point }) => point),
    ),
    baselines,
    encodedBytes: candidate.batchEvidence.reduce((sum, batch) => sum + batch.encodedBytes, 0),
  } as const;
  return { ...result, resultHash: hash(result) };
}

export type CalldataLabEvaluation = Awaited<ReturnType<typeof evaluateCalldataRules>>;
