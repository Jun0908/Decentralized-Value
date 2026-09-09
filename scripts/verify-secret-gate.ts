import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.SECRET_GATE_BASE_URL ?? "http://localhost:3000";
const chromePath =
  process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const outputDirectory = "tmp/secret-gate-verification";

await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({ executablePath: chromePath, headless: true });
const consoleErrors: string[] = [];
let lastEntryResponse: unknown = null;
let diagnosticPage: import("playwright").Page | null = null;

try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await desktop.newPage();
  diagnosticPage = page;
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("response", async (response) => {
    if (response.url().endsWith("/v1/secret-gate/enter")) {
      lastEntryResponse = await response.json().catch(() => ({ status: response.status() }));
    }
  });

  const response = await page.goto(`${baseUrl}/arenas/secret-gate`, {
    waitUntil: "networkidle",
  });
  if (!response?.ok())
    throw new Error(`Secret Gate page returned ${response?.status() ?? "no response"}`);
  if (!(await page.locator("body").innerText()).trim())
    throw new Error("Secret Gate page is blank");
  if (await page.locator("[data-nextjs-dialog]").count())
    throw new Error("Next.js error overlay is visible");

  await page.getByRole("button", { name: "Create disposable identity" }).click();
  await page.getByRole("button", { name: "Create membership snapshot" }).click();
  await page.getByText("Membership snapshot ready").waitFor({ timeout: 30_000 });
  await page.getByRole("button", { name: "Prove and enter" }).click();
  await page.getByRole("heading", { name: "Anonymous membership verified." }).waitFor({
    timeout: 30_000,
  });
  await page.screenshot({ path: `${outputDirectory}/desktop-gate-open.png`, fullPage: true });

  if (consoleErrors.length > 0) {
    throw new Error(`Browser console errors before replay test: ${consoleErrors.join(" | ")}`);
  }

  await page.getByRole("button", { name: "Prove and enter" }).click();
  await page.getByText("This identity has already entered this Gate scope.").waitFor({
    timeout: 120_000,
  });
  consoleErrors.length = 0;

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobile.newPage();
  mobilePage.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await mobilePage.goto(`${baseUrl}/arenas/secret-gate`, { waitUntil: "networkidle" });
  const overflow = await mobilePage.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  if (overflow) throw new Error("Secret Gate has horizontal overflow on mobile");
  await mobilePage.screenshot({ path: `${outputDirectory}/mobile.png`, fullPage: true });

  const filteredErrors = consoleErrors.filter(
    (message) => !message.includes("Download the React DevTools"),
  );
  if (filteredErrors.length > 0) {
    throw new Error(`Browser console errors: ${filteredErrors.join(" | ")}`);
  }

  process.stdout.write(
    JSON.stringify({
      page: "loaded",
      gate: "opened",
      duplicateNullifier: "rejected",
      mobileOverflow: false,
      consoleErrors: 0,
      screenshots: [`${outputDirectory}/desktop-gate-open.png`, `${outputDirectory}/mobile.png`],
    }),
  );
} catch (cause) {
  if (diagnosticPage) {
    await diagnosticPage.screenshot({ path: `${outputDirectory}/failure.png`, fullPage: true });
    const state = await diagnosticPage
      .locator("body")
      .innerText()
      .catch(() => "Body unavailable");
    process.stderr.write(
      JSON.stringify({
        error: cause instanceof Error ? cause.message : "Verification failed",
        consoleErrors,
        lastEntryResponse,
        pageText: state.slice(-3000),
        screenshot: `${outputDirectory}/failure.png`,
      }),
    );
  }
  throw cause;
} finally {
  await browser.close();
}
