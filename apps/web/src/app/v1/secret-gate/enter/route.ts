import { secretGateEntrySchema, verifySecretGateEntry } from "@frontier/secret-gate";
import { canonicalProtocolJson } from "@frontier/shared";
import { keccak256, stringToHex } from "viem";
import { secretGateError, secretGateJson } from "@/lib/secret-gate-http";
import {
  requireDurableSecretGateStore,
  type SecretGateReceiptRecord,
} from "@/lib/secret-gate-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const entry = secretGateEntrySchema.parse(await request.json());
    const store = requireDurableSecretGateStore();
    const snapshot = await store.snapshot(entry.proof.merkleTreeRoot);
    if (!snapshot) {
      return secretGateJson(
        {
          gateOpen: false,
          error: {
            code: "UNTRUSTED_GROUP_ROOT",
            message: "Group snapshot is not trusted or expired.",
          },
        },
        400,
      );
    }
    const verification = await verifySecretGateEntry(entry, snapshot.root);
    if (!verification.valid) {
      return secretGateJson(
        {
          gateOpen: false,
          verification,
          error: { code: "INVALID_PROOF", message: "Proof did not satisfy the Gate policy." },
        },
        400,
      );
    }
    const receiptRecord = {
      schemaVersion: "1",
      gateId: entry.gateId,
      epoch: entry.epoch,
      root: snapshot.root,
      nullifier: verification.nullifier,
      proofHash: verification.proofHash,
      state: "off-chain-verified",
    } satisfies SecretGateReceiptRecord;
    const reserved = await store.reserveNullifier(receiptRecord);
    if (!reserved) {
      return secretGateJson(
        {
          gateOpen: false,
          verification,
          error: {
            code: "NULLIFIER_ALREADY_USED",
            message: "This identity has already entered this Gate scope.",
          },
        },
        409,
      );
    }
    return secretGateJson(
      {
        gateOpen: true,
        storage: store.durability,
        verification,
        receipt: {
          ...receiptRecord,
          receiptHash: keccak256(stringToHex(canonicalProtocolJson(receiptRecord))),
          verifiedAt: new Date().toISOString(),
        },
      },
      201,
    );
  } catch (cause) {
    return secretGateError(cause);
  }
}
