export type LedgerSigningMode = "development" | "dmk";

import { execFile as execFileCallback } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import type { OutcomeAttestation } from "@frontier/shared";
import { outcomeAttestationTypes } from "@frontier/shared";
import type { SignerEth } from "@ledgerhq/device-signer-kit-ethereum";
import { concatHex, numberToHex, padHex, type Address, type Hex } from "viem";

const execFile = promisify(execFileCallback);

export type AttestationDomain = { chainId: number; verifyingContract: Address };

export interface OutcomeSigner {
  readonly address: Address;
  signOutcome(attestation: OutcomeAttestation, domain: AttestationDomain): Promise<Hex>;
}

type LedgerSignature = { r: Hex; s: Hex; v: number };

function serializeSignature(signature: LedgerSignature): Hex {
  const normalizedV = signature.v < 27 ? signature.v + 27 : signature.v;
  if (normalizedV !== 27 && normalizedV !== 28) {
    throw new Error(`Ledger returned invalid recovery id ${signature.v}`);
  }
  return concatHex([
    padHex(signature.r, { size: 32 }),
    padHex(signature.s, { size: 32 }),
    numberToHex(normalizedV, { size: 1 }),
  ]);
}

function waitForLedgerSignature(
  action: ReturnType<SignerEth["signTypedData"]>,
): Promise<LedgerSignature> {
  return new Promise((resolve, reject) => {
    action.observable.subscribe({
      next(state) {
        if (state.status === "completed") {
          resolve(state.output);
        } else if (state.status === "error") {
          reject(new Error("Ledger rejected EIP-712 signing", { cause: state.error }));
        } else if (state.status === "stopped") {
          reject(new Error("Ledger EIP-712 signing was stopped"));
        }
      },
      error(error: unknown) {
        reject(new Error("Ledger transport failed", { cause: error }));
      },
    });
  });
}

export class DmkOutcomeSigner implements OutcomeSigner {
  constructor(
    private readonly signer: SignerEth,
    readonly address: Address,
    private readonly derivationPath = "44'/60'/0'/0/0",
  ) {}

  async signOutcome(attestation: OutcomeAttestation, domain: AttestationDomain): Promise<Hex> {
    const action = this.signer.signTypedData(this.derivationPath, {
      domain: {
        name: "Frontier Protocol",
        version: "1",
        chainId: domain.chainId,
        verifyingContract: domain.verifyingContract,
      },
      types: { OutcomeAttestation: [...outcomeAttestationTypes.OutcomeAttestation] },
      primaryType: "OutcomeAttestation",
      message: attestation,
    });
    return serializeSignature(await waitForLedgerSignature(action));
  }
}

export class LedgerKeyRingCredentialProvider {
  constructor(
    private readonly encryptedFile: string,
    private readonly keyName: string,
    private readonly walletCli = "wallet-cli",
  ) {}

  async read(): Promise<string> {
    const output = join(tmpdir(), `frontier-ring-${randomUUID()}.txt`);
    try {
      await execFile(
        this.walletCli,
        ["ring", "decrypt", "-i", this.encryptedFile, "-o", output, "--key", this.keyName],
        { windowsHide: true },
      );
      const credential = (await readFile(output, "utf8")).trim();
      if (!credential) throw new Error("Ledger Key Ring returned an empty credential");
      return credential;
    } catch (error) {
      throw new Error("Ledger Key Ring credential provisioning failed; runner stopped", {
        cause: error,
      });
    } finally {
      await rm(output, { force: true });
    }
  }
}

export function assertLedgerMode(environment: NodeJS.ProcessEnv): void {
  if (environment.LEDGER_SIGNING_MODE === "dmk") return;
  if (
    environment.NODE_ENV === "development" &&
    environment.LEDGER_SIGNING_MODE === "development" &&
    environment.ALLOW_INSECURE_LOCAL_SIGNER === "true"
  ) {
    return;
  }
  throw new Error(
    "Runner signing must use Ledger DMK outside an explicitly enabled local development session",
  );
}
