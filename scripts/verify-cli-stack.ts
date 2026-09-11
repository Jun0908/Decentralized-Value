import assert from "node:assert/strict";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve, join, relative, sep } from "node:path";
import {
  createApi,
  MemoryPlan6CompetitionStore,
  CliAuthService,
  MemoryCliAuthStore,
} from "../apps/api/src/index";
import benchmark from "../benchmarks/evm-orderbook/results/latest.json";

if (process.env.NODE_ENV === "production")
  throw new Error("Run this isolated fixture verification outside production.");
const root = resolve(import.meta.dirname, "..");
const entry = resolve(process.env.FRONTIER_CLI_ENTRY ?? resolve(root, "packages/cli/dist/bin.js"));
const temporary = await mkdtemp(join(tmpdir(), "frontier-cli-stack-"));
const execute = promisify(execFile);
type Envelope = {
  ok: boolean;
  data: Record<string, unknown>;
  error?: { code: string; details?: Record<string, unknown> };
};
const records: Array<{ step: string; passed: boolean }> = [];
const passed = (step: string) => {
  records.push({ step, passed: true });
  process.stdout.write(`PASS ${step}\n`);
};

async function fixture() {
  let dropSubmissionResponse = false;
  const server = createServer(async (incoming, outgoing) => {
    try {
      const request = new Request(`${origin}${incoming.url}`, {
        method: incoming.method,
        headers: incoming.headers as Record<string, string>,
        ...(incoming.method === "GET" || incoming.method === "HEAD"
          ? {}
          : { body: Readable.toWeb(incoming), duplex: "half" }),
      } as RequestInit);
      const response = await api.fetch(request);
      if (
        dropSubmissionResponse &&
        request.method === "POST" &&
        incoming.url === "/v1/challenges/disaster-response/submissions"
      ) {
        dropSubmissionResponse = false;
        outgoing.destroy();
        return;
      }
      outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      outgoing.writeHead(500);
      outgoing.end("Fixture server failed");
    }
  });
  await new Promise<void>((resolveReady, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveReady);
  });
  const address = server.address();
  assert(address && typeof address === "object");
  const origin = `http://127.0.0.1:${address.port}`;
  const identity = async (request: Request) => {
    assert.equal(request.headers.get("authorization"), "Bearer local-fixture-user");
    assert.equal(request.headers.get("x-privy-identity-token"), "local-fixture-identity");
    return {
      userId: "local-cli-stack-fixture",
      wallet: "0x1111111111111111111111111111111111111111" as const,
    };
  };
  const store = new MemoryPlan6CompetitionStore();
  const api = createApi(benchmark, undefined, undefined, undefined, {
    store,
    identity,
    cliAuth: new CliAuthService({
      store: new MemoryCliAuthStore(),
      identity,
      origin,
      production: false,
    }),
  });
  return {
    origin,
    store,
    dropNextSubmission: () => {
      dropSubmissionResponse = true;
    },
    close: () =>
      new Promise<void>((done, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : done()));
      }),
  };
}

async function testCli(
  f: Awaited<ReturnType<typeof fixture>>,
  cwd: string,
  args: string[],
  expected = 0,
  token?: string,
): Promise<Envelope> {
  let stdout = "",
    stderr = "",
    exitCode = 0;
  const env = {
    ...process.env,
    FRONTIER_BASE_URL: f.origin,
    FRONTIER_TOKEN: token ?? "",
    FRONTIER_TOKEN_ORIGIN: token ? f.origin : "",
  };
  try {
    const result = await execute(process.execPath, [entry, ...args, "--json"], {
      cwd,
      env,
      timeout: 60000,
      maxBuffer: 8 * 1024 * 1024,
    });
    stdout = result.stdout;
    stderr = result.stderr;
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string; code?: number };
    stdout = failure.stdout ?? "";
    stderr = failure.stderr ?? "";
    exitCode = typeof failure.code === "number" ? failure.code : -1;
  }
  if (token) {
    assert(!stdout.includes(token), "Session leaked to stdout");
    assert(!stderr.includes(token), "Session leaked to stderr");
  }
  const payload = JSON.parse(stdout) as Envelope;
  assert.equal(
    exitCode,
    expected,
    `${args.join(" ")}: ${payload.error?.code ?? "unexpected exit"}`,
  );
  assert.equal(payload.ok, expected === 0 || expected === 8);
  return payload;
}

