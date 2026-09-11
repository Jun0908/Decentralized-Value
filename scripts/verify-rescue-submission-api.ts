/** Hackathon agent-entry preflight: existing API + SDK, zero AI/RPC/auth calls.
 * Requests use the real API handler through an injected fetch; no socket/deployment.
 * The hashes below use the legacy Rescue canonical format, not Request/Result V2.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";
import { keccak256, stringToHex } from "viem";
import { createApi } from "../apps/api/src/index";
import {
  evaluateRescueDoctrinePracticeEpisode,
  replayRescueDoctrinePractice,
  rescueDoctrineHash,
  rescueDoctrinePresets,
} from "../packages/rescue-room/src/index";
import { canonicalProtocolJson } from "../packages/shared/src/manifest";
import { FrontierClient, compareRuns } from "../packages/sdk/src/index";

const root = resolve(import.meta.dirname, "..");
const openapi = parse(await readFile(resolve(root, "openapi/frontier-v1.yaml"), "utf8"));
const path = "/v1/rescue-room/doctrine-evaluations";
const operation = openapi.paths[path].post;
assert.equal(
  operation.requestBody.content["application/json"].schema.$ref,
  "#/components/schemas/RescueRoomDoctrineEvaluationInput",
);
assert.equal(
  operation.responses["200"].content["application/json"].schema.$ref,
  "#/components/schemas/CliRescuePracticeResult",
);
assert.ok(openapi.components.schemas.RescueRoomDoctrineEvaluationInput);
assert.ok(openapi.components.schemas.CliRescuePracticeResult);
assert.ok(openapi.paths["/v1/cli/arenas/{id}"]);

let modelCalls = 0;
const api = createApi(
  JSON.parse(await readFile(resolve(root, "benchmarks/evm-orderbook/results/latest.json"), "utf8")),
  undefined,
  undefined,
  undefined,
  undefined,
  {
    commander: async () => {
      modelCalls++;
      throw new Error("PAID_MODEL_FORBIDDEN_IN_PREFLIGHT");
    },
  },
);
const baseUrl = "http://127.0.0.1:3000";
const requests: { method: string; path: string; status: number }[] = [];
const allowed = new Set([
  "GET /v1/cli/arenas/rescue-room",
  "GET /v1/rescue-room/starter-kit",
  `POST ${path}`,
]);
const fetcher: typeof fetch = async (input, init) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  assert.equal(url.origin, baseUrl);
  assert.ok(
    allowed.has(`${request.method} ${url.pathname}`),
    "Only non-billable Practice routes may run.",
  );
  assert.equal(request.headers.get("authorization"), null);
  const response = await api.fetch(request);
  requests.push({ method: request.method, path: url.pathname, status: response.status });
  return response;
};
const client = new FrontierClient({ baseUrl, fetch: fetcher });
const manifest = await client.arenas.get("rescue-room");
assert.equal(manifest.capabilities.practice.authentication, "none");
assert.equal(manifest.capabilities.practice.available, true);
assert.equal(manifest.capabilities.submit.supported, false);
assert.equal(manifest.capabilities.finalEntry.supported, false);
assert.equal(manifest.rewardEligible, false);
assert.equal(manifest.paymentState, "game-credits");
assert.equal(manifest.context.evidenceState, "simulated");
assert.ok((await client.arenas.downloadStarter("rescue-room", manifest)).byteLength > 0);

const episodeId = manifest.episodes[0]!.id;
const input = {
  arenaId: "rescue-room" as const,
  artifact: manifest.artifact.sample,
  episodeId,
  context: manifest.context,
};
const first = await client.evaluations.practice(input);
const second = await client.evaluations.practice(input);
assert.equal(first.artifactHash, second.artifactHash);
assert.equal(first.resultHash, second.resultHash);
assert.deepEqual(first.values, second.values);
assert.notEqual(first.runId, second.runId, "Client run IDs are not deterministic result hashes.");

const local = evaluateRescueDoctrinePracticeEpisode(input.artifact, episodeId);
assert.deepEqual(first.raw, {
  state: "simulated",
  strategyState: "deterministic-rules",
  paymentState: "game-credits",
  ...local,
});
assert.equal(first.artifactHash, local.doctrineHash);
assert.equal(first.resultHash, local.evaluationHash);
const hash = (value: unknown) => keccak256(stringToHex(canonicalProtocolJson(value)));
function verifyEvidence(value: typeof local): void {
  assert.equal(rescueDoctrineHash(input.artifact), value.doctrineHash);
  const { evaluationHash, ...evaluation } = value;
  assert.equal(hash(evaluation), evaluationHash);
  const { resultHash, ...outcome } = value.outcome;
  assert.equal(hash(outcome), resultHash);
  assert.equal(hash(value.outcome.transcript), value.outcome.transcriptHash);
  const { evidenceHash, ...payments } = value.paymentEvidence;
  assert.equal(hash(payments), evidenceHash);
  const replay = replayRescueDoctrinePractice(episodeId, input.artifact, value.decisions);
  assert.equal(replay.resultHash, value.outcome.resultHash);
  assert.equal(replay.transcriptHash, value.outcome.transcriptHash);
  assert.equal(value.replay.matchesRecordedOutcome, true);
  assert.equal(value.rewardEligibility.eligible, false);
}
verifyEvidence(local);
assert.throws(() =>
  verifyEvidence({
    ...local,
    outcome: { ...local.outcome, userLossUsd: local.outcome.userLossUsd + 1 },
  }),
);

const alternate = await client.evaluations.practice({
  ...input,
  artifact: rescueDoctrinePresets[1]!.doctrine,
});
const comparison = compareRuns(first, alternate);
assert.deepEqual(
  comparison.metrics.map(({ key, direction }) => ({ key, direction })),
  [
    { key: "totalUserLossUsd", direction: "MINIMIZE" },
    { key: "servedProtocolDemandPpm", direction: "MAXIMIZE" },
    { key: "netResponseSpendCredits", direction: "MINIMIZE" },
  ],
);
assert.equal("score" in comparison, false);
assert.throws(() =>
  compareRuns(first, {
    ...alternate,
    context: { ...alternate.context, runtimeContextHash: `0x${"ab".repeat(32)}` },
  }),
);

async function direct(body: unknown, headers: Record<string, string> = {}) {
  return fetcher(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
const badContext = await direct(
  { doctrine: input.artifact, episodeId },
  {
    "X-Frontier-Context-Hash": `0x${"ab".repeat(32)}`,
    "X-Frontier-Runtime-Context-Hash": manifest.context.runtimeContextHash!,
  },
);
assert.equal(badContext.status, 409);
assert.equal((await badContext.json()).error.code, "CONTEXT_MISMATCH");
assert.equal(
  (
    await direct(
      { doctrine: input.artifact, episodeId },
      { "X-Frontier-Context-Hash": manifest.context.contextHash },
    )
  ).status,
  409,
);
assert.equal((await direct({ doctrine: { schemaVersion: "invalid" }, episodeId })).status, 400);
assert.equal(
  (await direct({ doctrine: input.artifact, episodeId: "not-a-public-episode" })).status,
  400,
);
assert.equal(modelCalls, 0);

console.log(
  JSON.stringify(
    {
      schemaVersion: "rescue-submission-api-verification-v0",
      status: "pass",
      transport: "existing-api-handler-with-injected-fetch",
      externalNetworkRequests: 0,
      modelCalls,
      paymentsRequested: 0,
      publicDeploymentVerified: false,
      input: { episodeId, doctrineHash: local.doctrineHash },
      context: manifest.context,
      outcome: { correctness: first.correctness, values: first.values },
      hashes: {
        evaluation: local.evaluationHash,
        result: local.outcome.resultHash,
        transcript: local.outcome.transcriptHash,
        paymentEvidence: local.paymentEvidence.evidenceHash,
      },
      verification: {
        openapiAndSdkPath: true,
        starterDigest: true,
        repeatedResult: true,
        localEvaluator: true,
        recordedActionReplay: true,
        tamperRejected: true,
        contextMismatchRejected: true,
        invalidInputRejected: true,
      },
      comparison: { relation: comparison.relation, metrics: comparison.metrics },
      boundary: {
        state: "simulated",
        payments: "game-credits",
        rewardEligible: false,
        finalEntrySupported: false,
      },
      requests,
    },
    null,
    2,
  ),
);
