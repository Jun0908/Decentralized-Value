export class FrontierError extends Error {
  readonly code: string;
  readonly status: number | undefined;
  readonly details: unknown;
  readonly retryable: boolean;
  readonly retryAfter: string | undefined;

  constructor(
    code: string,
    message: string,
    options: {
      status?: number;
      details?: unknown;
      retryable?: boolean;
      retryAfter?: string;
    } = {},
  ) {
    super(message);
    this.name = "FrontierError";
    this.code = code;
    this.status = options.status;
    this.details = options.details ?? null;
    this.retryable = options.retryable ?? false;
    this.retryAfter = options.retryAfter;
  }
}

export { FrontierError as FrontierApiError };
