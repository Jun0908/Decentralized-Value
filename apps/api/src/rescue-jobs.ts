import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, readdir, rename, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";

/** Local, single-host storage only. The directory must be private and persistent.
 * Owner IDs MUST come from a trusted authenticated adapter, never request bodies.
 * No secrets or private model reasoning may be placed in requests, results or events.
 * This store fences record mutations, not external model calls or transactions.
 */
export type RescueJobJson =
  null | boolean | number | string | RescueJobJson[] | { [key: string]: RescueJobJson };

const jsonSchema = z.json();
const boundedLabel = z.string().min(1).max(256);
const jobIdSchema = z.string().regex(/^rjob_[a-f0-9]{64}$/);
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const rescueJobStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "needs-reconciliation",
]);

const eventSchema = z
  .object({
    sequence: z.number().int().positive(),
    at: z.number().int().nonnegative(),
    type: boundedLabel,
    data: jsonSchema,
  })
  .strict();

const jobSchema = z
  .object({
    schemaVersion: z.literal("rescue-job-v1"),
    jobId: jobIdSchema,
    ownerId: boundedLabel,
    idempotencyKey: boundedLabel,
    requestHash: digestSchema,
    request: z.record(z.string(), jsonSchema),
    status: rescueJobStatusSchema,
    revision: z.number().int().positive(),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    attempt: z.number().int().nonnegative(),
    runToken: z.string().uuid().nullable(),
    workerId: boundedLabel.nullable(),
    result: jsonSchema,
    failureCode: boundedLabel.nullable(),
    nextEventSequence: z.number().int().positive(),
    events: z.array(eventSchema).max(256),
  })
  .strict();

export type RescueJob = z.infer<typeof jobSchema>;
export type RescueJobEvent = z.infer<typeof eventSchema>;
export type RescueJobStatus = RescueJob["status"];
export type RescueJobErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "IDEMPOTENCY_CONFLICT"
  | "INVALID_STATE"
  | "STALE_RUN"
  | "STORE_BUSY"
  | "CORRUPT_STORE";

export class RescueJobError extends Error {
  constructor(
    public readonly code: RescueJobErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RescueJobError";
  }
}

type JobRef = { ownerId: string; jobId: string };
type RunRef = JobRef & { runToken: string };
type EventInput = { type: string; data?: RescueJobJson };

/** Future shared-host adapters must retain these atomic and fail-closed semantics. */
export interface RescueJobStore {
  create(input: {
    ownerId: string;
    idempotencyKey: string;
    request: Record<string, RescueJobJson>;
  }): Promise<{ job: RescueJob; created: boolean }>;
  get(ownerId: string, jobId: string): Promise<RescueJob | null>;
  list(ownerId: string): Promise<RescueJob[]>;
  claim(input: JobRef & { workerId: string }): Promise<RescueJob>;
  appendEvent(input: RunRef & { event: EventInput }): Promise<RescueJob>;
  complete(input: RunRef & { result: RescueJobJson }): Promise<RescueJob>;
  failSafe(input: RunRef & { failureCode: string }): Promise<RescueJob>;
  requireReconciliation(input: RunRef & { failureCode: string }): Promise<RescueJob>;
  resolveReconciliation(
    input: JobRef & {
      expectedRevision: number;
      resolution: "retry-safe" | "failed";
      operatorEvidence: string;
      confirmNoActiveRunner: true;
    },
  ): Promise<RescueJob>;
}

function invalid(message: string): never {
  throw new RescueJobError("INVALID_INPUT", message);
}

function label(value: string, name: string): string {
  if (!boundedLabel.safeParse(value).success || value.trim() !== value) {
    invalid(`${name} must be a nonempty bounded identifier.`);
  }
  return value;
}

