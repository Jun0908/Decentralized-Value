import {
  challengeManifestV2Schema,
  hashChallengeManifest,
  type FinalEntry,
  type ParticipantRecord,
  type SourceBundle,
  type SubmissionRevision,
  type ChallengeManifestV2,
} from "@frontier/shared";

export const frontierSdkVersion = "0.2.0";

export type EvaluationEnvelope<TResult> = TResult & { state: "measured" };
export type SandboxEnvelope<TResult> = TResult & { mode: "sandbox"; storage: "ephemeral-memory" };

export class FrontierClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  private url(path: string) {
    return new URL(path, this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`);
  }

  private async request<TResult>(path: string, init?: RequestInit): Promise<TResult> {
    const response = await this.fetcher(this.url(path), init);
    const payload = (await response.json()) as TResult & {
      error?: { message?: string };
    };
    if (!response.ok) throw new Error(payload.error?.message ?? `Frontier API ${response.status}`);
    return payload;
  }

  getArenas<TResult = unknown>() {
    return this.request<TResult>("v1/arenas");
  }

  getEmergencySupplyContext<TResult = unknown>(contextId: string) {
    const query = new URLSearchParams({ contextId });
    return this.request<TResult>(`v1/emergency-supply?${query}`);
  }

  getCalldataContext<TResult = unknown>(contextId: string) {
    const query = new URLSearchParams({ contextId });
    return this.request<TResult>(`v1/calldata-compression?${query}`);
  }

  getMicrogridContext<TResult = unknown>() {
    return this.request<TResult>("v1/microgrid-dispatch");
  }

  evaluate<TResult>(endpoint: string, input: unknown) {
    return this.request<EvaluationEnvelope<TResult>>(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  }

  registerSandboxParticipant(challengeId: string, wallet: string) {
    return this.request<
      SandboxEnvelope<{
        uniqueness: "wallet-only-not-personhood";
        participant: ParticipantRecord;
      }>
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
    return this.request<SandboxEnvelope<{ submission: SubmissionRevision }>>(
      "v2/sandbox/submissions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    );
  }

  getSandboxSubmissions(participantId: string) {
    return this.request<{
      storage: "ephemeral-memory";
      submissions: SubmissionRevision[];
    }>(`v2/sandbox/participants/${participantId}/submissions`);
  }

  selectSandboxFinalEntry(participantId: string, submissionId: string) {
    return this.request<{
      mode: "sandbox";
      frozen: false;
      finalEntry: FinalEntry;
    }>("v2/sandbox/final-entry", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ participantId, submissionId }),
    });
  }
}

export function verifyChallengeManifest(
  value: unknown,
  expectedHash: string,
): { manifest: ChallengeManifestV2; valid: boolean; actualHash: string } {
  const manifest = challengeManifestV2Schema.parse(value);
  const actualHash = hashChallengeManifest(manifest);
  return {
    manifest,
    actualHash,
    valid: actualHash.toLowerCase() === expectedHash.toLowerCase(),
  };
}
