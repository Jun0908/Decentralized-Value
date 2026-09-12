import { evaluateCalldataRules, parseCalldataLabRequest } from "@frontier/calldata-compression/lab";
import { CalldataRuleValidationError } from "@frontier/calldata-compression/rules";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 16_384;

export async function POST(request: Request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) {
    return Response.json({ error: "Send an application/json rule artifact." }, { status: 415 });
  }
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: "Request body is required." }, { status: 400 });
  let size = 0;
  const decoder = new TextDecoder();
  let text = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return Response.json(
          { error: "Rule artifact exceeds the 16 KiB request limit." },
          { status: 413 },
        );
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const { artifact, contextId } = parseCalldataLabRequest(JSON.parse(text));
    const result = await evaluateCalldataRules(artifact, contextId);
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Request must be valid JSON." }, { status: 400 });
    }
    if (error instanceof CalldataRuleValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json(
      { error: "Local EVM measurement is unavailable. Retry this artifact." },
      { status: 503 },
    );
  } finally {
    reader.releaseLock();
  }
}
