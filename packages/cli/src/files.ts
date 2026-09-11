import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { open, mkdir, lstat, readdir, rename, unlink, link } from "node:fs/promises";
import { dirname, resolve, parse as parsePath, join } from "node:path";
import { CliError } from "./output.js";

export function digest(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}
export function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export async function safePath(path: string) {
  const absolute = resolve(path);
  let current = parsePath(absolute).root;
  for (const part of absolute.slice(current.length).split(/[\\/]/).filter(Boolean)) {
    current = join(current, part);
    const stat = await lstat(current).catch((e: NodeJS.ErrnoException) => {
      if (e.code === "ENOENT") return null;
      throw e;
    });
    if (stat?.isSymbolicLink())
      throw new CliError("UNSAFE_PATH", "Symbolic links are not allowed in project paths");
  }
  return absolute;
}
export async function readJson(path: string, limit = 8 * 1024 * 1024): Promise<unknown> {
  await safePath(path);
  let file;
  try {
    file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > limit)
      throw new CliError("INVALID_FILE", "Expected a bounded regular JSON file");
    return JSON.parse(await file.readFile("utf8"));
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError("INVALID_FILE", "Cannot read valid JSON", 2, { path });
  } finally {
    await file?.close();
  }
}
export async function atomicJson(path: string, value: unknown, replace = false) {
  await safePath(path);
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  const file = await open(temporary, "wx", 0o600);
  try {
    await file.writeFile(`${JSON.stringify(value, null, 2)}\n`);
    await file.sync();
  } finally {
    await file.close();
  }
  try {
    if (replace) await rename(temporary, path);
    else {
      await link(temporary, path);
      await unlink(temporary);
    }
  } catch (error) {
    await unlink(temporary).catch(() => {});
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      throw new CliError("FILE_EXISTS", "Destination already exists", 2, {
        path,
      });
    throw error;
  }
}
export async function requireEmpty(path: string) {
  await safePath(path);
  const entries = await readdir(path).catch((e: NodeJS.ErrnoException) => {
    if (e.code === "ENOENT") return [];
    throw e;
  });
  if (entries.length)
    throw new CliError("DIRECTORY_NOT_EMPTY", "Init requires a new or empty directory");
}
