import { CronCapability, handlerInTee, Runner, type TeeRuntime } from "@chainlink/cre-sdk";
import { z } from "zod";
import { evaluateSecretPack } from "./generated/evaluator.js";

const configSchema = z
  .object({
    schedule: z.literal("0 0 * * * *"),
    commitment: z.string().regex(/^0x[0-9a-f]{64}$/),
    evaluatorBundleHash: z.string().regex(/^0x[0-9a-f]{64}$/),
    scope: z.literal("nonproduction-secret-pack-simulation"),
  })
  .strict();
type Config = z.infer<typeof configSchema>;

const confidential = (runtime: TeeRuntime<Config>) => {
  const secret = runtime.getSecret({ id: "RESCUE_PRIVATE_PACK" }).result();
  // The pure evaluator checks every committed field before executing. Neither
  // pack, seed, salt nor unrevealed outcomes enter the returned receipt/logs.
  const receiptJson = evaluateSecretPack(
    runtime.config.commitment,
    secret.value,
    runtime.config.evaluatorBundleHash,
  );
  return {
    schemaVersion: "frontier-cre-secret-pack-result-v1",
    receiptJson,
    handlerKind: "confidential",
    privateInputUsed: true,
    liveTeeAttestationVerified: false,
    onchainWrites: false,
    rewardEligible: false,
  };
};

export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema });
  await runner.run((config: Config) => [
    handlerInTee(new CronCapability().trigger({ schedule: config.schedule }), confidential, {}),
  ]);
}
