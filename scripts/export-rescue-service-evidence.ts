import {
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { config } from "dotenv";
import {
  createPublicClient,
  erc20Abi,
  formatUnits,
  http,
  keccak256,
  parseEventLogs,
  type Hex,
} from "viem";
import { sepolia } from "viem/chains";
import { createLocalRescueJobStore } from "../apps/api/src/rescue-jobs";
import { rescuePaymentExecutorEscrowAbi } from "../apps/api/src/rescue-payment-executor-viem";
import { rescueServices } from "../packages/rescue-room/src/index";
import { replayRescueServiceAnalysis } from "../packages/rescue-room/src/service-execution";
import type { runRescueServiceWorkflow } from "../apps/api/src/rescue-service-workflow";
import { replayRescueServiceWorkflow } from "../apps/api/src/rescue-service-workflow";
import { rescueServiceWorkflowRequestSchema } from "../apps/api/src/rescue-jobs-http";
import type { deployRescueOperator } from "./lib/rescue-operator-chain";
import { rescueOperatorPublicEvidenceSchema } from "../apps/web/src/lib/rescue-operator-public";

const root = resolve(import.meta.dirname, "..");
const directory = resolve(root, ".frontier/rescue-operator");
const load = <T>(file: string): T =>
  JSON.parse(readFileSync(resolve(directory, file), "utf8")) as T;
try {
  config({
    path: resolve(root, existsSync(resolve(root, ".env.local")) ? ".env.local" : ".env"),
    quiet: true,
  });
  if (!process.env.SEPOLIA_RPC_URL) throw new Error("RPC_UNAVAILABLE");
  const deployment = load<Awaited<ReturnType<typeof deployRescueOperator>>>("deployment.json");
  const client = createPublicClient({
    chain: sepolia,
    transport: http(process.env.SEPOLIA_RPC_URL, { retryCount: 0 }),
  });
  if ((await client.getChainId()) !== sepolia.id) throw new Error("WRONG_NETWORK");
  const [tokenCode, escrowCode] = await Promise.all([
    client.getCode({ address: deployment.token.address }),
    client.getCode({ address: deployment.escrow.address }),
  ]);
  if (
    !tokenCode ||
    !escrowCode ||
    keccak256(tokenCode) !== deployment.token.codeHash ||
    keccak256(escrowCode) !== deployment.escrow.codeHash
  )
    throw new Error("DEPLOYMENT_CODE_CHANGED");
  const jobs = await createLocalRescueJobStore({ directory: resolve(directory, "jobs") }).list(
    "local-rescue-operator",
  );
  const job = jobs.find(
    (job) =>
      job.status === "succeeded" &&
      job.result &&
      typeof job.result === "object" &&
      !Array.isArray(job.result) &&
      job.result.status === "service-purchased",
  );
  const result = job?.result as Awaited<ReturnType<typeof runRescueServiceWorkflow>> | undefined;
  const readReceipt = async (hash: Hex) => {
    const receipt = await client.waitForTransactionReceipt({
      hash,
      confirmations: 2,
      timeout: 30_000,
    });
    if (
      receipt.status !== "success" ||
      receipt.to?.toLowerCase() !== deployment.escrow.address.toLowerCase()
    )
      throw new Error("INVALID_ESCROW_RECEIPT");
    return receipt;
  };
  let purchase = null;
  if (result?.status === "service-purchased") {
    if (
      result.paymentState !== "paid" ||
      result.commander.runtime.provider !== "openai" ||
      result.specialist.runtime.provider !== "openai"
    )
      throw new Error("NOT_REAL_MODEL_PAYMENT_EVIDENCE");
    replayRescueServiceAnalysis(result.serviceRequest, result.specialist.delivery);
    await replayRescueServiceWorkflow(
      rescueServiceWorkflowRequestSchema.parse(job!.request),
      result,
    );
    const [funded, delivered, released] = await Promise.all([
      readReceipt(result.payment.funding.transactionHash),
      readReceipt(result.payment.delivery.transactionHash),
      readReceipt(result.payment.release.transactionHash),
    ]);
    const amount = BigInt(result.purchase.order.amountCredits) * 1_000_000n;
    const escrowEvents = (logs: typeof released.logs) =>
      parseEventLogs({
        abi: rescuePaymentExecutorEscrowAbi,
        logs: logs.filter(
          (l) => l.address.toLowerCase() === deployment.escrow.address.toLowerCase(),
        ),
        strict: true,
      });
    if (
      !escrowEvents(funded.logs).some(
        (e) =>
          e.eventName === "ServiceOrderFunded" &&
          e.args.orderId === result.purchase.order.orderId &&
          e.args.amount === amount &&
          e.args.provider.toLowerCase() === result.providerAddress.toLowerCase() &&
          e.args.commander.toLowerCase() === deployment.commander.toLowerCase() &&
          e.args.token.toLowerCase() === deployment.token.address.toLowerCase(),
      ) ||
      !escrowEvents(delivered.logs).some(
        (e) =>
          e.eventName === "ServiceDeliverableRecorded" &&
          e.args.orderId === result.purchase.order.orderId &&
          e.args.deliverableHash === result.specialist.delivery.deliveryHash &&
          e.args.receiptHash === result.actualServiceReceiptHash,
      ) ||
      !escrowEvents(released.logs).some(
        (e) =>
          e.eventName === "ServicePaymentReleased" &&
          e.args.orderId === result.purchase.order.orderId &&
          e.args.acceptanceHash === result.actualServiceAcceptanceHash &&
          e.args.amount === amount &&
          e.args.provider.toLowerCase() === result.providerAddress.toLowerCase(),
      )
    )
      throw new Error("PAYMENT_EVENT_MISMATCH");
    const transfers = parseEventLogs({
      abi: erc20Abi,
      logs: released.logs.filter(
        (l) => l.address.toLowerCase() === deployment.token.address.toLowerCase(),
      ),
      eventName: "Transfer",
      strict: true,
    });
    if (
      !transfers.some(
        (e) =>
          e.args.from.toLowerCase() === deployment.escrow.address.toLowerCase() &&
          e.args.to.toLowerCase() === result.providerAddress.toLowerCase() &&
          e.args.value === amount,
      )
    )
      throw new Error("PROVIDER_TRANSFER_MISSING");
    const balance = await client.readContract({
      address: deployment.token.address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [result.providerAddress as Hex],
      blockNumber: released.blockNumber,
    });
    const block = await client.getBlock({ blockNumber: released.blockNumber });
    if (
      block.hash !== released.blockHash ||
      block.timestamp > BigInt(result.purchase.deadlineUnixSeconds) ||
      balance < amount
    )
      throw new Error("PAYMENT_BALANCE_OR_DEADLINE_MISMATCH");
    const usage = [result.commander.runtime.usage, result.specialist.runtime.usage].reduce(
      (sum, u) => ({
        inputTokens: sum.inputTokens + u.inputTokens,
        outputTokens: sum.outputTokens + u.outputTokens,
      }),
      { inputTokens: 0, outputTokens: 0 },
    );
    purchase = {
      serviceName: rescueServices.find((s) => s.id === result.purchase.order.serviceId)!.name,
      providerAddress: result.providerAddress,
      amount: formatUnits(amount, 6),
      commanderReason: result.commander.decision.decision.reasonCode,
      observation: result.publicView.observations.map((o) => o.headline).join(" / "),
      serviceSummary: result.specialist.delivery.analysis.summary,
      recommendation: result.specialist.delivery.analysis.recommendation,
      deliveryHash: result.specialist.delivery.deliveryHash,
      receiptHash: result.actualServiceReceiptHash,
      acceptanceHash: result.actualServiceAcceptanceHash,
      model: result.specialist.runtime.configuredModel,
      ...usage,
      estimatedModelCostUsd: (usage.inputTokens * 0.2 + usage.outputTokens * 1.2) / 1_000_000,
      fundingTx: funded.transactionHash,
      deliveryTx: delivered.transactionHash,
      releaseTx: released.transactionHash,
      providerBalanceAfter: formatUnits(balance, 6),
    };
  }
  let refund = null;
  if (existsSync(resolve(directory, "refund-evidence.json"))) {
    const saved = load<{
      orderId: Hex;
      amountTokenBaseUnits: string;
      refund: { transactionHash: Hex };
      funding: { transactionHash: Hex };
    }>("refund-evidence.json");
    const [receipt, funded] = await Promise.all([
      readReceipt(saved.refund.transactionHash),
      readReceipt(saved.funding.transactionHash),
    ]);
    const fundedEvents = parseEventLogs({
      abi: rescuePaymentExecutorEscrowAbi,
      logs: funded.logs.filter(
        (l) => l.address.toLowerCase() === deployment.escrow.address.toLowerCase(),
      ),
      eventName: "ServiceOrderFunded",
      strict: true,
    });
    if (
      !fundedEvents.some(
        (e) =>
          e.args.orderId === saved.orderId &&
          e.args.commander.toLowerCase() === deployment.commander.toLowerCase() &&
          e.args.token.toLowerCase() === deployment.token.address.toLowerCase() &&
          e.args.amount === BigInt(saved.amountTokenBaseUnits),
      )
    )
      throw new Error("REFUND_FUNDING_EVENT_MISMATCH");
    const events = parseEventLogs({
      abi: rescuePaymentExecutorEscrowAbi,
      logs: receipt.logs.filter(
        (l) => l.address.toLowerCase() === deployment.escrow.address.toLowerCase(),
      ),
      eventName: "ServicePaymentRefunded",
      strict: true,
    });
    if (
      !events.some(
        (e) =>
          e.args.orderId === saved.orderId &&
          e.args.commander.toLowerCase() === deployment.commander.toLowerCase() &&
          e.args.amount === BigInt(saved.amountTokenBaseUnits),
      )
    )
      throw new Error("REFUND_EVENT_MISMATCH");
    const transfers = parseEventLogs({
      abi: erc20Abi,
      logs: receipt.logs.filter(
        (l) => l.address.toLowerCase() === deployment.token.address.toLowerCase(),
      ),
      eventName: "Transfer",
      strict: true,
    });
    if (
      !transfers.some(
        (e) =>
          e.args.from.toLowerCase() === deployment.escrow.address.toLowerCase() &&
          e.args.to.toLowerCase() === deployment.commander.toLowerCase() &&
          e.args.value === BigInt(saved.amountTokenBaseUnits),
      )
    )
      throw new Error("REFUND_TRANSFER_MISMATCH");
    const balance = await client.readContract({
      address: deployment.token.address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [deployment.commander],
      blockNumber: receipt.blockNumber,
    });
    refund = {
      amount: formatUnits(BigInt(saved.amountTokenBaseUnits), 6),
      fundingTx: funded.transactionHash,
      refundTx: receipt.transactionHash,
      commanderBalanceAfter: formatUnits(balance, 6),
    };
  }
  const evidence = rescueOperatorPublicEvidenceSchema.parse({
    verifiedAt: new Date().toISOString(),
    deployment: {
      tokenAddress: deployment.token.address,
      escrowAddress: deployment.escrow.address,
      commanderAddress: deployment.commander,
    },
    purchase,
    refund,
  });
  const destination = resolve(root, "Docs/evidence/deployments/sepolia-rescue-service-demo.json");
  const temporary = `${destination}.${randomUUID()}.tmp`;
  const fd = openSync(temporary, "wx", 0o600);
  try {
    writeFileSync(fd, `${JSON.stringify(evidence, null, 2)}\n`);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(temporary, destination);
  console.log(
    JSON.stringify({
      status: "verified",
      purchase: purchase !== null,
      refund: refund !== null,
      modelEstimatedCostUsd: purchase?.estimatedModelCostUsd ?? null,
    }),
  );
} catch {
  console.error(
    "Public evidence export stopped: chain, model, delivery, or receipt verification failed. No evidence was replaced.",
  );
  process.exitCode = 1;
}
