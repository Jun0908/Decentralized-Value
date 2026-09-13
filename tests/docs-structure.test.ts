import { access, readdir, readFile, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const docs = new URL("../Docs/", import.meta.url);
const repository = fileURLToPath(new URL("../", import.meta.url));

function ignoredPaths(paths: string[]): string[] {
  const result = spawnSync("git", ["check-ignore", "--no-index", "-z", "--stdin"], {
    cwd: repository,
    input: paths.join("\0") + "\0",
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && result.status !== 1) throw new Error(result.stderr);
  return result.stdout.split("\0").filter(Boolean);
}

describe("documentation navigation contract", () => {
  it("keeps only five project-wide entry documents at the root", async () => {
    const files = (await readdir(docs, { withFileTypes: true }))
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();
    expect(files).toEqual([
      "ARCHITECTURE.md",
      "INTEGRATIONS.md",
      "PRODUCT.md",
      "README.md",
      "STATUS.md",
    ]);
  });

  it("uses four purpose-based folders with hackathon history inside development", async () => {
    const folders = (await readdir(docs, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && entry.name !== "local-only")
      .map((entry) => entry.name)
      .sort();
    expect(folders).toEqual(["development", "evidence", "hackathon", "product"]);
    for (const folder of folders) await access(new URL(`${folder}/README.md`, docs));
    await access(new URL("development/history/README.md", docs));
    await access(new URL("hackathon/DEMO.md", docs));
  });

  it("keeps the full Plan 1–12 development sequence together and indexed", async () => {
    const index = await readFile(new URL("development/plans/README.md", docs), "utf8");
    for (let plan = 1; plan <= 12; plan++) {
      await access(new URL(`development/plans/Plan${plan}.md`, docs));
      expect(index).toContain(`(Plan${plan}.md)`);
    }
  });

  it("resolves relative documentation links and heading anchors", async () => {
    async function markdown(dir: string): Promise<string[]> {
      if (
        ["Docs/local-only", "Docs/hackathon/recording"].includes(
          path.relative(repository, dir).replace(/\\/g, "/"),
        )
      )
        return [];
      const entries = await readdir(dir, { withFileTypes: true });
      const groups = await Promise.all(
        entries.map(async (entry) => {
          const file = path.join(dir, entry.name);
          return entry.isDirectory() ? markdown(file) : entry.name.endsWith(".md") ? [file] : [];
        }),
      );
      return groups.flat();
    }
    function anchors(body: string): Set<string> {
      const found = new Set<string>();
      const seen = new Map<string, number>();
      const withoutFences = body.replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, "");
      for (const match of withoutFences.matchAll(/^#{1,6}\s+(.+)$/gm)) {
        const base = match[1]
          .trim()
          .toLowerCase()
          .replace(/<[^>]*>/g, "")
          .replace(/[\u2000-\u206f]/g, "")
          .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, "")
          .replace(/ /g, "-");
        const count = seen.get(base) ?? 0;
        seen.set(base, count + 1);
        found.add(base + (count ? `-${count}` : ""));
      }
      for (const match of body.matchAll(/(?:id|name)=["']([^"']+)["']/g)) found.add(match[1]);
      return found;
    }
    const root = fileURLToPath(new URL("../", import.meta.url));
    const files = [
      ...(await markdown(fileURLToPath(docs))),
      ...["README.md", "README_JA.md", "AGENTS.md", "design-qa.md"].map((file) =>
        path.join(root, file),
      ),
    ];
    const errors: string[] = [];
    const linkTargets = new Set<string>();
    const cache = new Map<string, Set<string>>();
    for (const file of files) {
      const body = await readFile(file, "utf8");
      for (const match of body.matchAll(/\[[^\]]*\]\((<[^>]*>|[^)\n]*)\)/g)) {
        const uri = match[1].replace(/^<|>$/g, "");
        if (/^(?:[a-z]+:|\/\/)/i.test(uri)) continue;
        const [relative, fragment] = uri.split("#");
        const target = relative
          ? path.resolve(path.dirname(file), decodeURIComponent(relative))
          : file;
        linkTargets.add(target);
        const label = `${path.relative(root, file)} -> ${uri}`;
        try {
          await stat(target);
        } catch {
          errors.push(label);
          continue;
        }
        if (fragment && target.endsWith(".md")) {
          if (!cache.has(target)) cache.set(target, anchors(await readFile(target, "utf8")));
          if (!cache.get(target)!.has(decodeURIComponent(fragment))) errors.push(label);
        }
      }
    }
    for (const target of ignoredPaths([...linkTargets]))
      errors.push(`Public link targets ignored file: ${target}`);
    expect(errors).toEqual([]);
  });

  it("ignores local operations and video material without hiding development or evidence", async () => {
    const local = [
      "Docs/local-only/README.md",
      "Docs/local-only/operations/OWNER_CONFIRMATIONS.md",
      "Docs/local-only/coordination/README.md",
      "Docs/local-only/recording/RESCUE_NARRATION_EN.md",
      "Docs/local-only/source-copies/sponsors--MANUAL_ACTION_REQUIRED.md.txt",
      "Docs/local-only/future-operator-note.md",
      "Docs/hackathon/recording/RESCUE_NARRATION_EN.md",
      "Docs/hackathon/recording/future-take.webm",
      "artifacts/video-demo/future-capture.json",
      "Docs/development/history/docs-cleanup-2026-09-13/originals/RESCUE_HANDOFF.md.txt",
      "Docs/development/history/docs-cleanup-2026-09-13/originals/sponsors--SPONSOR_DEMO_RECORDING.md.txt",
      "Docs/RESCUE_NARRATION_EN.md",
      "Docs/VIDEO_DEMO_103S.md",
      "Docs/sponsors/RAW_VIDEO.md",
      "Docs/sponsors/MANUAL_ACTION_REQUIRED.md",
      "Docs/archive/legacy/prize-checklist.md",
      "Docs/archive/legacy/demo-script.md",
    ];
    const published = [
      "Docs/hackathon/DEMO.md",
      "Docs/hackathon/sponsors/SPONSOR_DEMO.md",
      "Docs/product/arenas/ILLUSTRATIONS.md",
      "Docs/development/plans/Plan1.md",
      "Docs/development/history/work-notes/PARALLEL_IMPLEMENTATION.md",
      "Docs/development/history/work-notes/SUBMISSION_CHANGE_INVENTORY.md",
      "Docs/development/history/work-notes/EXISTING_SPONSOR_CONNECTION_CHECK.md",
      "Docs/evidence/deployments/sepolia-rescue-service-demo.json",
      "scripts/record-sponsor-demo.ts",
      "apps/web/public/images/calldata-packing-story.png",
    ];
    expect(ignoredPaths([...local, ...published]).sort()).toEqual(local.sort());
    for (const file of published) await access(path.join(repository, file));
    const tracked = spawnSync(
      "git",
      [
        "ls-files",
        "--cached",
        "--",
        "Docs/local-only",
        "Docs/hackathon/recording",
        "artifacts/video-demo",
        ...local,
      ],
      { cwd: repository, encoding: "utf8" },
    );
    expect(tracked.status).toBe(0);
    expect(tracked.stdout.trim()).toBe("");
  });

  it("keeps design QA in English and retains the forbidden lime/light pairing rule", async () => {
    const qa = await readFile(new URL("../design-qa.md", import.meta.url), "utf8");
    expect(qa).not.toMatch(/[\u3040-\u30ff\u3400-\u9fff]/u);
    expect(qa).toContain("**Never pair**");
    expect(qa).toContain("#c7ff45");
    expect(qa).toContain("4.5:1");
    expect(qa).toContain("final result: blocked");
    await access(new URL("development/history/design-qa-original-2026-09-13.md.txt", docs));
  });
});
