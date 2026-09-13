import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium, type Locator, type Page } from "playwright";
import { verifyMicrogridReplay } from "../packages/microgrid-dispatch/src/practice";

// Usage: pnpm exec tsx scripts/verify-arena-labs.ts http://127.0.0.1:3014
// Start preview-arena-labs.ts first: built UI + real HTTP Gate handlers with
// isolated local-memory storage. There are no intercepted or mocked responses.
const base = new URL(process.argv[2] ?? "http://127.0.0.1:3014");
const publicCheck = process.argv.includes("--public-practice");
if (publicCheck) {
  assert.equal(base.origin, "https://web-rho-seven-d6te7t3f0y.vercel.app");
} else {
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname), "QA must target loopback");
  assert.equal(base.protocol, "http:");
}
const output = publicCheck ? ".frontier/arena-public-qa" : ".frontier/arena-labs-qa";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report: object[] = [];

async function downloadJson(page: Page, control: Locator) {
  const [download] = await Promise.all([page.waitForEvent("download"), control.click()]);
  const path = await download.path();
  assert.ok(path);
  return JSON.parse(await readFile(path, "utf8"));
}

async function measureCalldata(page: Page) {
  const [response] = await Promise.all([
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/calldata-lab" &&
        response.request().method() === "POST",
    ),
    page.getByTestId("calldata-measure").click(),
  ]);
  assert.equal(response.status(), 200);
  await page.locator('[data-testid="calldata-measure"]:not([disabled])').waitFor();
  await page.getByTestId("calldata-result").waitFor();
  return response.json();
}

