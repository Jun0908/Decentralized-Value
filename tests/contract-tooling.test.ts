import { mkdtemp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { plan6SubmissionSchema as canonicalSubmission } from "../apps/api/src/plan6-competition";
import { plan6SubmissionSchema as generatedSubmission } from "../packages/sdk/src/generated/request-schemas";
import { syncGeneratedOutputs } from "../scripts/generated-output";
import { extractRequestSchemas, generateSdkContract } from "../scripts/sync-contract";
import { validatePackedManifest } from "../scripts/verify-package";
import disasterFixture from "./fixtures/disaster-response.json";

describe("non-mutating contract generation", () => {
  it("reports every stale/missing output without changing content or timestamps", async () => {
    const root = await mkdtemp(join(tmpdir(), "frontier-contract-check-"));
    await writeFile(join(root, "current.txt"), "old\r\n");
    const before = await stat(join(root, "current.txt"));
    const outputs = new Map([
      ["current.txt", "new\n"],
      ["nested/missing.txt", "new\n"],
    ]);
    await expect(syncGeneratedOutputs(root, outputs, true)).rejects.toThrow(
      "current.txt\nnested/missing.txt",
    );
    expect(await readFile(join(root, "current.txt"), "utf8")).toBe("old\r\n");
    expect((await stat(join(root, "current.txt"))).mtimeMs).toBe(before.mtimeMs);
    expect(await readdir(root)).toEqual(["current.txt"]);
    await syncGeneratedOutputs(root, outputs, false);
    await expect(syncGeneratedOutputs(root, outputs, true)).resolves.toBeUndefined();
  });

  it("accepts Windows checkout newlines and does not rewrite a current output", async () => {
    const root = await mkdtemp(join(tmpdir(), "frontier-contract-lines-"));
    await writeFile(join(root, "fixture.txt"), "one\r\ntwo\r\n");
    const before = await stat(join(root, "fixture.txt"));
    const outputs = new Map([["fixture.txt", "one\ntwo\n"]]);
    await syncGeneratedOutputs(root, outputs, true);
    await syncGeneratedOutputs(root, outputs, false);
    expect((await stat(join(root, "fixture.txt"))).mtimeMs).toBe(before.mtimeMs);
  });

  it("reproduces checked-in SDK types, source refinements and deterministic fixtures", async () => {
    const root = resolve(import.meta.dirname, "..");
    const outputs = await generateSdkContract(root);
    await expect(syncGeneratedOutputs(root, outputs, true)).resolves.toBeUndefined();
    // Exercise real generated files in an isolated directory: never corrupt the worktree.
    const isolated = await mkdtemp(join(tmpdir(), "frontier-contract-corrupt-"));
    await syncGeneratedOutputs(isolated, outputs, false);
    const target = "packages/sdk/src/generated/request-schemas.ts";
    await writeFile(join(isolated, target), "// corrupted snapshot\n");
    await expect(syncGeneratedOutputs(isolated, outputs, true)).rejects.toThrow(target);
    expect(await readFile(join(isolated, target), "utf8")).toBe("// corrupted snapshot\n");
    await syncGeneratedOutputs(isolated, outputs, false);
    await expect(syncGeneratedOutputs(isolated, outputs, true)).resolves.toBeUndefined();
  }, 30_000);

  it("fails closed when canonical declarations disappear or become ambiguous", () => {
    expect(() => extractRequestSchemas("const somethingElse = 1;")).toThrow("review the generator");
    expect(() =>
      extractRequestSchemas(
        "const supplierIdSchema = 1, extra = 2; const disasterResponseStrategySchema = 3; const plan6SubmissionSchema = 4;",
      ),
    ).toThrow("review the generator");
  });
});

describe("copied API cross-field refinements", () => {
  const base = { strategy: disasterFixture.manifest.artifact.sample, sourceMethod: "JSON" };
  it.each([
    ["ordinary submission", base, true],
    [
      "missing paired commit",
      { ...base, repositoryUrl: "https://github.com/example/agent" },
      false,
    ],
    ["missing paired repository", { ...base, sourceCommit: "a".repeat(40) }, false],
    ["missing agent evidence", { ...base, sourceMethod: "AGENT_API" }, false],
    [
      "complete agent evidence",
      {
        ...base,
        sourceMethod: "AGENT_API",
        agentEvidence: { name: "Commander", version: "1", objective: "Preserve tradeoffs" },
      },
      true,
    ],
    ["unknown input property", { ...base, overrideScore: 1 }, false],
  ])("retains server semantics for %s", (_name, input, valid) => {
    const actual = generatedSubmission.safeParse(input);
    const expected = canonicalSubmission.safeParse(input);
    expect(actual.success).toBe(valid);
    expect(actual).toEqual(expected);
  });
});

describe("standalone package manifest validation", () => {
  const expected = {
    name: "@frontier/sdk",
    version: "0.9.0",
    dependencies: { "@frontier/shared": "workspace:*", zod: "4.5.4" },
  };
  const versions = new Map([["@frontier/shared", "0.8.0"]]);
  const installed = { ...expected, dependencies: { "@frontier/shared": "0.8.0", zod: "4.5.4" } };
  it("uses current workspace identities and converted dependency versions", () => {
    expect(() => validatePackedManifest(installed, expected, versions)).not.toThrow();
  });
  it.each(["workspace:*", "file:../shared", "link:../shared", "../shared", "C:\\repo\\shared"])(
    "rejects %s",
    (version) => {
      expect(() =>
        validatePackedManifest(
          {
            ...installed,
            dependencies: { ...installed.dependencies, "@frontier/shared": version },
          },
          expected,
          versions,
        ),
      ).toThrow("Nonportable");
    },
  );
  it("rejects changed identities, versions and dropped runtime dependencies", () => {
    expect(() =>
      validatePackedManifest({ ...installed, version: "0.3.0" }, expected, versions),
    ).toThrow("identity");
    expect(() =>
      validatePackedManifest(
        { ...installed, dependencies: { ...installed.dependencies, "@frontier/shared": "0.2.0" } },
        expected,
        versions,
      ),
    ).toThrow("version");
    expect(() =>
      validatePackedManifest({ ...installed, dependencies: { zod: "4.5.4" } }, expected, versions),
    ).toThrow("names");
  });
});
