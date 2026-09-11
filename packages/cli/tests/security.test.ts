import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createOperation, loadOperation } from "../src/operation-store.js";
import { atomicJson, digest } from "../src/files.js";
import { tokenFor } from "../src/credential-store.js";
import { origin, initialize, checkProject, loadProject } from "../src/project.js";
import { classify, redact } from "../src/output.js";
import { parse } from "../src/commands.js";
import { verifiedStarter } from "../src/starter.js";
import { zipSync, unzipSync } from "fflate";
import { makeManifest, starterZip, hash } from "./fixtures.js";

const directories: string[] = [];
async function temp() {
  const dir = await mkdtemp(join(tmpdir(), "frontier-cli-test-"));
  directories.push(dir);
  return dir;
}
afterEach(async () => {
  for (const dir of directories.splice(0)) await rm(dir, { recursive: true, force: true });
});

describe("origin and output boundaries", () => {
  it("requires an explicit matching environment token origin", async () => {
    const store = {
      get: async () => null,
      set: async () => {},
      delete: async () => {},
    };
    await expect(
      tokenFor("http://localhost:3000", { FRONTIER_TOKEN: "secret" }, store),
    ).rejects.toMatchObject({ code: "TOKEN_ORIGIN_MISMATCH" });
    await expect(
      tokenFor(
        "http://localhost:3000",
        {
          FRONTIER_TOKEN: "secret",
          FRONTIER_TOKEN_ORIGIN: "https://example.com",
        },
        store,
      ),
    ).rejects.toMatchObject({ exitCode: 3 });
    expect(
      await tokenFor(
        "http://localhost:3000",
        {
          FRONTIER_TOKEN: "secret",
          FRONTIER_TOKEN_ORIGIN: "http://localhost:3000",
        },
        store,
      ),
    ).toBe("secret");
  });
  it.each([
    "http://remote.example",
    "https://user:pass@example.com",
    "https://example.com/path",
    "https://example.com/?token=secret",
  ])("rejects unsafe base URL %s", (value) => expect(() => origin(value)).toThrow());
  it("redacts errors without dropping ordinary raw outcome evidence", () => {
    expect(
      redact(
        {
          raw: { state: "simulated", amount: "0" },
          access_token: "abc",
          message: "failed abc",
        },
        ["abc"],
      ),
    ).toEqual({
      raw: { state: "simulated", amount: "0" },
      access_token: "[REDACTED]",
      message: "failed [REDACTED]",
    });
    expect(classify({ code: "RATE_LIMITED", status: 429, retryAfter: "10" })).toMatchObject({
      exitCode: 6,
      details: { retryAfter: "10" },
    });
    expect(parse(["submit", "--json"]).values.yes).toBeUndefined();
    expect(() => parse(["practice", "--yes"])).toThrow();
  });
});

