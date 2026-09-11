import { z } from "zod";
import { FrontierError } from "./errors.js";

export interface FrontierAuth {
  getHeaders(): HeadersInit | Promise<HeadersInit>;
}

export interface FrontierClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
  auth?: FrontierAuth;
  timeoutMs?: number;
}

const apiErrorSchema = z
  .object({
    error: z
      .object({
        code: z.string().optional(),
        message: z.string().optional(),
        details: z.unknown().optional(),
      })
      .passthrough(),
  })
  .passthrough();

export function apiOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new FrontierError("INVALID_BASE_URL", "A valid API URL is required");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" && !(local && url.protocol === "http:"))
  ) {
    throw new FrontierError(
      "INVALID_BASE_URL",
      "Use HTTPS or an explicit loopback HTTP development URL, without credentials, query or fragment",
    );
  }
  return url.origin;
}

export class FrontierTransport {
  readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;
  private readonly auth: FrontierAuth | undefined;
  private readonly requestBase: string;

  constructor(options: FrontierClientOptions) {
    this.baseUrl = apiOrigin(options.baseUrl);
    this.requestBase = options.baseUrl.endsWith("/") ? options.baseUrl : `${options.baseUrl}/`;
    this.fetcher = options.fetch ?? globalThis.fetch;
    this.auth = options.auth;
    this.timeoutMs = options.timeoutMs ?? 60_000;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0 || this.timeoutMs > 2_147_483_647) {
      throw new FrontierError("INVALID_TIMEOUT", "timeoutMs must be a positive supported duration");
    }
  }

  private url(path: string): URL {
    const url = new URL(path, this.requestBase);
    if (url.origin !== this.baseUrl || url.username || url.password) {
      throw new FrontierError(
        "CROSS_ORIGIN_REQUEST",
        "Requests must use the configured API origin",
      );
    }
    return url;
  }

  private async perform<T>(
    path: string,
    init: RequestInit,
    authenticated: boolean,
    consume: (response: Response) => Promise<T>,
  ): Promise<T> {
    const url = this.url(path);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(
          new FrontierError("TIMEOUT", "The request timed out; server completion is unknown", {
            retryable: true,
          }),
        );
      }, this.timeoutMs);
    });
    const work = async () => {
      const headers = new Headers(authenticated ? await this.auth?.getHeaders() : undefined);
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
      if (controller.signal.aborted)
        throw new FrontierError("TIMEOUT", "The request timed out", { retryable: true });
      const response = await this.fetcher(url, {
        ...init,
        headers,
        signal: controller.signal,
        redirect: "manual",
        credentials: "omit",
        cache: "no-store",
      });
      if (
        (response.status >= 300 && response.status < 400) ||
        response.type === "opaqueredirect" ||
        response.redirected ||
        (response.url && new URL(response.url).origin !== this.baseUrl)
      ) {
        throw new FrontierError("REDIRECT_REJECTED", "API redirects are not followed", {
          status: response.status,
        });
      }
      if (!response.ok) {
        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }
        const parsed = apiErrorSchema.safeParse(payload);
        const error = parsed.success ? parsed.data.error : undefined;
        const redact = (value: string) => {
          for (const [key, secret] of headers) {
            if (/authorization|token|cookie|api-key/i.test(key) && secret) {
              value = value.split(secret).join("[REDACTED]");
              if (/^Bearer /i.test(secret)) value = value.split(secret.slice(7)).join("[REDACTED]");
            }
          }
          return value;
        };
        throw new FrontierError(
          error?.code ?? `HTTP_${response.status}`,
          redact(error?.message ?? `Frontier API ${response.status}`),
          {
            status: response.status,
            details:
              error?.details === undefined
                ? null
                : JSON.parse(redact(JSON.stringify(error.details))),
            retryable: response.status === 429 || response.status >= 500,
            ...(response.headers.get("retry-after")
              ? { retryAfter: response.headers.get("retry-after") as string }
              : {}),
          },
        );
      }
      return consume(response);
    };
    try {
      return await Promise.race([timeout, work()]);
    } catch (error) {
      if (error instanceof FrontierError) throw error;
      throw new FrontierError("NETWORK_ERROR", "The API request could not be completed", {
        retryable: true,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async request<T>(
    path: string,
    schema: z.ZodType<T>,
    init: RequestInit = {},
    authenticated = false,
  ): Promise<T> {
    return (await this.requestWithMetadata(path, schema, init, authenticated)).data;
  }

  async requestWithMetadata<T>(
    path: string,
    schema: z.ZodType<T>,
    init: RequestInit = {},
    authenticated = false,
  ): Promise<{ data: T; status: number }> {
    return this.perform(path, init, authenticated, async (response) => {
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new FrontierError("INVALID_RESPONSE", "The API did not return valid JSON");
      }
      const parsed = schema.safeParse(payload);
      if (!parsed.success)
        throw new FrontierError(
          "INVALID_RESPONSE",
          "The API response does not match its contract",
          {
            details: parsed.error.issues.map(({ path, code }) => ({ path, code })),
          },
        );
      return { data: parsed.data, status: response.status };
    });
  }

  async download(path: string, maximumBytes = 10 * 1024 * 1024): Promise<Uint8Array> {
    return this.perform(path, {}, false, async (response) => {
      const size = Number(response.headers.get("content-length"));
      if (size > maximumBytes)
        throw new FrontierError("STARTER_TOO_LARGE", "Starter exceeds the download limit");
      if (!response.body)
        throw new FrontierError("INVALID_RESPONSE", "Starter response has no body");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > maximumBytes)
            throw new FrontierError("STARTER_TOO_LARGE", "Starter exceeds the download limit");
          chunks.push(value);
        }
      } finally {
        await reader.cancel();
      }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return bytes;
    });
  }
}
