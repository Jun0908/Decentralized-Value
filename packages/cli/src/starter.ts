import { fromBuffer, type Entry } from "yauzl";
import type { CliArenaManifest } from "@frontier/shared/cli";
import { digest, stable } from "./files.js";
import { CliError } from "./output.js";

const MAX_ARCHIVE = 8 * 1024 * 1024;
const MAX_ENTRY = 4 * 1024 * 1024;
const MAX_TOTAL = 16 * 1024 * 1024;
const allowed = {
  "disaster-response": [
    "challenge-manifest.json",
    "network.json",
    "training-scenarios.json",
    "value-pools.json",
    "sample_strategy.json",
    "submission-schema.json",
    "evaluation-contract.json",
    "agent-submission.example.json",
    "policy-artifact-v1.schema.json",
    "baseline-agent.mjs",
    "README.md",
  ],
  "rescue-room": [
    "challenge-manifest.json",
    "public-practice-alerts.json",
    "service-agents.json",
    "playbook.schema.json",
    "doctrine.schema.json",
    "doctrine-presets.json",
    "starter-playbook.json",
    "runtime-contract.json",
    "request.example.json",
    "doctrine-request.example.json",
    "payment-contract.json",
    "README.md",
  ],
};
export async function verifiedStarter(
  manifest: CliArenaManifest,
  archive: Uint8Array,
): Promise<Record<string, unknown>> {
  if (archive.byteLength > MAX_ARCHIVE)
    throw new CliError("UNSAFE_ARCHIVE", "Starter archive exceeds the size limit");
  if (digest(archive) !== manifest.starter.sha256)
    throw new CliError(
      "STARTER_DIGEST_MISMATCH",
      "Starter ZIP SHA-256 does not match the manifest",
      4,
    );
  const extracted = await new Promise<Record<string, Buffer>>((resolve, reject) => {
    fromBuffer(
      Buffer.from(archive),
      { lazyEntries: true, strictFileNames: true, validateEntrySizes: true },
      (error, zip) => {
        if (error || !zip) return reject(new CliError("UNSAFE_ARCHIVE", "Invalid ZIP archive"));
        const result: Record<string, Buffer> = Object.create(null);
        const seen = new Set<string>();
        let total = 0;
        let ended = false;
        const fail = () => {
          if (!ended) {
            ended = true;
            zip.close();
            reject(
              new CliError(
                "UNSAFE_ARCHIVE",
                "Starter archive contains an unsafe entry or exceeds limits",
              ),
            );
          }
        };
        zip.on("error", fail);
        zip.on("end", () => {
          if (!ended) {
            ended = true;
            resolve(result);
          }
        });
        zip.on("entry", (entry: Entry) => {
          const name = entry.fileName;
          const prefix = `${manifest.id}-starter/`;
          const relative = name.slice(prefix.length);
          const fileType = (entry.externalFileAttributes >>> 16) & 0o170000;
          if (
            !name.startsWith(prefix) ||
            !allowed[manifest.id].includes(relative) ||
            /[\\:\x00-\x1f]/.test(name) ||
            name
              .split("/")
              .some(
                (part) =>
                  part === ".." ||
                  /[. ]$/.test(part) ||
                  /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),
              ) ||
            (fileType !== 0 && fileType !== 0o100000) ||
            entry.generalPurposeBitFlag & 1 ||
            seen.has(name.toLowerCase()) ||
            seen.size >= 64 ||
            entry.uncompressedSize > MAX_ENTRY ||
            (total += entry.uncompressedSize) > MAX_TOTAL
          )
            return fail();
          seen.add(name.toLowerCase());
          zip.openReadStream(entry, (streamError, stream) => {
            if (streamError || !stream) return fail();
            const chunks: Buffer[] = [];
            let size = 0;
            stream.on("error", fail);
            stream.on("data", (chunk: Buffer) => {
              size += chunk.length;
              if (size > MAX_ENTRY || size > entry.uncompressedSize) {
                stream.destroy();
                fail();
              } else chunks.push(chunk);
            });
            stream.on("end", () => {
              if (ended) return;
              if (size !== entry.uncompressedSize) return fail();
              result[relative] = Buffer.concat(chunks);
              zip.readEntry();
            });
          });
        });
        zip.readEntry();
      },
    );
  });
  function json(name: string): unknown {
    try {
      if (!extracted[name]) throw new Error();
      return JSON.parse(extracted[name].toString("utf8"));
    } catch {
      throw new CliError("INVALID_STARTER", `Missing or invalid starter file: ${name}`);
    }
  }
  const sample =
    manifest.id === "disaster-response"
      ? (json("sample_strategy.json") as { strategy: unknown }).strategy
      : (json("doctrine-request.example.json") as { doctrine: unknown }).doctrine;
  const schema = json(
    manifest.id === "disaster-response" ? "submission-schema.json" : "doctrine.schema.json",
  );
  if (
    stable(sample) !== stable(manifest.artifact.sample) ||
    stable(schema) !== stable(manifest.artifact.schema)
  )
    throw new CliError(
      "STARTER_CONTEXT_MISMATCH",
      "Zipped sample or schema differs from the manifest",
      4,
    );
  const contract = json(
    manifest.id === "disaster-response" ? "evaluation-contract.json" : "runtime-contract.json",
  ) as Record<string, unknown>;
  if (
    contract.contextHash !== manifest.context.contextHash ||
    (manifest.context.runtimeContextHash &&
      contract.doctrineContextHash !== manifest.context.runtimeContextHash)
  )
    throw new CliError("STARTER_CONTEXT_MISMATCH", "Zipped context differs from the manifest", 4);
  // Only public data is materialized. Scripts and alternate runtime examples are never copied or run.
  const names =
    manifest.id === "disaster-response"
      ? ["network.json", "training-scenarios.json", "evaluation-contract.json"]
      : ["public-practice-alerts.json", "service-agents.json", "payment-contract.json"];
  return Object.fromEntries(names.map((name) => [name, json(name)]));
}
