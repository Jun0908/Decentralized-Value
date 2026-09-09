import { ZodError } from "zod";

export function secretGateJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export function secretGateError(cause: unknown) {
  if (cause instanceof ZodError) {
    return secretGateJson(
      {
        error: {
          code: "INVALID_REQUEST",
          message: "Request did not match the Secret Gate schema.",
          details: cause.issues,
        },
      },
      400,
    );
  }
  const message = cause instanceof Error ? cause.message : "Secret Gate request failed";
  const unavailable = message.includes("not configured");
  return secretGateJson(
    { error: { code: unavailable ? "STORAGE_UNCONFIGURED" : "SECRET_GATE_ERROR", message } },
    unavailable ? 503 : 500,
  );
}
