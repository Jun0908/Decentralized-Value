import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { benchmarkRecordSchema } from "../packages/shared/src/index.js";
import "dotenv/config";

const root = resolve(import.meta.dirname, "..");
const benchmarkPath = resolve(root, "benchmarks/evm-orderbook/results/latest.json");
const hasForge = (() => {
  try {
    execFileSync("forge", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

function run(command: string, args: string[]) {
  execFileSync(command, args, { cwd: root, stdio: "inherit" });
}

process.stdout.write("[seed] validating local deterministic state\n");
if (hasForge) run("forge", ["build", "--root", resolve(root, "packages/contracts")]);
else
  process.stdout.write(
    "[seed] local: Foundry unavailable; retaining the previously verified benchmark fixture\n",
  );
if (!existsSync(benchmarkPath) || process.env.DEMO_RESEED_BENCHMARK === "true") {
  if (!hasForge) throw new Error("Cannot regenerate the benchmark without Foundry");
  run("pnpm", ["benchmark:orderbook"]);
}
const benchmark = benchmarkRecordSchema.parse(JSON.parse(readFileSync(benchmarkPath, "utf8")));
if (benchmark.artifacts.filter((artifact) => artifact.frontier).length < 2) {
  throw new Error("Demo seed is not interesting: fewer than two frontier artifacts");
}
process.stdout.write(
  `[seed] ${benchmark.artifacts.length} artifacts, ${benchmark.artifacts.filter((artifact) => artifact.frontier).length} frontier members\n`,
);

if (!process.env.SEPOLIA_RPC_URL || !process.env.DEPLOYER_PRIVATE_KEY) {
  process.stdout.write(
    "[seed] external: skipped Sepolia deployment (RPC or funded deployer unavailable)\n",
  );
} else if (!process.env.CHALLENGE_REGISTRY_ADDRESS) {
  process.stdout.write(
    "[seed] external: credentials detected; run pnpm deploy:sepolia once and record addresses before registration\n",
  );
} else {
  process.stdout.write(
    "[seed] external: deployment addresses present; idempotent live registration must be confirmed by demo:check\n",
  );
}

process.stdout.write(
  "[seed] demo API ready; evaluations are labeled simulated until Sepolia settlement is connected\n",
);
process.stdout.write("[seed] local seed ready; last measured frontier retained\n");