/** Snapshot plain finite JSON without invoking accessors or toJSON hooks. */
function canonicalJson(value: unknown, maxBytes: number): string {
  let nodes = 0;
  const active = new Set<object>();
  const encode = (current: unknown, depth: number): string => {
    if (++nodes > 100_000 || depth > 32) invalid("JSON exceeds structural limits.");
    if (current === null) return "null";
    if (typeof current === "string" || typeof current === "boolean") {
      return JSON.stringify(current);
    }
    if (typeof current === "number" && Number.isFinite(current)) return JSON.stringify(current);
    if (typeof current !== "object" || current === null)
      invalid("Only finite plain JSON is accepted.");
    if (active.has(current)) invalid("Cyclic JSON is not accepted.");
    active.add(current);
    const descriptors = Object.getOwnPropertyDescriptors(current);
    if (Object.getOwnPropertySymbols(current).length > 0)
      invalid("Symbol fields are not accepted.");
    let result: string;
    if (Array.isArray(current)) {
      if (Object.getPrototypeOf(current) !== Array.prototype)
        invalid("Only plain JSON arrays are accepted.");
      const keys = Object.keys(descriptors).filter((key) => key !== "length");
      if (keys.length !== current.length) invalid("Sparse or decorated arrays are not accepted.");
      result = `[${Array.from({ length: current.length }, (_, index) => {
        const descriptor = descriptors[String(index)];
        if (!descriptor || !descriptor.enumerable || !("value" in descriptor))
          invalid("JSON accessors are not accepted.");
        return encode(descriptor.value, depth + 1);
      }).join(",")}]`;
    } else {
      const prototype: unknown = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null)
        invalid("Only plain JSON objects are accepted.");
      result = `{${Object.keys(descriptors)
        .sort()
        .map((key) => {
          const descriptor = descriptors[key]!;
          if (!descriptor.enumerable || !("value" in descriptor))
            invalid("Hidden fields and accessors are not accepted.");
          return `${JSON.stringify(key)}:${encode(descriptor.value, depth + 1)}`;
        })
        .join(",")}}`;
    }
    active.delete(current);
    if (Buffer.byteLength(result, "utf8") > maxBytes) invalid("JSON exceeds byte limit.");
    return result;
  };
  const result = encode(value, 0);
  if (Buffer.byteLength(result, "utf8") > maxBytes) invalid("JSON exceeds byte limit.");
  return result;
}

