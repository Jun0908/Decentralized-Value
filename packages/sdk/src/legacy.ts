import type {
  FinalEntry,
  ParticipantRecord,
  SourceBundle,
  SubmissionRevision,
} from "@frontier/shared";
import { z } from "zod";
import { FrontierTransport } from "./transport.js";

export type EvaluationEnvelope<TResult> = TResult & { state: "measured" | "simulated" };
export type SandboxEnvelope<TResult> = TResult & { mode: "sandbox"; storage: "ephemeral-memory" };

/** Compatibility surface. Prefer the runtime-validated, arena-specific methods. */
export class LegacyFrontierClient {
  constructor(private readonly legacyTransport: FrontierTransport) {}

  private async legacyRequest<T>(path: string, init?: RequestInit): Promise<T> {
    // The legacy generic API delegates response typing to its caller.
    return (await this.legacyTransport.request(path, z.unknown(), init)) as T;
  }

  getArenas<TResult = unknown>() {
    return this.legacyRequest<TResult>("v1/arenas");
  }
  getEmergencySupplyContext<TResult = unknown>(contextId: string) {
    return this.legacyRequest<TResult>(`v1/emergency-supply?${new URLSearchParams({ contextId })}`);
  }
  getCalldataContext<TResult = unknown>(contextId: string) {
    return this.legacyRequest<TResult>(
      `v1/calldata-compression?${new URLSearchParams({ contextId })}`,
    );
  }
  getMicrogridContext<TResult = unknown>() {
    return this.legacyRequest<TResult>("v1/microgrid-dispatch");
  }
  evaluate<TResult>(endpoint: string, input: unknown) {
    return this.legacyRequest<EvaluationEnvelope<TResult>>(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  }
  registerSandboxParticipant(challengeId: string, wallet: string) {
    return this.legacyRequest<
      SandboxEnvelope<{ uniqueness: "wallet-only-not-personhood"; participant: ParticipantRecord }>
    >("v2/sandbox/participants/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ challengeId, wallet }),
    });
  }
  submitSandboxRevision(input: {
    participantId: string;
    challengeId: string;
    source: SourceBundle;
    artifactInput: unknown;
  }) {
    return this.legacyRequest<SandboxEnvelope<{ submission: SubmissionRevision }>>(
      "v2/sandbox/submissions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    );
  }
  getSandboxSubmissions(participantId: string) {
    return this.legacyRequest<{ storage: "ephemeral-memory"; submissions: SubmissionRevision[] }>(
      `v2/sandbox/participants/${encodeURIComponent(participantId)}/submissions`,
    );
  }
  selectSandboxFinalEntry(participantId: string, submissionId: string) {
    return this.legacyRequest<{ mode: "sandbox"; frozen: false; finalEntry: FinalEntry }>(
      "v2/sandbox/final-entry",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ participantId, submissionId }),
      },
    );
  }
}
