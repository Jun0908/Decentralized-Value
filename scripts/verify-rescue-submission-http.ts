/** Real loopback HTTP, deterministic public Practice only. No auth/env/model/payment. */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { FrontierClient, compareRuns } from "../packages/sdk/src/index";
import { evaluateRescueDoctrinePracticeEpisode } from "../packages/rescue-room/src/index";

const origin = new URL(process.argv[2] ?? "http://127.0.0.1:3012");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname));
assert.equal(origin.protocol, "http:");
assert.equal(origin.href, `${origin.origin}/`);
const allowed = new Set([
  "GET /v1/cli/arenas/rescue-room",
  "GET /v1/rescue-room/starter-kit",
  "POST /v1/rescue-room/doctrine-evaluations",
]);
const requests: { method: string; path: string; status: number }[] = [];
const client = new FrontierClient({
  baseUrl: origin.origin,
  timeoutMs: 60000,
  fetch: async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    assert.equal(url.origin, origin.origin);
    assert.ok(allowed.has(`${request.method} ${url.pathname}`));
    assert.equal(request.headers.get("authorization"), null);
    const result = await fetch(request);
    requests.push({ method: request.method, path: url.pathname, status: result.status });
    return result;
  },
});
// Verify the actual isolated Web before the API run; no inferred success from Ready logs.
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors: string[] = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (e) => {
    if (e.type() === "error") errors.push(e.text());
  });
  const response = await page.goto(`${origin.origin}/rescue-room/submission`, {
    waitUntil: "networkidle",
  });
  assert.equal(response?.status(), 200);
  assert.equal(await page.locator("h1").count(), 1);
  assert.equal(await page.locator("[data-nextjs-dialog]").count(), 0);
  assert.ok((await page.locator("main").innerText()).includes("71.13%"));
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
const manifest = await client.arenas.get("rescue-room");
assert.equal(manifest.rewardEligible, false);
assert.equal(manifest.paymentState, "game-credits");
assert.equal(manifest.capabilities.practice.authentication, "none");
assert.ok((await client.arenas.downloadStarter("rescue-room", manifest)).byteLength);
const request = {
  arenaId: "rescue-room" as const,
  context: manifest.context,
  episodeId: manifest.episodes[0]!.id,
  artifact: manifest.artifact.sample,
};
const first = await client.evaluations.practice(request);
const repeat = await client.evaluations.practice(request);
const local = evaluateRescueDoctrinePracticeEpisode(request.artifact, request.episodeId);
assert.deepEqual(first.raw, {
  state: "simulated",
  strategyState: "deterministic-rules",
  paymentState: "game-credits",
  ...local,
});
assert.equal(first.resultHash, repeat.resultHash);
assert.equal(compareRuns(first, repeat).relation, "equal");
const report = {
  schemaVersion: "rescue-loopback-http-check-v1",
  verified: true,
  origin: origin.origin,
  requests,
  browserConsoleErrors: errors.length,
  episodeId: request.episodeId,
  artifactHash: first.artifactHash,
  resultHash: first.resultHash,
  values: first.values,
  independentEvaluatorMatch: true,
  repeatedHashMatch: true,
  privateConfigurationPresent: [
    ".env",
    ".env.local",
    "apps/web/.env.local",
    "secrets",
    ".frontier/rescue-operator",
  ].some((p) => existsSync(resolve(p))),
  modelCalls: 0,
  chainTransactions: 0,
  liveDeploymentVerified: false,
};
const output = resolve(".frontier/handoff/rescue-en");
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, "loopback-http-qa.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
