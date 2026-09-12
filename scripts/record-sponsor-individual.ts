/** Sponsor-specific raw Playwright capture. Public evidence only, no new execution. */
import assert from "node:assert/strict";
import { mkdir, writeFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, type Page } from "playwright";

const id = process.argv[2];
assert(id === "ens" || id === "cre" || id === "bazantic", "Choose ens, cre or bazantic");
const output = resolve(`.frontier/handoff/sponsors-individual-2026-09-12/${id}`);
const videoPath = resolve(output, `${id}-raw.webm`);
assert(
  !(await access(videoPath).then(
    () => true,
    () => false,
  )),
  "Existing recording must not be overwritten",
);
await mkdir(output, { recursive: true });
const url = `http://localhost:3000/sponsors/demo#${id}`;
const evidencePath = resolve(output, `${id}-evidence.json`);
const browser = await chromium.launch({ channel: "chrome", headless: true });

async function focus(page: Page, selector: string) {
  const box = await page.locator(selector).boundingBox();
  assert(box);
  await page.mouse.wheel(0, box.y - 96);
  await page.waitForTimeout(700);
}

try {
  const preflight = await browser.newContext();
  const response = await preflight.request.get(
    `http://localhost:3000/sponsors/demo/evidence/${id}`,
  );
  assert.equal(response.status(), 200);
  const evidence = await response.json();
  assert(typeof evidence.schemaVersion === "string");
  // Save the exact public download, not an authored screen or a rewritten result.
  await writeFile(evidencePath, await response.body());
  const warmup = await preflight.newPage();
  assert.equal((await warmup.goto(url))?.status(), 200);
  await warmup.goto(pathToFileURL(evidencePath).href);
  assert((await warmup.locator("body").innerText()).includes(evidence.schemaVersion));
  await preflight.close();

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: output, size: { width: 1920, height: 1080 } },
  });
  const page = await context.newPage();
  const errors: string[] = [];
  const unexpectedWrites: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (e) => {
    if (e.type() === "error") errors.push(e.text());
  });
  await page.route("**/*", async (route) => {
    if (!["GET", "HEAD"].includes(route.request().method())) {
      unexpectedWrites.push(route.request().method());
      await route.abort();
    } else await route.continue();
  });
  assert.equal((await page.goto(url, { waitUntil: "networkidle" }))?.status(), 200);
  await focus(page, `#${id}`);
  const started = Date.now();
  const cue = async (seconds: number, name: string) => {
    const remaining = started + seconds * 1000 - Date.now();
    if (remaining > 0) await page.waitForTimeout(remaining);
    assert.deepEqual(errors, []);
    assert.deepEqual(unexpectedWrites, []);
    console.log(`${id}: ${seconds}s ${name}`);
  };
  await page.screenshot({ path: resolve(output, "01-overview.png") });
  await cue(18, "open evidence details");
  await page.locator(`#${id} summary`).click();
  await focus(page, `#${id} details`);
  await page.screenshot({ path: resolve(output, "02-details.png") });
  await cue(35, "inspect recorded proof");
  if (id === "ens") {
    await page.locator("#ens details a").last().hover();
  } else {
    await page.locator(`#${id} details code`).last().scrollIntoViewIfNeeded();
  }
  await page.screenshot({ path: resolve(output, "03-proof.png") });
  await cue(50, "open actual downloaded JSON");
  await page.goto(pathToFileURL(evidencePath).href, { waitUntil: "load" });
  assert((await page.locator("body").innerText()).includes(evidence.schemaVersion));
  await page.screenshot({ path: resolve(output, "04-json.png") });
  await cue(65, "scroll original evidence");
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(700);
  await page.screenshot({ path: resolve(output, "05-json-detail.png") });
  await cue(76, "return to sponsor overview");
  await page.goto(url, { waitUntil: "networkidle" });
  await focus(page, `#${id}`);
  await page.screenshot({ path: resolve(output, "06-overview.png") });
  await cue(90, "end");
  const video = page.video()!;
  await context.close();
  await video.saveAs(videoPath);
  await writeFile(
    resolve(output, "recording.json"),
    JSON.stringify(
      {
        sponsor: id,
        source: url,
        plannedSeconds: 90,
        createdAt: new Date().toISOString(),
        audio: false,
        overlays: false,
        cssInjection: false,
        cuts: false,
        newModelCalls: 0,
        newPayments: 0,
        errors,
        unexpectedWrites,
        evidenceViewer: "Chrome displaying the actual public JSON download",
        note: "Original recording includes initial page loading; no new sponsor execution",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ sponsor: id, videoPath, verified: true }));
} finally {
  await browser.close();
}
