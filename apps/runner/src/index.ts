import { EnsRunnerDirectory } from "@frontier/ens-adapter";
import type { AttestationDomain, OutcomeSigner } from "@frontier/ledger-adapter";
import {
  bytes32Schema,
  computeOutcomeResultHash,
  outcomeAttestationSchema,
  outcomeAttestationTypes,
  type Challenge,
} from "@frontier/shared";
import { getAddress, keccak256, recoverTypedDataAddress, stringToHex, type Hex } from "viem";
import { z } from "zod";

export * from "./secret-gate-runner";

export const runnerJobSchema = z.object({
  jobId: z.string().uuid(),
  challengeId: bytes32Schema,
  artifactId: bytes32Schema,
  artifactHash: bytes32Schema,
  artifactBytecode: z
    .string()
    .regex(/^0x[0-9a-fA-F]*$/)
    .transform((value) => value as Hex),
  contextHash: bytes32Schema,
  context: z.record(z.string(), z.unknown()),
  runnerEnsName: z.string().endsWith(".eth"),
});
export type RunnerJob = z.infer<typeof runnerJobSchema>;

export interface BenchmarkExecutor {
  checkCorrectness(job: RunnerJob): Promise<{ correct: boolean; constraintResultHash: Hex }>;
  measure(job: RunnerJob): Promise<{ gasPerOrder: bigint; parallelThroughput: bigint }>;
}
export interface ChallengeSource {
  getChallenge(challengeId: Hex): Promise<Challenge | null>;
}
export interface CredentialProvider {
  read(): Promise<string>;
}
export interface AttestationSubmitter {
  submit(input: {
    jobId: string;
    attestation: ReturnType<typeof outcomeAttestationSchema.parse>;
    signature: Hex;
    credential: string;
  }): Promise<{ txHash: Hex }>;
}

export class RunnerPipeline {
  constructor(
    private readonly challenges: ChallengeSource,
    private readonly benchmark: BenchmarkExecutor,
    private readonly directory: EnsRunnerDirectory,
    private readonly signer: OutcomeSigner,
    private readonly credentialProvider: CredentialProvider,
    private readonly submitter: AttestationSubmitter,
    private readonly domain: AttestationDomain,
    private readonly clock: () => bigint = () => BigInt(Math.floor(Date.now() / 1000)),
  ) {}

  async run(input: unknown) {
    const job = runnerJobSchema.parse(input);
    const challenge = await this.challenges.getChallenge(job.challengeId);
    if (!challenge) throw new Error(`Unknown challenge ${job.challengeId}`);
    if (challenge.contextHash !== job.contextHash)
      throw new Error("Job contextHash does not match challenge");
    if (keccak256(job.artifactBytecode) !== job.artifactHash)
      throw new Error("Artifact bytecode hash mismatch");
    if (keccak256(stringToHex(JSON.stringify(job.context))) !== job.contextHash) {
      throw new Error("Evaluation context hash mismatch");
    }

    const runner = await this.directory.resolve(job.runnerEnsName);
    if (!runner.capabilities.includes(challenge.artifactType))
      throw new Error(`ENS runner lacks capability ${challenge.artifactType}`);
    if (runner.signingAddress !== getAddress(this.signer.address))
      throw new Error("Configured signer address does not match ENS runner address");

    const correctness = await this.benchmark.checkCorrectness(job);
    if (!correctness.correct) throw new Error("Artifact failed correctness constraints");
    const measurement = await this.benchmark.measure(job);
    const base = {
      challengeId: job.challengeId,
      artifactId: job.artifactId,
      artifactHash: job.artifactHash,
      contextHash: job.contextHash,
      constraintSpecHash: challenge.constraintSpecHash,
      constraintResultHash: correctness.constraintResultHash,
      ...measurement,
      runnerEnsName: runner.ensName,
      runnerAddress: runner.signingAddress,
      issuedAt: this.clock(),
    };
    const attestation = outcomeAttestationSchema.parse({
      ...base,
      resultHash: computeOutcomeResultHash(base),
    });
    const credential = await this.credentialProvider.read();
    const signature = await this.signer.signOutcome(attestation, this.domain);
    const recovered = await recoverTypedDataAddress({
      domain: { name: "Frontier Protocol", version: "1", ...this.domain },
      types: outcomeAttestationTypes,
      primaryType: "OutcomeAttestation",
      message: attestation,
      signature,
    });
    await this.directory.assertSigner(runner.ensName, recovered);
    const receipt = await this.submitter.submit({
      jobId: job.jobId,
      attestation,
      signature,
      credential,
    });
    return { attestation, signature, txHash: receipt.txHash };
  }
}

export function createRunnerHandler(pipeline: RunnerPipeline) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/v1/jobs") {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Route not found" } },
        { status: 404 },
      );
    }
    try {
      const result = await pipeline.run(await request.json());
      return new Response(
        JSON.stringify(result, (_key, value: unknown) =>
          typeof value === "bigint" ? value.toString() : value,
        ),
        {
          status: 201,
          headers: { "content-type": "application/json" },
        },
      );
    } catch (cause) {
      return Response.json(
        {
          error: {
            code: "EVALUATION_FAILED",
            message: cause instanceof Error ? cause.message : "Evaluation failed",
          },
        },
        { status: 422 },
      );
    }
  };
}
