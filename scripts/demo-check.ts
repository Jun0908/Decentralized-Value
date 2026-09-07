import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPublicClient, getAddress, http } from "viem";
import { sepolia } from "viem/chains";
import "dotenv/config";

type Check = { name: string; ok: boolean; recovery: string };
const root = resolve(import.meta.dirname, "..");
const rewardEvidencePath = resolve(root, "Docs/deployments/sepolia-reward-demo.json");
const commandAvailable = (command: string) => {
  try {
    execFileSync(command, ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};
const present = (name: string) => Boolean(process.env[name]);
const checks: Check[] = [
  {
    name: "benchmark fixture",
    ok: existsSync(resolve(root, "benchmarks/evm-orderbook/results/latest.json")),
    recovery: "run pnpm benchmark:orderbook",
  },
  { name: "Foundry", ok: commandAvailable("forge"), recovery: "install Foundry 1.8.1" },
  { name: "Sepolia RPC", ok: present("SEPOLIA_RPC_URL"), recovery: "set SEPOLIA_RPC_URL locally" },
  {
    name: "funded deployer",
    ok: present("DEPLOYER_PRIVATE_KEY"),
    recovery: "provide a funded Sepolia signing method locally",
  },
  {
    name: "contracts",
    ok: [
      "CHALLENGE_REGISTRY_ADDRESS",
      "ARTIFACT_REGISTRY_ADDRESS",
      "ATTESTATION_ADDRESS",
      "PARETO_SETTLEMENT_ADDRESS",
    ].every(present),
    recovery: "run pnpm deploy:sepolia and record verified addresses",
  },
  {
    name: "ENSv2 parent",
    ok: present("ENS_PARENT_NAME"),
    recovery: "create the Sepolia ENSv2 namespaces and set ENS_PARENT_NAME",
  },
  {
    name: "runner endpoint",
    ok: present("RUNNER_PUBLIC_URL"),
    recovery: "deploy the runner and set RUNNER_PUBLIC_URL",
  },
  {
    name: "Bazantic",
    ok: ["BAZANTIC_GATEWAY_URL", "BAZANTIC_SERVICE_ID", "BAZANTIC_RECIPE_ID"].every(present),
    recovery: "register/activate the public OpenAPI service and Recipe, then copy returned IDs",
  },
  {
    name: "web deployment",
    ok: present("NEXT_PUBLIC_DEPLOYMENT_URL"),
    recovery: "deploy apps/web and set NEXT_PUBLIC_DEPLOYMENT_URL",
  },
  {
    name: "Sepolia reward demo evidence",
    ok: existsSync(rewardEvidencePath),
    recovery: "run pnpm deploy:reward-demo and record the public receipts",
  },
];

if (process.env.SEPOLIA_RPC_URL) {
  const client = createPublicClient({
    chain: sepolia,
    transport: http(process.env.SEPOLIA_RPC_URL, { timeout: 8_000 }),
  });
  try {
    const chainId = await client.getChainId();
    checks.find((check) => check.name === "Sepolia RPC")!.ok = chainId === sepolia.id;
    if (process.env.DEPLOYER_ADDRESS) {
      const balance = await client.getBalance({
        address: getAddress(process.env.DEPLOYER_ADDRESS),
      });
      checks.push({
        name: "Sepolia balance",
        ok: balance > 0n,
        recovery: "fund DEPLOYER_ADDRESS with Sepolia ETH",
      });
    }
    for (const name of [
      "CHALLENGE_REGISTRY_ADDRESS",
      "ARTIFACT_REGISTRY_ADDRESS",
      "ATTESTATION_ADDRESS",
      "PARETO_SETTLEMENT_ADDRESS",
    ] as const) {
      const value = process.env[name];
      if (value) {
        const code = await client.getCode({ address: getAddress(value) });
        checks.push({
          name: `${name} code`,
          ok: Boolean(code && code !== "0x"),
          recovery: `redeploy and correct ${name}`,
        });
      }
    }
    if (process.env.ENS_PARENT_NAME) {
      const manifest = await client.getEnsText({
        name: process.env.ENS_PARENT_NAME,
        key: "frontier.runners",
      });
      checks.find((check) => check.name === "ENSv2 parent")!.ok = Boolean(manifest);
    }
    if (existsSync(rewardEvidencePath)) {
      const evidence = JSON.parse(readFileSync(rewardEvidencePath, "utf8")) as {
        rewardPoolAddress: `0x${string}`;
        demoTokenAddress: `0x${string}`;
        transactions: { rewardPayout: `0x${string}` };
      };
      const [poolCode, tokenCode, payout] = await Promise.all([
        client.getCode({ address: getAddress(evidence.rewardPoolAddress) }),
        client.getCode({ address: getAddress(evidence.demoTokenAddress) }),
        client.getTransactionReceipt({ hash: evidence.transactions.rewardPayout }),
      ]);
      checks.find((check) => check.name === "Sepolia reward demo evidence")!.ok = Boolean(
        poolCode &&
        poolCode !== "0x" &&
        tokenCode &&
        tokenCode !== "0x" &&
        payout.status === "success",
      );
    }
  } catch {
    checks.find((check) => check.name === "Sepolia RPC")!.ok = false;
  }
}

for (const [name, urlName] of [
  ["Bazantic", "BAZANTIC_GATEWAY_URL"],
  ["web deployment", "NEXT_PUBLIC_DEPLOYMENT_URL"],
] as const) {
  const url = process.env[urlName];
  if (!url) continue;
  try {
    const response = await fetch(url, { method: "GET", signal: AbortSignal.timeout(8_000) });
    checks.find((check) => check.name === name)!.ok &&= response.status < 500;
  } catch {
    checks.find((check) => check.name === name)!.ok = false;
  }
}

for (const check of checks)
  process.stdout.write(
    `${check.ok ? "PASS" : "BLOCKED"} ${check.name}${check.ok ? "" : ` — ${check.recovery}`}\n`,
  );
const blocked = checks.filter((check) => !check.ok);
process.stdout.write(`\n${checks.length - blocked.length}/${checks.length} checks ready.\n`);
if (process.argv.includes("--strict") && blocked.length) process.exitCode = 1;
