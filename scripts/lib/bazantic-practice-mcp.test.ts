import { expect, it } from "vitest";
import {
  parseMcpHttpResult,
  createBazanticPracticeTransport,
  bazanticRescueOrigin,
} from "./bazantic-practice-mcp";
it("requires a successful inner HTTP response, not just MCP HTTP 200", () => {
  expect(
    parseMcpHttpResult({
      content: [{ type: "text", text: 'HTTP GET /example\nStatus: 200\nResponse:\n{"ok":true}' }],
    }),
  ).toEqual({ status: 200, body: { ok: true } });
  for (const status of [401, 402, 403, 404, 500])
    expect(() =>
      parseMcpHttpResult({
        content: [
          { type: "text", text: `HTTP GET /example\nStatus: ${status}\nResponse:\nSECRET` },
        ],
      }),
    ).toThrow(`BAZANTIC_HTTP_${status}`);
  expect(() => parseMcpHttpResult({ isError: true })).toThrow("BAZANTIC_TOOL_FAILED");
  expect(() => parseMcpHttpResult({ content: [{ type: "text", text: "unrelated" }] })).toThrow(
    "BAZANTIC_RESPONSE_INVALID",
  );
});

it("locks the manifest, caps tool calls and blocks credentials and unrelated origins", async () => {
  const calls: string[] = [];
  const network: typeof fetch = async (_input, init) => {
    const request = JSON.parse(init!.body as string);
    let result: unknown = {};
    if (request.method === "tools/list")
      result = { tools: [{ name: "getCliArena" }, { name: "evaluateRescueRoomDoctrine" }] };
    if (request.method === "tools/call") {
      calls.push(request.params.name);
      result = {
        content: [
          { type: "text", text: 'HTTP GET /example\nStatus: 200\nResponse:\n{"snapshot":1}' },
        ],
      };
    }
    return Response.json({ jsonrpc: "2.0", id: request.id, result });
  };
  const transport = await createBazanticPracticeTransport(network);
  const manifest = `${bazanticRescueOrigin}/v1/cli/arenas/rescue-room`;
  const evaluate = `${bazanticRescueOrigin}/v1/rescue-room/doctrine-evaluations`;
  const options = { method: "POST", body: "{}" };
  expect(await (await transport.fetch(manifest)).json()).toEqual({ snapshot: 1 });
  await transport.fetch(evaluate, options);
  await transport.fetch(manifest);
  await transport.fetch(evaluate, options);
  await transport.fetch(manifest);
  expect(calls).toEqual([
    "getCliArena",
    "evaluateRescueRoomDoctrine",
    "evaluateRescueRoomDoctrine",
  ]);
  await expect(transport.fetch(evaluate, options)).rejects.toThrow("BAZANTIC_TOOL_BUDGET_EXCEEDED");
  for (const url of [
    "https://example.com/v1/cli/arenas/rescue-room",
    `${manifest}?token=x`,
    `${bazanticRescueOrigin}/payments`,
  ])
    await expect(transport.fetch(url)).rejects.toThrow("BAZANTIC_REQUEST_BLOCKED");
  for (const header of ["authorization", "cookie", "x-api-key"])
    await expect(
      transport.fetch(manifest, { headers: { [header]: "DO_NOT_FORWARD" } }),
    ).rejects.toThrow("BAZANTIC_REQUEST_BLOCKED");
  expect(calls).toHaveLength(3);
});
