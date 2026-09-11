import { createHash, randomBytes } from "node:crypto";
import type { Plan5Identity } from "./plan5-competition";

export const cliAuthScopes = [
  "disaster:read",
  "disaster:join",
  "disaster:submit",
  "disaster:entry",
] as const;
export type CliAuthScope = (typeof cliAuthScopes)[number];
export const cliAuthDeviceLifetime = 600;
export const cliAuthSessionLifetime = 28_800;
export const cliAuthPollInterval = 5;

export type CliAuthDevice = {
  deviceHash: string;
  userCodeHash: string;
  origin: string;
  scopes: CliAuthScope[];
  expiresAt: number;
  interval: number;
  nextPollAt: number;
  status: "pending" | "approved" | "denied" | "consumed";
  identity?: Plan5Identity;
};
export type CliAuthSession = Plan5Identity & {
  tokenHash: string;
  origin: string;
  scopes: CliAuthScope[];
  expiresAt: number;
  revoked: boolean;
};
export type CliAuthPollResult =
  | { code: "issued"; session: CliAuthSession }
  | { code: "authorization_pending" | "slow_down"; interval: number }
  | { code: "expired_token" | "access_denied" | "invalid_grant" };
export type CliAuthDecisionResult = "approved" | "denied" | "expired_token" | "invalid_grant";

/** Implementations must serialize each mutation, including polling and session creation. */
export interface CliAuthStore {
  readonly durability: "durable-redis" | "ephemeral-memory";
  create(device: CliAuthDevice, now: number): Promise<boolean>;
  inspect(userCodeHash: string, now: number): Promise<CliAuthDevice | null>;
  decide(
    userCodeHash: string,
    identity: Plan5Identity,
    decision: "approve" | "deny",
    now: number,
  ): Promise<CliAuthDecisionResult>;
  poll(
    deviceHash: string,
    tokenHash: string,
    now: number,
    sessionLifetimeMs: number,
  ): Promise<CliAuthPollResult>;
  session(tokenHash: string, now: number): Promise<CliAuthSession | null>;
  revoke(tokenHash: string, now: number): Promise<void>;
  rateLimit(key: string, now: number, windowMs: number, limit: number): Promise<boolean>;
}

export class MemoryCliAuthStore implements CliAuthStore {
  readonly durability = "ephemeral-memory" as const;
  private readonly devices = new Map<string, CliAuthDevice>();
  private readonly codes = new Map<string, string>();
  private readonly sessions = new Map<string, CliAuthSession>();
  private readonly limits = new Map<string, { count: number; expiresAt: number }>();

  private prune(now: number) {
    for (const [hash, device] of this.devices)
      if (device.expiresAt <= now) {
        this.devices.delete(hash);
        this.codes.delete(device.userCodeHash);
      }
    for (const [hash, session] of this.sessions)
      if (session.expiresAt <= now) this.sessions.delete(hash);
    for (const [key, limit] of this.limits) if (limit.expiresAt <= now) this.limits.delete(key);
  }

  async create(device: CliAuthDevice, now: number) {
    this.prune(now);
    if (this.devices.has(device.deviceHash) || this.codes.has(device.userCodeHash)) return false;
    this.devices.set(device.deviceHash, structuredClone(device));
    this.codes.set(device.userCodeHash, device.deviceHash);
    return true;
  }

  async inspect(userCodeHash: string, now: number) {
    this.prune(now);
    const device = this.devices.get(this.codes.get(userCodeHash) ?? "");
    return device ? structuredClone(device) : null;
  }

  async decide(
    userCodeHash: string,
    identity: Plan5Identity,
    decision: "approve" | "deny",
    now: number,
  ): Promise<CliAuthDecisionResult> {
    this.prune(now);
    const device = this.devices.get(this.codes.get(userCodeHash) ?? "");
    if (!device) return "expired_token";
    if (device.status !== "pending") return "invalid_grant";
    device.status = decision === "approve" ? "approved" : "denied";
    if (decision === "approve") device.identity = structuredClone(identity);
    return device.status;
  }

