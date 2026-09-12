import { describe, expect, it } from "vitest";
import { calldataRulePresets } from "@frontier/calldata-compression/rules";
import { POST } from "./route";

const url = "http://localhost/api/calldata-lab";
const requestBody = { artifact: calldataRulePresets.adaptive, contextId: "public-transfer-mix" };

describe("internal Calldata Practice route", () => {
  it("returns real measured evidence with explicit local-only state", async () => {
    const response = await POST(
      new Request(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody),
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const result = await response.json();
    expect(result).toMatchObject({
      kind: "calldata-rule-evidence-v1",
      state: "measured",
      point: { correctness: true, calldataGas: 5172, decodeExecutionGas: 17185 },
    });
    expect(result.batchEvidence).toHaveLength(3);
  }, 30_000);

  it("rejects invalid JSON, arbitrary source fields, and unknown context before execution", async () => {
    for (const body of [
      "not-json",
      JSON.stringify({ ...requestBody, source: "console.log(1)" }),
      JSON.stringify({ ...requestBody, contextId: "hidden" }),
    ]) {
      const response = await POST(
        new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body }),
      );
      expect(response.status).toBe(400);
    }
  });

  it("rejects unsupported media types", async () => {
    const response = await POST(
      new Request(url, {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: JSON.stringify(requestBody),
      }),
    );
    expect(response.status).toBe(415);
  });

  it("bounds streamed body bytes even without content-length", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(9000));
        controller.enqueue(new Uint8Array(9000));
        controller.close();
      },
    });
    const request = new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit);
    expect(request.headers.get("content-length")).toBeNull();
    expect((await POST(request)).status).toBe(413);
  });
});
