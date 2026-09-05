import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { EnsRunnerDirectory, type EnsRecordReader } from "./index.js";

class MemoryEns implements EnsRecordReader {
  readonly addresses = new Map<string, Address>();
  readonly text = new Map<string, string>();
  getAddress(name: string) {
    return Promise.resolve(this.addresses.get(name) ?? null);
  }
  getText(name: string, key: string) {
    return Promise.resolve(this.text.get(`${name}:${key}`) ?? null);
  }
}

const address = "0x1111111111111111111111111111111111111111";
const otherAddress = "0x2222222222222222222222222222222222222222";
const namespace = "runners.frontier-protocol.eth";
const name = `ledger.${namespace}`;

function configuredDirectory() {
  const ens = new MemoryEns();
  ens.text.set(`${namespace}:frontier.runners`, JSON.stringify([name]));
  ens.addresses.set(name, address);
  ens.text.set(`${name}:frontier.role`, "runner");
  ens.text.set(`${name}:frontier.capabilities`, "evm-orderbook-v1,solidity");
  ens.text.set(`${name}:url`, "https://runner.example.test/v1/jobs");
  ens.text.set(`${name}:frontier.version`, "1.0.0");
  ens.text.set(`${name}:frontier.status`, "active");
  return { directory: new EnsRunnerDirectory(ens, namespace), ens };
}

describe("EnsRunnerDirectory", () => {
  it("discovers only active runners with the required capability", async () => {
    const { directory } = configuredDirectory();
    await expect(directory.discover("evm-orderbook-v1")).resolves.toMatchObject([
      { ensName: name, signingAddress: address, status: "active" },
    ]);
    await expect(directory.discover("unknown")).rejects.toThrow("No active ENS runner");
  });

  it("reflects live record mutation rather than caching identity", async () => {
    const { directory, ens } = configuredDirectory();
    await expect(directory.discover("evm-orderbook-v1")).resolves.toHaveLength(1);
    ens.text.set(`${name}:frontier.status`, "paused");
    await expect(directory.discover("evm-orderbook-v1")).rejects.toThrow();
  });

  it("fails closed for malformed or incomplete records", async () => {
    const { directory, ens } = configuredDirectory();
    ens.text.delete(`${name}:url`);
    await expect(directory.resolve(name)).rejects.toThrow("missing url");
  });

  it("requires the recovered signer to match the ENS address", async () => {
    const { directory } = configuredDirectory();
    await expect(directory.assertSigner(name, address)).resolves.toBeDefined();
    await expect(directory.assertSigner(name, otherAddress)).rejects.toThrow("does not match");
  });
});
