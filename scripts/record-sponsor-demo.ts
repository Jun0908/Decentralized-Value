/** Record existing public evidence only. No model calls, transactions or application edits. */
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type Page } from "playwright";

const output = resolve(".frontier/handoff/sponsors-raw-2026-09-12");
await mkdir(output, { recursive: true });
const record = process.argv.includes("--record");
const origin = "http://localhost:3000";
const duration = 116;
const chapters = [
  {
    id: "intro",
    start: 0,
    end: 10,
    label: "RESCUE ROOM · THREE WORKING INTEGRATIONS",
    caption: "Who gets to decide what better means?",
    note: "Recorded execution evidence · September 12, 2026",
    narration:
      "Who gets to decide what better means? Rescue Room keeps outcomes independent. Here are three working integrations.",
  },
  {
    id: "ens",
    start: 10,
    end: 24,
    label: "01 / ENSv2 · SEPOLIA",
    caption: "Discover a service by name. Delegate only one text record.",
    note: "Operator-managed service · not a third-party marketplace",
    narration:
      "First, ENS. Our existing name resolves a Rescue practice service. The owner delegated permission for just one text record.",
  },
  {
    id: "ens-proof",
    start: 24,
    end: 40,
    label: "01 / ENSv2 · CONFIRMED TRANSACTIONS",
    caption: "Grant → activate → pause → restore → revoke",
    note: "7 confirmed transactions · post-revocation rejection checked with eth_call",
    narration:
      "The delegate activated and paused the service. Paused discovery was rejected. We restored the service, revoked permission, and verified that another write was rejected. These are real Sepolia transactions.",
  },
  {
    id: "cre",
    start: 40,
    end: 56,
    label: "02 / CHAINLINK CRE · OFFICIAL CLI SIMULATION",
    caption: "Commit first. Supply the private scenario through a secret input.",
    note: "Confidential handler in local simulation · not live TEE attestation",
    narration:
      "Second, Chainlink CRE. We committed a fresh scenario before execution and supplied the private pack through a secret input. The official confidential simulation returned a salted receipt.",
  },
  {
    id: "cre-proof",
    start: 56,
    end: 76,
    label: "02 / CHAINLINK CRE · REPLAYABLE EVIDENCE",
    caption: "Independent Node execution matched. Reveal and replay passed.",
    note: "No onchain commitment · no completed hidden Final tournament",
    narration:
      "Independent Node execution matched the receipt. After explicit reveal, we replayed the scenario and verified the result. The commitment and executed build hashes are available here. This is local simulation, not a live TEE attestation or a completed Final tournament.",
  },
  {
    id: "bazantic",
    start: 76,
    end: 91,
    label: "03 / BAZANTIC MCP · REAL EXTERNAL AI",
    caption: "One AI. Two strategies. The same episode and context.",
    note: "External OpenAI agent through Bazantic MCP · not a hosted Recipe",
    narration:
      "Third, Bazantic. A real external AI read the manifest and evaluated two strategies through MCP. It reduced the investigation budget from ninety to sixty credits.",
  },
  {
    id: "bazantic-proof",
    start: 91,
    end: 108,
    label: "03 / BAZANTIC MCP · VERIFIED TOOL CALLS",
    caption: "Three successful tool calls. The observed outcome is a tie.",
    note: "SDK integrity and local replay matched · simulated game credits, not tokens",
    narration:
      "Both strategies produced equal outcomes here. We show the tie honestly and keep user loss, availability, and spending separate. The tool calls and submitted parameters are recorded. This is external AI using Bazantic, not hosted Recipe execution.",
  },
  {
    id: "outro",
    start: 108,
    end: 116,
    label: "VALUE DECENTRALIZATION",
    caption: "Measure once. Preserve the tradeoffs. Let values diverge.",
    note: "Evidence is downloadable · no weighted score · no new payments in this recording",
    narration:
      "The evidence is downloadable. Measure once. Preserve the tradeoffs. Let values diverge.",
  },
];

