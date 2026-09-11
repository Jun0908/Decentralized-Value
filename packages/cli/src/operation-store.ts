import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { cliContextSchema, type CliContext } from "@frontier/shared/cli";
import { atomicJson, digest, readJson } from "./files.js";
import { CliError } from "./output.js";
import { origin } from "./project.js";

export interface Operation {
  schemaVersion: "1";
  operationId: string;
  idempotencyKey: string;
  state: "prepared";
  baseUrl: string;
  userId: string;
  arenaId: "disaster-response";
  createdAt: string;
  context: CliContext;
  body: string;
  bodyDigest: string;
}
function path(dir: string, id: string) {
  if (!/^op_[a-f0-9-]{36}$/.test(id))
    throw new CliError("INVALID_OPERATION_ID", "Invalid operation ID");
  return join(dir, ".frontier", "operations", `${id}.json`);
}
export async function createOperation(
  dir: string,
  input: Omit<
    Operation,
    "schemaVersion" | "state" | "operationId" | "idempotencyKey" | "createdAt" | "bodyDigest"
  >,
) {
  const operation: Operation = {
    ...input,
    schemaVersion: "1",
    state: "prepared",
    operationId: `op_${randomUUID()}`,
    idempotencyKey: randomUUID(),
    createdAt: new Date().toISOString(),
    bodyDigest: digest(input.body),
  };
  await atomicJson(path(dir, operation.operationId), operation);
  return operation;
}
export async function loadOperation(
  dir: string,
  id: string,
  baseUrl: string,
  userId: string,
): Promise<Operation> {
  const value = (await readJson(path(dir, id))) as Operation;
  if (
    value.schemaVersion !== "1" ||
    value.state !== "prepared" ||
    value.operationId !== id ||
    value.arenaId !== "disaster-response" ||
    typeof value.body !== "string" ||
    value.bodyDigest !== digest(value.body) ||
    !/^[a-f0-9-]{36}$/.test(value.idempotencyKey)
  )
    throw new CliError("INVALID_OPERATION", "Operation snapshot failed integrity validation");
  cliContextSchema.parse(value.context);
  if (origin(value.baseUrl) !== origin(baseUrl) || value.userId !== userId)
    throw new CliError(
      "OPERATION_IDENTITY_MISMATCH",
      "Operation belongs to another API origin or user",
      3,
    );
  try {
    JSON.parse(value.body);
  } catch {
    throw new CliError("INVALID_OPERATION", "Saved operation body is invalid JSON");
  }
  return value;
}
export async function completeOperation(dir: string, operation: Operation, result: unknown) {
  const receipt = join(dir, ".frontier", "operations", `${operation.operationId}.receipt.json`);
  try {
    await atomicJson(receipt, {
      schemaVersion: "1",
      operationId: operation.operationId,
      state: "saved",
      result,
    });
  } catch (e) {
    if (!(e instanceof CliError && e.code === "FILE_EXISTS")) throw e;
  }
}
