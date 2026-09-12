import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = new URL(process.argv[2] ?? "http://127.0.0.1:3014");
assert.ok(["127.0.0.1", "localhost"].includes(base.hostname));
const output = ".frontier/arena-story-qa";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report: object[] = [];
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    for (const slug of ["calldata-compression", "microgrid-dispatch", "secret-gate"]) {
      assert.equal((await page.goto(new URL(`/arenas/${slug}`, base).href))?.status(), 200);
      const story = page.getByTestId("arena-intro-story");
      await story.waitFor();
      await story.locator("img").evaluate(async (image: HTMLImageElement) => {
        await image.decode();
      });
      assert.equal(await story.locator("li").count(), 3);
      assert.match(await story.innerText(), /Concept illustration/);
      assert.equal(await page.locator("[data-nextjs-dialog]").count(), 0);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
      const dimensions = await story.locator("img").evaluate((image: HTMLImageElement) => ({
        loaded: image.complete && image.naturalWidth > 0,
        ratio: image.clientWidth / image.clientHeight,
        alt: image.alt,
      }));
      assert.ok(dimensions.loaded);
      assert.ok(Math.abs(dimensions.ratio - 1.5) < 0.02, "Do not crop or distort the scene");
      assert.ok(dimensions.alt.length > 40);
      await page.screenshot({ path: `${output}/${slug}-${width}-page.png` });
      await story.screenshot({ path: `${output}/${slug}-${width}-story.png` });
      assert.deepEqual(errors, []);
      report.push({ slug, width, ...dimensions, consoleErrors: 0, overflow: false });
    }
    assert.equal((await page.goto(new URL("/arenas", base).href))?.status(), 200);
    assert.equal(await page.getByTestId("arena-intro-story").count(), 0);
    assert.deepEqual(errors, []);
    await page.close();
  }
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
