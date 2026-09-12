import { describe, expect, it, vi } from "vitest";
import { createApi } from "../../apps/api/src/index";
import benchmark from "../../benchmarks/evm-orderbook/results/latest.json";
import { checkRescuePracticeOnboarding } from "./rescue-practice-preflight";

const origin = "http://127.0.0.1:3000";
function fixture() {
  const model = vi.fn(async () => {
    throw new Error("MODEL_FORBIDDEN");
  });
  const api = createApi(benchmark, undefined, undefined, undefined, undefined, {
    commander: model,
  });
  const fetcher = vi.fn<typeof fetch>(async (input, init) => api.fetch(new Request(input, init)));
  return { fetcher, model };
}

describe("external developer Rescue preflight (in-process API, no network)", () => {
  it("verifies Starter, two Practice results and independent hashes without auth or model", async () => {
    const { fetcher, model } = fixture();
    const report = await checkRescuePracticeOnboarding(origin, { fetch: fetcher });
    expect(report.verified).toBe(true);
    expect(report.requests).toHaveLength(6);
    expect(report.requests.every(({ status }) => status === 200)).toBe(true);
    expect(report).toMatchObject({
      credentialsSent: false,
      paymentAttempted: false,
      automaticRetries: 0,
    });
    if (report.verified)
      expect(report.integrity).toMatchObject({
        integrityVerified: true,
        evaluatorReplay: false,
        paymentVerified: false,
      });
    expect(model).not.toHaveBeenCalled();
    for (const [, init] of fetcher.mock.calls) {
      expect(init).toMatchObject({ redirect: "manual", credentials: "omit" });
      expect(new Headers(init?.headers).get("authorization")).toBeNull();
    }
  });

  it.each([
    "not-a-url",
    "http://example.com",
    "https://user:secret@example.com",
    "https://example.com/path",
    "https://example.com?secret=hidden",
    "https://example.com#hidden",
  ])("rejects non-origin/unsafe input without request: %s", async (url) => {
    const { fetcher } = fixture();
    expect(await checkRescuePracticeOnboarding(url, { fetch: fetcher })).toMatchObject({
      verified: false,
      phase: "configuration",
      code: "INVALID_ORIGIN",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    [401, "AUTH_REQUIRED"],
    [402, "PAYMENT_REQUIRED"],
    [403, "AUTH_REQUIRED"],
    [429, "RATE_LIMITED"],
    [503, "UNAVAILABLE"],
  ] as const)(
    "stops on %s without retry or reflecting server-controlled errors",
    async (status, code) => {
      const fetcher = vi.fn<typeof fetch>(async () =>
        Response.json(
          {
            error: {
              code: "untrusted-secret",
              message: "untrusted-secret",
              details: "untrusted-secret",
            },
          },
          { status },
        ),
      );
      const report = await checkRescuePracticeOnboarding(origin, { fetch: fetcher });
      expect(report).toMatchObject({
        verified: false,
        phase: "manifest",
        code,
        automaticRetries: 0,
      });
      expect(JSON.stringify(report)).not.toContain("untrusted-secret");
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );

  it("refuses redirection", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(null, { status: 302, headers: { location: "https://untrusted.example" } }),
    );
    expect(await checkRescuePracticeOnboarding(origin, { fetch: fetcher })).toMatchObject({
      code: "REDIRECT_REJECTED",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("stops before Starter download if the manifest asks for an unexpected path", async () => {
    const { fetcher } = fixture();
    const report = await checkRescuePracticeOnboarding(origin, {
      fetch: async (input, init) => {
        const manifest = await (await fetcher(input, init)).json();
        manifest.starter.path = "/v1/rescue-room/commander-evaluations";
        return Response.json(manifest);
      },
    });
    expect(report).toMatchObject({ code: "UNSUPPORTED_MANIFEST" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("stops on a corrupted Starter before evaluating", async () => {
    const { fetcher } = fixture();
    const report = await checkRescuePracticeOnboarding(origin, {
      fetch: async (input, init) =>
        String(input).endsWith("starter-kit") ? new Response("bad archive") : fetcher(input, init),
    });
    expect(report).toMatchObject({ code: "STARTER_HASH_MISMATCH", phase: "starter" });
    expect(report.requests).toHaveLength(2);
  });

  it("does not evaluate after a manifest context race", async () => {
    const { fetcher } = fixture();
    let manifests = 0;
    const report = await checkRescuePracticeOnboarding(origin, {
      fetch: async (input, init) => {
        const response = await fetcher(input, init);
        if (String(input).includes("/cli/arenas/") && ++manifests === 2) {
          const manifest = await response.json();
          manifest.context.contextHash = `0x${"ab".repeat(32)}`;
          return Response.json(manifest);
        }
        return response;
      },
    });
    expect(report).toMatchObject({ code: "CONTEXT_MISMATCH", phase: "practice" });
    expect(report.requests.every(({ method }) => method === "GET")).toBe(true);
  });

  it.each([1, 2])("rejects a tampered result on evaluation %s", async (corruptCall) => {
    const { fetcher } = fixture();
    let evaluations = 0;
    const report = await checkRescuePracticeOnboarding(origin, {
      fetch: async (input, init) => {
        const response = await fetcher(input, init);
        if (init?.method === "POST" && ++evaluations === corruptCall) {
          const raw = await response.json();
          raw.outcome.userLossUsd += 1;
          return Response.json(raw);
        }
        return response;
      },
    });
    expect(report).toMatchObject({ verified: false, code: "INTEGRITY_FAILED" });
    expect(evaluations).toBe(corruptCall);
  });

  it("aborts timeout without retry", async () => {
    let signal: AbortSignal | null | undefined;
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      signal = init?.signal;
      return new Promise(() => {});
    });
    expect(
      await checkRescuePracticeOnboarding(origin, { fetch: fetcher, timeoutMs: 10 }),
    ).toMatchObject({ code: "TIMEOUT" });
    expect(signal?.aborted).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("keeps the returned failure snapshot unchanged after a late fetch completion", async () => {
    let complete: (response: Response) => void = () => {};
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Promise<Response>((resolve) => {
          complete = resolve;
        }),
    );
    const report = await checkRescuePracticeOnboarding(origin, { fetch: fetcher, timeoutMs: 10 });
    const before = JSON.stringify(report);
    expect(report).toMatchObject({ code: "TIMEOUT", requests: [] });
    complete(Response.json({ error: { message: "late untrusted detail" } }, { status: 503 }));
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(JSON.stringify(report)).toBe(before);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("returns a useful contract failure for HTML instead of JSON", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response("<html>not the API</html>"));
    expect(await checkRescuePracticeOnboarding(origin, { fetch: fetcher })).toMatchObject({
      code: "INVALID_RESPONSE",
      phase: "manifest",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
