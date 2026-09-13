/** Actual browser capture; no evaluator mocks, signatures, inference or payments. */
import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import { chromium, type Page, type Locator } from "playwright";

const output = resolve(process.env.VIDEO_OUTPUT_DIR ?? "artifacts/video-demo");
const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";
const ffprobe = process.env.FFPROBE_PATH ?? "ffprobe";
const finalPath = join(output, "value-decentralization-demo-silent.mp4");
assert(
  !(await access(finalPath).then(
    () => true,
    () => false,
  )),
  "Refusing to overwrite final video",
);
await mkdir(output, { recursive: true });
const localOrigin = process.env.VIDEO_LOCAL_ORIGIN ?? "http://127.0.0.1:3008";
const localUrl = `${localOrigin}/arenas/emergency-supply`;
const evidenceUrl = "https://web-rho-seven-d6te7t3f0y.vercel.app/architecture";
const recordedPayment = JSON.parse(
  await readFile("Docs/evidence/deployments/sepolia-reward-demo.json", "utf8"),
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors: string[] = [];
const writes: string[] = [];
const segments: {
  name: string;
  startMs: number;
  duration: number;
  file?: string;
  offset?: number;
}[] = [];
const phases = new Set<string>();

async function frame(page: Page, selector: string, top = 40) {
  await page
    .locator(selector)
    .first()
    .evaluate((e, margin) => {
      window.scrollTo({
        top: e.getBoundingClientRect().top + window.scrollY - margin,
        behavior: "instant",
      });
    }, top);
  await page.waitForTimeout(700);
}
async function move(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  assert(box);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 22 });
}
async function click(page: Page, locator: Locator) {
  await move(page, locator);
  await locator.click();
}
async function camera(page: Page, payment = false) {
  // Capture-only chrome exclusion, never changes metrics, evidence or application state.
  await page.addStyleTag({
    content: `.site-header,nextjs-portal{display:none!important}.competition-nav{position:static!important}${payment ? ".wallet-commit-proof{display:none!important}html{zoom:1.25}" : ""}`,
  });
  await page.evaluate(() => {
    const cursor = document.createElement("div");
    cursor.id = "recording-cursor";
    cursor.setAttribute("aria-hidden", "true");
    cursor.style.cssText =
      "position:fixed;left:90px;top:80px;width:28px;height:34px;z-index:2147483647;pointer-events:none;filter:drop-shadow(1px 2px 2px #000)";
    cursor.innerHTML =
      '<svg viewBox="0 0 28 34"><path d="M3 2 L3 27 L10 20 L16 32 L22 29 L16 17 L26 17 Z" fill="white" stroke="black" stroke-width="2"/></svg>';
    document.body.append(cursor);
    document.addEventListener("mousemove", (event) => {
      const zoom = Number.parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
      cursor.style.left = `${event.clientX / zoom}px`;
      cursor.style.top = `${event.clientY / zoom}px`;
    });
  });
}
async function shot(
  page: Page,
  name: string,
  duration: number,
  action?: (cue: (at: number) => Promise<void>) => Promise<void>,
) {
  const startMs = Date.now();
  const segment = { name, duration, startMs };
  segments.push(segment);
  console.log(`Recording ${name} (${duration}s)`);
  const cue = async (at: number) => {
    const wait = startMs + at * 1000 - Date.now();
    if (wait > 0) await page.waitForTimeout(wait);
  };
  await page.screenshot({ path: join(output, `${name}-start.png`) });
  if (action) await action(cue);
  await cue(duration);
  assert(Date.now() - startMs < duration * 1000 + 1500, `Shot ${name} overran`);
  await page.screenshot({ path: join(output, `${name}-end.png`) });
}
function probe(path: string) {
  return JSON.parse(
    execFileSync(ffprobe, ["-v", "error", "-show_streams", "-show_format", "-of", "json", path], {
      encoding: "utf8",
    }),
  );
}
async function finish(
  context: Awaited<ReturnType<typeof browser.newContext>>,
  page: Page,
  indices: number[],
  name: string,
) {
  // Align recorded wall-clock cues to the final video frame. Shot guards keep cuts clear of preparation.
  await page.waitForTimeout(1500);
  const ended = Date.now();
  const video = page.video()!;
  await context.close();
  const raw = join(output, `${name}-raw.webm`);
  await video.saveAs(raw);
  const duration = Number(probe(raw).format.duration);
  for (const index of indices) {
    segments[index]!.file = raw;
    segments[index]!.offset = duration - (ended - segments[index]!.startMs) / 1000;
  }
}

