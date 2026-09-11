import { z } from "zod";
import { canonicalProtocolJson } from "@frontier/shared/manifest";
import {
  cliArenaIdSchema,
  cliArenaManifestSchema,
  cliContextSchema,
  cliRunSchema,
  type CliArenaId,
  type CliArenaManifest,
  type CliContext,
  type CliRun,
} from "@frontier/shared/cli";
import { FrontierTransport, type FrontierClientOptions } from "./transport.js";
import { FrontierError } from "./errors.js";
import { assertSameContext } from "./compare.js";
import { plan6SubmissionSchema } from "./generated/request-schemas.js";
import {
  disasterPracticeSchema,
  rescuePracticeSchema,
  joinResponseSchema,
  submissionsResponseSchema,
  createSubmissionResponseSchema,
  selectEntryResponseSchema,
  type DisasterResponsePractice,
  type RescueRoomPractice,
} from "./responses.js";
import { LegacyFrontierClient } from "./legacy.js";

export type SubmissionBody = z.input<typeof plan6SubmissionSchema>;
export type PracticeRun = CliRun & { raw: DisasterResponsePractice | RescueRoomPractice };
export interface PracticeInput {
  arenaId: CliArenaId;
  artifact: Record<string, unknown>;
  context: CliContext;
  episodeId?: string | null;
}
export interface CreateSubmissionInput {
  arenaId: CliArenaId;
  body: SubmissionBody;
  context: CliContext;
  idempotencyKey: string;
}

function contextHeaders(context: CliContext): Record<string, string> {
  const parsed = cliContextSchema.parse(context);
  return {
    "X-Frontier-Context-Hash": parsed.contextHash,
    ...(parsed.runtimeContextHash
      ? { "X-Frontier-Runtime-Context-Hash": parsed.runtimeContextHash }
      : {}),
  };
}

function post(body: unknown, headers: HeadersInit = {}): RequestInit {
  const result = new Headers(headers);
  result.set("content-type", "application/json");
  return { method: "POST", headers: result, body: JSON.stringify(body) };
}

function disasterOnly(arenaId: CliArenaId): void {
  if (arenaId !== "disaster-response")
    throw new FrontierError("UNSUPPORTED_OPERATION", "Rescue Room supports practice only");
}

function available(manifest: CliArenaManifest): void {
  if (!manifest.capabilities.practice.supported)
    throw new FrontierError("UNSUPPORTED_OPERATION", "Practice is not supported");
  if (!manifest.capabilities.practice.available)
    throw new FrontierError(
      "SERVICE_UNAVAILABLE",
      manifest.capabilities.practice.reason ?? "Practice is unavailable",
    );
}

export class FrontierClient extends LegacyFrontierClient {
  readonly baseUrl: string;
  private readonly transport: FrontierTransport;

  constructor(options: FrontierClientOptions);
  /** @deprecated Use the options object constructor. */
  constructor(baseUrl: string, fetcher?: typeof fetch);
  constructor(options: FrontierClientOptions | string, fetcher?: typeof fetch) {
    const transport = new FrontierTransport(
      typeof options === "string"
        ? { baseUrl: options, ...(fetcher ? { fetch: fetcher } : {}) }
        : options,
    );
    super(transport);
    this.transport = transport;
    this.baseUrl = transport.baseUrl;
  }

