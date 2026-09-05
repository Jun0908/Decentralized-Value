import { EnsRunnerDirectory, type EnsRecordReader } from "@frontier/ens-adapter";
import type { OutcomeSigner } from "@frontier/ledger-adapter";
import { outcomeAttestationTypes } from "@frontier/shared";
import { keccak256, stringToHex, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it, vi } from "vitest";
import { RunnerPipeline, type BenchmarkExecutor } from "./index.js";

const account = privateKeyToAccount(
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
);
const runnerName = "ledger.runners.frontier-protocol.eth";
const context = { workloadVersion: "evm-orderbook-v1" };
const contextHash = keccak256(stringToHex(JSON.stringify(context)));
const bytecode = "0x6000" as Hex;
const artifactHash = keccak256(bytecode);
const challengeId = `0x${"11".repeat(32)}` as Hex;
const constraintSpecHash = `0x${"33".repeat(32)}` as Hex;
const constraintResultHash = `0x${"44".repeat(32)}` as Hex;
const verifyingContract = "0x5555555555555555555555555555555555555555";

class MemoryEns implements EnsRecordReader {
  getAddress() {
    return Promise.resolve(account.address);
  }
  getText(_name: string, keyName: string) {
    const values: Record<string, string> = {
      "frontier.role": "runner",
      "frontier.capabilities": "evm-orderbook-v1",
      url: "https://runner.example.test/v1/jobs",
      "frontier.version": "1.0.0",
      "frontier.status": "active",
    };
    return Promise.resolve(values[keyName] ?? null);
  }
}

const job = {
  jobId: "00000000-0000-4000-8000-000000000001",
  challengeId,
  artifactId: `0x${"22".repeat(32)}`,
  artifactHash,
  artifactBytecode: bytecode,
  contextHash,
  context,
  runnerEnsName: runnerName,
};

function setup(options?: { correct?: boolean; credentialFails?: boolean; ensAddress?: Address }) {
  const measure = vi.fn(async () => ({ gasPerOrder: 70_000n, parallelThroughput: 400n }));
  const benchmark: BenchmarkExecutor = {
    checkCorrectness: vi.fn(async () => ({
      correct: options?.correct ?? true,
      constraintResultHash,
    })),
    measure,
  };
  const memoryEns = new MemoryEns();
  if (options?.ensAddress) memoryEns.getAddress = () => Promise.resolve(options.ensAddress!);
  const signer: OutcomeSigner = {
    address: account.address,
    signOutcome: (attestation, domain) =>
      account.signTypedData({
        domain: { name: "Frontier Protocol", version: "1", ...domain },
        types: outcomeAttestationTypes,
        primaryType: "OutcomeAttestation",
        message: attestation,
      }),
  };
  const submit = vi.fn(async () => ({ txHash: `0x${"66".repeat(32)}` as Hex }));
  return {
    pipeline: new RunnerPipeline(
      {
        getChallenge: async () => ({
          challengeId,
          artifactType: "evm-orderbook-v1",
          contextHash,
          constraintSpecHash,
          runnerRequirementHash: `0x${"77".repeat(32)}`,
          axes: [
            { key: "gasPerOrder", direction: "MINIMIZE", unit: "gas" },
            { key: "parallelThroughput", direction: "MAXIMIZE", unit: "normalized-ops-per-second" },
          ],
          metadataUri: "https://example.test/challenge.json",
        }),
      },
      benchmark,
      new EnsRunnerDirectory(memoryEns, "runners.frontier-protocol.eth"),
      signer,
      {
        read: options?.credentialFails
          ? async () => {
              throw new Error("ring unavailable");
            }
          : async () => "scoped-token",
      },
      { submit },
      { chainId: 11155111, verifyingContract },
      () => 1_800_000_000n,
    ),
    measure,
    submit,
  };
}

describe("RunnerPipeline", () => {
  it("checks correctness before measurement, signs, verifies, and submits", async () => {
    const { pipeline, submit } = setup();
    const result = await pipeline.run(job);
    expect(result.attestation.resultHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result.signature).toHaveLength(132);
    expect(submit).toHaveBeenCalledOnce();
  });
  it("does not benchmark an incorrect artifact", async () => {
    const { pipeline, measure } = setup({ correct: false });
    await expect(pipeline.run(job)).rejects.toThrow("failed correctness");
    expect(measure).not.toHaveBeenCalled();
  });
  it("stops when Key Ring credential provisioning fails", async () => {
    const { pipeline, submit } = setup({ credentialFails: true });
    await expect(pipeline.run(job)).rejects.toThrow("ring unavailable");
    expect(submit).not.toHaveBeenCalled();
  });
  it("stops before benchmarking when ENS and signer identities differ", async () => {
    const { pipeline, measure } = setup({
      ensAddress: "0x9999999999999999999999999999999999999999",
    });
    await expect(pipeline.run(job)).rejects.toThrow("does not match ENS");
    expect(measure).not.toHaveBeenCalled();
  });
});
