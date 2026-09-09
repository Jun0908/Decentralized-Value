import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const version = "4.13.0";
const depth = 3;
const outputDirectory = join("apps", "web", "public", "semaphore", version);
const baseUrl = `https://snark-artifacts.pse.dev/semaphore/${version}`;
const expectedHashes = {
  wasm: "48e15502f710be0a623d573d472edeeaf918fd5eee0b2ca9b407c4e4f20d12f2",
  zkey: "c36653c42784df35a01f3d93415af9ad8292a540f8deb134a6a34a01752a89d3",
} as const;

await mkdir(outputDirectory, { recursive: true });

for (const extension of ["wasm", "zkey"] as const) {
  const name = `semaphore-${depth}.${extension}`;
  const response = await fetch(`${baseUrl}/${name}`);
  if (!response.ok) throw new Error(`Failed to download ${name}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== expectedHashes[extension]) {
    throw new Error(`Refusing unexpected ${name} artifact hash: ${hash}`);
  }
  await writeFile(join(outputDirectory, name), bytes);
}

process.stdout.write(`Downloaded pinned Semaphore ${version} depth-${depth} artifacts.`);
