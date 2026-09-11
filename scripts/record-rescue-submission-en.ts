/** Read-only UI QA and optional silent recording. Never calls a model/payment endpoint. */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const recording = process.argv.includes("--record");
const output = resolve(".frontier/handoff/rescue-en");
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const reports: unknown[] = [];
try {
  // Inventory: English copy, five chapter links, six details, both downloads, language
  // switch, mobile/reduced motion, keyboard toggle, long hashes, console and overflow.
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (e) => {
      if (e.type() === "error") errors.push(e.text());
    });
    const response = await page.goto("http://localhost:3000/rescue-room/submission/en", {
      waitUntil: "networkidle",
    });
    assert.equal(response?.status(), 200);
    assert.equal(await page.locator("main").getAttribute("lang"), "en");
    const body = await page.locator("main").innerText();
    for (const claim of [
      "71.13%",
      "100.00%",
      "Do nothing",
      "not committed or paid",
      "no inference or payment",
    ])
      assert.ok(body.includes(claim), claim);
    assert.equal(await page.locator("ol > li").count(), 3);
    await page.screenshot({ path: resolve(output, `en-${width}-intro.png`) });
    for (const [chapter, text] of [
      ["purchase", "1. Hire"],
      ["response", "2. Decide"],
      ["outcomes", "3. Compare"],
      ["pools", "4. Allocate"],
      ["replay", "5. Verify"],
    ]) {
      await page.getByRole("link", { name: text, exact: true }).click();
      assert.equal(new URL(page.url()).hash, `#${chapter}`);
      await page.screenshot({ path: resolve(output, `en-${width}-${chapter}.png`) });
    }
    const details = page.locator("main details");
    for (const detail of await details.all()) {
      await detail.locator("summary").focus();
      await page.keyboard.press("Enter");
      assert.equal(await detail.evaluate((e) => (e as HTMLDetailsElement).open), true);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
      await page.keyboard.press("Enter");
      assert.equal(await detail.evaluate((e) => (e as HTMLDetailsElement).open), false);
    }
    for (const [label, filename] of [
      ["Download replay inputs", "rescue-submission-replay.json"],
      ["Download public evidence", "rescue-submission-demo.json"],
    ]) {
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("link", { name: label, exact: true }).click(),
      ]);
      assert.equal(download.suggestedFilename(), filename);
    }
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    const violations = await page.locator("main a, main summary, main span").evaluateAll(
      (elements) =>
        elements.filter((e) => {
          const s = getComputedStyle(e);
          return s.backgroundColor === "rgb(199, 255, 69)" && s.color !== "rgb(17, 17, 17)";
        }).length,
    );
    assert.equal(violations, 0);
    const tx = page.getByRole("link", { name: "View payment transaction" });
    assert.match(
      (await tx.getAttribute("href"))!,
      /^https:\/\/sepolia\.etherscan\.io\/tx\/0x[0-9a-f]{64}$/,
    );
    await page.getByRole("link", { name: "日本語版" }).click();
    await page.waitForURL("**/rescue-room/submission");
    await page.getByRole("link", { name: "English demo" }).click();
    await page.waitForURL("**/rescue-room/submission/en");
    assert.deepEqual(errors, []);
    reports.push({
      width,
      passed: true,
      consoleErrors: 0,
      horizontalOverflow: false,
      contrastViolations: 0,
    });
    await context.close();
  }
  if (recording) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: { dir: output, size: { width: 1440, height: 900 } },
    });
    const page = await context.newPage();
    await page.goto("http://localhost:3000/rescue-room/submission/en", {
      waitUntil: "networkidle",
    });
    const started = Date.now();
    const cue = async (second: number, chapter?: string) => {
      const remaining = second * 1000 - (Date.now() - started);
      if (remaining > 0) await page.waitForTimeout(remaining);
      if (chapter) await page.getByRole("link", { name: chapter, exact: true }).click();
      console.log(`Recording cue ${second}s: ${chapter ?? "intro/end"}`);
    };
    await cue(20, "1. Hire");
    await page.getByText("Read the delivered analysis", { exact: true }).click();
    await cue(43, "2. Decide");
    await page.locator("ol details").last().locator("summary").click();
    await cue(63, "3. Compare");
    await cue(84, "4. Allocate");
    await cue(107, "5. Verify");
    await cue(125);
    const video = page.video()!;
    await context.close();
    await video.saveAs(resolve(output, "rescue-room-en-silent.webm"));
    reports.push({
      recording: "rescue-room-en-silent.webm",
      viewport: "1440x900",
      plannedSeconds: 125,
      audio: false,
      source: "actual local recorded-evidence page",
      newModelCalls: 0,
      newPayments: 0,
    });
  }
  writeFileSync(resolve(output, "ui-qa.json"), JSON.stringify(reports, null, 2));
  console.log(JSON.stringify(reports));
} finally {
  await browser.close();
}
