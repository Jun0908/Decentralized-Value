import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  parseEther,
  stringToHex,
  type Abi,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { replayEmergencySupplyAgents } from "../packages/emergency-supply/src/index";

type SolcOutput = {
  contracts?: Record<string, Record<string, { abi: Abi; evm: { bytecode: { object: string } } }>>;
  errors?: { severity: "error" | "warning"; formattedMessage: string }[];
};

type Solc = {
  compile(
    input: string,
    callbacks: { import: (path: string) => { contents?: string; error?: string } },
  ): string;
};

const contractsRoot = resolve(import.meta.dirname, "../packages/contracts");
const sourceRoot = resolve(contractsRoot, "src");
const deploymentEvidencePath = resolve(
  import.meta.dirname,
  "../Docs/evidence/deployments/sepolia-reward-demo.json",
);

function source(name: string) {
  return readFileSync(resolve(sourceRoot, name), "utf8");
}

function imported(path: string) {
  for (const candidate of [
    resolve(contractsRoot, path),
    resolve(contractsRoot, "node_modules", path),
  ]) {
    try {
      return { contents: readFileSync(candidate, "utf8") };
    } catch {
      // Try the next deterministic import root.
    }
  }
  return { error: `Import not found: ${path}` };
}

async function compile() {
  const solc = (await import("solc")).default as Solc;
  const input = {
    language: "Solidity",
    sources: {
      "FrontierDemoToken.sol": { content: source("FrontierDemoToken.sol") },
      "FrontierRewardPool.sol": { content: source("FrontierRewardPool.sol") },
    },
    settings: {
      evmVersion: "cancun",
      optimizer: { enabled: true, runs: 200 },
      metadata: { appendCBOR: false, bytecodeHash: "none" },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const output = JSON.parse(
    solc.compile(JSON.stringify(input), { import: imported }),
  ) as SolcOutput;
  const failures = output.errors?.filter(({ severity }) => severity === "error") ?? [];
  if (failures.length > 0) {
    throw new Error(failures.map(({ formattedMessage }) => formattedMessage).join("\n"));
  }
  const token = output.contracts?.["FrontierDemoToken.sol"]?.FrontierDemoToken;
  const pool = output.contracts?.["FrontierRewardPool.sol"]?.FrontierRewardPool;
  if (!token?.evm.bytecode.object || !pool?.evm.bytecode.object) {
    throw new Error("Solidity compiler returned no deployable bytecode");
  }
  return {
    token: { abi: token.abi, bytecode: `0x${token.evm.bytecode.object}` as Hex },
    pool: { abi: pool.abi, bytecode: `0x${pool.evm.bytecode.object}` as Hex },
  };
}

async function main() {
  const { token, pool } = await compile();
  if (process.argv.includes("--compile-only")) {
    process.stdout.write("Reward demo contracts compiled with solc 0.8.30.\n");
    return;
  }
  if (existsSync(deploymentEvidencePath) && !process.argv.includes("--force")) {
    throw new Error(
      "A Sepolia reward demo is already recorded. Pass --force only when a deliberate replacement is required.",
    );
  }
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  const rawPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
  const privateKey = rawPrivateKey
    ? (`${rawPrivateKey.startsWith("0x") ? "" : "0x"}${rawPrivateKey}` as Hex)
    : undefined;
  if (!rpcUrl || !privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("SEPOLIA_RPC_URL and a 32-byte DEPLOYER_PRIVATE_KEY are required");
  }

  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: sepolia, transport: http(rpcUrl) });
  if ((await publicClient.getChainId()) !== sepolia.id) throw new Error("RPC is not Sepolia");

  const tokenDeployHash = await walletClient.deployContract({
    abi: token.abi,
    bytecode: token.bytecode,
    args: [account.address],
  });
  const tokenReceipt = await publicClient.waitForTransactionReceipt({ hash: tokenDeployHash });
  if (!tokenReceipt.contractAddress) throw new Error("Demo token deployment returned no address");

  const poolDeployHash = await walletClient.deployContract({
    abi: pool.abi,
    bytecode: pool.bytecode,
    args: [account.address, tokenReceipt.contractAddress],
  });
  const poolReceipt = await publicClient.waitForTransactionReceipt({ hash: poolDeployHash });
  if (!poolReceipt.contractAddress) throw new Error("Reward pool deployment returned no address");

  const amount = parseEther("10000");
  const mintHash = await walletClient.writeContract({
    address: tokenReceipt.contractAddress,
    abi: token.abi,
    functionName: "mint",
    args: [poolReceipt.contractAddress, amount],
  });
  await publicClient.waitForTransactionReceipt({ hash: mintHash });

  const replay = replayEmergencySupplyAgents();
  const challengeId = keccak256(stringToHex("emergency-supply-v1"));
  const allocationHash = await walletClient.writeContract({
    address: poolReceipt.contractAddress,
    abi: pool.abi,
    functionName: "commitAllocation",
    args: [challengeId, replay.replayHash, [account.address], [amount]],
  });
  await publicClient.waitForTransactionReceipt({ hash: allocationHash });

  const balanceBefore = (await publicClient.readContract({
    address: tokenReceipt.contractAddress,
    abi: token.abi,
    functionName: "balanceOf",
    args: [account.address],
  })) as bigint;
  const payoutHash = await walletClient.writeContract({
    address: poolReceipt.contractAddress,
    abi: pool.abi,
    functionName: "distribute",
    args: [challengeId, [account.address]],
  });
  const payoutReceipt = await publicClient.waitForTransactionReceipt({ hash: payoutHash });
  const balanceAfter = (await publicClient.readContract({
    address: tokenReceipt.contractAddress,
    abi: token.abi,
    functionName: "balanceOf",
    args: [account.address],
  })) as bigint;
  if (balanceAfter - balanceBefore !== amount) {
    throw new Error("Recipient balance did not increase by the committed amount");
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        chainId: sepolia.id,
        challengeId,
        resultRoot: replay.replayHash,
        rewardPoolAddress: poolReceipt.contractAddress,
        demoTokenAddress: tokenReceipt.contractAddress,
        recipient: account.address,
        rewardAmount: amount.toString(),
        balanceBefore: balanceBefore.toString(),
        balanceAfter: balanceAfter.toString(),
        deploymentTransactions: {
          token: tokenDeployHash,
          rewardPool: poolDeployHash,
          funding: mintHash,
        },
        allocationTransaction: allocationHash,
        payoutTransaction: payoutHash,
        payoutBlockNumber: payoutReceipt.blockNumber.toString(),
      },
      null,
      2,
    )}\n`,
  );
}

await main();
