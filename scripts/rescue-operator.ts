import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { config } from "dotenv";
import { createPublicClient, http, parseEther, parseGwei, type Hex, type PublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import {
  buildRescueRunPaymentEvidence,
  createRescuePracticeSession,
  publicRescueRoomScenario,
  rescueCommanderStarterPlaybook,
  rescuePublicViewHash,
  rescueServiceManifestHash,
  type RescuePaymentPolicy,
  type RescuePaymentPurchase,
} from "../packages/rescue-room/src/index";
import { rescueServiceExecutionHash } from "../packages/rescue-room/src/service-execution";
import {
  createLocalRescueJobStore,
  runRescueJob,
  type RescueJobJson,
} from "../apps/api/src/rescue-jobs";
import {
  rescueServiceWorkflowRequestSchema,
  toPublicRescueJob,
} from "../apps/api/src/rescue-jobs-http";
import {
  createRescuePaymentExecutor,
  type RescuePaymentOperation,
} from "../apps/api/src/rescue-payment-executor";
import { createRescuePaymentFileStore } from "../apps/api/src/rescue-payment-executor-store";
import { createRescuePaymentViemChain } from "../apps/api/src/rescue-payment-executor-viem";
import {
  runOpenAiRescueCommanderHire,
  runOpenAiRescueServiceAgent,
  rescueServiceAgentLimits,
} from "../apps/api/src/rescue-service-agent";
import {
  runRescueServiceWorkflow,
  rescueServiceWorkflowContextHash,
  type RescueWorkflowPayments,
  type RescueWorkflowReceipt,
} from "../apps/api/src/rescue-service-workflow";
import {
  persistNewJson,
  type RescueOperatorKeys,
  type deployRescueOperator,
} from "./lib/rescue-operator-chain";
import { withRescueModelBudget } from "./lib/rescue-model-budget";

const root = resolve(import.meta.dirname, "..");
const directory = resolve(root, ".frontier/rescue-operator");
const ownerId = "local-rescue-operator";
export const rescueOperatorJobStore = createLocalRescueJobStore({
  directory: resolve(directory, "jobs"),
});
const store = rescueOperatorJobStore;
const command = process.argv[2] ?? "status";
const now = () => Math.floor(Date.now() / 1000);

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8")) as T;
}
function publicJob(job: Awaited<ReturnType<typeof store.list>>[number]) {
  return {
    jobId: job.jobId,
    status: job.status,
    revision: job.revision,
    failureCode: job.failureCode,
    episodeId: job.request.episodeId,
    events: toPublicRescueJob(job).events,
    result: job.result,
  };
}

async function withOperator<T>(
  run: (context: {
    deployment: Awaited<ReturnType<typeof deployRescueOperator>>;
    client: PublicClient;
    executor: ReturnType<typeof createRescuePaymentExecutor>;
  }) => Promise<T>,
) {
  if (!process.argv.includes("--execute-approved-sepolia"))
    throw new Error("EXPLICIT_SEPOLIA_EXECUTION_FLAG_REQUIRED");
  mkdirSync(directory, { recursive: true });
  const lockPath = resolve(directory, "operator.lock");
  const lock = openSync(lockPath, "wx", 0o600);
  try {
    config({
      path: resolve(root, existsSync(resolve(root, ".env.local")) ? ".env.local" : ".env"),
      quiet: true,
    });
    if (!process.env.SEPOLIA_RPC_URL) throw new Error("RPC_UNAVAILABLE");
    const deployment = readJson<Awaited<ReturnType<typeof deployRescueOperator>>>(
      resolve(directory, "deployment.json"),
    );
    if (deployment.chainId !== sepolia.id || deployment.evidenceState !== "committed")
      throw new Error("DEPLOYMENT_UNVERIFIED");
    const keys = readJson<RescueOperatorKeys>(
      resolve(root, "secrets/rescue-operator-wallets.json"),
    );
    const client = createPublicClient({
      chain: sepolia,
      transport: http(process.env.SEPOLIA_RPC_URL, { retryCount: 0, timeout: 15_000 }),
    }) as PublicClient;
    if ((await client.getChainId()) !== sepolia.id) throw new Error("NOT_SEPOLIA");
    const executor = createRescuePaymentExecutor({
      store: createRescuePaymentFileStore(resolve(directory, "payments")),
      chain: createRescuePaymentViemChain({
        publicClient: client,
        accounts: {
          commander: privateKeyToAccount(keys.commander),
          policyExecutor: privateKeyToAccount(keys.executor),
          deliveryAttestor: privateKeyToAccount(keys.attestor),
        },
        expectedTokenCodeHash: deployment.token.codeHash,
        expectedEscrowCodeHash: deployment.escrow.codeHash,
      }),
      limits: {
        maximumTotalFeeWei: String(parseEther("0.25")),
        maximumTransactionFeeWei: String(parseEther("0.005")),
        maximumGas: "500000",
        maximumFeePerGasWei: String(parseGwei("10")),
        maximumPriorityFeePerGasWei: String(parseGwei("2")),
        requiredConfirmations: 2,
      },
    });
    return await run({ deployment, client, executor });
  } finally {
    closeSync(lock);
    unlinkSync(lockPath);
  }
}

