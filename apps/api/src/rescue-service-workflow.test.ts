import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { publicRescueRoomScenario, rescueCommanderStarterPlaybook } from "@frontier/rescue-room";
import { createLocalRescueJobStore, runRescueJob, type RescueJobJson } from "./rescue-jobs";
import {
  executeRescueCommanderHire,
  executeRescueServiceAgent,
  type RescueAgentModel,
} from "./rescue-service-agent";
import {
  runRescueServiceWorkflow,
  replayRescueServiceWorkflow,
  type RescueWorkflowPayments,
} from "./rescue-service-workflow";

const hash = `0x${"1".repeat(64)}` as const;
const model: RescueAgentModel = async (request) => {
  const input = JSON.parse(request.input);
  const output =
    request.role === "commander-hire"
      ? {
          action: { type: "BUY_SERVICE", serviceId: "pulse-monitor" },
          reasonCode: "purchase-initial-monitoring",
          confidencePpm: 400_000,
        }
      : {
          requestHash: input.requestHash,
          assessment: "inconclusive",
          likelyAffectedModule: null,
          confidencePpm: 200_000,
          evidenceRefs: [input.evidenceRefs[0]],
          recommendation: "seek-second-opinion",
          summary:
            "Unusual activity warrants investigation, but these observations do not prove an exploit.",
        };
  return {
    rawOutput: JSON.stringify(output),
    provider: "injected-test-model",
    configuredModel: "test-only",
    responseIds: [],
    usage: { requests: 1, inputTokens: 10, outputTokens: 10, totalTokens: 20 },
  };
};
const confirmed = {
  transactionHash: hash,
  blockNumber: "1",
  state: "confirmed" as const,
  verifiedEvent: true as const,
  recipientBalanceAfter: "5000000",
};
function fixture() {
  const events: string[] = [];
  const payments: RescueWorkflowPayments = {
    mode: "isolated-local-test",
    reserve: vi.fn(async () => ({ key: hash, providerAddress: `0x${"2".repeat(40)}` })),
    fund: vi.fn(async () => confirmed),
    deliverAndRelease: vi.fn(async () => ({ delivery: confirmed, release: confirmed })),
  };
  const options = {
    episodeId: publicRescueRoomScenario().episodes[0]!.id,
    playbook: rescueCommanderStarterPlaybook,
    deadlineUnixSeconds: 1_800_000_000,
    commander: (request: Parameters<typeof executeRescueCommanderHire>[0]) =>
      executeRescueCommanderHire(request, { model }),
    specialist: (request: Parameters<typeof executeRescueServiceAgent>[0]) =>
      executeRescueServiceAgent(request, { model }),
    payments,
    recordEvent: async ({ type }: { type: string }) => {
      events.push(type);
    },
  };
  return { options, events, payments };
}
describe("Rescue hiring / delivery / payment vertical slice", () => {
  it("replays the entire saved purchase and rejects altered runtime, observation or acceptance evidence", async () => {
    const { options } = fixture();
    const result = await runRescueServiceWorkflow(options);
    if (result.status !== "service-purchased") throw new Error("Expected purchase");
    await expect(replayRescueServiceWorkflow(options, result)).resolves.toEqual(result);
    for (const mutate of [
      (copy: typeof result) => {
        copy.specialist.runtime.usage.inputTokens += 1;
      },
      (copy: typeof result) => {
        copy.publicView.observations[0]!.headline = "Altered observation";
      },
      (copy: typeof result) => {
        Object.assign(copy, { actualServiceAcceptanceHash: hash });
      },
      (copy: typeof result) => {
        copy.commander.decision.decision.reasonCode = "altered";
      },
    ]) {
      const copy = structuredClone(result);
      mutate(copy);
      await expect(replayRescueServiceWorkflow(options, copy)).rejects.toThrow();
    }
  });
  it("connects an accepted Commander choice, actual structured model output and separately verified payment", async () => {
    const { options, events, payments } = fixture();
    const result = await runRescueServiceWorkflow(options);
    expect(result.status).toBe("service-purchased");
    if (result.status !== "service-purchased") throw new Error("Expected purchase");
    expect(result.paymentState).toBe("simulated");
    expect(result.specialist.delivery.correctness).toBe("not-evaluated");
    expect(result.specialist.runtime.provider).toBe("injected-test-model");
    expect(result.replay.changesDeterministicEvaluation).toBe(false);
    expect(result.purchase.order.deliverableHash).not.toBe(result.specialist.delivery.deliveryHash);
    expect(events).toEqual([
      "commander-started",
      "commander-decided",
      "payment-reserved",
      "escrow-funded",
      "service-delivered",
      "service-payment-released",
    ]);
    expect(payments.deliverAndRelease).toHaveBeenCalledWith(
      hash,
      expect.objectContaining({ deliverableHash: result.specialist.delivery.deliveryHash }),
    );
  });
  it("does not pay an invalid or mismatched specialist output", async () => {
    const { options, payments } = fixture();
    const original = options.specialist;
    options.specialist = async (request) => {
      const result = await original(request);
      return { ...result, delivery: { ...result.delivery, rawOutput: "{}" } };
    };
    await expect(runRescueServiceWorkflow(options)).rejects.toThrow();
    expect(payments.fund).toHaveBeenCalledTimes(1);
    expect(payments.deliverAndRelease).not.toHaveBeenCalled();
  });
  it("does not call a specialist until funded evidence is confirmed", async () => {
    const { options } = fixture();
    options.payments.fund = async () => ({ ...confirmed, verifiedEvent: false as never });
    const specialist = vi.fn(options.specialist);
    await expect(runRescueServiceWorkflow({ ...options, specialist })).rejects.toThrow(
      "UNCONFIRMED_WORKFLOW_PAYMENT",
    );
    expect(specialist).not.toHaveBeenCalled();
  });
  it("allows the Commander to close without hiring or sending any payment", async () => {
    const { options, payments } = fixture();
    const close: RescueAgentModel = async (request) => ({
      ...(await model(request)),
      rawOutput: JSON.stringify({
        action: { type: "CLOSE_INCIDENT" },
        reasonCode: "no-purchase-needed",
        confidencePpm: 100_000,
      }),
    });
    options.commander = (request) => executeRescueCommanderHire(request, { model: close });
    const result = await runRescueServiceWorkflow(options);
    expect(result.status).toBe("closed-without-hire");
    expect(payments.reserve).not.toHaveBeenCalled();
    expect(payments.fund).not.toHaveBeenCalled();
  });
  it("persists completed work and refuses a duplicate job execution after restart", async () => {
    const { options } = fixture();
    const directory = await mkdtemp(join(tmpdir(), "rescue-workflow-job-"));
    const store = createLocalRescueJobStore({ directory });
    const { job } = await store.create({
      ownerId: "local-owner",
      idempotencyKey: "one",
      request: { episodeId: options.episodeId },
    });
    const completed = await runRescueJob({
      store,
      ownerId: "local-owner",
      jobId: job.jobId,
      workerId: "one",
      execute: async ({ recordEvent }) =>
        JSON.parse(
          JSON.stringify(await runRescueServiceWorkflow({ ...options, recordEvent })),
        ) as RescueJobJson,
    });
    expect(completed.status).toBe("succeeded");
    const reopened = createLocalRescueJobStore({ directory });
    expect((await reopened.get("local-owner", job.jobId))?.result).toEqual(completed.result);
    const execute = vi.fn();
    await expect(
      runRescueJob({
        store: reopened,
        ownerId: "local-owner",
        jobId: job.jobId,
        workerId: "two",
        execute,
      }),
    ).rejects.toThrow();
    expect(execute).not.toHaveBeenCalled();
  });
});