async function topOf(page: Page, selector: string) {
  await page.locator(selector).evaluate((element) => {
    window.scrollTo({
      top: window.scrollY + element.getBoundingClientRect().top - 95,
      behavior: "smooth",
    });
  });
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const warmup = await browser.newPage();
  assert.equal((await warmup.goto(`${origin}/sponsors/demo`))?.status(), 200);
  await warmup.close();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ...(record ? { recordVideo: { dir: output, size: { width: 1920, height: 1080 } } } : {}),
  });
  const captureStart = Date.now();
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (e) => {
    if (e.type() === "error") errors.push(e.text());
  });
  // A recording of a read-only page must not silently start paid work.
  await page.route("**/*", async (route) => {
    assert(
      ["GET", "HEAD"].includes(route.request().method()),
      "Recording unexpectedly attempted a write request",
    );
    await route.continue();
  });
  assert.equal(
    (await page.goto(`${origin}/sponsors/demo`, { waitUntil: "networkidle" }))?.status(),
    200,
  );
  // Raw capture: no DOM overlays, CSS injection, captions, audio or hidden app elements.
  await page.waitForTimeout(600);
  const started = Date.now();
  const trimStartSeconds = (started - captureStart) / 1000;
  for (const chapter of chapters) {
    if (record) {
      const remaining = started + chapter.start * 1000 - Date.now();
      if (remaining > 0) await page.waitForTimeout(remaining);
    }
    if (chapter.id === "ens") await topOf(page, "#ens");
    if (chapter.id === "ens-proof") {
      await page.locator("#ens summary").click();
      await topOf(page, "#ens details");
    }
    if (chapter.id === "cre") await topOf(page, "#cre");
    if (chapter.id === "cre-proof") {
      await page.locator("#cre summary").click();
      await topOf(page, "#cre details");
    }
    if (chapter.id === "bazantic") await topOf(page, "#bazantic");
    if (chapter.id === "bazantic-proof") {
      await page.locator("#bazantic summary").click();
      await topOf(page, "#bazantic details");
    }
    if (chapter.id === "outro") {
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("link", { name: "Download AI execution evidence", exact: true }).click(),
      ]);
      await download.saveAs(resolve(output, "bazantic-evidence.json"));
      await topOf(page, "#bazantic");
    }
    await page.waitForTimeout(650);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    assert.deepEqual(errors, []);
    await page.screenshot({ path: resolve(output, `${chapter.id}.png`) });
    console.log(`Scene ${chapter.start}s: ${chapter.id}`);
  }
  if (record) {
    const remaining = started + duration * 1000 - Date.now();
    if (remaining > 0) await page.waitForTimeout(remaining);
    const video = page.video()!;
    await context.close();
    await video.saveAs(resolve(output, "sponsor-demo-raw.webm"));
  } else await context.close();
  const manifest = {
    createdAt: new Date().toISOString(),
    source: `${origin}/sponsors/demo`,
    duration,
    trimStartSeconds,
    recording: record,
    width: 1920,
    height: 1080,
    audio: false,
    newModelCalls: 0,
    newPayments: 0,
    consoleErrors: errors,
    overlays: false,
    cssInjection: false,
    editing: "none; original Playwright recording includes initial page load",
    chapters,
  };
  await writeFile(resolve(output, "recording.json"), JSON.stringify(manifest, null, 2) + "\n");
  await writeFile(
    resolve(output, "narration-en.txt"),
    chapters.map((c) => c.narration).join("\n\n") + "\n",
  );
  await writeFile(
    resolve(output, "narration-timed-en.md"),
    "# Sponsor demo narration\n\nSilent picture master. Add your voice; do not present these as newly executed transactions.\n\n" +
      chapters
        .map((c) => `## ${c.start}–${c.end} seconds · ${c.label}\n\n${c.narration}\n`)
        .join("\n"),
  );
  for (const [id, name] of [
    ["ens", "ensv2-rescue-demo"],
    ["cre", "chainlink-cre-private-pack"],
    ["bazantic", "bazantic-rescue-agent-demo"],
  ]) {
    await copyFile(
      resolve(`Docs/deployments/${name}.json`),
      resolve(output, `${id}-evidence.json`),
    );
    const group = chapters.filter((c) => c.id === id || c.id === `${id}-proof`);
    await writeFile(
      resolve(output, `${id}-narration-en.txt`),
      group.map((c) => c.narration).join("\n\n") + "\n",
    );
  }
  // Source hashes, not a claim that footage itself verifies chain execution.
  const { createHash } = await import("node:crypto");
  const evidenceHashes = Object.fromEntries(
    await Promise.all(
      ["ens", "cre", "bazantic"].map(async (id) => [
        id,
        createHash("sha256")
          .update(await readFile(resolve(output, `${id}-evidence.json`)))
          .digest("hex"),
      ]),
    ),
  );
  await writeFile(resolve(output, "evidence-hashes.json"), JSON.stringify(evidenceHashes, null, 2));
  console.log(
    JSON.stringify({ record, duration, trimStartSeconds, output, consoleErrors: errors.length }),
  );
} finally {
  await browser.close();
}
