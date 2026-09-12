import {
  FrontierClient,
  FrontierError,
  compareRuns,
  verifyRescueDoctrinePracticeIntegrity,
} from "../../packages/sdk/src/index";

const paths = new Set([
  "GET /v1/cli/arenas/rescue-room",
  "GET /v1/rescue-room/starter-kit",
  "POST /v1/rescue-room/doctrine-evaluations",
]);
type Phase = "configuration" | "manifest" | "starter" | "practice" | "integrity" | "repeat";
const hints = {
  INVALID_ORIGIN:
    "Use an exact HTTPS origin or loopback HTTP origin, without a path or credentials.",
  AUTH_REQUIRED:
    "Public Practice unexpectedly requires authentication. Stop; do not add wallet credentials.",
  PAYMENT_REQUIRED:
    "Public Practice unexpectedly requests payment. Stop; do not pay or retry automatically.",
  RATE_LIMITED: "The API is rate limited. Wait and explicitly rerun; no retry was attempted.",
  CONTEXT_MISMATCH:
    "The locked context changed. Fetch a fresh manifest and start a new comparison set.",
  STARTER_HASH_MISMATCH:
    "The Starter does not match its manifest. Do not execute the downloaded content.",
  TIMEOUT: "The request timed out; server completion is unknown. No automatic retry was attempted.",
  REDIRECT_REJECTED: "Use the final approved API origin; redirects are not followed.",
  UNSUPPORTED_MANIFEST:
    "This command supports only non-billable, non-reward Rescue Doctrine Practice.",
  INTEGRITY_FAILED: "The result failed independent hash checks. Do not compare or reward it.",
  REPEAT_MISMATCH: "Repeated Practice did not reproduce the same hashes and outcomes.",
  REQUEST_BLOCKED: "The requested path or credentials are outside this public Practice check.",
  INVALID_RESPONSE: "The response does not match the supported API contract.",
  UNAVAILABLE: "The API is unavailable or could not be reached. Check the selected server.",
} as const;
type FailureCode = keyof typeof hints;

/** No account, env, wallet, model or payment adapter. Injected fetch is trusted code, not a sandbox. */
export async function checkRescuePracticeOnboarding(
  baseUrl: string,
  options: { fetch?: typeof fetch; timeoutMs?: number } = {},
) {
  let phase: Phase = "configuration";
  const requests: { method: string; path: string; status: number }[] = [];
  const fail = (code: FailureCode) => ({
    schemaVersion: "rescue-practice-onboarding-v1" as const,
    verified: false as const,
    phase,
    code,
    nextAction: hints[code],
    requests: structuredClone(requests),
    automaticRetries: 0,
    credentialsSent: false,
    paymentAttempted: false,
  });
  try {
    let origin: URL;
    try {
      origin = new URL(baseUrl);
      if (
        origin.href !== `${origin.origin}/` ||
        origin.username ||
        origin.password ||
        (origin.protocol !== "https:" &&
          !(
            origin.protocol === "http:" &&
            ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
          ))
      )
        return fail("INVALID_ORIGIN");
    } catch {
      return fail("INVALID_ORIGIN");
    }
    let attempts = 0;
    const client = new FrontierClient({
      baseUrl: origin.origin,
      timeoutMs: options.timeoutMs ?? 60_000,
      fetch: async (input, init) => {
        const request = new Request(input, init);
        const url = new URL(request.url);
        if (
          ++attempts > 6 ||
          url.origin !== origin.origin ||
          url.search ||
          !paths.has(`${request.method} ${url.pathname}`) ||
          [...request.headers.keys()].some((key) =>
            /authorization|cookie|token|api-key/i.test(key),
          ) ||
          init?.redirect !== "manual" ||
          init.credentials !== "omit"
        )
          throw new FrontierError("REQUEST_BLOCKED", hints.REQUEST_BLOCKED);
        const response = await (options.fetch ?? fetch)(input, init);
        requests.push({ method: request.method, path: url.pathname, status: response.status });
        return response;
      },
    });
    phase = "manifest";
    const manifest = await client.arenas.get("rescue-room");
    if (
      manifest.artifact.kind !== "doctrine" ||
      manifest.context.evidenceState !== "simulated" ||
      manifest.paymentState !== "game-credits" ||
      manifest.rewardEligible !== false ||
      !manifest.capabilities.practice.available ||
      manifest.capabilities.practice.authentication !== "none" ||
      manifest.starter.path !== "/v1/rescue-room/starter-kit" ||
      !manifest.episodes[0]
    )
      return fail("UNSUPPORTED_MANIFEST");
    phase = "starter";
    const starter = await client.arenas.downloadStarter("rescue-room", manifest);
    // Keep the original request independently of returned result fields.
    const input = structuredClone({
      arenaId: "rescue-room" as const,
      context: manifest.context,
      episodeId: manifest.episodes[0].id,
      artifact: manifest.artifact.sample,
    });
    phase = "practice";
    const first = await client.evaluations.practice(input);
    phase = "integrity";
    const integrity = verifyRescueDoctrinePracticeIntegrity({ request: input, run: first });
    phase = "repeat";
    const repeat = await client.evaluations.practice(input);
    verifyRescueDoctrinePracticeIntegrity({ request: input, run: repeat });
    if (
      first.resultHash !== repeat.resultHash ||
      first.artifactHash !== repeat.artifactHash ||
      compareRuns(first, repeat).relation !== "equal"
    )
      return fail("REPEAT_MISMATCH");
    return {
      schemaVersion: "rescue-practice-onboarding-v1" as const,
      verified: true as const,
      origin: origin.origin,
      requests: structuredClone(requests),
      starterBytes: starter.byteLength,
      episodeId: input.episodeId,
      context: input.context,
      artifactHash: first.artifactHash,
      resultHash: first.resultHash,
      correctness: first.correctness,
      values: first.values,
      integrity,
      repeatedHashMatch: true,
      automaticRetries: 0,
      credentialsSent: false,
      paymentAttempted: false,
      boundary:
        "Simulated single-Episode Practice. Hash consistency, not authenticated evaluator execution, real payment or Final entry.",
    };
  } catch (error) {
    // Never print server-controlled message/details/code, URLs or credential-like strings.
    if (!(error instanceof FrontierError)) return fail("INVALID_RESPONSE");
    if (error.status === 401 || error.status === 403) return fail("AUTH_REQUIRED");
    if (error.status === 402) return fail("PAYMENT_REQUIRED");
    if (error.status === 429) return fail("RATE_LIMITED");
    if (error.code === "CONTEXT_MISMATCH") return fail("CONTEXT_MISMATCH");
    if (phase === "integrity" || error.code.startsWith("RESCUE_INTEGRITY"))
      return fail("INTEGRITY_FAILED");
    if (Object.hasOwn(hints, error.code)) return fail(error.code as FailureCode);
    return fail(error.status && error.status < 500 ? "INVALID_RESPONSE" : "UNAVAILABLE");
  }
}
