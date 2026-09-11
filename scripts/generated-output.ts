import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const normalizedText = (text: string) => text.replace(/\r\n/g, "\n");

/** Check every output before writing anything. --check never creates directories or files. */
export async function syncGeneratedOutputs(
  root: string,
  outputs: ReadonlyMap<string, string>,
  check: boolean,
): Promise<void> {
  const stale: string[] = [];
  for (const [path, expected] of outputs) {
    const actual = await readFile(resolve(root, path), "utf8").catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return null;
        throw error;
      },
    );
    if (actual === null || normalizedText(actual) !== normalizedText(expected)) stale.push(path);
  }
  if (check) {
    if (stale.length) throw new Error(`Generated files are stale or missing:\n${stale.join("\n")}`);
    return;
  }
  for (const path of stale) {
    const target = resolve(root, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, normalizedText(outputs.get(path)!), "utf8");
  }
}