function policy(
  deployment: Awaited<ReturnType<typeof deployRescueOperator>>,
  purchase: RescuePaymentPurchase,
  window: { from: number; until: number },
): RescuePaymentPolicy {
  return {
    schemaVersion: "rescue-payment-policy-v0",
    chainId: 11155111,
    tokenAddress: deployment.token.address,
    escrowAddress: deployment.escrow.address,
    commanderWallet: deployment.commander,
    evaluationContextHash: rescueServiceWorkflowContextHash,
    episodeHash: purchase.order.episodeHash,
    maximumOrderAmount: "50000000",
    maximumEpisodeAmount: "100000000",
    validFromUnixSeconds: window.from,
    validUntilUnixSeconds: window.until,
    maximumOrderLifetimeSeconds: 7200,
    services: Object.entries(deployment.providers).map(([serviceId, providerAddress]) => ({
      serviceId: serviceId as RescuePaymentPurchase["order"]["serviceId"],
      providerAddress,
      serviceManifestHash: rescueServiceManifestHash(
        serviceId as RescuePaymentPurchase["order"]["serviceId"],
      ),
    })),
  };
}

async function confirmed(
  executor: ReturnType<typeof createRescuePaymentExecutor>,
  key: Hex,
  operation: RescuePaymentOperation,
): Promise<RescueWorkflowReceipt> {
  const limit = Date.now() + 180_000;
  while (Date.now() < limit) {
    const tx = await executor.execute(key, operation, now());
    if (tx.status === "reverted") throw new Error("PAYMENT_REVERTED");
    if (tx.status === "confirmed" && tx.receipt?.verifiedEvent)
      return {
        transactionHash: tx.transactionHash,
        blockNumber: tx.receipt.blockNumber,
        state: "confirmed",
        verifiedEvent: true,
        recipientBalanceAfter: tx.receipt.recipientBalanceAfter ?? null,
      };
    await delay(8_000);
  }
  throw new Error("PAYMENT_CONFIRMATION_UNCERTAIN");
}

export async function runLiveRescueOperator(jobId?: string) {
  return withOperator(async ({ deployment, executor }) => {
    const supplied = jobId ? await store.get(ownerId, jobId) : null;
    if (jobId && !supplied) throw new Error("UNKNOWN_OPERATOR_JOB");
    const request = supplied
      ? rescueServiceWorkflowRequestSchema.parse(supplied.request)
      : {
          schemaVersion: "rescue-service-workflow-request-v0",
          episodeId: publicRescueRoomScenario().episodes[0]!.id,
          playbook: {
            ...rescueCommanderStarterPlaybook,
            instructions:
              "Investigate the ambiguous alert with a low-cost initial monitoring purchase if useful. Prefer pulse-monitor for the first observation. Stay within the authorized budget; close without a purchase if investigation is not justified.",
          },
        };
    const episodeId = request.episodeId;
    const { job } = supplied
      ? { job: supplied }
      : await store.create({
          ownerId,
          idempotencyKey: "first-live-service-v1",
          request,
        });
    if (job.status !== "queued") return publicJob(job);
    const windowFile = resolve(directory, `${job.jobId}.window.json`);
    if (!existsSync(windowFile))
      persistNewJson(windowFile, { from: now() - 60, until: now() + 7200, deadline: now() + 3600 });
    const window = readJson<{ from: number; until: number; deadline: number }>(windowFile);
    const payments: RescueWorkflowPayments = {
      mode: "sepolia",
      async reserve(purchase) {
        const record = await executor.reserve(
          policy(deployment, purchase, window),
          purchase,
          now(),
        );
        return { key: record.key, providerAddress: record.intent.args.provider };
      },
      async fund(key) {
        await confirmed(executor, key, { kind: "approve" });
        return confirmed(executor, key, { kind: "fund" });
      },
      async deliverAndRelease(key, evidence) {
        const delivery = await confirmed(executor, key, {
          kind: "recordDelivery",
          deliverableHash: evidence.deliverableHash,
          receiptHash: evidence.receiptHash,
        });
        const release = await confirmed(executor, key, { kind: "release", ...evidence });
        return { delivery, release };
      },
    };
    const completed = await runRescueJob({
      store,
      ownerId,
      jobId: job.jobId,
      workerId: "local-operator-cli",
      execute: async ({ recordEvent }) => {
        const result = await runRescueServiceWorkflow({
          episodeId,
          playbook: request.playbook,
          deadlineUnixSeconds: window.deadline,
          commander: (req) =>
            withRescueModelBudget(
              resolve(directory, "model-budget"),
              `commander-${job.jobId.slice(5)}`,
              rescueServiceExecutionHash({ request: req, limits: rescueServiceAgentLimits }),
              () => runOpenAiRescueCommanderHire(req),
            ),
          specialist: (req) =>
            withRescueModelBudget(
              resolve(directory, "model-budget"),
              `specialist-${job.jobId.slice(5)}`,
              rescueServiceExecutionHash({ request: req, limits: rescueServiceAgentLimits }),
              () => runOpenAiRescueServiceAgent(req),
            ),
          payments,
          recordEvent,
        });
        persistNewJson(resolve(directory, `${job.jobId}.evidence.json`), result);
        return JSON.parse(JSON.stringify(result)) as RescueJobJson;
      },
    });
    return publicJob(completed);
  });
}

