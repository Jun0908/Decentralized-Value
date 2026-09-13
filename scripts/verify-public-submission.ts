import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

// Read-only UI / recorded evidence inspection. No live AI, payment or settlement clicks.
const origin = "https://web-rho-seven-d6te7t3f0y.vercel.app";
const output = ".frontier/public-submission-qa";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const records: object[] = [];
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    for (const route of [
      "/",
      "/arenas",
      "/arenas/emergency-supply",
      "/arenas/rescue-room",
      "/arenas/ocean-commons",
      "/sponsors/demo",
      "/rescue-room/submission/en",
    ]) {
      const response = await page.goto(origin + route, { waitUntil: "networkidle" });
      assert.equal(response?.status(), 200);
      assert.ok((await page.locator("main").innerText()).length > 100);
      assert.equal(await page.locator("[data-nextjs-dialog]").count(), 0);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
      if (route === "/sponsors/demo") {
        for (const [id, filename] of [
          ["ens", "ensv2-rescue-demo.json"],
          ["cre", "chainlink-cre-private-pack.json"],
          ["bazantic", "bazantic-rescue-agent-demo.json"],
        ]) {
          const link = page.locator(`a[href="/sponsors/demo/evidence/${id}"]`);
          const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
          const file = await download.path();
          assert.ok(file);
          assert.deepEqual(
            JSON.parse(await readFile(file, "utf8")),
            JSON.parse(await readFile(`Docs/evidence/deployments/${filename}`, "utf8")),
          );
          records.push({ width, evidence: id, matchesCommittedEvidence: true });
        }
      }
      assert.deepEqual(errors, []);
      await page.screenshot({
        path: `${output}/${route.replaceAll("/", "_") || "home"}-${width}.png`,
      });
      records.push({ width, route, status: 200, consoleErrors: 0, overflow: false });
    }
    await page.close();
  }
  const report = {
    checkedAt: new Date().toISOString(),
    origin,
    records,
    inferenceCalls: 0,
    paymentActions: 0,
  };
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
