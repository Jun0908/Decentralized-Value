import { randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { createRescueJobsHttpHandler } from "../apps/api/src/rescue-jobs-http";
import { rescueOperatorJobStore, runLiveRescueOperator } from "./rescue-operator";
import { persistNewJson } from "./lib/rescue-operator-chain";

const host = "127.0.0.1:4318";
const origin = `http://${host}`;
const secretPath = resolve(import.meta.dirname, "../secrets/rescue-operator-http.json");
if (!existsSync(secretPath))
  persistNewJson(secretPath, {
    schemaVersion: "rescue-operator-http-v1",
    token: randomBytes(32).toString("hex"),
  });
const credential = JSON.parse(readFileSync(secretPath, "utf8"));
if (
  credential.schemaVersion !== "rescue-operator-http-v1" ||
  !/^[0-9a-f]{64}$/.test(credential.token)
)
  throw new Error("INVALID_LOCAL_OPERATOR_CREDENTIAL");
const expected = Buffer.from(`Bearer ${credential.token}`);
const enabled = process.argv.includes("--execute-approved-sepolia");
const handler = createRescueJobsHttpHandler({
  store: rescueOperatorJobStore,
  trustedOrigin: origin,
  authenticate: async (request) => {
    const presented = Buffer.from(request.headers.get("authorization") ?? "");
    return presented.length === expected.length && timingSafeEqual(expected, presented)
      ? "local-rescue-operator"
      : null;
  },
  ...(enabled
    ? {
        executeJob: async (jobId: string, owner: string) => {
          if (owner !== "local-rescue-operator") throw new Error("UNKNOWN_OPERATOR");
          await runLiveRescueOperator(jobId);
        },
      }
    : {}),
});
const server = createServer(async (incoming, outgoing) => {
  // Bind loopback AND reject DNS rebinding/forwarded origins. No CORS and no public tunnel.
  if (
    incoming.headers.host !== host ||
    !incoming.url?.startsWith("/") ||
    incoming.url.startsWith("//") ||
    incoming.headers["x-forwarded-host"] ||
    incoming.headers["x-forwarded-for"]
  ) {
    outgoing.writeHead(403);
    outgoing.end("Local operator host required");
    return;
  }
  if (incoming.url === "/health" && incoming.method === "GET") {
    outgoing.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    outgoing.end(
      JSON.stringify({ status: "ok", scope: "single-host-operator", executionEnabled: enabled }),
    );
    return;
  }
  try {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of incoming) {
      size += chunk.length;
      if (size > 65_536) {
        outgoing.writeHead(413);
        outgoing.end("Request too large");
        return;
      }
      chunks.push(Buffer.from(chunk));
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(incoming.headers))
      if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(",") : value);
    const body = Buffer.concat(chunks);
    const request = new Request(new URL(incoming.url ?? "/", origin), {
      method: incoming.method ?? "GET",
      headers,
      ...(body.length ? { body } : {}),
    });
    const response = await handler(request);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing.writeHead(500, { "content-type": "application/json" });
    outgoing.end(JSON.stringify({ error: { code: "OPERATOR_UNAVAILABLE" } }));
  }
});
server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
server.listen(4318, "127.0.0.1", () =>
  console.log(
    JSON.stringify({
      origin,
      executionEnabled: enabled,
      credentials: "ignored-local-file",
      publicDeployment: false,
    }),
  ),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    server.close(() => {
      void handler.waitForIdle().finally(() => process.exit(0));
    });
  });