  async poll(
    deviceHash: string,
    tokenHash: string,
    now: number,
    sessionLifetimeMs: number,
  ): Promise<CliAuthPollResult> {
    this.prune(now);
    const device = this.devices.get(deviceHash);
    if (!device) return { code: "expired_token" };
    if (device.status === "consumed") return { code: "invalid_grant" };
    if (device.status === "denied") return { code: "access_denied" };
    if (now < device.nextPollAt) {
      device.interval += 5;
      device.nextPollAt = now + device.interval * 1000;
      return { code: "slow_down", interval: device.interval };
    }
    device.nextPollAt = now + device.interval * 1000;
    if (device.status === "pending")
      return { code: "authorization_pending", interval: device.interval };
    if (!device.identity || this.sessions.has(tokenHash)) return { code: "invalid_grant" };
    const session: CliAuthSession = {
      ...device.identity,
      tokenHash,
      origin: device.origin,
      scopes: [...device.scopes],
      expiresAt: now + sessionLifetimeMs,
      revoked: false,
    };
    this.sessions.set(tokenHash, session);
    device.status = "consumed";
    delete device.identity;
    return { code: "issued", session: structuredClone(session) };
  }

  async session(tokenHash: string, now: number) {
    this.prune(now);
    const session = this.sessions.get(tokenHash);
    return session && !session.revoked ? structuredClone(session) : null;
  }

  async revoke(tokenHash: string, now: number) {
    this.prune(now);
    const session = this.sessions.get(tokenHash);
    if (session) session.revoked = true;
  }

  async rateLimit(key: string, now: number, windowMs: number, limit: number) {
    this.prune(now);
    const entry = this.limits.get(key) ?? { count: 0, expiresAt: now + windowMs };
    entry.count += 1;
    this.limits.set(key, entry);
    return entry.count <= limit;
  }
}

export class CliAuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 401,
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "CliAuthError";
  }
}

export type CliAuthOptions = {
  store?: CliAuthStore;
  identity?: (request: Request) => Promise<Plan5Identity>;
  /** Trusted public origin, never inferred from forwarded headers. HTTP is loopback-only. */
  origin?: string;
  now?: () => number;
  production?: boolean;
  /** Inject only a proxy-verified client identifier. Untrusted forwarding headers are ignored. */
  rateLimitKey?: (request: Request) => string;
};

export function hashCliAuthSecret(kind: string, value: string) {
  return createHash("sha256").update(`frontier-cli:${kind}:${value}`).digest("hex");
}

function json(value: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(value, {
    status,
    headers: {
      "cache-control": "no-store",
      pragma: "no-cache",
      "referrer-policy": "no-referrer",
      ...headers,
    },
  });
}

function userCode(value: unknown) {
  if (typeof value !== "string" || !/^[A-Z2-9-]{12,14}$/i.test(value))
    throw new CliAuthError("invalid_request", "Enter the code displayed by your CLI.", 400);
  const normalized = value.replaceAll("-", "").toUpperCase();
  if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{12}$/.test(normalized))
    throw new CliAuthError("invalid_request", "Enter the code displayed by your CLI.", 400);
  return normalized;
}

async function body(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json")
    throw new CliAuthError("invalid_request", "Use application/json.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new CliAuthError("invalid_request", "A JSON object is required.", 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > 4096) {
        await reader.cancel();
        throw new CliAuthError("invalid_request", "Request body is too large.", 413);
      }
      chunks.push(part.value);
    }
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof CliAuthError) throw error;
    throw new CliAuthError("invalid_request", "A valid JSON object is required.", 400);
  } finally {
    reader.releaseLock();
  }
}

function only(input: Record<string, unknown>, keys: string[]) {
  if (Object.keys(input).some((key) => !keys.includes(key)))
    throw new CliAuthError("invalid_request", "Unexpected request field.", 400);
}

export class CliAuthService {
  readonly available: boolean;
  readonly durability: CliAuthStore["durability"] | "unavailable";
  readonly unavailableReason: string | null;
  readonly origin: string | null;
  private readonly now: () => number;

