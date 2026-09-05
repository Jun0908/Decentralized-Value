import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  benchmarkRecordSchema,
  computeParetoFrontier,
  stringifyProtocolJson,
  type FrontierPoint,
} from "@frontier/shared";
import { keccak256, stringToHex, type Hex } from "viem";

const root = resolve(import.meta.dirname, "../../..");
const contractsRoot = resolve(root, "packages/contracts");
const workloadPath = resolve(root, "benchmarks/evm-orderbook/workloads/orderbook-v1.json");
const outputPath = resolve(root, "benchmarks/evm-orderbook/results/latest.json");
const forge = process.env.FORGE_BIN || "forge";
const repetitions = 5;

type ForgeTest = {
  status: string;
  decoded_logs: string[];
};

type ArtifactMeasurement = {
  name: string;
  contract: string;
  test: string;
  design: "global" | "four-shards" | "per-market";
  gas: bigint[];
  correctness: boolean;
  constraintResultHash: Hex;
};

const measurements: ArtifactMeasurement[] = [
  {
    name: "PackedBook",
    contract: "PackedBook",
    test: "testBenchmarkPacked()",
    design: "global",
    gas: [],
    correctness: false,
    constraintResultHash: "0x" as Hex,
  },
  {
    name: "FrontierBook",
    contract: "FrontierBook",
    test: "testBenchmarkFrontier()",
    design: "four-shards",
    gas: [],
    correctness: false,
    constraintResultHash: "0x" as Hex,
  },
  {
    name: "ShardedBook",
    contract: "ShardedBook",
    test: "testBenchmarkSharded()",
    design: "per-market",
    gas: [],
    correctness: false,
    constraintResultHash: "0x" as Hex,
  },
  {
    name: "BadBook",
    contract: "BadBook",
    test: "testBenchmarkBad()",
    design: "global",
    gas: [],
    correctness: false,
    constraintResultHash: "0x" as Hex,
  },
];

for (let run = 0; run < repetitions; run += 1) {
  const stdout = execFileSync(
    forge,
    ["test", "--root", contractsRoot, "--match-contract", "OrderBookBenchmark", "-vv", "--json"],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  const suite = Object.values(
    JSON.parse(stdout) as Record<string, { test_results: Record<string, ForgeTest> }>,
  )[0];
  if (!suite) throw new Error("Foundry returned no benchmark suite");

  for (const measurement of measurements) {
    const result = suite.test_results[measurement.test];
    if (!result || result.status !== "Success")
      throw new Error(`Benchmark failed: ${measurement.test}`);
    const gasLog = result.decoded_logs.find((line) => line.startsWith("gasPerOrder:"));
    const correctnessLog = result.decoded_logs.find((line) => line.startsWith("correctness:"));
    const constraintLog = result.decoded_logs.find((line) =>
      line.startsWith("constraintResultHash:"),
    );
    if (!gasLog || !correctnessLog || !constraintLog)
      throw new Error(`Missing benchmark logs: ${measurement.test}`);
    measurement.gas.push(BigInt(gasLog.split(":")[1]!.trim()));
    measurement.correctness = correctnessLog.endsWith("1");
    measurement.constraintResultHash = constraintLog.split(":")[1]!.trim() as Hex;
  }
}

const workload = JSON.parse(readFileSync(workloadPath, "utf8")) as {
  version: string;
  marketIds: number[];
  ordersPerMarket: number;
  referenceLaneOpsPerSecond: number;
};

function parallelThroughput(design: ArtifactMeasurement["design"]): bigint {
  const laneCounts = new Map<string, number>();
  for (const marketId of workload.marketIds) {
    const lane =
      design === "global"
        ? "global"
        : design === "four-shards"
          ? String(marketId & 3)
          : String(marketId);
    laneCounts.set(lane, (laneCounts.get(lane) ?? 0) + workload.ordersPerMarket);
  }
  const totalOperations = workload.marketIds.length * workload.ordersPerMarket;
  const waves = Math.max(...laneCounts.values());
  return BigInt((totalOperations / waves) * workload.referenceLaneOpsPerSecond);
}

function median(values: bigint[]): bigint {
  const ordered = [...values].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  return ordered[Math.floor(ordered.length / 2)]!;
}

const evaluated = measurements.map((measurement) => {
  const artifactPath = resolve(
    contractsRoot,
    `out/${measurement.contract}.sol/${measurement.contract}.json`,
  );
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as {
    deployedBytecode: { object: Hex };
  };
  const artifactHash = keccak256(artifact.deployedBytecode.object);
  return {
    ...measurement,
    artifactHash,
    gasPerOrder: median(measurement.gas),
    parallelThroughput: parallelThroughput(measurement.design),
  };
});

const points: FrontierPoint[] = evaluated.map((item) => ({
  artifactId: item.artifactHash,
  correctness: item.correctness,
  gasPerOrder: item.gasPerOrder,
  parallelThroughput: item.parallelThroughput,
}));
const frontierIds = new Set(computeParetoFrontier(points).map((point) => point.artifactId));
if (frontierIds.size < 2)
  throw new Error("Reference benchmark must produce at least two non-dominated artifacts");

const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const contextHash = keccak256(stringToHex(JSON.stringify(workload)));
const record = {
  schemaVersion: "1",
  workloadVersion: workload.version,
  sourceCommit,
  compilerVersion: "solc 0.8.30",
  compilerFlags: [
    "optimizer=true",
    "optimizer_runs=200",
    "evm_version=cancun",
    "bytecode_hash=none",
  ],
  contextHash,
  measuredAt: new Date().toISOString(),
  repetitions,
  artifacts: evaluated.map((item) => ({
    name: item.name,
    artifactHash: item.artifactHash,
    correctness: item.correctness,
    constraintResultHash: item.constraintResultHash,
    gasPerOrder: item.gasPerOrder.toString(10),
    parallelThroughput: item.parallelThroughput.toString(10),
    frontier: frontierIds.has(item.artifactHash),
  })),
};

mkdirSync(dirname(outputPath), { recursive: true });
const validatedRecord = benchmarkRecordSchema.parse(record);
writeFileSync(outputPath, `${stringifyProtocolJson(validatedRecord, 2)}\n`, "utf8");
process.stdout.write(`Wrote ${outputPath}\n`);
for (const item of record.artifacts) {
  process.stdout.write(
    `${item.name}: gas/order=${item.gasPerOrder}, throughput=${item.parallelThroughput}, correct=${item.correctness}, frontier=${item.frontier}\n`,
  );
}
