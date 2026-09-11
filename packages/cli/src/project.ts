import { resolve, basename, dirname, join } from "node:path";
import { access, mkdir, mkdtemp, rename, rm, lstat } from "node:fs/promises";
import {
  cliProjectSchema,
  cliLockSchema,
  cliArenaManifestSchema,
  type CliArenaManifest,
  type CliLock,
} from "@frontier/shared/cli";
import { Ajv } from "ajv";
import { Ajv2020 } from "ajv/dist/2020.js";
import { atomicJson, readJson, stable, requireEmpty, safePath } from "./files.js";
import { CliError } from "./output.js";
import { verifiedStarter } from "./starter.js";

export function origin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new CliError("INVALID_BASE_URL", "A valid API origin is required");
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    )
  ) {
    throw new CliError(
      "INVALID_BASE_URL",
      "Use an HTTPS origin or a local HTTP origin without credentials, path, query, or fragment",
    );
  }
  return url.origin;
}
export function projectDir(cwd: string, path?: string) {
  const dir = resolve(cwd, path ?? ".");
  return basename(dir) === "frontier.json" ? dirname(dir) : dir;
}
export async function loadProject(dir: string, allowIncompleteContext = false) {
  const project = cliProjectSchema.parse(await readJson(join(dir, "frontier.json")));
  const lock = cliLockSchema.parse(await readJson(join(dir, "frontier.lock.json")));
  if (
    project.arenaId !== lock.arenaId ||
    origin(project.baseUrl) !== origin(lock.baseUrl) ||
    project.artifact !==
      (project.arenaId === "disaster-response" ? "strategy.json" : "doctrine.json")
  ) {
    throw new CliError(
      "PROJECT_LOCK_MISMATCH",
      "Project and lock disagree; initialize or repair the project",
    );
  }
  const manifest = cliArenaManifestSchema.parse(
    await readJson(join(dir, ".frontier", "manifest.json")),
  );
  const schema = await readJson(join(dir, project.artifact.replace(".json", ".schema.json")));
  const cacheConsistent =
    manifest.id === project.arenaId &&
    manifest.artifact.filename === project.artifact &&
    !contextChanges(lock, manifest).length &&
    stable(schema) === stable(manifest.artifact.schema);
  if (!cacheConsistent && !allowIncompleteContext) {
    throw new CliError(
      "PROJECT_UPDATE_INCOMPLETE",
      "Cached manifest, schema and lock disagree; the context update is incomplete or the project was modified",
      4,
    );
  }
  return { dir, project, lock, cacheConsistent };
}
export async function optionalProjectOrigin(dir: string) {
  try {
    await access(join(dir, "frontier.json"));
  } catch {
    return undefined;
  }
  return origin(cliProjectSchema.parse(await readJson(join(dir, "frontier.json"))).baseUrl);
}
export type Project = Awaited<ReturnType<typeof loadProject>>;
export function validateArtifact(schema: Record<string, unknown>, artifact: unknown) {
  const is2020 = schema.$schema === "https://json-schema.org/draft/2020-12/schema";
  if (schema.$schema && !is2020 && schema.$schema !== "http://json-schema.org/draft-07/schema#")
    throw new CliError(
      "UNSUPPORTED_SCHEMA",
      "Only JSON Schema draft-07 and 2020-12 are supported",
      5,
    );
  try {
    const validator = new (is2020 ? Ajv2020 : Ajv)({
      allErrors: true,
      strict: false,
      coerceTypes: false,
      useDefaults: false,
      removeAdditional: false,
    });
    const validate = validator.compile(schema);
    if (!validate(artifact))
      throw new CliError(
        "INVALID_ARTIFACT",
        "Artifact does not match its public schema",
        2,
        validate.errors,
      );
  } catch (e) {
    if (e instanceof CliError) throw e;
    throw new CliError(
      "INVALID_SCHEMA",
      "Cannot compile the local schema; external references are not fetched",
    );
  }
}
export async function checkProject(p: Project) {
  const artifact = await readJson(join(p.dir, p.project.artifact));
  const schema = await readJson(join(p.dir, p.project.artifact.replace(".json", ".schema.json")));
  validateArtifact(schema as Record<string, unknown>, artifact);
  const manifest = cliArenaManifestSchema.parse(
    await readJson(join(p.dir, ".frontier", "manifest.json")),
  );
  assertContext(p.lock, manifest);
  if (stable(schema) !== stable(manifest.artifact.schema))
    throw new CliError("SCHEMA_MISMATCH", "Local schema differs from the pinned manifest", 4);
  return {
    artifact: artifact as Record<string, unknown>,
    validation: {
      schema: "valid",
      correctness: "not-evaluated",
      constraints: manifest.constraints.map((constraint) => ({
        constraint,
        status: "not-evaluated",
      })),
    },
  };
}
export function lockFrom(
  manifest: CliArenaManifest,
  baseUrl: string,
  episodeId?: string | null,
): CliLock {
  const episode =
    manifest.id === "rescue-room" ? (episodeId ?? manifest.episodes[0]?.id ?? null) : null;
  if (
    manifest.id === "rescue-room" &&
    (!episode || !manifest.episodes.some((e) => e.id === episode))
  )
    throw new CliError(
      "INVALID_EPISODE",
      "The pinned public episode is unavailable; initialize a new project",
    );
  return cliLockSchema.parse({
    schemaVersion: "1",
    arenaId: manifest.id,
    baseUrl: origin(baseUrl),
    context: manifest.context,
    schemaHash: manifest.artifact.schemaHash,
    starterSha256: manifest.starter.sha256,
    episodeId: episode,
  });
}
export function contextChanges(lock: CliLock, manifest: CliArenaManifest) {
  const next = lockFrom(manifest, lock.baseUrl, lock.episodeId);
  return Object.keys(next)
    .filter((key) => stable(next[key as keyof CliLock]) !== stable(lock[key as keyof CliLock]))
    .map((key) => ({
      field: key,
      before: lock[key as keyof CliLock],
      after: next[key as keyof CliLock],
    }));
}
export function assertContext(lock: CliLock, manifest: CliArenaManifest) {
  if (contextChanges(lock, manifest).length)
    throw new CliError(
      "CONTEXT_MISMATCH",
      "Pinned context differs from the manifest; review context update",
      4,
      contextChanges(lock, manifest),
    );
}
export function capability(
  manifest: CliArenaManifest,
  operation: "practice" | "submit" | "finalEntry",
) {
  const value = manifest.capabilities[operation];
  if (!value.supported)
    throw new CliError("UNSUPPORTED_OPERATION", value.reason ?? `${operation} is unsupported`, 5);
  if (!value.available)
    throw new CliError("SERVICE_UNAVAILABLE", value.reason ?? `${operation} is unavailable`, 5);
}
export async function initialize(
  dir: string,
  manifest: CliArenaManifest,
  zip: Uint8Array,
  baseUrl: string,
) {
  await requireEmpty(dir);
  const files = await verifiedStarter(manifest, zip);
  validateArtifact(manifest.artifact.schema, manifest.artifact.sample);
  const project = cliProjectSchema.parse({
    schemaVersion: "1",
    arenaId: manifest.id,
    baseUrl: origin(baseUrl),
    artifact: manifest.artifact.filename,
    provenance: { kind: "human" },
  });
  const lock = lockFrom(manifest, baseUrl);
  const outputs = {
    ...files,
    [project.artifact]: manifest.artifact.sample,
    [project.artifact.replace(".json", ".schema.json")]: manifest.artifact.schema,
    [join(".frontier", "manifest.json")]: manifest,
    "frontier.json": project,
    "frontier.lock.json": lock,
  };
  const existing = await lstat(dir).catch((e: NodeJS.ErrnoException) => {
    if (e.code === "ENOENT") return null;
    throw e;
  });
  if (existing) {
    // Windows cannot replace an existing directory (including cwd). The lock is the completion marker.
    for (const [name, value] of Object.entries(outputs)) await atomicJson(join(dir, name), value);
    return { directory: dir, project, lock };
  }
  await safePath(dirname(dir));
  await mkdir(dirname(dir), { recursive: true });
  const staging = await mkdtemp(join(dirname(dir), ".frontier-init-"));
  try {
    for (const [name, value] of Object.entries(outputs))
      await atomicJson(join(staging, name), value);
    await requireEmpty(dir);
    // Directory rename publishes all verified files together and cannot replace a nonempty directory.
    await rename(staging, dir);
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
  return { directory: dir, project, lock };
}