  readonly arenas = {
    list: async (): Promise<CliArenaManifest[]> => {
      const result = await this.transport.request(
        "/v1/cli/arenas",
        z
          .object({ schemaVersion: z.literal("1"), arenas: z.array(cliArenaManifestSchema) })
          .passthrough(),
      );
      return result.arenas;
    },
    get: async (id: CliArenaId): Promise<CliArenaManifest> => {
      const arenaId = cliArenaIdSchema.parse(id);
      const manifest = await this.transport.request(
        `/v1/cli/arenas/${arenaId}`,
        cliArenaManifestSchema,
      );
      if (manifest.id !== arenaId)
        throw new FrontierError("INVALID_RESPONSE", "The API returned a different arena");
      return manifest;
    },
    downloadStarter: async (
      id: CliArenaId,
      expectedManifest?: CliArenaManifest,
    ): Promise<Uint8Array> => {
      const manifest = expectedManifest
        ? cliArenaManifestSchema.parse(expectedManifest)
        : await this.arenas.get(id);
      if (manifest.id !== id)
        throw new FrontierError("INVALID_INPUT", "Starter manifest belongs to a different arena");
      const bytes = await this.transport.download(manifest.starter.path);
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)));
      const actual = [...digest].map((value) => value.toString(16).padStart(2, "0")).join("");
      if (actual !== manifest.starter.sha256)
        throw new FrontierError(
          "STARTER_HASH_MISMATCH",
          "Starter does not match the manifest digest",
        );
      return bytes;
    },
  };

  readonly evaluations = {
    practice: async (input: PracticeInput): Promise<PracticeRun> => {
      const arenaId = cliArenaIdSchema.parse(input.arenaId);
      const context = cliContextSchema.parse(input.context);
      const artifact = structuredClone(z.record(z.string(), z.unknown()).parse(input.artifact));
      const manifest = await this.arenas.get(arenaId);
      available(manifest);
      assertSameContext(context, manifest.context);
      let raw: DisasterResponsePractice | RescueRoomPractice;
      let artifactHash: string;
      let resultHash: string;
      let correctness: boolean;
      let values: Record<string, number>;
      if (arenaId === "disaster-response") {
        if (input.episodeId != null)
          throw new FrontierError(
            "UNSUPPORTED_EPISODE",
            "Disaster Response does not accept an Episode",
          );
        raw = await this.transport.request(
          "/v1/disaster-response/evaluations",
          disasterPracticeSchema,
          post(artifact, contextHeaders(context)),
        );
        if (
          raw.dataVersion !== context.dataVersion ||
          raw.evaluatorVersion !== context.evaluatorVersion
        ) {
          throw new FrontierError(
            "CONTEXT_MISMATCH",
            "The server used a different evaluator or dataset",
            { details: { raw } },
          );
        }
        artifactHash = raw.inputHash;
        resultHash = raw.resultHash;
        correctness = raw.correctness;
        values = {
          totalProcurementCost: raw.totalProcurementCost,
          worstCaseDeliveredKits: raw.worstCaseDeliveredKits,
          regionalFairnessPpm: raw.regionalFairnessPpm,
        };
      } else {
        if (!input.episodeId || !manifest.episodes.some(({ id }) => id === input.episodeId)) {
          throw new FrontierError(
            "UNKNOWN_PRACTICE_EPISODE",
            "A public Episode from the locked project is required",
          );
        }
        raw = await this.transport.request(
          "/v1/rescue-room/doctrine-evaluations",
          rescuePracticeSchema,
          post({ doctrine: artifact, episodeId: input.episodeId }, contextHeaders(context)),
        );
        if (
          raw.doctrineContextHash !== context.runtimeContextHash ||
          raw.episode.id !== input.episodeId ||
          raw.interpreterVersion !== context.evaluatorVersion
        ) {
          throw new FrontierError(
            "CONTEXT_MISMATCH",
            "The server used a different Doctrine runtime or Episode",
            { details: { raw } },
          );
        }
        artifactHash = raw.doctrineHash;
        resultHash = raw.evaluationHash;
        correctness = raw.outcome.correctness;
        values = {
          totalUserLossUsd: raw.outcome.userLossUsd,
          servedProtocolDemandPpm: raw.outcome.servedProtocolDemandPpm,
          netResponseSpendCredits: raw.outcome.netResponseSpendCredits,
        };
      }
      if (
        raw.contextHash !== context.contextHash ||
        raw.manifestHash !== context.manifestHash ||
        raw.state !== context.evidenceState
      ) {
        throw new FrontierError(
          "CONTEXT_MISMATCH",
          "The API response does not match the locked context",
          { details: { raw } },
        );
      }
      if (
        context.metrics.some(({ key }) => values[key] === undefined) ||
        new Set(context.metrics.map(({ key }) => key)).size !== context.metrics.length
      ) {
        throw new FrontierError(
          "INVALID_RESPONSE",
          "The response is missing a required metric or has duplicate definitions",
          { details: { raw } },
        );
      }
      const run = cliRunSchema.parse({
        schemaVersion: "1",
        runId: `run_${crypto.randomUUID()}`,
        arenaId,
        baseUrl: this.baseUrl,
        createdAt: new Date().toISOString(),
        context,
        episodeId: input.episodeId ?? null,
        artifact,
        artifactHash,
        resultHash,
        correctness,
        values,
        raw,
      });
      return { ...run, raw };
    },
  };

  readonly competitions = {
    join: async (arenaId: CliArenaId = "disaster-response") => {
      disasterOnly(arenaId);
      return this.transport.request(
        "/v1/challenges/disaster-response/join",
        joinResponseSchema,
        post({}),
        true,
      );
    },
  };

  readonly submissions = {
    list: async (arenaId: CliArenaId = "disaster-response") => {
      disasterOnly(arenaId);
      return this.transport.request(
        "/v1/challenges/disaster-response/submissions/mine",
        submissionsResponseSchema,
        {},
        true,
      );
    },
    get: async (id: string, arenaId: CliArenaId = "disaster-response") => {
      const response = await this.submissions.list(arenaId);
      const submission = response.submissions.find(({ submissionId }) => submissionId === id);
      if (!submission)
        throw new FrontierError(
          "SUBMISSION_NOT_FOUND",
          "Submission is unavailable in this participant's history",
          { status: 404 },
        );
      return submission;
    },
    create: async (input: CreateSubmissionInput) => {
      disasterOnly(input.arenaId);
      // Parse for validation only: preserve the exact saved body on idempotent retries.
      const expected = plan6SubmissionSchema.parse(input.body);
      const context = cliContextSchema.parse(input.context);
      const key = input.idempotencyKey;
      if (!/^[\x21-\x7e]{8,128}$/.test(key))
        throw new FrontierError(
          "IDEMPOTENCY_KEY_REQUIRED",
          "An Idempotency-Key of 8-128 visible ASCII characters is required",
        );
      const response = await this.transport.requestWithMetadata(
        "/v1/challenges/disaster-response/submissions",
        createSubmissionResponseSchema,
        post(input.body, { ...contextHeaders(context), "Idempotency-Key": key }),
        true,
      );
      if (response.status !== 200 && response.status !== 201) {
        throw new FrontierError(
          "INVALID_RESPONSE",
          "The submission endpoint did not confirm a saved or replayed submission",
        );
      }
      const returned = response.data.submission;
      const returnedBody = {
        strategy: returned.artifact.strategy,
        sourceMethod: returned.sourceMethod,
        repositoryUrl: returned.repositoryUrl,
        sourceCommit: returned.sourceCommit,
        agentEvidence: returned.agentEvidence,
      };
      if (
        canonicalProtocolJson(returnedBody) !== canonicalProtocolJson(expected) ||
        canonicalProtocolJson(returned.evaluation.strategy) !==
          canonicalProtocolJson(expected.strategy)
      ) {
        throw new FrontierError(
          "SUBMISSION_RESPONSE_MISMATCH",
          "The returned submission does not match the posted artifact and provenance",
          {
            details: { submissionId: returned.submissionId },
          },
        );
      }
      // 200 is an idempotent replay and may refer to a previously committed context.
      if (
        response.status === 201 &&
        (returned.evaluation.contextHash !== context.contextHash ||
          returned.evaluation.manifestHash !== context.manifestHash ||
          returned.evaluation.evaluatorVersion !== context.evaluatorVersion ||
          returned.evaluation.dataVersion !== context.dataVersion ||
          context.runtimeContextHash !== null ||
          context.evidenceState !== "measured")
      ) {
        throw new FrontierError(
          "CONTEXT_MISMATCH",
          "The new submission was evaluated outside the requested context",
          {
            details: { submissionId: returned.submissionId, raw: response.data },
          },
        );
      }
      return response.data;
    },
  };

  readonly entries = {
    select: async (id: string, context: CliContext, arenaId: CliArenaId = "disaster-response") => {
      disasterOnly(arenaId);
      const submissionId = z
        .string()
        .regex(/^0x[0-9a-fA-F]{64}$/)
        .parse(id);
      return this.transport.request(
        "/v1/challenges/disaster-response/final-entry",
        selectEntryResponseSchema,
        { ...post({ submissionId }, contextHeaders(context)), method: "PUT" },
        true,
      );
    },
  };
}
