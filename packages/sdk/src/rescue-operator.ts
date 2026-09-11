import { z } from "zod";
import { FrontierError } from "./errors.js";
import { FrontierTransport, type FrontierAuth, type FrontierClientOptions } from "./transport.js";

/** Local pilot only; canonical episode and complex playbook validation remains server-side. */
export const rescueOperatorWorkflowRequestSchema = z
  .object({
    schemaVersion: z.literal("rescue-service-workflow-request-v0"),
    episodeId: z.string().min(1).max(128),
    playbook: z.record(z.string(), z.json()),
  })
  .strict();
export type RescueOperatorWorkflowRequest = z.infer<typeof rescueOperatorWorkflowRequestSchema>;

export const rescueOperatorCreateSchema = z
  .object({
    idempotencyKey: z
      .string()
      .min(1)
      .max(256)
      .refine((value) => value.trim() === value),
    request: rescueOperatorWorkflowRequestSchema,
  })
  .strict();
export type RescueOperatorCreateInput = z.infer<typeof rescueOperatorCreateSchema>;

const jobIdSchema = z.string().regex(/^rjob_[a-f0-9]{64}$/);
const boundedLabel = z.string().min(1).max(256);
function noInternalCapabilities(value: unknown): boolean {
  if (!value || typeof value !== "object") return true;
  return Object.entries(value).every(
    ([key, child]) => !["runToken", "workerId"].includes(key) && noInternalCapabilities(child),
  );
}

export const rescueOperatorJobSchema = z
  .object({
    schemaVersion: z.literal("rescue-job-v1"),
    jobId: jobIdSchema,
    requestHash: z.string().regex(/^[a-f0-9]{64}$/),
    request: rescueOperatorWorkflowRequestSchema,
    status: z.enum(["queued", "running", "succeeded", "failed", "needs-reconciliation"]),
    revision: z.number().int().positive(),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    attempt: z.number().int().nonnegative(),
    result: z.json(),
    failureCode: boundedLabel.nullable(),
    nextEventSequence: z.number().int().positive(),
    events: z
      .array(
        z
          .object({
            sequence: z.number().int().positive(),
            at: z.number().int().nonnegative(),
            type: boundedLabel,
            data: z.json(),
          })
          .strict(),
      )
      .max(256),
  })
  .strict()
  .refine(noInternalCapabilities);
export type RescueOperatorJob = z.infer<typeof rescueOperatorJobSchema>;

const jobResponseSchema = z.object({ job: rescueOperatorJobSchema }).strict();
const listResponseSchema = z
  .object({ jobs: z.array(rescueOperatorJobSchema).max(10_000) })
  .strict();
const safeCodes = new Set([
  "NOT_FOUND",
  "METHOD_NOT_ALLOWED",
  "AUTH_UNAVAILABLE",
  "AUTH_REQUIRED",
  "UNAUTHORIZED",
  "ORIGIN_FORBIDDEN",
  "UNSUPPORTED_MEDIA_TYPE",
  "BODY_TOO_LARGE",
  "INVALID_REQUEST",
  "EXECUTOR_UNAVAILABLE",
  "ALREADY_RUNNING",
  "INVALID_STATE",
  "IDEMPOTENCY_CONFLICT",
  "STORE_UNAVAILABLE",
  "TIMEOUT",
  "NETWORK_ERROR",
  "INVALID_RESPONSE",
  "REDIRECT_REJECTED",
]);

function safeError(error: unknown): FrontierError {
  const code =
    error instanceof FrontierError && safeCodes.has(error.code)
      ? error.code
      : "OPERATOR_REQUEST_FAILED";
  return new FrontierError(
    code,
    code === "TIMEOUT"
      ? "Operator request timed out; inspect the existing job before retrying."
      : `Rescue operator request failed (${code}).`,
    {
      ...(error instanceof FrontierError && error.status !== undefined
        ? { status: error.status }
        : {}),
      // Do not advertise automatic retry for an operator action whose completion is unknown.
      retryable: false,
    },
  );
}

function loopbackOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new FrontierError(
      "INVALID_BASE_URL",
      "An explicit loopback operator origin is required.",
    );
  }
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (value !== url.origin && value !== `${url.origin}/`)
  )
    throw new FrontierError(
      "INVALID_BASE_URL",
      "Only an explicit loopback operator origin without a path or credentials is allowed.",
    );
  return url.origin;
}

function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    throw new FrontierError("INVALID_REQUEST", "Invalid Rescue operator request.");
  return parsed.data;
}

/**
 * Separate from FrontierClient: these endpoints are a local operator pilot, not
 * the deployed public API. Credentials are explicitly injected, never read from
 * the environment. Create only saves a job; run is the explicit execution action.
 */
export class RescueOperatorClient {
  readonly baseUrl: string;
  private readonly transport: FrontierTransport;

  constructor(options: Omit<FrontierClientOptions, "auth"> & { auth: FrontierAuth }) {
    this.baseUrl = loopbackOrigin(options.baseUrl);
    if (!options.auth || typeof options.auth.getHeaders !== "function") {
      throw new FrontierError(
        "AUTH_REQUIRED",
        "An injected operator Bearer credential is required.",
      );
    }
    const auth: FrontierAuth = {
      getHeaders: async () => {
        const headers = new Headers(await options.auth.getHeaders());
        const authorization = headers.get("authorization");
        if (!authorization || !/^Bearer [^\s]{1,4096}$/i.test(authorization)) {
          throw new FrontierError(
            "AUTH_REQUIRED",
            "An injected operator Bearer credential is required.",
          );
        }
        // Do not forward unrelated account cookies or service API credentials.
        return { authorization };
      },
    };
    this.transport = new FrontierTransport({ ...options, baseUrl: this.baseUrl, auth });
  }

  async list(): Promise<RescueOperatorJob[]> {
    try {
      return (await this.transport.request("/operator/rescue/jobs", listResponseSchema, {}, true))
        .jobs;
    } catch (error) {
      throw safeError(error);
    }
  }

  async create(
    input: RescueOperatorCreateInput,
  ): Promise<{ job: RescueOperatorJob; created: boolean }> {
    try {
      const parsed = parseInput(rescueOperatorCreateSchema, input);
      const body = JSON.stringify(parsed);
      if (new TextEncoder().encode(body).byteLength > 65_536) {
        throw new FrontierError("BODY_TOO_LARGE", "Operator requests are limited to 64 KiB.");
      }
      const response = await this.transport.requestWithMetadata(
        "/operator/rescue/jobs",
        jobResponseSchema,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        },
        true,
      );
      if (response.status !== 200 && response.status !== 201)
        throw new FrontierError("INVALID_RESPONSE", "Unexpected create status.");
      return { job: response.data.job, created: response.status === 201 };
    } catch (error) {
      throw safeError(error);
    }
  }

  async get(jobId: string): Promise<RescueOperatorJob> {
    try {
      const id = parseInput(jobIdSchema, jobId);
      const job = (
        await this.transport.request(`/operator/rescue/jobs/${id}`, jobResponseSchema, {}, true)
      ).job;
      if (job.jobId !== id)
        throw new FrontierError("INVALID_RESPONSE", "Response belongs to a different job.");
      return job;
    } catch (error) {
      throw safeError(error);
    }
  }

  async run(jobId: string): Promise<RescueOperatorJob> {
    try {
      const id = parseInput(jobIdSchema, jobId);
      const response = await this.transport.requestWithMetadata(
        `/operator/rescue/jobs/${id}/run`,
        jobResponseSchema,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        },
        true,
      );
      if (response.status !== 202)
        throw new FrontierError("INVALID_RESPONSE", "Unexpected run status.");
      if (response.data.job.jobId !== id)
        throw new FrontierError("INVALID_RESPONSE", "Response belongs to a different job.");
      return response.data.job;
    } catch (error) {
      throw safeError(error);
    }
  }
}
