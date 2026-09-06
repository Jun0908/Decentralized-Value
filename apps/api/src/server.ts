import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { EnsRunnerDirectory, ViemEnsRecordReader } from "@frontier/ens-adapter";
import { parseEnvironment } from "@frontier/shared";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { createApi } from "./index";

const root = resolve(import.meta.dirname, "../../..");
const benchmark = JSON.parse(
  await readFile(resolve(root, "benchmarks/evm-orderbook/results/latest.json"), "utf8"),
);
const { API_PORT } = parseEnvironment(process.env);
const runnerDirectory =
  process.env.SEPOLIA_RPC_URL && process.env.ENS_PARENT_NAME
    ? new EnsRunnerDirectory(
        new ViemEnsRecordReader(
          createPublicClient({ chain: sepolia, transport: http(process.env.SEPOLIA_RPC_URL) }),
        ),
        `runners.${process.env.ENS_PARENT_NAME}`,
      )
    : undefined;
const api = createApi(benchmark, undefined, runnerDirectory);

createServer(async (incoming, outgoing) => {
  const origin = `http://${incoming.headers.host ?? `localhost:${API_PORT}`}`;
  const request = new Request(new URL(incoming.url ?? "/", origin), {
    method: incoming.method,
    headers: new Headers(incoming.headers as Record<string, string>),
    body:
      incoming.method === "GET" || incoming.method === "HEAD"
        ? undefined
        : (Readable.toWeb(incoming) as ReadableStream),
    duplex: "half",
  } as RequestInit);
  const response = await api.fetch(request);
  outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  outgoing.end(Buffer.from(await response.arrayBuffer()));
}).listen(API_PORT, "127.0.0.1", () =>
  process.stdout.write(`Frontier API listening on http://127.0.0.1:${API_PORT}\n`),
);
