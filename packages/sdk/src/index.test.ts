import { describe, expect, it } from "vitest";
import { FrontierClient } from "./index";

describe("FrontierClient", () => {
  it("requests a context and preserves its explicit context id", async () => {
    let requestedUrl = "";
    const fetcher: typeof fetch = async (input) => {
      requestedUrl = input.toString();
      return Response.json({ contextId: "public-low-reuse", evidenceLevel: 0 });
    };
    const client = new FrontierClient("https://example.test", fetcher);
    const result = await client.getCalldataContext<{ contextId: string; evidenceLevel: number }>(
      "public-low-reuse",
    );
    expect(result).toEqual({ contextId: "public-low-reuse", evidenceLevel: 0 });
    expect(requestedUrl).toContain("contextId=public-low-reuse");
  });

  it("surfaces stable API errors", async () => {
    const fetcher: typeof fetch = async () =>
      Response.json({ error: { message: "Hard constraint failed" } }, { status: 400 });
    const client = new FrontierClient("https://example.test", fetcher);
    await expect(client.evaluate("v1/evaluations", {})).rejects.toThrow("Hard constraint failed");
  });

  it("prepares a typed sandbox registration request", async () => {
    let requestBody = "";
    const fetcher: typeof fetch = async (_input, init) => {
      requestBody = String(init?.body);
      return Response.json({
        mode: "sandbox",
        storage: "ephemeral-memory",
        uniqueness: "wallet-only-not-personhood",
        participant: {},
      });
    };
    const client = new FrontierClient("https://example.test", fetcher);
    await client.registerSandboxParticipant(
      "example-v1",
      "0x0000000000000000000000000000000000000001",
    );
    expect(JSON.parse(requestBody)).toEqual({
      challengeId: "example-v1",
      wallet: "0x0000000000000000000000000000000000000001",
    });
  });
});
