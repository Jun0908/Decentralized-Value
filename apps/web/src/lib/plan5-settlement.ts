import "server-only";

import type { Plan5Settlement } from "@frontier/api";
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  keccak256,
  parseUnits,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const ownerAbi = [
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const tokenAbi = [
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const poolAbi = [
  ...ownerAbi,
  {
    inputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    name: "allocationCommitted",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "reserved",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes32", name: "challengeId", type: "bytes32" },
      { internalType: "bytes32", name: "resultRoot", type: "bytes32" },
      { internalType: "address[]", name: "recipients", type: "address[]" },
      { internalType: "uint256[]", name: "amounts", type: "uint256[]" },
    ],
    name: "commitAllocation",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes32", name: "challengeId", type: "bytes32" },
      { internalType: "address[]", name: "recipients", type: "address[]" },
    ],
    name: "distribute",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

function address(name: string): Address | null {
  const value = process.env[name];
  return value && /^0x[0-9a-fA-F]{40}$/.test(value) ? getAddress(value) : null;
}

function privateKey(): Hex | null {
  const raw = process.env.PLAN5_RELAYER_PRIVATE_KEY;
  if (!raw) return null;
  const value = `${raw.startsWith("0x") ? "" : "0x"}${raw}`;
  return /^0x[0-9a-fA-F]{64}$/.test(value) ? (value as Hex) : null;
}

export function createPlan5Settlement(): Plan5Settlement | undefined {
  if (process.env.PLAN5_SETTLEMENT_ENABLED !== "true") return undefined;
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  const key = privateKey();
  const pool = address("PLAN5_REWARD_POOL_ADDRESS");
  const token = address("PLAN5_DEMO_TOKEN_ADDRESS");
  const maxReward = process.env.PLAN5_MAX_REWARD_CREDITS;
  if (!rpcUrl || !key || !pool || !token || !maxReward || !/^\d+$/.test(maxReward)) {
    return undefined;
  }

  const account = privateKeyToAccount(key);
  const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: sepolia, transport: http(rpcUrl) });

  return async ({ participantId, recipient, amount: rewardCredits, resultHash }) => {
    if (rewardCredits <= 0n || rewardCredits > BigInt(maxReward))
      throw new Error("Reward exceeds the demo cap");
    const amount = parseUnits(rewardCredits.toString(), 18);
    if ((await publicClient.getChainId()) !== sepolia.id)
      throw new Error("Settlement RPC is not Sepolia");
    const poolOwner = await publicClient.readContract({
      address: pool,
      abi: poolAbi,
      functionName: "owner",
    });
    if (getAddress(poolOwner) !== account.address) {
      throw new Error("Configured Plan 5 relayer does not own the reward pool");
    }

    const challengeId = keccak256(stringToHex(`plan5:${participantId}`));
    const resultRoot = keccak256(
      stringToHex(
        `plan5:${participantId}:${recipient.toLowerCase()}:${rewardCredits}:${resultHash}`,
      ),
    );
    const committed = await publicClient.readContract({
      address: pool,
      abi: poolAbi,
      functionName: "allocationCommitted",
      args: [challengeId],
    });
    if (committed) throw new Error("This participant reward was already committed onchain");

    const [balance, reserved] = await Promise.all([
      publicClient.readContract({
        address: token,
        abi: tokenAbi,
        functionName: "balanceOf",
        args: [pool],
      }),
      publicClient.readContract({ address: pool, abi: poolAbi, functionName: "reserved" }),
    ]);
    if (balance < reserved || balance - reserved < amount)
      throw new Error("The finite Plan 5 demo reward pool is exhausted");

    const commitmentHash = await walletClient.writeContract({
      account,
      address: pool,
      abi: poolAbi,
      functionName: "commitAllocation",
      args: [challengeId, resultRoot, [recipient], [amount]],
    });
    await publicClient.waitForTransactionReceipt({ hash: commitmentHash });
    const transactionHash = await walletClient.writeContract({
      account,
      address: pool,
      abi: poolAbi,
      functionName: "distribute",
      args: [challengeId, [recipient]],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash });
    if (receipt.status !== "success") throw new Error("Sepolia reward transaction reverted");
    return {
      allocationRoot: resultRoot,
      transactionHash,
      blockNumber: receipt.blockNumber.toString(),
    };
  };
}