describe("immutable operation snapshots", () => {
  it("resumes the identical serialized body and key and checks origin, owner and digest", async () => {
    const dir = await temp();
    const operation = await createOperation(dir, {
      baseUrl: "http://localhost:3000",
      userId: "user-a",
      arenaId: "disaster-response",
      context: makeManifest().context,
      body: '{"strategy":{"name":"original"}}',
    });
    await atomicJson(join(dir, "strategy.json"), { name: "edited" });
    expect(await loadOperation(dir, operation.operationId, operation.baseUrl, "user-a")).toEqual(
      operation,
    );
    await expect(
      loadOperation(dir, operation.operationId, operation.baseUrl, "other"),
    ).rejects.toMatchObject({ exitCode: 3 });
    await expect(
      loadOperation(dir, operation.operationId, "https://other.example", "user-a"),
    ).rejects.toMatchObject({ exitCode: 3 });
    await atomicJson(
      join(dir, ".frontier", "operations", `${operation.operationId}.json`),
      { ...operation, body: "{}" },
      true,
    );
    await expect(
      loadOperation(dir, operation.operationId, operation.baseUrl, "user-a"),
    ).rejects.toMatchObject({ code: "INVALID_OPERATION" });
  });
  it("does not overwrite existing destinations, including concurrent creation", async () => {
    const path = join(await temp(), "data.json");
    const results = await Promise.allSettled([
      atomicJson(path, { a: 1 }),
      atomicJson(path, { b: 2 }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(JSON.parse(await readFile(path, "utf8"))).toSatisfy(
      (v: object) => Object.keys(v).length === 1,
    );
  });
});

describe("starter safety", () => {
  it.each(["disaster-response", "rescue-room"] as const)(
    "initializes verified %s starter and checks offline",
    async (arena) => {
      const manifest = makeManifest(arena);
      const archive = starterZip(manifest);
      manifest.starter.sha256 = digest(archive);
      const dir = join(await temp(), "project");
      await initialize(dir, manifest, archive, "http://localhost:3000");
      const checked = await checkProject(await loadProject(dir));
      expect(checked.artifact).toEqual(manifest.artifact.sample);
      expect(checked.validation.correctness).toBe("not-evaluated");
      await expect(
        initialize(dir, manifest, archive, "http://localhost:3000"),
      ).rejects.toMatchObject({ code: "DIRECTORY_NOT_EMPTY" });
    },
  );
  it("also accepts an existing empty directory", async () => {
    const manifest = makeManifest();
    const archive = starterZip(manifest);
    manifest.starter.sha256 = digest(archive);
    const dir = join(await temp(), "empty");
    await mkdir(dir);
    await initialize(dir, manifest, archive, "http://localhost:3000");
    expect((await loadProject(dir)).lock.context.contextHash).toBe(hash);
  });
  it.each([
    "../escape.json",
    "disaster-response-starter/CON.json",
    "disaster-response-starter/evil.js",
    "C:/evil.json",
    "disaster-response-starter/sample_strategy.json:ads",
  ])("rejects unsafe ZIP entry %s", async (extra) => {
    const manifest = makeManifest();
    const archive = starterZip(manifest, { [extra]: Buffer.from("bad") });
    manifest.starter.sha256 = digest(archive);
    await expect(verifiedStarter(manifest, archive)).rejects.toMatchObject({
      code: "UNSAFE_ARCHIVE",
    });
  });
  it("rejects wrong digest and mismatched zipped sample", async () => {
    const manifest = makeManifest();
    const archive = starterZip(manifest);
    await expect(verifiedStarter(manifest, archive)).rejects.toMatchObject({
      code: "STARTER_DIGEST_MISMATCH",
    });
    manifest.starter.sha256 = digest(archive);
    manifest.artifact.sample = { changed: true };
    await expect(verifiedStarter(manifest, archive)).rejects.toMatchObject({
      code: "STARTER_CONTEXT_MISMATCH",
    });
  });
  it("rejects symlink entries and oversized compressed or expanded input", async () => {
    const manifest = makeManifest();
    const files = unzipSync(starterZip(manifest));
    const linkArchive = zipSync({
      ...files,
      "disaster-response-starter/network.json": [
        Buffer.from("../../target"),
        { os: 3, attrs: 0o120777 << 16 },
      ],
    });
    manifest.starter.sha256 = digest(linkArchive);
    await expect(verifiedStarter(manifest, linkArchive)).rejects.toMatchObject({
      code: "UNSAFE_ARCHIVE",
    });
    const expanded = starterZip(manifest, {
      "disaster-response-starter/network.json": new Uint8Array(5 * 1024 * 1024),
    });
    manifest.starter.sha256 = digest(expanded);
    await expect(verifiedStarter(manifest, expanded)).rejects.toMatchObject({
      code: "UNSAFE_ARCHIVE",
    });
    await expect(
      verifiedStarter(manifest, new Uint8Array(8 * 1024 * 1024 + 1)),
    ).rejects.toMatchObject({ code: "UNSAFE_ARCHIVE" });
  });
  it("rejects duplicate central-directory names before materializing any file", async () => {
    const manifest = makeManifest();
    const duplicate = Buffer.from(
      starterZip(manifest, {
        "disaster-response-starter/NETWORK.json": Buffer.from("{}"),
      }),
    );
    const from = Buffer.from("disaster-response-starter/NETWORK.json");
    const to = Buffer.from("disaster-response-starter/network.json");
    let at = duplicate.indexOf(from);
    while (at >= 0) {
      duplicate.set(to, at);
      at = duplicate.indexOf(from, at + to.length);
    }
    manifest.starter.sha256 = digest(duplicate);
    await expect(verifiedStarter(manifest, duplicate)).rejects.toMatchObject({
      code: "UNSAFE_ARCHIVE",
    });
  });
});
