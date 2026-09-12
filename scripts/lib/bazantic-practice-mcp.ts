/** Only three explicitly free Rescue operations. No payment/auth fallback. */
export const bazanticRescueOrigin = "https://kjrjolrzlra2zd7f7uycwazhya.bazgateway.com";
export function parseMcpHttpResult(result: {
  isError?: boolean;
  content?: { type: string; text?: string }[];
}) {
  if (result.isError) throw new Error("BAZANTIC_TOOL_FAILED");
  const response = result.content?.find(
    (item) => item.type === "text" && item.text?.startsWith("HTTP "),
  )?.text;
  const match = response?.match(/^HTTP [^\n]+\nStatus: (\d{3})\nResponse:\n([\s\S]*)$/);
  if (!match) throw new Error("BAZANTIC_RESPONSE_INVALID");
  const status = Number(match[1]);
  if (status !== 200) throw new Error(`BAZANTIC_HTTP_${status}`);
  const body: unknown = JSON.parse(match[2]!);
  return { status, body };
}

export async function createBazanticPracticeTransport(network: typeof fetch = fetch) {
  let requestId = 0,
    session: string | null = null,
    conversation: string | undefined;
  let lockedManifestJson: string | undefined;
  const events: { tool: string; status: number }[] = [];
  async function rpc(method: string, params: unknown) {
    const id = ++requestId;
    const response = await network(`${bazanticRescueOrigin}/mcp`, {
      method: "POST",
      redirect: "error",
      credentials: "omit",
      signal: AbortSignal.timeout(25_000),
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...(session ? { "mcp-session-id": session } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    });
    if (!response.ok) throw new Error(`BAZANTIC_HTTP_${response.status}`);
    session = response.headers.get("mcp-session-id") ?? session;
    const text = await response.text();
    if (text.length > 2_000_000) throw new Error("BAZANTIC_RESPONSE_TOO_LARGE");
    const messages = response.headers.get("content-type")?.includes("text/event-stream")
      ? text
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => JSON.parse(line.slice(5)))
      : [JSON.parse(text)];
    const message = messages.find((item) => item.id === id);
    if (!message?.result || message.error) throw new Error("BAZANTIC_RPC_FAILED");
    return message.result;
  }
  await rpc("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "frontier-rescue-agent-demo", version: "1" },
  });
  const listed = await rpc("tools/list", {});
  for (const required of ["getCliArena", "evaluateRescueRoomDoctrine"])
    if (!listed.tools?.some((tool: { name: string }) => tool.name === required))
      throw new Error("BAZANTIC_TOOL_MISSING");
  const transport: typeof fetch = async (input, init) => {
    const request = new Request(input, init),
      url = new URL(request.url);
    if (
      url.origin !== bazanticRescueOrigin ||
      url.search ||
      [...request.headers.keys()].some((k) => /authorization|cookie|token|api-key/i.test(k))
    )
      throw new Error("BAZANTIC_REQUEST_BLOCKED");
    let name: string, args: Record<string, unknown>;
    if (request.method === "GET" && url.pathname === "/v1/cli/arenas/rescue-room") {
      // The SDK reads the manifest before each evaluation. Reuse the exact
      // locked snapshot; the evaluation endpoint still verifies context headers.
      if (lockedManifestJson !== undefined)
        return new Response(lockedManifestJson, {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      name = "getCliArena";
      args = { id: "rescue-room" };
    } else if (
      request.method === "POST" &&
      url.pathname === "/v1/rescue-room/doctrine-evaluations"
    ) {
      name = "evaluateRescueRoomDoctrine";
      args = {
        requestBody: await request.json(),
        "X-Frontier-Context-Hash": request.headers.get("X-Frontier-Context-Hash"),
        "X-Frontier-Runtime-Context-Hash": request.headers.get("X-Frontier-Runtime-Context-Hash"),
      };
    } else throw new Error("BAZANTIC_REQUEST_BLOCKED");
    if (events.length >= 3) throw new Error("BAZANTIC_TOOL_BUDGET_EXCEEDED");
    // Reserve before awaiting: concurrent requests cannot exceed the cap.
    const event = { tool: name, status: 0 };
    events.push(event);
    if (conversation) args.conversation_id = conversation;
    const raw = await rpc("tools/call", { name, arguments: args });
    const parsed = parseMcpHttpResult(raw);
    event.status = parsed.status;
    if (name === "getCliArena") lockedManifestJson = JSON.stringify(parsed.body);
    for (const content of raw.content ?? []) {
      if (content.type === "text")
        conversation =
          content.text?.match(/\[SERVER\]: Reuse conversation_id=([a-f0-9-]{36})\b/)?.[1] ??
          conversation;
    }
    return new Response(JSON.stringify(parsed.body), {
      status: parsed.status,
      headers: { "content-type": "application/json" },
    });
  };
  return { fetch: transport, events };
}