function snapshot<T>(value: T, maxBytes: number): T {
  return JSON.parse(canonicalJson(value, maxBytes)) as T;
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function idFor(ownerId: string, idempotencyKey: string): string {
  return `rjob_${digest(JSON.stringify(["rescue-job-v1", ownerId, idempotencyKey]))}`;
}

function hasCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

export function createLocalRescueJobStore(options: {
  directory: string;
  maxEvents?: number;
  now?: () => number;
}): RescueJobStore {
  if (!options.directory.trim()) invalid("A private persistent directory is required.");
  const directory = resolve(options.directory);
  const maxEvents = options.maxEvents ?? 128;
  if (!Number.isInteger(maxEvents) || maxEvents < 1 || maxEvents > 256)
    invalid("maxEvents must be 1..256.");
  const now = () => {
    const value = (options.now ?? Date.now)();
    if (!Number.isSafeInteger(value) || value < 0) invalid("Invalid clock.");
    return value;
  };
  const pathFor = (jobId: string) => {
    if (!jobIdSchema.safeParse(jobId).success) invalid("Invalid job ID.");
    return join(directory, `${jobId}.json`);
  };
  const initialize = () => mkdir(directory, { recursive: true, mode: 0o700 });

  // No automatic stale-lock expiry: a slow live writer must never lose its lock.
  // If a process dies while holding writer.lock, stop ALL writers and manually
  // remove that exact lock after operator inspection. Never unlink it by age.
  async function exclusive<T>(operation: () => Promise<T>): Promise<T> {
    await initialize();
    const lockPath = join(directory, "writer.lock");
    let lock;
    for (let attempt = 0; ; attempt++) {
      try {
        lock = await open(lockPath, "wx", 0o600);
        break;
      } catch (error) {
        if (!hasCode(error, "EEXIST")) throw error;
        if (attempt >= 40)
          throw new RescueJobError(
            "STORE_BUSY",
            "Writer is active or requires operator lock recovery.",
          );
        await new Promise((done) => setTimeout(done, 10));
      }
    }
    try {
      await lock.writeFile(
        JSON.stringify({
          schemaVersion: "rescue-job-lock-v1",
          pid: process.pid,
          token: randomUUID(),
        }),
      );
      await lock.sync();
      return await operation();
    } finally {
      await lock.close();
      await unlink(lockPath);
    }
  }

  async function read(jobId: string): Promise<RescueJob | null> {
    const path = pathFor(jobId);
    let raw: string;
    try {
      const metadata = await lstat(path);
      if (!metadata.isFile() || metadata.isSymbolicLink())
        throw new RescueJobError("CORRUPT_STORE", "Job record must be an ordinary private file.");
      if (metadata.size > 2_097_152)
        throw new RescueJobError("CORRUPT_STORE", "Job record exceeds storage limit.");
      raw = await readFile(path, "utf8");
    } catch (error) {
      if (hasCode(error, "ENOENT")) return null;
      throw error;
    }
    try {
      const job = jobSchema.parse(JSON.parse(raw));
      if (
        job.jobId !== jobId ||
        idFor(job.ownerId, job.idempotencyKey) !== jobId ||
        digest(canonicalJson(job.request, 65_536)) !== job.requestHash ||
        (job.status === "running") !== (job.runToken !== null) ||
        (job.status === "running") !== (job.workerId !== null) ||
        job.events.some(
          (event, index) => event.sequence !== job.nextEventSequence - job.events.length + index,
        )
      )
        throw new Error("Invalid record invariants.");
      return job;
    } catch {
      throw new RescueJobError(
        "CORRUPT_STORE",
        "Job record failed validation; operator recovery is required.",
      );
    }
  }

  async function write(job: RescueJob): Promise<void> {
    const data = canonicalJson(jobSchema.parse(job), 2_097_152);
    const target = pathFor(job.jobId);
    const temporary = join(directory, `${job.jobId}.${randomUUID()}.tmp`);
    const file = await open(temporary, "wx", 0o600);
    try {
      await file.writeFile(data);
      await file.sync();
    } finally {
      await file.close();
    }
    // Readers see either complete old or complete new record. Temp files are
    // ignored after crashes. This promises process-restart, not hardware-loss durability.
    await rename(temporary, target);
  }

  function event(job: RescueJob, input: EventInput): void {
    job.events.push({
      sequence: job.nextEventSequence++,
      at: now(),
      type: label(input.type, "event type"),
      data: snapshot(input.data ?? null, 4096),
    });
    job.events = job.events.slice(-maxEvents);
  }

  async function owned(ref: JobRef): Promise<RescueJob> {
    label(ref.ownerId, "ownerId");
    const job = await read(ref.jobId);
    if (!job || job.ownerId !== ref.ownerId)
      throw new RescueJobError("NOT_FOUND", "Job not found.");
    return job;
  }

  async function mutate(ref: JobRef, change: (job: RescueJob) => void): Promise<RescueJob> {
    const captured = { ownerId: ref.ownerId, jobId: ref.jobId };
    return exclusive(async () => {
      const job = await owned(captured);
      change(job);
      job.revision++;
      job.updatedAt = now();
      await write(job);
      return job;
    });
  }

  function running(job: RescueJob, runToken: string): void {
    if (job.status !== "running" || job.runToken !== runToken)
      throw new RescueJobError("STALE_RUN", "Worker no longer owns this run.");
  }

  const terminate = (
    ref: RunRef,
    status: "failed" | "needs-reconciliation",
    failureCode: string,
  ) => {
    label(failureCode, "failureCode");
    const runToken = ref.runToken;
    return mutate(ref, (job) => {
      running(job, runToken);
      job.status = status;
      job.failureCode = failureCode;
      job.runToken = null;
      job.workerId = null;
      event(job, { type: status, data: { failureCode } });
    });
  };

  return {
    async create(input) {
      const ownerId = label(input.ownerId, "ownerId");
      const idempotencyKey = label(input.idempotencyKey, "idempotencyKey");
      const request = snapshot(input.request, 65_536);
      if (!request || Array.isArray(request) || typeof request !== "object")
        invalid("request must be a JSON record.");
      const requestHash = digest(canonicalJson(request, 65_536));
      const jobId = idFor(ownerId, idempotencyKey);
      return exclusive(async () => {
        const existing = await read(jobId);
        if (existing) {
          if (existing.requestHash !== requestHash)
            throw new RescueJobError(
              "IDEMPOTENCY_CONFLICT",
              "Idempotency key already binds a different request.",
            );
          return { job: existing, created: false };
        }
        const timestamp = now();
        const job: RescueJob = {
          schemaVersion: "rescue-job-v1",
          jobId,
          ownerId,
          idempotencyKey,
          requestHash,
          request,
          status: "queued",
          revision: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
          attempt: 0,
          runToken: null,
          workerId: null,
          result: null,
          failureCode: null,
          nextEventSequence: 1,
          events: [],
        };
        event(job, { type: "queued" });
        await write(job);
        return { job, created: true };
      });
    },
    async get(ownerId, jobId) {
      label(ownerId, "ownerId");
      const job = await read(jobId);
      return job?.ownerId === ownerId ? job : null;
    },
    async list(ownerId) {
      label(ownerId, "ownerId");
      await initialize();
      const result: RescueJob[] = [];
      for (const name of await readdir(directory)) {
        if (!/^rjob_[a-f0-9]{64}\.json$/.test(name)) continue;
        const job = await read(name.slice(0, -5));
        if (job?.ownerId === ownerId) result.push(job);
      }
      return result.sort(
        (a, b) => b.createdAt - a.createdAt || (a.jobId < b.jobId ? -1 : a.jobId > b.jobId ? 1 : 0),
      );
    },
    claim(input) {
      const workerId = label(input.workerId, "workerId");
      return mutate(input, (job) => {
        if (job.status !== "queued")
          throw new RescueJobError(
            "INVALID_STATE",
            "Only a queued job can be claimed; retries require reconciliation.",
          );
        job.status = "running";
        job.attempt++;
        job.runToken = randomUUID();
        job.workerId = workerId;
        event(job, { type: "running", data: { attempt: job.attempt, workerId } });
      });
    },
    appendEvent(input) {
      const captured = snapshot(input.event, 4352);
      const runToken = input.runToken;
      return mutate(input, (job) => {
        running(job, runToken);
        event(job, captured);
      });
    },
    complete(input) {
      const result = snapshot(input.result, 524_288);
      const runToken = input.runToken;
      return mutate(input, (job) => {
        running(job, runToken);
        job.status = "succeeded";
        job.result = result;
        job.failureCode = null;
        job.runToken = null;
        job.workerId = null;
        event(job, { type: "succeeded" });
      });
    },
    failSafe: (input) => terminate(input, "failed", input.failureCode),
    requireReconciliation: (input) => terminate(input, "needs-reconciliation", input.failureCode),
    resolveReconciliation(input) {
      const evidence = label(input.operatorEvidence, "operatorEvidence");
      const { resolution, expectedRevision } = input;
      if (input.confirmNoActiveRunner !== true)
        invalid("Operator must stop and inspect the previous runner first.");
      if (input.resolution !== "retry-safe" && input.resolution !== "failed")
        invalid("Invalid reconciliation resolution.");
      return mutate(input, (job) => {
        if (job.status !== "needs-reconciliation" || job.revision !== expectedRevision)
          throw new RescueJobError(
            "INVALID_STATE",
            "Reconciliation requires the exact current revision.",
          );
        job.status = resolution === "retry-safe" ? "queued" : "failed";
        job.failureCode = resolution === "retry-safe" ? null : "OPERATOR_CONFIRMED_FAILED";
        event(job, {
          type: "reconciled",
          data: { resolution, operatorEvidence: evidence },
        });
      });
    },
  };
}

/** Throw only when it is known that no uncertain external side effect remains. */
export class RescueJobSafeFailure extends Error {
  constructor(public readonly failureCode: string) {
    super("Rescue job failed without unresolved external side effects.");
    label(failureCode, "failureCode");
  }
}

/** One attempt only. A restart never automatically reclaims a running job.
 * Unknown exceptions become needs-reconciliation, without leaking their message.
 * Handler side effects need their own durable idempotency / payment policy.
 */
export async function runRescueJob(
  input: JobRef & {
    store: RescueJobStore;
    workerId: string;
    execute: (context: {
      job: RescueJob;
      request: Record<string, RescueJobJson>;
      recordEvent: (event: EventInput) => Promise<void>;
    }) => Promise<RescueJobJson>;
  },
): Promise<RescueJob> {
  const claimed = await input.store.claim(input);
  const ref = { ownerId: input.ownerId, jobId: input.jobId, runToken: claimed.runToken! };
  try {
    const result = await input.execute({
      job: snapshot(claimed, 2_097_152),
      request: snapshot(claimed.request, 65_536),
      recordEvent: async (event) => {
        await input.store.appendEvent({ ...ref, event });
      },
    });
    return await input.store.complete({ ...ref, result });
  } catch (error) {
    // A stale worker must not overwrite a newer reconciliation or attempt.
    if (error instanceof RescueJobError && error.code === "STALE_RUN") throw error;
    if (error instanceof RescueJobSafeFailure) {
      return input.store.failSafe({ ...ref, failureCode: error.failureCode });
    }
    return input.store.requireReconciliation({
      ...ref,
      failureCode: "EXECUTION_OUTCOME_UNCERTAIN",
    });
  }
}
