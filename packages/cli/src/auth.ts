import { CliError, classify } from "./output.js";
import type { CredentialStore } from "./credential-store.js";

export type Session = {
  userId: string;
  wallet: string;
  scopes: string[];
  expiresAt: string;
  revoked: boolean;
};
export class AuthApi {
  constructor(
    private readonly baseUrl: string,
    private readonly fetcher: typeof fetch,
    private readonly timeoutMs: number,
  ) {}
  async request(action: string, body?: unknown, token?: string): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new CliError("TIMEOUT", "Authentication request timed out", 7, null, true));
      }, this.timeoutMs);
    });
    const work = async () => {
      const headers = new Headers({ "content-type": "application/json" });
      if (token) headers.set("authorization", `Bearer ${token}`);
      const response = await this.fetcher(new URL(`/v1/cli/auth/${action}`, this.baseUrl), {
        method: action === "session" ? "GET" : "POST",
        headers,
        ...(action === "session" ? {} : { body: JSON.stringify(body ?? {}) }),
        redirect: "manual",
        credentials: "omit",
        cache: "no-store",
        signal: controller.signal,
      });
      if (
        response.redirected ||
        (response.status >= 300 && response.status < 400) ||
        (response.url && new URL(response.url).origin !== this.baseUrl)
      )
        throw new CliError("REDIRECT_REJECTED", "Authentication redirects are not followed", 3);
      const text = await response.text();
      if (text.length > 128 * 1024)
        throw new CliError("INVALID_RESPONSE", "Authentication response exceeds its size limit");
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(text);
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error();
      } catch {
        throw new CliError("INVALID_RESPONSE", "Authentication response is not a JSON object");
      }
      if (!response.ok) {
        const nested = payload.error;
        const error =
          typeof nested === "string"
            ? { code: nested, message: payload.error_description }
            : (nested as Record<string, unknown> | undefined);
        throw classify({
          code: typeof error?.code === "string" ? error.code : `HTTP_${response.status}`,
          message:
            typeof error?.message === "string" ? error.message : "Authentication request failed",
          status: response.status,
          details: error?.details,
          retryAfter: response.headers.get("retry-after") ?? undefined,
        });
      }
      return payload;
    };
    try {
      return await Promise.race([work(), timeout]);
    } catch (e) {
      if (e instanceof CliError) throw e;
      throw new CliError(
        "NETWORK_ERROR",
        "Authentication request could not be completed",
        7,
        null,
        true,
      );
    } finally {
      clearTimeout(timer);
    }
  }
  async session(token: string): Promise<Session> {
    const value = await this.request("session", undefined, token);
    if (
      typeof value.userId !== "string" ||
      !value.userId ||
      typeof value.wallet !== "string" ||
      !Array.isArray(value.scopes) ||
      !value.scopes.every((s) => typeof s === "string") ||
      typeof value.expiresAt !== "string" ||
      !Number.isFinite(Date.parse(value.expiresAt))
    )
      throw new CliError("INVALID_RESPONSE", "Invalid server session response");
    if (value.revoked === true || Date.parse(value.expiresAt) <= Date.now())
      throw new CliError("SESSION_EXPIRED", "Session has expired or was revoked; log in again", 3);
    return {
      userId: value.userId,
      wallet: value.wallet,
      scopes: value.scopes,
      expiresAt: value.expiresAt,
      revoked: false,
    };
  }
}

export async function login(options: {
  api: AuthApi;
  baseUrl: string;
  store: CredentialStore;
  noBrowser: boolean;
  progress: (message: string) => void;
  open: (url: string, origin: string) => Promise<void>;
  rememberSecret: (secret: string) => void;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}) {
  const { api, baseUrl, store } = options;
  // Check keychain access before creating a one-time authorization exchange.
  await store.get(baseUrl);
  const device = await api.request("device");
  if (
    typeof device.device_code !== "string" ||
    !device.device_code ||
    typeof device.user_code !== "string" ||
    typeof device.verification_uri !== "string" ||
    typeof device.expires_in !== "number" ||
    device.expires_in <= 0 ||
    device.expires_in > 3600 ||
    typeof device.interval !== "number" ||
    device.interval < 1 ||
    device.interval > 60
  )
    throw new CliError("INVALID_RESPONSE", "Invalid device authorization response");
  options.rememberSecret(device.device_code);
  const url = new URL(device.verification_uri);
  if (
    url.origin !== baseUrl ||
    url.username ||
    url.password ||
    url.hash ||
    url.search ||
    url.pathname !== "/cli/authorize"
  )
    throw new CliError(
      "UNSAFE_AUTH_URL",
      "Authorization URI must use the selected origin and authorization page",
      3,
    );
  options.progress(`Authorize at ${url.href}\nUser code: ${device.user_code}`);
  if (!options.noBrowser) {
    try {
      await options.open(url.href, baseUrl);
    } catch {
      options.progress("Browser could not open. Use the authorization URL and user code above.");
    }
  }
  const deadline = options.now() + device.expires_in * 1000;
  let interval = device.interval * 1000;
  while (options.now() < deadline) {
    await options.sleep(Math.min(interval, Math.max(0, deadline - options.now())));
    if (options.now() >= deadline) break;
    let tokenResponse;
    try {
      tokenResponse = await api.request("token", {
        device_code: device.device_code,
      });
    } catch (error) {
      const e = classify(error);
      if (["authorization_pending", "pending"].includes(e.code.toLowerCase())) continue;
      if (["slow_down", "slow-down"].includes(e.code.toLowerCase())) {
        interval += 5000;
        continue;
      }
      if (["access_denied", "expired_token", "invalid_grant"].includes(e.code.toLowerCase()))
        throw new CliError(e.code, e.message, 3, e.details);
      throw e;
    }
    if (
      typeof tokenResponse.access_token !== "string" ||
      !tokenResponse.access_token ||
      tokenResponse.token_type !== "Bearer" ||
      typeof tokenResponse.expires_in !== "number" ||
      tokenResponse.expires_in <= 0
    )
      throw new CliError("INVALID_RESPONSE", "Invalid token exchange response");
    const token = tokenResponse.access_token;
    options.rememberSecret(token);
    try {
      const session = await api.session(token);
      await store.set(baseUrl, token);
      return { authenticated: true, origin: baseUrl, ...session };
    } catch (error) {
      await api.request("revoke", {}, token).catch(() => {});
      throw error;
    }
  }
  throw new CliError("expired_token", "Device authorization expired; start login again", 3);
}
