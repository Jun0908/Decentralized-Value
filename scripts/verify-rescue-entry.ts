import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

// Read-only navigation. Never click an inference, payment, or settlement action.
const origin = new URL(process.argv[2] ?? "http://localhost:3000");
assert.ok(["localhost", "127.0.0.1"].includes(origin.hostname), "Use a local preview");
assert.equal(origin.protocol, "http:");
const output = ".frontier/rescue-entry-qa";
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
    for (const path of [
      "/rescue-room",
      "/rescue-room/operations",
      "/rescue-room/submission",
      "/rescue-room/submission/en",
    ]) {
      const response = await page.goto(new URL(path, origin).href, { waitUntil: "networkidle" });
      assert.equal(response?.status(), 200);
      if (path === "/rescue-room") {
        await page.waitForURL("**/arenas/rescue-room");
      } else {
        assert.equal(new URL(page.url()).pathname, path);
      }
      assert.ok((await page.locator("body").innerText()).length > 100);
      assert.ok(await page.locator("h1").count());
      assert.equal(await page.locator("[data-nextjs-dialog]").count(), 0);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `${output}/${path.replaceAll("/", "_")}-${width}.png` });
      records.push({ width, path, destination: new URL(page.url()).pathname, consoleErrors: 0 });
    }
    await page.close();
  }
  const report = { checkedAt: new Date().toISOString(), origin: origin.origin, records };
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
