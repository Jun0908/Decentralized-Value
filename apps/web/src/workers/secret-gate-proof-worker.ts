/// <reference lib="webworker" />

import { Group } from "@semaphore-protocol/group";
import { Identity } from "@semaphore-protocol/identity";
import { generateProof, verifyProof } from "@semaphore-protocol/proof";

export type SecretGateWorkerRequest = {
  requestId: string;
  privateKey: string;
  members: string[];
  message: string;
  scope: string;
  treeDepth: number;
  artifactUrls: { wasm: string; zkey: string };
};

export type SecretGateWorkerResponse =
  | {
      requestId: string;
      ok: true;
      proof: Awaited<ReturnType<typeof generateProof>>;
      proofVerified: boolean;
      provingMs: number;
    }
  | { requestId: string; ok: false; error: string };

self.addEventListener("message", (event: MessageEvent<SecretGateWorkerRequest>) => {
  const request = event.data;
  void (async () => {
    try {
      const identity = Identity.import(request.privateKey);
      const group = new Group(request.members);
      const startedAt = performance.now();
      const proof = await generateProof(
        identity,
        group,
        BigInt(request.message),
        BigInt(request.scope),
        request.treeDepth,
        request.artifactUrls,
      );
      const provingMs = performance.now() - startedAt;
      const proofVerified = await verifyProof(proof);
      self.postMessage({
        requestId: request.requestId,
        ok: true,
        proof,
        proofVerified,
        provingMs,
      } satisfies SecretGateWorkerResponse);
    } catch (cause) {
      self.postMessage({
        requestId: request.requestId,
        ok: false,
        error: cause instanceof Error ? cause.message : "Proof generation failed",
      } satisfies SecretGateWorkerResponse);
    }
  })();
});

export {};
