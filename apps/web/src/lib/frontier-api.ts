import { createDemoApi } from "@frontier/api";
import { EnsRunnerDirectory, ViemEnsRecordReader } from "@frontier/ens-adapter";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import benchmark from "../../../../benchmarks/evm-orderbook/results/latest.json";

function createRunnerDirectory() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  const parentName = process.env.ENS_PARENT_NAME;
  if (!rpcUrl || !parentName) return undefined;

  return new EnsRunnerDirectory(
    new ViemEnsRecordReader(createPublicClient({ chain: sepolia, transport: http(rpcUrl) })),
    `runners.${parentName}`,
  );
}

const globalApi = globalThis as typeof globalThis & {
  frontierDemoApi?: ReturnType<typeof createDemoApi>;
};

export const frontierDemoApi =
  globalApi.frontierDemoApi ?? createDemoApi(benchmark, createRunnerDirectory());

if (process.env.NODE_ENV !== "production") globalApi.frontierDemoApi = frontierDemoApi;
