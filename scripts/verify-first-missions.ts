import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = new URL(process.argv[2] ?? "http://127.0.0.1:3014");
assert.ok(["localhost", "127.0.0.1"].includes(base.hostname));
const output = ".frontier/first-mission-qa";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report: object[] = [];
try {
  for (const width of [1440, 390]) {
    for (const slug of ["calldata-compression", "microgrid-dispatch", "secret-gate"]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors: string[] = [];
      let duplicateCheck = false;
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error" && !(duplicateCheck && /409/.test(message.text())))
          errors.push(message.text());
      });
      assert.equal((await page.goto(new URL(`/arenas/${slug}`, base).href))?.status(), 200);
      const mission = page.getByTestId("first-mission");
      await mission.waitFor();
      assert.equal(await mission.getAttribute("data-complete"), "false");
      await mission.screenshot({ path: `${output}/${slug}-${width}-initial.png` });
      if (slug === "calldata-compression") {
        await mission.getByRole("button", { name: "Measure current rules", exact: true }).click();
        await page.getByTestId("calldata-result").waitFor();
        assert.equal(await mission.getAttribute("data-complete"), "false");
        await mission.getByRole("link").click();
        await page.getByTestId("calldata-rule-min-reuse-0").fill("100");
        assert.equal(await mission.getAttribute("data-complete"), "false");
        await mission.getByRole("button", { name: "Measure edited rules", exact: true }).click();
        await mission.locator('[data-testid="first-mission-result"]').waitFor();
        assert.match(await mission.innerText(), /sending \+3,028 gas/);
        assert.match(await mission.innerText(), /decoding −4,124 gas/);
      } else if (slug === "microgrid-dispatch") {
        await mission.getByRole("button", { name: "Run current policy", exact: true }).click();
        assert.equal(await mission.getAttribute("data-complete"), "false");
        await mission.getByRole("link").click();
        await page.locator("#microgrid-maxGridMwh").fill("2");
        await mission.getByRole("button", { name: "Run edited policy", exact: true }).click();
        await mission.getByTestId("first-mission-result").waitFor();
        assert.match(await mission.innerText(), /unmet demand.*MWh/);
      } else {
        await mission.getByRole("button", { name: "Create demo identity", exact: true }).click();
        await mission.getByRole("button", { name: "Register membership", exact: true }).click();
        await mission.getByRole("button", { name: "Make proof and enter", exact: true }).click();
        await page.getByTestId("secret-gate-receipt").waitFor({ timeout: 60_000 });
        assert.equal(await mission.getAttribute("data-complete"), "false");
        duplicateCheck = true;
        await mission
          .getByRole("button", { name: "Test the same proof again", exact: true })
          .click();
        await mission.getByTestId("first-mission-result").waitFor();
        assert.match(await mission.innerText(), /409 · NULLIFIER_ALREADY_USED/);
      }
      assert.equal(await mission.getAttribute("data-complete"), "true");
      const actionBackgrounds = await mission
        .locator("button, a")
        .evaluateAll((elements) =>
          elements.map((element) => getComputedStyle(element).backgroundColor),
        );
      for (const background of actionBackgrounds) {
        assert.ok(
          ["rgb(13, 16, 19)", "rgb(24, 32, 27)", "rgb(27, 41, 22)"].includes(background),
          `Unexpected inherited mission action background: ${background}`,
        );
      }
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
      assert.deepEqual(errors, []);
      await mission.screenshot({ path: `${output}/${slug}-${width}-complete.png` });
      report.push({
        slug,
        width,
        completedFromActualResults: true,
        consoleErrors: 0,
        overflow: false,
      });
      if (slug === "calldata-compression") {
        await page.getByTestId("calldata-rule-min-reuse-0").fill("80");
        assert.equal(await mission.getAttribute("data-complete"), "false");
        await page.getByTestId("calldata-context").selectOption("public-low-reuse");
        await page.locator('[data-testid="calldata-context"]:not([disabled])').waitFor();
        assert.equal(await page.getByTestId("calldata-result").count(), 0);
        assert.equal(await mission.getAttribute("data-complete"), "false");
      } else if (slug === "microgrid-dispatch") {
        await page.locator("#microgrid-chargeBelowPrice").fill("100");
        await mission.getByRole("button", { name: "Run edited policy", exact: true }).click();
        await mission.getByRole("alert").waitFor();
        assert.equal(await mission.getAttribute("data-complete"), "false");
      }
      await page.close();
    }
  }
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
