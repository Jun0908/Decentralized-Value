import { createServer, request as proxyRequest } from "node:http";

// Run a normal Web production build/server first. This loopback-only development
// preview reuses the real Secret Gate handlers with ephemeral local storage.
// It does not weaken the deployed application's production Redis requirement.
// pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/preview-arena-labs.ts 3012 3014
const upstreamPort = Number(process.argv[2] ?? 3012);
const port = Number(process.argv[3] ?? 3014);
if (
  ![upstreamPort, port].every(
    (value) => Number.isInteger(value) && value >= 1024 && value <= 65535,
  ) ||
  port === upstreamPort
)
  throw new Error("Provide two distinct local ports from 1024 to 65535");
process.env.NODE_ENV = "development";
for (const key of [
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
])
  delete process.env[key];
const enroll = await import("../apps/web/src/app/v1/secret-gate/enroll/route");
const enter = await import("../apps/web/src/app/v1/secret-gate/enter/route");
const localPostPaths = new Set([
  "/api/calldata-lab",
  "/v1/calldata-compression/evaluations",
  "/v1/microgrid-dispatch/evaluations",
]);
const server = createServer(async (incoming, outgoing) => {
  const origin = incoming.headers.origin;
  if (origin && origin !== `http://127.0.0.1:${port}` && origin !== `http://localhost:${port}`) {
    outgoing.writeHead(403, { "content-type": "application/json" });
    outgoing.end(
      JSON.stringify({ error: "Cross-origin access is disabled in this local preview" }),
    );
    return;
  }
  const path = (incoming.url ?? "/").split("?")[0];
  if (
    incoming.method === "POST" &&
    (path === "/v1/secret-gate/enroll" || path === "/v1/secret-gate/enter")
  ) {
    try {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of incoming) {
        const bytes = Buffer.from(chunk);
        size += bytes.byteLength;
        if (size > 16_384) {
          outgoing.writeHead(413, { "content-type": "application/json" });
          outgoing.end(JSON.stringify({ error: "Local preview body limit exceeded" }));
          return;
        }
        chunks.push(bytes);
      }
      const handler = path.endsWith("/enroll") ? enroll.POST : enter.POST;
      const response = await handler(
        new Request(`http://127.0.0.1:${port}${path}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: Buffer.concat(chunks).toString("utf8"),
        }),
      );
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(await response.text());
    } catch {
      outgoing.writeHead(503, { "content-type": "application/json" });
      outgoing.end(JSON.stringify({ error: "Local Secret Gate preview unavailable" }));
    }
    return;
  }
  // No inference, wallet, settlement or other state-changing routes in this preview.
  if (
    incoming.method !== "GET" &&
    incoming.method !== "HEAD" &&
    !(incoming.method === "POST" && localPostPaths.has(path ?? ""))
  ) {
    outgoing.writeHead(405, { "content-type": "application/json" });
    outgoing.end(
      JSON.stringify({ error: "This local preview only enables the three Practice labs" }),
    );
    return;
  }
  const proxy = proxyRequest(
    {
      hostname: "127.0.0.1",
      port: upstreamPort,
      method: incoming.method,
      path: incoming.url,
      headers: { ...incoming.headers, host: `127.0.0.1:${upstreamPort}` },
    },
    (response) => {
      outgoing.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(outgoing);
    },
  );
  proxy.on("error", () => {
    if (!outgoing.headersSent) outgoing.writeHead(502, { "content-type": "text/plain" });
    outgoing.end("Start the local Web production server first.");
  });
  incoming.pipe(proxy);
});
server.listen(port, "127.0.0.1", () => {
  console.log(`Local Practice preview: http://127.0.0.1:${port}/arenas`);
  console.log(
    "Secret Gate: actual verifier, local-memory only; restart resets one-use protection. No payment or AI routes.",
  );
});