async function runRefund() {
  return withOperator(async ({ deployment, executor, client }) => {
    const evidencePath = resolve(directory, "refund-evidence.json");
    if (existsSync(evidencePath)) return readJson(evidencePath);
    const fixturePath = resolve(directory, "refund-purchase.json");
    if (!existsSync(fixturePath)) {
      const episodeId = publicRescueRoomScenario().episodes[1]!.id;
      const session = createRescuePracticeSession(episodeId, rescueCommanderStarterPlaybook);
      const view = session.getPublicView();
      const action = { type: "BUY_SERVICE", serviceId: "pulse-monitor" } as const;
      if (!session.takeAction(action).accepted) throw new Error("REFUND_FIXTURE_ACTION_REJECTED");
      const outcome = session.finish();
      const order = buildRescueRunPaymentEvidence(outcome, rescueServiceWorkflowContextHash)
        .orders[0]!;
      const purchase: RescuePaymentPurchase = {
        accepted: true,
        action,
        decision: 1,
        publicViewHash: rescuePublicViewHash(view),
        order,
        policyNonce: "0",
        deadlineUnixSeconds: now() + 180,
      };
      persistNewJson(fixturePath, {
        episodeId,
        purchase,
        window: { from: now() - 60, until: now() + 7200 },
      });
    }
    const saved = readJson<{
      episodeId: string;
      purchase: RescuePaymentPurchase;
      window: { from: number; until: number };
    }>(fixturePath);
    const record = await executor.reserve(
      policy(deployment, saved.purchase, saved.window),
      saved.purchase,
      now(),
    );
    await confirmed(executor, record.key, { kind: "approve" });
    const funding = await confirmed(executor, record.key, { kind: "fund" });
    while (Number((await client.getBlock()).timestamp) <= saved.purchase.deadlineUnixSeconds)
      await delay(8_000);
    const refund = await confirmed(executor, record.key, { kind: "refundExpired" });
    const evidence = {
      schemaVersion: "rescue-sepolia-refund-verification-v1",
      network: "sepolia",
      chainId: 11155111,
      intentionalNonDeliveryTest: true,
      modelCalled: false,
      paymentState: "refunded",
      episodeId: saved.episodeId,
      orderId: saved.purchase.order.orderId,
      amountTokenBaseUnits: record.intent.args.amount,
      funding,
      refund,
    };
    persistNewJson(evidencePath, evidence);
    return evidence;
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result =
      command === "run"
        ? await runLiveRescueOperator(
            process.argv.includes("--job")
              ? process.argv[process.argv.indexOf("--job") + 1]
              : undefined,
          )
        : command === "refund-test"
          ? await runRefund()
          : command === "status"
            ? {
                deployment: existsSync(resolve(directory, "deployment.json"))
                  ? readJson(resolve(directory, "deployment.json"))
                  : null,
                jobs: (await store.list(ownerId)).map(publicJob),
                refund: existsSync(resolve(directory, "refund-evidence.json"))
                  ? readJson(resolve(directory, "refund-evidence.json"))
                  : null,
              }
            : null;
    if (result === null) throw new Error("UNKNOWN_OPERATOR_COMMAND");
    console.log(JSON.stringify(result, null, 2));
    if (
      typeof result === "object" &&
      "status" in result &&
      result.status === "needs-reconciliation"
    )
      process.exitCode = 1;
  } catch {
    console.error(
      "Rescue operator stopped. Inspect persisted job status/journal; no automatic retry of uncertain model or payment effects.",
    );
    process.exitCode = 1;
  }
}
