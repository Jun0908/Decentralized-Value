import { lstat, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FrontierError } from "../packages/sdk/src/errors";
import {
  RescueOperatorClient,
  rescueOperatorCreateSchema,
  type RescueOperatorJob,
} from "../packages/sdk/src/rescue-operator";

const usage =
  "Rescue local operator: list | get --job ID | create --file REQUEST.json | run --job ID";
const root = resolve(import.meta.dirname, "..");
function parseCredential(value: unknown): { token: string } {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== "rescue-operator-http-v1" ||
    !("token" in value) ||
    typeof value.token !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.token) ||
    Object.keys(value).length !== 2
  )
    throw new Error("INVALID_LOCAL_CREDENTIAL");
  return { token: value.token };
}

async function readBoundedJson(file: string, maxBytes: number): Promise<unknown> {
  const metadata = await lstat(file);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > maxBytes)
    throw new Error("INVALID_LOCAL_FILE");
  const bytes = await readFile(file);
  if (bytes.byteLength > maxBytes) throw new Error("INVALID_LOCAL_FILE");
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

function summary(job: RescueOperatorJob) {
  return {
    jobId: job.jobId,
    status: job.status,
    requestHash: job.requestHash,
    revision: job.revision,
    attempt: job.attempt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    failureCode: job.failureCode,
  };
}

/** Local developer command. No environment loading, configurable remote origin or token flags. */
export async function runRescueJobsCli(
  args: string[],
  options: {
    root?: string;
    fetch?: typeof fetch;
    write?: (message: string) => void;
  } = {},
): Promise<number> {
  const write = options.write ?? console.log;
  if (args.length === 0 || (args.length === 1 && ["--help", "help"].includes(args[0]!))) {
    write(usage);
    return 0;
  }
  let token: string | undefined;
  try {
    const [command, flag, value] = args;
    if (!(
      (command === "list" && args.length === 1) ||
      (command === "create" && args.length === 3 && flag === "--file" && value) ||
      (["get", "run"].includes(command!) && args.length === 3 && flag === "--job" && value)
    )) {
      throw new Error("INVALID_ARGUMENTS");
    }
    const workspace = options.root ?? root;
    const credential = parseCredential(
      await readBoundedJson(resolve(workspace, "secrets/rescue-operator-http.json"), 8192),
    );
    token = credential.token;
    const client = new RescueOperatorClient({
      baseUrl: "http://127.0.0.1:4318",
      auth: { getHeaders: () => ({ authorization: `Bearer ${credential.token}` }) },
      ...(options.fetch ? { fetch: options.fetch } : {}),
    });
    let result: unknown;
    if (command === "list") result = { jobs: (await client.list()).map(summary) };
    else if (command === "create") {
      const request = rescueOperatorCreateSchema.parse(
        await readBoundedJson(resolve(value!), 65_536),
      );
      const created = await client.create(request);
      result = { created: created.created, job: summary(created.job) };
    } else if (command === "get") result = { job: summary(await client.get(value!)) };
    else result = { executionRequested: true, job: summary(await client.run(value!)) };
    // Output only metadata, never raw playbooks, model responses, credentials or transport errors.
    write(JSON.stringify(result, null, 2).split(credential.token).join("[REDACTED]"));
    return 0;
  } catch (error) {
    const code =
      error instanceof FrontierError && /^[A-Z_]{1,64}$/.test(error.code)
        ? error.code
        : "LOCAL_OPERATOR_COMMAND_FAILED";
    const message = `Rescue operator command stopped (${code}). Inspect the existing job before retrying. ${usage}`;
    write(token ? message.split(token).join("[REDACTED]") : message);
    return 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exitCode = await runRescueJobsCli(process.argv.slice(2));
}
