import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

// Read-only verification: no paid model or transaction endpoints are invoked.
const origin = "http://localhost:3000";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results: Record<string, unknown>[] = [];
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const response = await page.goto(`${origin}/rescue-room/operations`, {
      waitUntil: "networkidle",
    });
    assert.equal(response?.status(), 200);
    assert.equal(await page.locator("h1").count(), 1);
    const body = await page.locator("body").innerText();
    assert.ok(body.includes("rUSD-DEMO") && body.includes("返金") && body.includes("運営"));
    const details = page.locator("details");
    assert.ok((await details.count()) > 0);
    for (const detail of await details.all()) {
      assert.equal(await detail.getAttribute("open"), null);
      await detail.locator("summary").click();
      assert.notEqual(await detail.getAttribute("open"), null);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false, `Horizontal overflow at ${width}px`);
    assert.ok((await page.locator('a[href^="https://sepolia.etherscan.io/tx/"]').count()) >= 4);
    const screenshot = join(tmpdir(), `rescue-operator-${width}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    await page.goto(`${origin}/arenas/rescue-room`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Lock doctrine & start incident" }).click();
    await page.getByRole("button", { name: "Skip to outcome" }).click();
    const link = page.locator('a[href="/rescue-room/operations"]');
    await link.waitFor({ state: "visible" });
    assert.ok((await page.locator(".rescue-payment-journey").innerText()).includes("Practice"));
    await link.click();
    await page.waitForURL(`${origin}/rescue-room/operations`);
    assert.deepEqual(errors, []);
    results.push({ width, status: "passed", consoleErrors: errors.length, overflow, screenshot });
    await page.close();
  }
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
