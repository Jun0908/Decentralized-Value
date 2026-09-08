import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  parseEther,
  type Abi,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

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
  const output = JSON.parse(
    solc.compile(
      JSON.stringify({
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
      }),
      { import: imported },
    ),
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

function addProductionEnvironment(name: string, value: string, sensitive: boolean) {
  const args = [
    "exec",
    "vercel",
    "env",
    "add",
    name,
    "production",
    "--force",
    sensitive ? "--sensitive" : "--no-sensitive",
    "--yes",
  ];
  const result = spawnSync("pnpm", args, {
    cwd: resolve(import.meta.dirname, ".."),
    input: `${value}\n`,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error(`Could not configure Vercel environment ${name}: ${result.stderr}`);
  }
}

async function main() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  const rawPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
  const deployerKey = rawPrivateKey
    ? (`${rawPrivateKey.startsWith("0x") ? "" : "0x"}${rawPrivateKey}` as Hex)
    : undefined;
  if (!rpcUrl || !deployerKey || !/^0x[0-9a-fA-F]{64}$/.test(deployerKey)) {
    throw new Error("SEPOLIA_RPC_URL and a 32-byte DEPLOYER_PRIVATE_KEY are required");
  }

  const deployer = privateKeyToAccount(deployerKey);
  const relayerKey = generatePrivateKey();
  const relayer = privateKeyToAccount(relayerKey);
  const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
  const walletClient = createWalletClient({
    account: deployer,
    chain: sepolia,
    transport: http(rpcUrl),
  });
  if ((await publicClient.getChainId()) !== sepolia.id) throw new Error("RPC is not Sepolia");
  const deployerBalance = await publicClient.getBalance({ address: deployer.address });
  if (deployerBalance < parseEther("0.03")) {
    throw new Error(
      `Deployer needs at least 0.03 Sepolia ETH; current balance is ${formatEther(deployerBalance)}`,
    );
  }

  // Save the only copy of the new runtime key directly to Vercel before assigning ownership.
  addProductionEnvironment("PLAN5_RELAYER_PRIVATE_KEY", relayerKey, true);
  addProductionEnvironment("SEPOLIA_RPC_URL", rpcUrl, true);

  const { token, pool } = await compile();
  const tokenDeployHash = await walletClient.deployContract({
    abi: token.abi,
    bytecode: token.bytecode,
    args: [deployer.address],
  });
  const tokenReceipt = await publicClient.waitForTransactionReceipt({ hash: tokenDeployHash });
  if (!tokenReceipt.contractAddress) throw new Error("Demo token deployment returned no address");

  const poolDeployHash = await walletClient.deployContract({
    abi: pool.abi,
    bytecode: pool.bytecode,
    args: [relayer.address, tokenReceipt.contractAddress],
  });
  const poolReceipt = await publicClient.waitForTransactionReceipt({ hash: poolDeployHash });
  if (!poolReceipt.contractAddress) throw new Error("Reward pool deployment returned no address");

  const poolFunding = parseEther("100000");
  const fundingHash = await walletClient.writeContract({
    address: tokenReceipt.contractAddress,
    abi: token.abi,
    functionName: "mint",
    args: [poolReceipt.contractAddress, poolFunding],
  });
  await publicClient.waitForTransactionReceipt({ hash: fundingHash });
  const relayerFunding = parseEther("0.02");
  const relayerFundingHash = await walletClient.sendTransaction({
    to: relayer.address,
    value: relayerFunding,
  });
  await publicClient.waitForTransactionReceipt({ hash: relayerFundingHash });

  const [poolOwner, poolBalance, relayerBalance] = await Promise.all([
    publicClient.readContract({
      address: poolReceipt.contractAddress,
      abi: pool.abi,
      functionName: "owner",
    }),
    publicClient.readContract({
      address: tokenReceipt.contractAddress,
      abi: token.abi,
      functionName: "balanceOf",
      args: [poolReceipt.contractAddress],
    }),
    publicClient.getBalance({ address: relayer.address }),
  ]);
  if (
    poolOwner !== relayer.address ||
    poolBalance !== poolFunding ||
    relayerBalance < relayerFunding
  ) {
    throw new Error("Plan 5 reward deployment verification failed");
  }

  addProductionEnvironment("PLAN5_REWARD_POOL_ADDRESS", poolReceipt.contractAddress, false);
  addProductionEnvironment("PLAN5_DEMO_TOKEN_ADDRESS", tokenReceipt.contractAddress, false);
  addProductionEnvironment("PLAN5_MAX_REWARD_CREDITS", "10000", false);
  addProductionEnvironment("PLAN5_SETTLEMENT_ENABLED", "true", false);

  process.stdout.write(
    `${JSON.stringify(
      {
        chainId: sepolia.id,
        deployer: deployer.address,
        relayer: relayer.address,
        demoTokenAddress: tokenReceipt.contractAddress,
        rewardPoolAddress: poolReceipt.contractAddress,
        poolFunding: poolFunding.toString(),
        relayerFunding: relayerFunding.toString(),
        transactions: {
          tokenDeployment: tokenDeployHash,
          poolDeployment: poolDeployHash,
          poolFunding: fundingHash,
          relayerFunding: relayerFundingHash,
        },
      },
      null,
      2,
    )}\n`,
  );
}

await main();
