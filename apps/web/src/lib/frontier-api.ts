import { CliAuthService, createDemoApi } from "@frontier/api";
import { EnsRunnerDirectory, ViemEnsRecordReader } from "@frontier/ens-adapter";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import benchmark from "../../../../benchmarks/evm-orderbook/results/latest.json";
import { createPlan5Store } from "@/lib/plan5-store";
import { createPlan6Store } from "@/lib/plan6-store";
import { createPrivyIdentityResolver } from "@/lib/privy-server";
import { createPlan5Settlement } from "@/lib/plan5-settlement";
import { createCliAuthStore } from "@/lib/cli-auth-store";

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

const identity = createPrivyIdentityResolver();
const settlement = createPlan5Settlement();
const cliAuthStore = createCliAuthStore();
const cliOrigin =
  process.env.FRONTIER_CLI_ORIGIN?.trim() ||
  (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : undefined);
const cliAuth = new CliAuthService({
  ...(cliAuthStore ? { store: cliAuthStore } : {}),
  ...(identity ? { identity } : {}),
  ...(cliOrigin ? { origin: cliOrigin } : {}),
});
const plan5 = {
  store: createPlan5Store(),
  ...(identity ? { identity } : {}),
  ...(settlement ? { settlement } : {}),
};
const plan6 = {
  cliAuth,
  store: createPlan6Store(),
  ...(identity ? { identity } : {}),
  ...(settlement ? { settlement } : {}),
};

export const frontierDemoApi =
  globalApi.frontierDemoApi ?? createDemoApi(benchmark, createRunnerDirectory(), plan5, plan6);

if (process.env.NODE_ENV !== "production") globalApi.frontierDemoApi = frontierDemoApi;
