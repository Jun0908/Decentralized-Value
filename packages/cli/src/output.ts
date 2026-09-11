export class CliError extends Error {
  constructor(
    public code: string,
    message: string,
    public exitCode = 2,
    public details: unknown = null,
    public retryable = false,
  ) {
    super(message);
  }
}

export function classify(error: unknown): CliError {
  if (error instanceof CliError) return error;
  const e = error as {
    code?: string;
    message?: string;
    status?: number;
    statusCode?: number;
    details?: unknown;
    retryable?: boolean;
    retryAfter?: unknown;
    name?: string;
  };
  if (e?.name === "ZodError")
    return new CliError("INVALID_INPUT", "Input does not match the canonical contract", 2);
  const status = e?.status ?? e?.statusCode;
  const code =
    e?.code ??
    (e?.name === "AbortError" || e?.name === "TimeoutError" ? "TIMEOUT" : "INTERNAL_ERROR");
  const category = code.toUpperCase();
  let exit = 1;
  if (status === 429 || /RATE_LIMIT/.test(category)) exit = 6;
  else if (
    status === 401 ||
    status === 403 ||
    /AUTH|TOKEN|SCOPE|ACCESS_DENIED|CONFIRMATION/.test(category)
  )
    exit = 3;
  else if (/CONTEXT|INCOMPARABLE|COMPARISON|NOT_COMPARABLE/.test(category)) exit = 4;
  else if (status === 503 || /UNSUPPORTED|UNAVAILABLE|UNCONFIGURED/.test(category)) exit = 5;
  else if (/TIMEOUT|NETWORK|FETCH|OUTCOME_UNKNOWN/.test(category) || (status && status >= 500))
    exit = 7;
  else if (
    (status && status >= 400) ||
    /INVALID|NOT_FOUND|CONFLICT|MISMATCH|TOO_LARGE|UNKNOWN/.test(category)
  )
    exit = 2;
  return new CliError(
    code,
    e?.message ?? "Unexpected internal error",
    exit,
    e?.retryAfter !== undefined
      ? { details: e.details ?? null, retryAfter: e.retryAfter }
      : (e?.details ?? null),
    e?.retryable ?? exit === 7,
  );
}

export function redact(value: unknown, secrets: readonly string[] = []): unknown {
  if (typeof value === "string") {
    let clean = value.replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]");
    for (const secret of secrets) if (secret) clean = clean.split(secret).join("[REDACTED]");
    return clean;
  }
  if (Array.isArray(value)) return value.map((item) => redact(item, secrets));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        /^(authorization|access_token|refresh_token|device_code|token|identityToken|password|secret)$/i.test(
          key,
        )
          ? "[REDACTED]"
          : redact(item, secrets),
      ]),
    );
  return value;
}