try {
  if (process.env.VIDEO_SOURCE_RECORDING) {
    const source = JSON.parse(await readFile(process.env.VIDEO_SOURCE_RECORDING, "utf8"));
    segments.push(...source.segments);
  } else {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      locale: "en-US",
      recordVideo: { dir: output, size: { width: 1920, height: 1080 } },
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (e) => {
      if (e.type() === "error") errors.push(e.text());
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== localOrigin) return route.abort();
      if (!["GET", "HEAD"].includes(request.method())) {
        writes.push(`${request.method()} ${url.pathname}`);
        if (request.method() !== "POST" || url.pathname !== "/v1/disaster-response/evaluations")
          return route.abort();
      }
      await route.continue();
    });
    assert.equal((await page.goto(localUrl, { waitUntil: "networkidle" }))?.status(), 200);
    await page.waitForFunction(() => [...document.images].every((i) => i.complete));
    await camera(page);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await frame(page, ".platform-arena-hero", 28);
    await shot(page, "01-challenge", 8, async (cue) => {
      await cue(3);
      await page.mouse.move(1400, 160, { steps: 35 });
    });

    await frame(page, ".strategy-presets");
    await shot(page, "02-strategy", 12, async (cue) => {
      await cue(1);
      await click(page, page.getByRole("button", { name: "Balance", exact: true }));
      await cue(4);
      const kits = page.getByRole("spinbutton", { name: "Backup route reserve kits" });
      await click(page, kits);
      await kits.fill("300");
      await kits.press("Tab");
      await cue(7);
      const budget = page.getByRole("spinbutton", {
        name: "Emergency recovery budget in US dollars",
      });
      await click(page, budget);
      await budget.fill("22000");
      await budget.press("Tab");
      await cue(9);
      await move(page, page.locator(".budget-ledger"));
    });

    const run = page.getByRole("button", { name: "Run the practice simulation", exact: true });
    await run.scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    const responsePromise = page.waitForResponse(
      (r) =>
        r.url().endsWith("/v1/disaster-response/evaluations") && r.request().method() === "POST",
    );
    // A one-second button action joins the complete 19-second replay without API waiting footage.
    await shot(page, "03-run", 1, async (cue) => {
      await move(page, run);
      await cue(0.8);
      await page.mouse.down();
      await cue(0.9);
      await page.mouse.up();
    });
    const response = await responsePromise;
    assert.equal(response.status(), 200);
    const evaluation = await response.json();
    assert.equal(evaluation.correctness, true);
    await writeFile(join(output, "practice-evaluation.json"), JSON.stringify(evaluation, null, 2));
    await page.locator(".replay-experience").waitFor();
    await frame(page, ".replay-experience", 40);
    await page.locator(".replay-map img").evaluate(async (img: HTMLImageElement) => {
      await img.decode();
    });
    // Restart via the actual replay control after framing so no phase is lost to scrolling.
    await click(page, page.getByRole("button", { name: "Replay", exact: true }));
    await shot(page, "04-replay", 19, async (cue) => {
      await page.mouse.move(610, 980, { steps: 20 });
      for (let second = 0; second < 18; second++) {
        await cue(second);
        const cls = await page.locator(".replay-experience").getAttribute("class");
        phases.add(cls!.match(/phase-\w+/)![0]);
        if ([3, 6, 10, 15].includes(second))
          await page.screenshot({ path: join(output, `replay-${second}s.png`) });
      }
    });
    assert.deepEqual(
      [...phases].sort(),
      ["phase-disruption", "phase-placement", "phase-recovery", "phase-result"].sort(),
    );
    await frame(page, "#replay", 30);
    await shot(page, "05-results", 16, async (cue) => {
      const metrics = page.locator(".metric-origin-grid > *");
      for (let i = 0; i < 3; i++) {
        await cue(2 + i * 4);
        await move(page, metrics.nth(i));
      }
    });
    await frame(page, "#allocations", 40);
    await shot(page, "06-allocations", 18, async (cue) => {
      assert.match(await page.locator("#allocations").innerText(), /No overall winner/);
      for (const name of ["Budget Sprint", "Resilience Mesh", "Fair Reach"])
        assert((await page.locator("#allocations").innerText()).includes(name));
      for (const [i, selector] of [
        "#allocations article:nth-of-type(2)",
        "#allocations article:nth-of-type(1)",
        "#allocations article:nth-of-type(3)",
        "#allocations article:nth-of-type(4)",
      ].entries()) {
        await cue(2 + i * 4);
        const card = page.locator(selector);
        if (await card.count()) await move(page, card.first());
      }
    });
    await frame(page, ".evaluation-evidence", 500);
    await shot(page, "07-evidence", 14, async (cue) => {
      await cue(1);
      await click(page, page.locator(".evaluation-evidence summary"));
      await cue(3);
      for (const label of ["Context hash", "Final scenario commitment", "Result hash"])
        assert((await page.locator(".evaluation-evidence").textContent())!.includes(label));
      await move(page, page.locator(".evaluation-evidence dl"));
    });
    assert.deepEqual(errors, []);
    // Live forecast also evaluates after preset/parameter edits; these are local measurements.
    assert(writes.length >= 1);
    assert(writes.every((request) => request === "POST /v1/disaster-response/evaluations"));
    await finish(context, page, [0, 1, 2, 3, 4, 5, 6], "main");

    const paymentContext = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      locale: "en-US",
      recordVideo: { dir: output, size: { width: 1920, height: 1080 } },
    });
    const payment = await paymentContext.newPage();
    // Public app is preloaded; neither a wallet session nor Etherscan navigation is performed.
    await payment.goto(evidenceUrl, { waitUntil: "networkidle" });
    await camera(payment, true);
    await frame(payment, "#reward-evidence", 90);
    const payoutLink = payment.locator(
      `#reward-evidence a[href$="${recordedPayment.transactions.rewardPayout}"]`,
    );
    assert.equal(await payoutLink.count(), 1);
    assert.match(await payment.locator("#reward-evidence").innerText(), /Recorded on Sepolia/);
    assert.match(await payment.locator("#reward-evidence").innerText(), /not a completed public/);
    await paymentContext.setOffline(true);
    await payment.waitForTimeout(1000);
    const paymentErrors: string[] = [];
    payment.on("pageerror", (e) => paymentErrors.push(e.message));
    await shot(payment, "08-recorded-sepolia", 15, async (cue) => {
      await cue(2);
      await move(
        payment,
        payment.locator(
          `#reward-evidence a[href$="${recordedPayment.transactions.allocationCommitment}"]`,
        ),
      );
      await cue(6);
      await move(payment, payoutLink);
      await cue(10);
      await move(payment, payment.locator(".settlement-demo-note"));
      await cue(12); // Final three seconds are stationary.
    });
    assert.deepEqual(paymentErrors, []);
    await finish(paymentContext, payment, [7], "sepolia");
    await writeFile(
      join(output, "recording.json"),
      JSON.stringify(
        {
          segments,
          phases: [...phases],
          errors,
          writes,
          paymentErrors,
          localUrl,
          evidenceUrl,
          overlays: "mouse cursor only",
          captureChromeExcluded: ["site header", "Next dev indicator", "wallet connection panel"],
          extraPayments: 0,
          inferenceCalls: 0,
          finalSeconds: 103,
        },
        null,
        2,
      ),
    );
  }
  const mainOffsetCorrection = Number(process.env.VIDEO_MAIN_OFFSET_SECONDS ?? 0);
  assert(Number.isFinite(mainOffsetCorrection));
  for (const segment of segments) {
    if (segment.name !== "08-recorded-sepolia") segment.offset! += mainOffsetCorrection;
  }
  await writeFile(
    join(output, "export-timing.json"),
    JSON.stringify(
      {
        sourceRecording: process.env.VIDEO_SOURCE_RECORDING ?? "recording.json",
        mainOffsetCorrection,
        segments,
      },
      null,
      2,
    ),
  );
  const clips: string[] = [];
  for (const [i, segment] of segments.entries()) {
    const clip = join(output, `clip-${i + 1}.mp4`);
    execFileSync(
      ffmpeg,
      [
        "-n",
        "-v",
        "error",
        "-threads",
        "2",
        "-ss",
        String(segment.offset),
        "-i",
        segment.file!,
        "-t",
        String(segment.duration),
        "-an",
        "-vf",
        "fps=25,setsar=1",
        "-c:v",
        "libx264",
        "-threads",
        "2",
        "-preset",
        "fast",
        "-crf",
        "17",
        "-pix_fmt",
        "yuv420p",
        clip,
      ],
      { stdio: "inherit" },
    );
    clips.push(`file '${clip.replaceAll("\\", "/").replaceAll("'", "'\\''")}'`);
  }
  const list = join(output, "concat.txt");
  await writeFile(list, clips.join("\n"));
  execFileSync(
    ffmpeg,
    [
      "-n",
      "-v",
      "error",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      list,
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      finalPath,
    ],
    { stdio: "inherit" },
  );
  const metadata = probe(finalPath);
  assert.equal(metadata.streams.length, 1);
  assert.equal(metadata.streams[0].width, 1920);
  assert.equal(metadata.streams[0].height, 1080);
  assert.equal(metadata.streams[0].r_frame_rate, "25/1");
  assert(Number(metadata.format.duration) >= 100 && Number(metadata.format.duration) <= 103.05);
  execFileSync(ffmpeg, ["-v", "error", "-threads", "2", "-i", finalPath, "-f", "null", "-"], {
    stdio: "inherit",
  });
  await writeFile(join(output, "video-metadata.json"), JSON.stringify(metadata, null, 2));
  console.log(`Verified ${metadata.format.duration}s silent video: ${finalPath}`);
} finally {
  await browser.close();
}