  constructor(private readonly options: CliAuthOptions = {}) {
    this.now = options.now ?? Date.now;
    let origin: string | null = null;
    try {
      const url = new URL(options.origin ?? "");
      if (
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash &&
        url.pathname === "/" &&
        (url.protocol === "https:" ||
          (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
      )
        origin = url.origin;
    } catch {
      /* Missing or invalid configuration keeps the service unavailable. */
    }
    this.origin = origin;
    this.durability = options.store?.durability ?? "unavailable";
    this.unavailableReason = !origin
      ? "CLI authorization origin is not configured."
      : !options.identity
        ? "CLI browser authentication is not configured."
        : !options.store
          ? "CLI authorization storage is not configured."
          : (options.production ?? process.env.NODE_ENV === "production") &&
              options.store.durability !== "durable-redis"
            ? "CLI authorization requires durable storage in production."
            : null;
    this.available = this.unavailableReason === null;
  }

  private requireStore(request: Request) {
    if (!this.available || !this.options.store)
      throw new CliAuthError(
        "service_unavailable",
        this.unavailableReason ?? "CLI authorization is unavailable.",
        503,
      );
    if (new URL(request.url).origin !== this.origin)
      throw new CliAuthError("invalid_origin", "CLI authorization origin does not match.", 403);
    const origin = request.headers.get("origin");
    if (origin !== null && origin !== this.origin)
      throw new CliAuthError("invalid_origin", "Cross-origin authorization is not permitted.", 403);
    return this.options.store;
  }

  private async browserIdentity(request: Request) {
    if (
      request.headers.get("origin") !== this.origin ||
      request.headers.get("x-frontier-cli-csrf") !== "1" ||
      (request.headers.has("sec-fetch-site") &&
        request.headers.get("sec-fetch-site") !== "same-origin")
    )
      throw new CliAuthError(
        "invalid_origin",
        "Open authorization on the configured Frontier origin.",
        403,
      );
    if (
      !request.headers.get("authorization")?.startsWith("Bearer ") ||
      !request.headers.get("x-privy-identity-token") ||
      request.headers.get("authorization")?.startsWith("Bearer frontier_cli_")
    )
      throw new CliAuthError("authentication_required", "Sign in to approve this CLI request.");
    try {
      const identity = await this.options.identity!(request);
      if (!identity.userId || !/^0x[0-9a-fA-F]{40}$/.test(identity.wallet)) throw new Error();
      return identity;
    } catch {
      throw new CliAuthError(
        "authentication_required",
        "Your sign-in session could not be verified.",
      );
    }
  }

  private async limit(store: CliAuthStore, key: string, count: number) {
    if (
      !(await store.rateLimit(
        hashCliAuthSecret("rate", `${this.origin}:${key}`),
        this.now(),
        60_000,
        count,
      ))
    )
      throw new CliAuthError(
        "rate_limited",
        "Too many authorization requests. Try again in one minute.",
        429,
        60,
      );
  }

  private tokenHash(request: Request) {
    const match = /^Bearer (frontier_cli_[A-Za-z0-9_-]{43})$/.exec(
      request.headers.get("authorization") ?? "",
    );
    if (!match?.[1]) throw new CliAuthError("invalid_token", "A valid CLI session is required.");
    return this.hash("token", match[1]);
  }

  private hash(kind: string, value: string) {
    return hashCliAuthSecret(kind, `${this.origin}:${value}`);
  }

  private async currentSession(request: Request) {
    const store = this.requireStore(request);
    const session = await store.session(this.tokenHash(request), this.now());
    if (
      !session ||
      session.revoked ||
      session.expiresAt <= this.now() ||
      session.origin !== this.origin
    )
      throw new CliAuthError("invalid_token", "CLI session has expired or was revoked.");
    return session;
  }

  async resolve(request: Request, scope: CliAuthScope): Promise<Plan5Identity> {
    try {
      const session = await this.currentSession(request);
      if (!cliAuthScopes.includes(scope) || !session.scopes.includes(scope))
        throw new CliAuthError(
          "insufficient_scope",
          "This CLI session does not permit this operation.",
          403,
        );
      return { userId: session.userId, wallet: session.wallet };
    } catch (error) {
      if (error instanceof CliAuthError) throw error;
      throw new CliAuthError(
        "service_unavailable",
        "CLI authorization storage is unavailable.",
        503,
      );
    }
  }

  async handle(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/v1/cli/auth/")) return null;
    try {
      const store = this.requireStore(request);
      const action = url.pathname.slice("/v1/cli/auth/".length);
      if (!["device", "inspect", "approve", "token", "session", "revoke"].includes(action))
        throw new CliAuthError("not_found", "Unknown CLI authorization endpoint.", 404);
      const method = action === "session" ? "GET" : "POST";
      if (request.method !== method)
        return json({ error: { code: "method_not_allowed", message: `Use ${method}.` } }, 405, {
          allow: method,
        });
      if (url.search)
        throw new CliAuthError(
          "invalid_request",
          "Authorization API parameters belong in the request body.",
          400,
        );
      await this.limit(store, "global", 1000);
      await this.limit(
        store,
        `client:${this.options.rateLimitKey?.(request) ?? "unattributed"}:${action}`,
        action === "device" ? 20 : 120,
      );
      if (action === "session") {
        const session = await this.currentSession(request);
        return json({
          userId: session.userId,
          wallet: session.wallet,
          scopes: session.scopes,
          expiresAt: new Date(session.expiresAt).toISOString(),
          revoked: false,
        });
      }
      if (action === "revoke") {
        await store.revoke(this.tokenHash(request), this.now());
        return json({ revoked: true });
      }
      const input = await body(request);
      if (action === "device") {
        only(input, ["scope", "scopes"]);
        if (input.scope !== undefined && input.scopes !== undefined)
          throw new CliAuthError("invalid_scope", "Specify scope or scopes, not both.", 400);
        const requested =
          input.scope !== undefined
            ? typeof input.scope === "string"
              ? input.scope.split(" ")
              : null
            : (input.scopes ?? [...cliAuthScopes]);
        if (
          !Array.isArray(requested) ||
          !requested.length ||
          requested.some(
            (scope: unknown) =>
              typeof scope !== "string" || !cliAuthScopes.includes(scope as CliAuthScope),
          )
        )
          throw new CliAuthError(
            "invalid_scope",
            "Only Disaster Response read, join, submit and entry scopes are supported.",
            400,
          );
        const scopes = cliAuthScopes.filter((scope) => requested.includes(scope));
        for (let attempt = 0; attempt < 3; attempt++) {
          const deviceCode = randomBytes(32).toString("base64url");
          const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
          const code = [...randomBytes(12)].map((byte) => alphabet[byte & 31]).join("");
          const now = this.now();
          if (
            !(await store.create(
              {
                deviceHash: this.hash("device", deviceCode),
                userCodeHash: this.hash("user-code", code),
                origin: this.origin!,
                scopes,
                expiresAt: now + cliAuthDeviceLifetime * 1000,
                interval: cliAuthPollInterval,
                nextPollAt: now,
                status: "pending",
              },
              now,
            ))
          )
            continue;
          return json({
            device_code: deviceCode,
            user_code: `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8)}`,
            verification_uri: `${this.origin}/cli/authorize`,
            expires_in: cliAuthDeviceLifetime,
            interval: cliAuthPollInterval,
          });
        }
        throw new CliAuthError(
          "service_unavailable",
          "Could not create an authorization request.",
          503,
        );
      }
      if (action === "inspect" || action === "approve") {
        only(input, action === "inspect" ? ["user_code"] : ["user_code", "decision"]);
        const identity = await this.browserIdentity(request);
        await this.limit(store, `identity:${identity.userId}`, 20);
        const hash = this.hash("user-code", userCode(input.user_code));
        const device = await store.inspect(hash, this.now());
        if (!device || device.expiresAt <= this.now())
          throw new CliAuthError(
            "expired_token",
            "This code is invalid or expired. Start a new CLI sign-in.",
            400,
          );
        if (device.origin !== this.origin || device.status !== "pending")
          throw new CliAuthError("invalid_grant", "This request has already been decided.", 409);
        if (action === "inspect")
          return json({
            origin: device.origin,
            scopes: device.scopes,
            expiresAt: new Date(device.expiresAt).toISOString(),
            session_expires_in: cliAuthSessionLifetime,
          });
        if (input.decision !== "approve" && input.decision !== "deny")
          throw new CliAuthError("invalid_request", "Choose approve or deny.", 400);
        const result = await store.decide(hash, identity, input.decision, this.now());
        if (result === "expired_token" || result === "invalid_grant")
          throw new CliAuthError(result, "This request expired or has already been decided.", 409);
        return json({ status: result });
      }
      only(input, ["device_code"]);
      if (typeof input.device_code !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(input.device_code))
        throw new CliAuthError("invalid_request", "A valid device_code is required.", 400);
      const token = `frontier_cli_${randomBytes(32).toString("base64url")}`;
      const result = await store.poll(
        this.hash("device", input.device_code),
        this.hash("token", token),
        this.now(),
        cliAuthSessionLifetime * 1000,
      );
      if (result.code !== "issued")
        throw new CliAuthError(
          result.code,
          {
            authorization_pending: "Awaiting your browser approval.",
            slow_down: "Increase the polling interval by five seconds.",
            expired_token: "Device code is invalid or expired.",
            access_denied: "The authorization request was denied.",
            invalid_grant: "This device code has already been consumed.",
          }[result.code],
          400,
          "interval" in result ? result.interval : undefined,
        );
      return json({
        access_token: token,
        token_type: "Bearer",
        expires_in: cliAuthSessionLifetime,
      });
    } catch (error) {
      const failure =
        error instanceof CliAuthError
          ? error
          : new CliAuthError(
              "service_unavailable",
              "CLI authorization storage is unavailable.",
              503,
            );
      return json(
        { error: { code: failure.code, message: failure.message } },
        failure.status,
        failure.retryAfter ? { "retry-after": String(failure.retryAfter) } : {},
      );
    }
  }
}
