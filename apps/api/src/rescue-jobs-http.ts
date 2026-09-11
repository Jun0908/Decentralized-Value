import {
  normalizeRescueCommanderPlaybook,
  publicRescueRoomScenario,
  rescueCommanderPlaybookSchema,
} from "@frontier/rescue-room";
import { z } from "zod";
import { RescueJobError, type RescueJob, type RescueJobStore } from "./rescue-jobs";

const practiceEpisodeIds = new Set(
  publicRescueRoomScenario().episodes.map((episode) => episode.id),
);

export const rescueServiceWorkflowRequestSchema = z
  .object({
    schemaVersion: z.literal("rescue-service-workflow-request-v0"),
    episodeId: z
      .string()
      .min(1)
      .max(128)
      .refine((id) => practiceEpisodeIds.has(id)),
    playbook: rescueCommanderPlaybookSchema,
  })
  .strict()
  .transform((request) => ({
    ...request,
    playbook: normalizeRescueCommanderPlaybook(request.playbook),
  }));

const createSchema = z
  .object({
    idempotencyKey: z
      .string()
      .min(1)
      .max(256)
      .refine((key) => key.trim() === key),
    request: rescueServiceWorkflowRequestSchema,
  })
  .strict();

export type PublicRescueJob = Omit<
  RescueJob,
  "runToken" | "workerId" | "idempotencyKey" | "ownerId"
>;

/** Internal fencing capabilities and owner credentials never enter a response. */
export function toPublicRescueJob(job: RescueJob): PublicRescueJob {
  return {
    schemaVersion: job.schemaVersion,
    jobId: job.jobId,
    requestHash: job.requestHash,
    request: job.request,
    status: job.status,
    revision: job.revision,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    attempt: job.attempt,
    result: job.result,
    failureCode: job.failureCode,
    nextEventSequence: job.nextEventSequence,
    // The store's running event contains workerId. Keep only public attempt count.
    events: job.events.map((event) => {
      if (event.type !== "running") return event;
      const data = event.data;
      const attempt =
        data && typeof data === "object" && !Array.isArray(data) && typeof data.attempt === "number"
          ? data.attempt
          : null;
      return { ...event, data: { attempt } };
    }),
  };
}

export type RescueJobsHttpHandler = ((request: Request) => Promise<Response>) & {
  /** Shutdown/test supervision only. Never automatically restarts an interrupted job. */
  waitForIdle: () => Promise<void>;
};

type ErrorCode =
  | "NOT_FOUND"
  | "METHOD_NOT_ALLOWED"
  | "AUTH_UNAVAILABLE"
  | "UNAUTHORIZED"
  | "ORIGIN_FORBIDDEN"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "BODY_TOO_LARGE"
  | "INVALID_REQUEST"
  | "EXECUTOR_UNAVAILABLE"
  | "ALREADY_RUNNING"
  | "INVALID_STATE"
  | "IDEMPOTENCY_CONFLICT"
  | "STORE_UNAVAILABLE";

class HttpFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
  ) {
    super(code);
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

async function readJson(request: Request, allowEmpty = false): Promise<unknown> {
  if (
    request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !==
    "application/json"
  ) {
    throw new HttpFailure(415, "UNSUPPORTED_MEDIA_TYPE");
  }
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > 65_536)) {
    throw new HttpFailure(413, "BODY_TOO_LARGE");
  }
  if (!request.body) {
    if (allowEmpty) return {};
    throw new HttpFailure(400, "INVALID_REQUEST");
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65_536) {
        void reader.cancel().catch(() => undefined);
        throw new HttpFailure(413, "BODY_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (size === 0 && allowEmpty) return {};
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new HttpFailure(400, "INVALID_REQUEST");
  }
}

/**
 * Local operator pilot ONLY: the caller must bind a loopback socket and reject
 * unexpected Host headers. This adapter deliberately creates no public server.
 * Authentication must validate a credential and derive ownerId from that credential.
 * Origin is either absent (CLI) or exactly the configured browser origin; no CORS bypass.
 *
 * executeJob MUST use the store's atomic claim/runRescueJob before any side effect,
 * and persist its completion or uncertain outcome. This supervisor catches rejected
 * promises but never impersonates another worker to mutate or retry its state.
 */