async function checkHealth(page: Page) {
  assert.equal(await page.locator("[data-nextjs-dialog], .vite-error-overlay").count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  // A standalone string keeps tsx's __name transform out of browser evaluation.
  const violations = await page.evaluate(String.raw`(() => {
    const elements = Array.from(document.querySelectorAll("button, select, summary, a"));
    const luminance = (rgb) =>
      rgb.slice(0, 3).reduce((sum, value, index) => {
        const channel = value / 255;
        return (
          sum +
          (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4) *
            [0.2126, 0.7152, 0.0722][index]
        );
      }, 0);
    return elements.flatMap((element) => {
      if (!(element instanceof HTMLElement) || !element.getClientRects().length) return [];
      const style = getComputedStyle(element);
      const background = style.backgroundColor.match(/[\d.]+/g)?.map(Number);
      const foreground = style.color.match(/[\d.]+/g)?.map(Number);
      if (!background || !foreground || (background[3] ?? 1) < 1) return [];
      const back = luminance(background),
        front = luminance(foreground);
      return back > 0.5 && front > 0.5
        ? [
            {
              text: element.innerText.slice(0, 70),
              color: style.color,
              background: style.backgroundColor,
            },
          ]
        : [];
    });
  })()`);
  assert.deepEqual(violations, [], "Forbidden bright-background/light-text combination");
}

try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors: string[] = [];
    let duplicateCheck = false;
    let expectedDuplicateErrors = 0;
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      if (duplicateCheck && /409/.test(message.text())) expectedDuplicateErrors += 1;
      else errors.push(message.text());
    });
    for (const slug of ["calldata-compression", "microgrid-dispatch", "secret-gate"]) {
      const response = await page.goto(new URL(`/arenas/${slug}`, base).href, {
        waitUntil: "networkidle",
      });
      assert.equal(response?.status(), 200);
      await page.screenshot({ path: `${output}/${slug}-${width}-initial.png` });
      await checkHealth(page);

      if (slug === "calldata-compression") {
        const firstResponse = await measureCalldata(page);
        const first = await downloadJson(page, page.getByTestId("calldata-evidence-download"));
        assert.equal(first.resultHash, firstResponse.resultHash);
        assert.equal(first.point.correctness, true);
        assert.equal(first.malformedInputRejected, true);
        await page
          .getByTestId("calldata-byte-journey")
          .screenshot({ path: `${output}/calldata-journey-${width}.png` });
        await page.getByTestId("calldata-rule-min-reuse-0").fill("100");
        const secondResponse = await measureCalldata(page);
        const second = await downloadJson(page, page.getByTestId("calldata-evidence-download"));
        assert.equal(second.resultHash, secondResponse.resultHash);
        assert.equal(first.contextHash, second.contextHash);
        assert.notEqual(first.artifactHash, second.artifactHash);
        assert.notEqual(first.point.calldataGas, second.point.calldataGas);
        assert.notDeepEqual(second, first, "Edited rule must change exported evidence");
        assert.equal(await page.getByTestId("calldata-previous-comparison").count(), 1);
        await page.getByTestId("calldata-context").selectOption("public-low-reuse");
        const otherContext = await measureCalldata(page);
        assert.notEqual(first.contextHash, otherContext.contextHash);
        assert.equal(await page.getByTestId("calldata-previous-comparison").count(), 0);
        await page.getByTestId("calldata-result").scrollIntoViewIfNeeded();
      } else if (slug === "microgrid-dispatch") {
        await page.getByTestId("microgrid-run").click();
        await page.getByTestId("microgrid-result").waitFor();
        const evidence = await downloadJson(page, page.getByTestId("microgrid-artifact-download"));
        assert.ok(verifyMicrogridReplay(evidence), "Downloaded day must replay exactly");
        await page.getByTestId("microgrid-step-next").click();
        await page.getByTestId("microgrid-step-previous").click();
        await page.locator("#microgrid-maxGridMwh").fill("2");
        await page.locator("#microgrid-reservePercent").fill("0");
        await page.locator("#microgrid-dischargePrice").fill("30");
        await page.getByTestId("microgrid-run").click();
        const revision = await downloadJson(page, page.getByTestId("microgrid-artifact-download"));
        assert.ok(verifyMicrogridReplay(revision));
        assert.notEqual(revision.policyHash, evidence.policyHash);
        assert.ok(revision.totals.unservedMwh > evidence.totals.unservedMwh);
        assert.ok(revision.totals.carbonKg < evidence.totals.carbonKg);
        assert.match(await page.getByTestId("microgrid-result").innerText(), /Previous revision/);
        assert.equal(
          await page
            .getByTestId("microgrid-comparison")
            .evaluate((element) => element.scrollWidth > element.clientWidth),
          false,
          "All comparison axes must fit, including within the table",
        );
        await page
          .getByTestId("microgrid-comparison")
          .screenshot({ path: `${output}/microgrid-comparison-${width}.png` });
        await page.getByRole("button", { name: "16:00 grid outage", exact: true }).click();
        await page
          .getByTestId("microgrid-energy-flow")
          .screenshot({ path: `${output}/microgrid-flow-${width}.png` });
        await page.getByTestId("microgrid-replay-verify").click();
        await page
          .getByText("Replay verified: policy, every turn and all hashes match.", { exact: true })
          .waitFor();
        await page.getByTestId("microgrid-mode-classic").click();
        await page.getByRole("button", { name: "Evaluate dispatch", exact: true }).waitFor();
        await page.getByTestId("microgrid-mode-day").click();
        await page.getByTestId("microgrid-scenario").selectOption("clear-day");
        await page.getByTestId("microgrid-run").click();
        const clearDay = await downloadJson(page, page.getByTestId("microgrid-artifact-download"));
        assert.ok(verifyMicrogridReplay(clearDay));
        assert.notEqual(clearDay.contextHash, evidence.contextHash);
        assert.doesNotMatch(
          await page.getByTestId("microgrid-result").innerText(),
          /Previous revision/,
        );
        await page.getByTestId("microgrid-result").scrollIntoViewIfNeeded();
      } else {
        page.on("request", (request) => {
          if (
            request.url().includes("/v1/secret-gate/") &&
            /privateKey|identitySecret/.test(request.postData() ?? "")
          )
            errors.push("Identity secret field was sent to HTTP");
        });
        await page.getByTestId("secret-gate-create").click();
        await page.getByTestId("secret-gate-enroll").click();
        await page.getByTestId("secret-gate-enter").click();
        await page.getByTestId("secret-gate-receipt").waitFor({ timeout: 60_000 });
        assert.match(
          await page.getByTestId("secret-gate-receipt").innerText(),
          publicCheck ? /Durable Redis storage/ : /Local memory storage/,
        );
        duplicateCheck = true;
        await page.getByTestId("secret-gate-duplicate").click();
        await page.getByTestId("secret-gate-duplicate-result").waitFor();
        assert.match(
          await page.getByTestId("secret-gate-duplicate-result").innerText(),
          /409.*NULLIFIER_ALREADY_USED/,
        );
        await page.getByLabel("Parallel proof slots").selectOption("2");
        await page.getByTestId("secret-gate-benchmark").click();
        await page.getByTestId("secret-gate-benchmark-result").waitFor({ timeout: 60_000 });
        assert.match(
          await page.getByTestId("secret-gate-benchmark-result").innerText(),
          /4 \/ 4 verified/,
        );
        assert.match(await page.getByTestId("secret-gate-feasibility").innerText(), /PIVOT/);
        await page
          .getByTestId("secret-gate-stages")
          .screenshot({ path: `${output}/secret-gate-stages-${width}.png` });
        await page.getByLabel("Parallel proof slots").selectOption("3");
        assert.match(
          await page.getByTestId("secret-gate-benchmark-result").innerText(),
          /Recorded settings: 2 parallel/,
        );
        await page.getByTestId("secret-gate-stages").scrollIntoViewIfNeeded();
      }
      await checkHealth(page);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `${output}/${slug}-${width}-result.png` });
      const result = {
        slug,
        width,
        passed: true,
        consoleErrors: errors.length,
        expectedDuplicateErrors,
        gateTransport:
          slug === "secret-gate"
            ? publicCheck
              ? "public HTTPS / durable-redis"
              : "real HTTP / source-handlers / isolated-local-memory"
            : "built-app",
      };
      report.push(result);
      console.log(JSON.stringify(result));
    }
    await context.close();
  }
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
