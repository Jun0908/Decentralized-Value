import {
  CronCapability,
  handler,
  handlerInTee,
  Runner,
  type Runtime,
  type TeeRuntime,
} from "@chainlink/cre-sdk";
import { z } from "zod";
import { evaluateFixture } from "./generated/evaluator.js";

const configSchema = z
  .object({
    schedule: z.literal("0 0 * * * *"),
    publicFixtureJson: z.string().min(1).max(100_000),
    expectedEvaluationJson: z.string().min(1).max(100_000),
    evaluatorBundleHash: z.string().regex(/^0x[0-9a-f]{64}$/),
    scope: z.literal("public-practice-compatibility-only"),
  })
  .strict();
type Config = z.infer<typeof configSchema>;

function evaluate(config: Config, inputJson: string, handlerKind: "ordinary" | "confidential") {
  // This is a deliberately PUBLIC fixture, including when accessed through getSecret.
  // Do not return/log real secrets, a hidden Final seed, or unrevealed episode transcripts.
  if (inputJson !== config.publicFixtureJson)
    throw new Error("Public compatibility fixture mismatch");
  const evaluationJson = evaluateFixture(inputJson);
  if (evaluationJson !== config.expectedEvaluationJson)
    throw new Error("CRE evaluator differs from Node fixture");
  return {
    schemaVersion: "frontier-rescue-cre-compatibility-result-v0",
    handlerKind,
    evaluatorBundleHash: config.evaluatorBundleHash,
    evaluation: JSON.parse(evaluationJson),
    scope: config.scope,
    confidentialDataUsed: false,
    liveTeeAttestationVerified: false,
    onchainWrites: false,
    paymentState: "not-requested",
    rewardEligible: false,
  };
}

const ordinary = (runtime: Runtime<Config>) =>
  evaluate(runtime.config, runtime.config.publicFixtureJson, "ordinary");

const confidential = (runtime: TeeRuntime<Config>) => {
  const input = runtime.getSecret({ id: "RESCUE_PUBLIC_FIXTURE" }).result();
  return evaluate(runtime.config, input.value, "confidential");
};

const initWorkflow = (config: Config) => {
  const cron = new CronCapability();
  return [
    handler(cron.trigger({ schedule: config.schedule }), ordinary),
    handlerInTee(cron.trigger({ schedule: config.schedule }), confidential, {}),
  ];
};

export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema });
  await runner.run(initWorkflow);
}