async function authenticate(origin: string) {
  const post = async (action: string, payload: unknown, headers: Record<string, string> = {}) => {
    const response = await fetch(`${origin}/v1/cli/auth/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(payload),
    });
    assert.equal(response.status, 200, `Fixture authentication ${action}`);
    return response.json();
  };
  const device = await post("device", {});
  await post(
    "approve",
    { user_code: device.user_code, decision: "approve" },
    {
      authorization: "Bearer local-fixture-user",
      "x-privy-identity-token": "local-fixture-identity",
      origin,
      "x-frontier-cli-csrf": "1",
    },
  );
  return (await post("token", { device_code: device.device_code })).access_token as string;
}

try {
  const disaster = await fixture();
  try {
    const directory = join(temporary, "disaster");
    const arenas = await testCli(disaster, temporary, ["arenas", "list"]);
    assert.equal((arenas.data.arenas as unknown[]).length, 2);
    await testCli(disaster, temporary, ["init", "disaster-response", "--dir", directory]);
    await testCli(disaster, directory, ["check"]);
    passed("Disaster Response starter and offline validation");
    const first = await testCli(disaster, directory, ["practice", "--wait"]);
    const second = await testCli(disaster, directory, ["practice", "--wait"]);
    const runA = (first.data.run as Record<string, unknown> | undefined) ?? first.data;
    const runB = (second.data.run as Record<string, unknown> | undefined) ?? second.data;
    assert.equal(runA.resultHash, runB.resultHash);
    assert.notEqual(runA.runId, runB.runId);
    const compared = await testCli(disaster, directory, [
      "compare",
      String(runA.runId),
      String(runB.runId),
    ]);
    assert.equal(compared.data.relation, "equal");
    passed("Deterministic official Practice, independent local Run IDs and metric comparison");
    const token = await authenticate(disaster.origin);
    await testCli(disaster, directory, ["auth", "status"], 0, token);
    await testCli(disaster, directory, ["submit"], 3, token);
    disaster.dropNextSubmission();
    const interrupted = await testCli(disaster, directory, ["submit", "--yes"], 7, token);
    const operationId = interrupted.error?.details?.operationId;
    assert.equal(typeof operationId, "string");
    const path = join(directory, "strategy.json");
    const original = JSON.parse(await readFile(path, "utf8"));
    await writeFile(path, JSON.stringify({ ...original, reserveKits: original.reserveKits + 1 }));
    const resumed = await testCli(
      disaster,
      directory,
      ["submit", "--resume", String(operationId)],
      0,
      token,
    );
    const saved = resumed.data.submission as {
      submissionId: string;
      revision: number;
      artifact: { strategy: unknown };
    };
    assert.equal(saved.revision, 1);
    assert.deepEqual(saved.artifact.strategy, original);
    assert.equal((await disaster.store.submissionsForChallenge()).length, 1);
    passed("Confirmed registration/submission, lost response, immutable resume and one revision");
    await testCli(disaster, directory, ["submissions", "list"], 0, token);
    await testCli(disaster, directory, ["submissions", "inspect", saved.submissionId], 0, token);
    const downloaded = join(directory, "saved-strategy.json");
    await testCli(
      disaster,
      directory,
      ["submissions", "download", saved.submissionId, "--output", downloaded],
      0,
      token,
    );
    assert.deepEqual(JSON.parse(await readFile(downloaded, "utf8")), original);
    await testCli(disaster, directory, ["entry", "select", saved.submissionId, "--yes"], 0, token);
    const opened = await testCli(
      disaster,
      directory,
      ["open", saved.submissionId, "--print-url"],
      0,
      token,
    );
    assert.equal(new URL(String(opened.data.url)).origin, disaster.origin);
    passed("Owned history, exact artifact download, Final Entry and saved-result URL");
  } finally {
    await disaster.close();
  }

  const rescue = await fixture();
  try {
    const directory = join(temporary, "rescue");
    await testCli(rescue, temporary, ["init", "rescue-room", "--dir", directory]);
    await testCli(rescue, directory, ["check"]);
    const first = await testCli(rescue, directory, ["practice", "--wait"]);
    const second = await testCli(rescue, directory, ["practice", "--wait"]);
    const runA = (first.data.run as Record<string, unknown> | undefined) ?? first.data;
    const runB = (second.data.run as Record<string, unknown> | undefined) ?? second.data;
    assert.equal(runA.resultHash, runB.resultHash);
    const raw = runA.raw as {
      state: string;
      paymentState: string;
      rewardEligibility: { eligible: boolean };
    };
    assert.equal(raw.state, "simulated");
    assert.equal(raw.paymentState, "game-credits");
    assert.equal(raw.rewardEligibility.eligible, false);
    await testCli(rescue, directory, ["compare", String(runA.runId), String(runB.runId)]);
    await testCli(rescue, directory, ["submit", "--yes"], 5);
    passed(
      "Rescue Room Doctrine determinism, same-Episode comparison and explicit submission rejection",
    );
  } finally {
    await rescue.close();
  }

  const report = resolve(root, "artifacts/sdk-cli-verification/stack-report.json");
  await mkdir(dirname(report), { recursive: true });
  await writeFile(
    report,
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        cliEntry: entry.startsWith(`${root}${sep}`)
          ? relative(root, entry).replaceAll("\\", "/")
          : "external-override",
        mode: "isolated-local-fixtures",
        liveAccountsUsed: false,
        records,
      },
      null,
      2,
    ) + "\n",
  );
  process.stdout.write(
    `Verified ${records.length} complete workflows with local-only fixture accounts.\n`,
  );
} finally {
  const target = resolve(temporary);
  assert(
    target.startsWith(resolve(tmpdir()) + sep) &&
      target.split(sep).at(-1)!.startsWith("frontier-cli-stack-"),
  );
  await rm(target, { recursive: true, force: true });
}