export function createRescueJobsHttpHandler(options: {
  store: RescueJobStore;
  authenticate?: (request: Request) => Promise<string | null>;
  executeJob?: (jobId: string, ownerId: string) => Promise<void>;
  trustedOrigin?: string;
  onExecutionError?: (error: { jobId: string; code: "EXECUTOR_REJECTED" }) => void;
}): RescueJobsHttpHandler {
  const { store, authenticate, executeJob, trustedOrigin, onExecutionError } = options;
  if (trustedOrigin !== undefined) {
    const parsed = new URL(trustedOrigin);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.origin !== trustedOrigin) {
      throw new Error("trustedOrigin must be an exact HTTP(S) origin.");
    }
  }
  const pending = new Map<string, Promise<void>>();
  const handle = async (request: Request): Promise<Response> => {
    try {
      const path = new URL(request.url).pathname;
      const match = /^\/operator\/rescue\/jobs(?:\/(rjob_[a-f0-9]{64})(\/run)?)?$/.exec(path);
      if (!match) throw new HttpFailure(404, "NOT_FOUND");
      const jobId = match[1];
      const run = match[2] === "/run";
      const methodAllowed = jobId
        ? run
          ? request.method === "POST"
          : request.method === "GET"
        : request.method === "GET" || request.method === "POST";
      if (!methodAllowed) throw new HttpFailure(405, "METHOD_NOT_ALLOWED");
      const origin = request.headers.get("origin");
      if (origin !== null && (trustedOrigin === undefined || origin !== trustedOrigin)) {
        throw new HttpFailure(403, "ORIGIN_FORBIDDEN");
      }
      if (!authenticate) throw new HttpFailure(503, "AUTH_UNAVAILABLE");
      let ownerId: string | null;
      try {
        ownerId = await authenticate(request);
      } catch {
        throw new HttpFailure(503, "AUTH_UNAVAILABLE");
      }
      if (ownerId === null) throw new HttpFailure(401, "UNAUTHORIZED");
      if (
        typeof ownerId !== "string" ||
        ownerId.length === 0 ||
        ownerId.length > 256 ||
        ownerId.trim() !== ownerId
      ) {
        throw new HttpFailure(503, "AUTH_UNAVAILABLE");
      }
      if (!jobId && request.method === "GET") {
        return json(200, { jobs: (await store.list(ownerId)).map(toPublicRescueJob) });
      }
      if (!jobId) {
        const input = createSchema.safeParse(await readJson(request));
        if (!input.success) throw new HttpFailure(400, "INVALID_REQUEST");
        const result = await store.create({ ownerId, ...input.data });
        return json(result.created ? 201 : 200, { job: toPublicRescueJob(result.job) });
      }
      const job = await store.get(ownerId, jobId);
      if (!job) throw new HttpFailure(404, "NOT_FOUND");
      if (!run) return json(200, { job: toPublicRescueJob(job) });
      if (!executeJob) throw new HttpFailure(503, "EXECUTOR_UNAVAILABLE");
      if (
        !z
          .object({})
          .strict()
          .safeParse(await readJson(request, true)).success
      ) {
        throw new HttpFailure(400, "INVALID_REQUEST");
      }
      const current = await store.get(ownerId, jobId);
      if (!current) throw new HttpFailure(404, "NOT_FOUND");
      const key = JSON.stringify([ownerId, jobId]);
      if (pending.has(key)) throw new HttpFailure(409, "ALREADY_RUNNING");
      if (
        current.status !== "queued" ||
        !rescueServiceWorkflowRequestSchema.safeParse(current.request).success
      )
        throw new HttpFailure(409, "INVALID_STATE");
      // No await between the final duplicate check and registration.
      const task = Promise.resolve()
        .then(() => executeJob(jobId, ownerId))
        .catch(() => {
          try {
            onExecutionError?.({ jobId, code: "EXECUTOR_REJECTED" });
          } catch {
            /* A diagnostic hook must not cause an unhandled rejection. */
          }
        })
        .finally(() => {
          pending.delete(key);
        });
      pending.set(key, task);
      return json(202, { job: toPublicRescueJob(current) });
    } catch (error) {
      if (error instanceof HttpFailure)
        return json(error.status, { error: { code: error.code, message: error.code } });
      if (error instanceof RescueJobError) {
        if (error.code === "IDEMPOTENCY_CONFLICT")
          return json(409, { error: { code: error.code, message: error.code } });
        if (error.code === "NOT_FOUND")
          return json(404, { error: { code: error.code, message: error.code } });
        if (error.code === "INVALID_INPUT")
          return json(400, { error: { code: "INVALID_REQUEST", message: "INVALID_REQUEST" } });
        if (error.code === "INVALID_STATE" || error.code === "STALE_RUN")
          return json(409, { error: { code: "INVALID_STATE", message: "INVALID_STATE" } });
      }
      return json(503, { error: { code: "STORE_UNAVAILABLE", message: "STORE_UNAVAILABLE" } });
    }
  };
  return Object.assign(handle, {
    waitForIdle: async () => {
      await Promise.all([...pending.values()]);
    },
  });
}
