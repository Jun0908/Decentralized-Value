import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { chromium } from "playwright";
import {
  assessSecretGateFeasibility,
  type SecretGateFeasibilityTrial,
} from "../apps/runner/src/secret-gate-runner";

const execFileAsync = promisify(execFile);
const baseUrl = process.env.SECRET_GATE_BASE_URL ?? "http://localhost:3000";
const chromePath =
  process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const resultsDirectory = "benchmarks/secret-gate/results";

type Strategy = {
  id: string;
  maxParallelProofs: 1 | 2 | 4;
  workerLifecycle: "reuse" | "per-request";
  artifactLoad: "on-demand" | "eager";
};

const strategies: Strategy[] = [
  {
    id: "sequential-reuse",
    maxParallelProofs: 1,
    workerLifecycle: "reuse",
    artifactLoad: "on-demand",
  },
  {
    id: "sequential-fresh",
    maxParallelProofs: 1,
    workerLifecycle: "per-request",
    artifactLoad: "on-demand",
  },
  { id: "parallel-2", maxParallelProofs: 2, workerLifecycle: "reuse", artifactLoad: "on-demand" },
  { id: "parallel-4", maxParallelProofs: 4, workerLifecycle: "reuse", artifactLoad: "on-demand" },
];
const order = [
  strategies[0]!,
  strategies[3]!,
  strategies[1]!,
  strategies[2]!,
  strategies[2]!,
  strategies[1]!,
  strategies[3]!,
  strategies[0]!,
];

async function processTreeRss(rootPid: number) {
  const command = [
    `$rootProcessId=${rootPid}`,
    "$processes=Get-CimInstance Win32_Process",
    "$ids=New-Object 'System.Collections.Generic.HashSet[int]'",
    "[void]$ids.Add([int]$rootProcessId)",
    "do {$before=$ids.Count; foreach($process in $processes) {if($ids.Contains([int]$process.ParentProcessId)) {[void]$ids.Add([int]$process.ProcessId)}}} while($ids.Count -gt $before)",
    "$total=[int64]0",
    "foreach($process in $processes) {if($ids.Contains([int]$process.ProcessId)) {$total += [int64]$process.WorkingSetSize}}",
    "Write-Output $total",
  ].join("; ");
  const { stdout } = await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    command,
  ]);
  const value = Number(stdout.trim());
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error("Could not measure Chrome RSS");
  return value;
}

await mkdir(resultsDirectory, { recursive: true });

const trials: SecretGateFeasibilityTrial[] = [];

for (const [trialIndex, strategy] of order.entries()) {
  const chrome = await chromium.launchServer({
    executablePath: chromePath,
    headless: true,
    args: [
      "--disable-background-networking",
      "--disable-default-apps",
      "--disable-extensions",
      "--disable-sync",
      "--no-first-run",
    ],
  });
  const chromePid = chrome.process().pid;
  if (!chromePid) throw new Error("Controlled Chrome did not expose its process id");
  const browser = await chromium.connect(chrome.wsEndpoint());
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/arenas/secret-gate`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Create disposable identity" }).click();
    await page.getByRole("button", { name: "Create membership snapshot" }).click();
    await page.getByText("Membership snapshot ready").waitFor({ timeout: 30_000 });
    await page
      .getByLabel("Maximum parallel proofs")
      .selectOption(String(strategy.maxParallelProofs));
    await page.getByLabel("Artifact loading").selectOption(strategy.artifactLoad);
    await page.getByLabel("Worker lifecycle").selectOption(strategy.workerLifecycle);

    const baselineRssBytes = await processTreeRss(chromePid);
    const samples = [baselineRssBytes];
    let sampling = true;
    const sampler = (async () => {
      while (sampling) {
        samples.push(await processTreeRss(chromePid));
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    })();

    await page.getByRole("button", { name: "Run personal benchmark" }).click();
    await page.getByTestId("secret-gate-benchmark-result").waitFor({ timeout: 180_000 });
    sampling = false;
    await sampler;
    const p95Text = await page.getByTestId("secret-gate-p95").innerText();
    const p95LatencyMs = Number(p95Text.replace(/[^0-9.]/g, ""));
    const proofState = await page.getByText("4 / 4 valid").count();
    const peakRssBytes = Math.max(...samples);
    trials.push({
      strategyId: strategy.id,
      maxParallelProofs: strategy.maxParallelProofs,
      workerLifecycle: strategy.workerLifecycle,
      artifactLoad: strategy.artifactLoad,
      p95LatencyMs,
      baselineRssBytes,
      peakRssBytes,
      peakIncrementalMemoryMb:
        Math.round(((peakRssBytes - baselineRssBytes) / 1024 / 1024) * 10) / 10,
      proofCount: 4,
      allProofsVerified: proofState === 1,
    });
    process.stdout.write(`trial ${trialIndex + 1}/${order.length}: ${strategy.id}\n`);
  } finally {
    await browser.close();
    await chrome.close();
  }
}

const assessment = assessSecretGateFeasibility(trials);
const output = {
  generatedAt: new Date().toISOString(),
  browser: "installed Google Chrome, headless controlled profile",
  environment: "local Windows feasibility runner",
  status: "feasibility-only; not settlement evidence",
  ...assessment,
};
await writeFile(`${resultsDirectory}/latest.json`, `${JSON.stringify(output, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
