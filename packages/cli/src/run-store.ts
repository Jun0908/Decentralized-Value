import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { cliRunSchema, type CliRun } from "@frontier/shared/cli";
import { atomicJson, readJson, safePath } from "./files.js";
import { CliError } from "./output.js";

export async function saveRun(
  dir: string,
  input: Omit<CliRun, "schemaVersion" | "runId" | "createdAt">,
) {
  const run = cliRunSchema.parse({
    ...input,
    schemaVersion: "1",
    runId: `run_${randomUUID()}`,
    createdAt: new Date().toISOString(),
  });
  const root = join(dir, ".frontier", "runs");
  await safePath(root);
  await mkdir(root, { recursive: true });
  const staging = await mkdtemp(join(root, ".pending-"));
  try {
    await atomicJson(join(staging, "artifact.json"), run.artifact);
    await atomicJson(join(staging, "context.json"), run.context);
    await atomicJson(join(staging, "raw.json"), run.raw);
    await atomicJson(join(staging, "summary.json"), run);
    await rename(staging, join(root, run.runId));
  } catch (e) {
    await rm(staging, { recursive: true, force: true });
    throw e;
  }
  return run;
}
export async function loadRun(dir: string, id: string) {
  if (!/^run_[a-f0-9-]{36}$/.test(id)) throw new CliError("INVALID_RUN_ID", "Invalid local Run ID");
  const run = cliRunSchema.parse(
    await readJson(join(dir, ".frontier", "runs", id, "summary.json")),
  );
  if (run.runId !== id)
    throw new CliError("INVALID_RUN", "Run identifier does not match its record");
  return run;
}
export async function listRuns(dir: string, baseUrl: string) {
  const root = join(dir, ".frontier", "runs");
  await safePath(root);
  const names = await readdir(root).catch((e: NodeJS.ErrnoException) => {
    if (e.code === "ENOENT") return [];
    throw e;
  });
  const runs = [];
  for (const id of names.filter((id) => /^run_[a-f0-9-]{36}$/.test(id)).sort()) {
    const run = await loadRun(dir, id);
    if (run.baseUrl === baseUrl) runs.push(run);
  }
  return runs.sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.runId.localeCompare(b.runId),
  );
}
