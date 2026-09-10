import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const targetUrl = process.env.RESCUE_ROOM_URL ?? "http://localhost:3000/arenas/rescue-room";
const verifyAiCommander = process.env.RESCUE_ROOM_VERIFY_AI !== "0";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results: Record<string, unknown>[] = [];

try {
  for (const config of [
    { name: "desktop", width: 1_440, height: 1_000 },
    { name: "mobile", width: 390, height: 844 },
  ] as const) {
    const context = await browser.newContext({
      viewport: { width: config.width, height: config.height },
      isMobile: config.name === "mobile",
      hasTouch: config.name === "mobile",
    });
    const page = await context.newPage();
    const homePage = await context.newPage();
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));

    const homeResponse = await homePage.goto(new URL("/", targetUrl).href, {
      waitUntil: "networkidle",
    });
    const rescueNavigationLinks = await homePage.locator('a[href="/arenas/rescue-room"]').count();
    await homePage.close();
    const response = await page.goto(targetUrl, { waitUntil: "networkidle" });
    const initialText = await page.locator("body").innerText();
    const initialPath = join(tmpdir(), `rescue-room-${config.name}-initial.png`);
    await page.screenshot({ path: initialPath, fullPage: false });
    const ablationPath = join(tmpdir(), `rescue-room-${config.name}-ablation.png`);
    await page.locator(".rescue-ablation").screenshot({ path: ablationPath });

    if (config.name === "mobile") {
      await page.getByLabel("Initial protocol alert").selectOption({ index: 1 });
      await page.getByLabel("Reference Commander").selectOption("monitor-first");
    }
    await page.getByRole("button", { name: "Run Reference Commander" }).click();
    const reveal = page.locator(".rescue-reveal");
    await reveal.waitFor({ state: "visible", timeout: 15_000 });
    const resultText = await page.locator("body").innerText();
    await page
      .locator(".rescue-result")
      .evaluate((element) => element.scrollIntoView({ block: "start" }));
    const resultPath = join(tmpdir(), `rescue-room-${config.name}-result.png`);
    await page.screenshot({ path: resultPath, fullPage: false });
    const revealPath = join(tmpdir(), `rescue-room-${config.name}-reveal.png`);
    await reveal.screenshot({ path: revealPath });
    await page
      .locator(".rescue-value-pools")
      .evaluate((element) => element.scrollIntoView({ block: "start" }));
    const poolsPath = join(tmpdir(), `rescue-room-${config.name}-pools.png`);
    await page.screenshot({ path: poolsPath, fullPage: false });

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download Context + Result Evidence" }).click();
    const download = await downloadPromise;
    const downloadName = download.suggestedFilename();

    await page.getByRole("button", { name: "Replay evidence timeline" }).click();
    const replayResetObserved = (await page.locator(".rescue-timeline > li").count()) < 12;
    await reveal.waitFor({ state: "visible", timeout: 15_000 });
    const referenceTimelineEvents = await page.locator(".rescue-timeline > li").count();
    const referenceHiddenStateRevealed = await reveal.isVisible();

    await page.getByRole("button", { name: "AI Playbook", exact: true }).click();
    const aiEditorVisible = await page.locator(".rescue-playbook-editor").isVisible();
    const aiServicePermissions = await page
      .locator(".rescue-playbook-options")
      .first()
      .locator("label")
      .count();
    const starterKitLink = await page.locator('a[href="/v1/rescue-room/starter-kit"]').isVisible();
    let aiRunVerified = false;
    let aiPath: string | null = null;
    if (config.name === "desktop" && verifyAiCommander) {
      await page.getByRole("button", { name: "Run AI Commander" }).click();
      const aiProof = page.locator(".rescue-ai-proof");
      await aiProof.waitFor({ state: "visible", timeout: 120_000 });
      const aiText = await page.locator(".rescue-result").innerText();
      aiRunVerified =
        aiText.includes("Action replay verified") &&
        aiText.includes("Not eligible") &&
        aiText.includes("AI runtime");
      aiPath = join(tmpdir(), "rescue-room-desktop-ai-result.png");
      await page.locator(".rescue-result").screenshot({ path: aiPath });
    }

    const dimensions = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overlay: Boolean(
        document.querySelector(
          "[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay",
        ),
      ),
    }));
    const forbiddenContrastPairs = await page
      .locator("button, a, [role='button']")
      .evaluateAll((elements) =>
        elements.flatMap((element) => {
          const bounds = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          if (
            bounds.width < 1 ||
            bounds.height < 1 ||
            style.display === "none" ||
            style.visibility === "hidden"
          ) {
            return [];
          }

          const background = style.backgroundColor
            .match(/[\d.]+/g)
            ?.slice(0, 3)
            .map(Number);
          const foreground = style.color
            .match(/[\d.]+/g)
            ?.slice(0, 3)
            .map(Number);
          const isBrightLime =
            background !== undefined &&
            background[0] >= 150 &&
            background[0] <= 230 &&
            background[1] >= 220 &&
            background[2] <= 140;
          const isLightText =
            foreground !== undefined && foreground.every((channel) => channel >= 180);
          if (!isBrightLime || !isLightText) {
            return [];
          }

          return [
            {
              label: element.textContent?.trim().replace(/\s+/g, " ").slice(0, 100) ?? "",
              background: style.backgroundColor,
              foreground: style.color,
            },
          ];
        }),
      );
    const record = {
      name: config.name,
      status: response?.status(),
      homeStatus: homeResponse?.status(),
      rescueNavigationLinks,
      title: await page.title(),
      initialContent:
        initialText.toLowerCase().includes("an incident is already moving") &&
        initialText.toLowerCase().includes("game credits"),
      services: await page.locator(".rescue-service-grid > article").count(),
      pools: await page.locator(".rescue-pool-grid > article").count(),
      timelineEvents: referenceTimelineEvents,
      outcomeVisible: resultText.includes("No weighted score. No overall winner."),
      hiddenStateRevealed: referenceHiddenStateRevealed,
      downloadName,
      replayResetObserved,
      aiEditorVisible,
      aiServicePermissions,
      starterKitLink,
      aiRunVerified:
        config.name === "desktop" && verifyAiCommander
          ? aiRunVerified
          : "not-run-in-this-verification",
      noHorizontalOverflow: dimensions.scrollWidth <= dimensions.innerWidth,
      overlay: dimensions.overlay,
      forbiddenContrastPairs,
      consoleErrors,
      initialPath,
      ablationPath,
      resultPath,
      revealPath,
      poolsPath,
      aiPath,
    };
    results.push(record);
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));

if (
  results.some(
    (result) =>
      result.status !== 200 ||
      result.homeStatus !== 200 ||
      Number(result.rescueNavigationLinks) < 1 ||
      !result.initialContent ||
      result.services !== 6 ||
      result.pools !== 4 ||
      Number(result.timelineEvents) < 1 ||
      !result.outcomeVisible ||
      !result.hiddenStateRevealed ||
      !String(result.downloadName).endsWith(".json") ||
      !result.replayResetObserved ||
      !result.aiEditorVisible ||
      result.aiServicePermissions !== 6 ||
      !result.starterKitLink ||
      (result.name === "desktop" && verifyAiCommander && !result.aiRunVerified) ||
      !result.noHorizontalOverflow ||
      result.overlay ||
      (result.forbiddenContrastPairs as unknown[]).length > 0 ||
      (result.consoleErrors as string[]).length > 0,
  )
) {
  process.exitCode = 1;
}
