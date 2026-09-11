import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (event) => {
      if (event.type() === "error") errors.push(event.text());
    });
    const response = await page.goto("http://localhost:3000/rescue-room/submission", {
      waitUntil: "networkidle",
    });
    assert.equal(response?.status(), 200);
    assert.equal(await page.locator("h1").count(), 1);
    assert.equal(await page.locator("ol > li").count(), 3);
    const text = await page.locator("main").innerText();
    for (const claim of ["71.13%", "100.00%", "何もしない", "Preview", "3手番", "Simulation"])
      assert.ok(text.includes(claim));
    const downloadDetails = page.locator("details").last();
    await downloadDetails.locator("summary").click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "公開Evidence JSONを保存" }).click(),
    ]);
    assert.equal(download.suggestedFilename(), "rescue-submission-demo.json");
    const [replayDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "公開Replay入力を保存" }).click(),
    ]);
    assert.equal(replayDownload.suggestedFilename(), "rescue-submission-replay.json");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false);
    const contrastViolations = await page.locator("a, summary").evaluateAll(
      (elements) =>
        elements.filter((element) => {
          const { color, backgroundColor } = getComputedStyle(element);
          return backgroundColor === "rgb(199, 255, 69)" && color !== "rgb(17, 17, 17)";
        }).length,
    );
    assert.equal(contrastViolations, 0);
    await page.evaluate(() => window.scrollTo(0, 0));
    const screenshot = join(tmpdir(), `rescue-submission-${width}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    await page.getByRole("link", { name: "支払い・返金の詳しい証跡 →" }).click();
    await page.waitForURL("**/rescue-room/operations");
    await page.getByRole("link", { name: "提出デモ：納品後の判断とValue Poolまで見る →" }).click();
    await page.waitForURL("**/rescue-room/submission");
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        width,
        passed: true,
        screenshot,
        overflow,
        consoleErrors: errors.length,
        contrastViolations,
      }),
    );
    await page.close();
  }
} finally {
  await browser.close();
}
