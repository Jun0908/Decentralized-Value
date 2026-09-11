import {
  FrontierClient,
  compareRuns,
  submissionBodySchema,
  type SubmissionBody,
} from "@frontier/sdk";
import { cliArenaIdSchema, cliArenaManifestSchema } from "@frontier/shared/cli";
import { createInterface } from "node:readline/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { parse, help, commandReference, version } from "./commands.js";
import { CliError, classify, redact } from "./output.js";
import { KeychainStore, tokenFor, type CredentialStore } from "./credential-store.js";
import { AuthApi, login } from "./auth.js";
import { atomicJson, stable } from "./files.js";
import {
  loadProject,
  optionalProjectOrigin,
  projectDir,
  origin,
  initialize,
  checkProject,
  assertContext,
  contextChanges,
  lockFrom,
  capability,
} from "./project.js";
import { saveRun, loadRun, listRuns } from "./run-store.js";
import {
  createOperation,
  loadOperation,
  completeOperation,
  type Operation,
} from "./operation-store.js";
import { openBrowser } from "./browser.js";
import { renderHuman } from "./human.js";

export interface CliOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  fetch?: typeof fetch;
  store?: CredentialStore;
  stdout?: (text: string) => void;
  stderr?: (text: string) => void;
  interactive?: boolean;
  confirm?: (summary: string) => Promise<boolean>;
  open?: (url: string, origin: string) => Promise<void>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export async function runCli(argv: string[], options: CliOptions = {}): Promise<number> {
  const env = options.env ?? process.env;
  const secrets: string[] = [env.FRONTIER_TOKEN ?? ""];
  const stdout = options.stdout ?? ((text) => process.stdout.write(text));
  const stderr = options.stderr ?? ((text) => process.stderr.write(text));
  const progress = (text: string) => stderr(`${redact(text, secrets)}\n`);
  const json = argv.some((arg) => arg === "--json");
  try {
    const { command, args, values } = parse(argv);
    const emit = (data: unknown, name = command?.name ?? "help") =>
      stdout(
        `${json ? JSON.stringify(redact({ schemaVersion: "1", ok: true, command: name, data }, secrets)) : redact(renderHuman(name, redact(data, secrets)), secrets)}\n`,
      );
    if (values.version) {
      if (json) emit({ version }, "version");
      else stdout(`${version}\n`);
      return 0;
    }
    if (values.help) {
      if (json) emit(command ? { ...commandReference, commands: [command] } : commandReference);
      else stdout(`${help(command?.name)}\n`);
      return 0;
    }
    const name = command!.name;
    const argument = (index: number): string => {
      const value = args[index];
      if (!value)
        throw new CliError(
          "INVALID_ARGUMENT",
          `Command ${name} requires positional argument ${index + 1}`,
        );
      return value;
    };
    const cwd = options.cwd ?? process.cwd();
    const dir = projectDir(cwd, values.project as string | undefined);
    const stringOption = (key: string) => values[key] as string | undefined;
    const baseUrl = origin(
      stringOption("base-url") ??
        env.FRONTIER_BASE_URL ??
        (await optionalProjectOrigin(dir)) ??
        "http://localhost:3000",
    );
    const timeoutMs = Number(stringOption("timeout-ms") ?? 60000);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2147483647)
      throw new CliError(
        "INVALID_TIMEOUT",
        "--timeout-ms must be a positive integer within the supported timer range",
      );
    const fetcher = options.fetch ?? globalThis.fetch;
    const store = options.store ?? new KeychainStore();
    const api = new AuthApi(baseUrl, fetcher, timeoutMs);
    const browser = options.open ?? openBrowser;
    let token: string | undefined;
    const authenticate = async () => {
      token = (await tokenFor(baseUrl, env, store)) ?? undefined;
      if (!token)
        throw new CliError(
          "AUTHENTICATION_REQUIRED",
          "Log in or inject a token for the selected API origin",
          3,
        );
      secrets.push(token);
      return api.session(token);
    };
    const client = new FrontierClient({
      baseUrl,
      fetch: fetcher,
      timeoutMs,
      auth: {
        getHeaders: () => {
          if (!token)
            throw new CliError("AUTHENTICATION_REQUIRED", "Authenticated session required", 3);
          return { authorization: `Bearer ${token}` };
        },
      },
    });
    const project = async () => {
      const p = await loadProject(dir, name === "context update");
      if (origin(p.project.baseUrl) !== baseUrl)
        throw new CliError(
          "PROJECT_ORIGIN_MISMATCH",
          "Project is pinned to another API origin; use its origin or initialize another project",
          4,
        );
      return p;
    };
    const selectedArena = async () =>
      values.project || (await optionalProjectOrigin(dir))
        ? (await project()).project.arenaId
        : ("disaster-response" as const);
    const assertNoSecrets = (value: unknown) => {
      const serialized = JSON.stringify(value);
      if (secrets.some((secret) => secret && serialized.includes(secret)))
        throw new CliError(
          "SECRET_IN_ARTIFACT",
          "Artifact or response contains a session secret and cannot be persisted",
        );
    };
    const confirm = async (summary: unknown) => {
      progress(JSON.stringify(redact(summary, secrets), null, 2));
      if (values.yes) return;
      if (!(options.interactive ?? Boolean(process.stdin.isTTY && process.stderr.isTTY)))
        throw new CliError(
          "CONFIRMATION_REQUIRED",
          "This action requires --yes in a noninteractive environment",
          3,
          summary,
        );
      let accepted: boolean;
      if (options.confirm) accepted = await options.confirm(JSON.stringify(summary));
      else {
        const rl = createInterface({
          input: process.stdin,
          output: process.stderr,
        });
        try {
          accepted = /^(y|yes)$/i.test((await rl.question("Proceed? [y/N] ")).trim());
        } finally {
          rl.close();
        }
      }
      if (!accepted) throw new CliError("CONFIRMATION_REQUIRED", "Action was not confirmed", 3);
    };
    let data: unknown;
    let exit = 0;
    switch (name) {
      case "arenas list":
        data = { arenas: await client.arenas.list() };
        break;
      case "arenas inspect":
        data = await client.arenas.get(cliArenaIdSchema.parse(args[0]));
        break;
      case "init": {
        const id = cliArenaIdSchema.parse(args[0]);
        const manifest = cliArenaManifestSchema.parse(await client.arenas.get(id));
        const bytes = await client.arenas.downloadStarter(id, manifest);
        const latest = await client.arenas.get(id);
        if (stable(manifest) !== stable(latest))
          throw new CliError(
            "CONTEXT_MISMATCH",
            "Manifest changed while downloading the starter",
            4,
          );
        data = await initialize(
          values.dir ? resolve(cwd, String(values.dir)) : dir,
          manifest,
          bytes,
          baseUrl,
        );
        break;
      }
      case "check":
        data = (await checkProject(await project())).validation;
        break;
      case "context inspect":
        data = (await project()).lock;
        break;
      case "context update": {
        const p = await project();
        const manifest = await client.arenas.get(p.project.arenaId);
        const changes = contextChanges(p.lock, manifest);
        if (!p.cacheConsistent)
          changes.push({
            field: "cachedFiles",
            before: "inconsistent",
            after: "restored",
          });
        if (!changes.length) {
          data = { changed: false, lock: p.lock };
          break;
        }
        await confirm({
          action: "context update",
          changes,
          effect: "Future runs use the new context. Existing runs keep their original context.",
        });
        const lock = lockFrom(manifest, baseUrl, p.lock.episodeId);
        await atomicJson(
          join(dir, p.project.artifact.replace(".json", ".schema.json")),
          manifest.artifact.schema,
          true,
        );
        await atomicJson(join(dir, ".frontier", "manifest.json"), manifest, true);
        await atomicJson(join(dir, "frontier.lock.json"), lock, true);
        data = { changed: true, changes, lock };
        break;
      }
      case "practice": {
        const p = await project();
        const { artifact } = await checkProject(p);
        assertNoSecrets(artifact);
        const manifest = await client.arenas.get(p.project.arenaId);
        capability(manifest, "practice");
        assertContext(p.lock, manifest);
        if (p.project.arenaId === "disaster-response" && values.episode)
          throw new CliError(
            "UNSUPPORTED_EPISODE",
            "Disaster Response does not support --episode",
            5,
          );
        const episodeId = stringOption("episode") ?? p.lock.episodeId;
        if (
          p.project.arenaId === "rescue-room" &&
          !manifest.episodes.some((e) => e.id === episodeId)
        )
          throw new CliError("INVALID_EPISODE", "Choose a public episode in the manifest");
        progress(
          `Running synchronous practice${episodeId ? ` for ${episodeId}` : ""}. A retry may consume another practice run.`,
        );
        try {
          const result = await client.evaluations.practice({
            arenaId: p.project.arenaId,
            artifact,
            context: p.lock.context,
            episodeId,
          });
          data = await saveRun(dir, {
            ...result,
            raw: redact(result.raw, secrets) as typeof result.raw,
          });
          exit = result.correctness ? 0 : 8;
        } catch (error) {
          const e = classify(error);
          const raw = (e.details as { raw?: unknown } | null)?.raw;
          if (raw) {
            const diagnosticId = `diagnostic_${randomUUID()}`;
            await atomicJson(
              join(dir, ".frontier", "diagnostics", `${diagnosticId}.json`),
              redact({ code: e.code, context: p.lock.context, raw }, secrets),
            );
            e.details = {
              diagnosticId,
              reason: "Result excluded from normal runs",
            };
          }
          if (e.exitCode === 7)
            e.details = {
              ...(e.details && typeof e.details === "object" ? e.details : {}),
              completion: "unknown",
              retryMayConsumePracticeRun: true,
            };
          throw e;
        }
        break;
      }
      case "runs list":
        await project();
        data = { runs: await listRuns(dir, baseUrl) };
        break;
      case "runs inspect": {
        await project();
        const run = await loadRun(dir, argument(0));
        if (run.baseUrl !== baseUrl)
          throw new CliError("CONTEXT_MISMATCH", "Run belongs to another API origin", 4);
        data = run;
        break;
      }
      case "compare": {
        await project();
        const a = await loadRun(dir, argument(0));
        const b = await loadRun(dir, argument(1));
        if (a.baseUrl !== baseUrl || b.baseUrl !== baseUrl)
          throw new CliError("CONTEXT_MISMATCH", "Runs belong to another API origin", 4);
        data = compareRuns(a, b);
        break;
      }
      case "auth login": {
        if (env.FRONTIER_TOKEN)
          throw new CliError(
            "ENV_TOKEN_ACTIVE",
            "Unset FRONTIER_TOKEN before starting keychain login",
            3,
          );
        data = await login({
          api,
          baseUrl,
          store,
          noBrowser: Boolean(values["no-browser"]),
          progress,
          open: browser,
          rememberSecret: (secret) => secrets.push(secret),
          sleep: options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
          now: options.now ?? Date.now,
        });
        break;
      }
      case "auth status":
        data = {
          authenticated: true,
          origin: baseUrl,
          ...(await authenticate()),
        };
        break;
      case "auth logout": {
        token = (await tokenFor(baseUrl, env, store)) ?? undefined;
        if (token) secrets.push(token);
        let revokeError: unknown;
        try {
          if (token) await api.request("revoke", {}, token);
        } catch (e) {
          revokeError = e;
        }
        await store.delete(baseUrl);
        if (revokeError)
          throw new CliError(
            "LOGOUT_REVOCATION_UNCONFIRMED",
            "Local credential deleted, but server revocation is unconfirmed",
            7,
            {
              localDeleted: true,
              serverRevocation: "unconfirmed",
              environmentTokenMustBeUnset: Boolean(env.FRONTIER_TOKEN),
              cause: classify(revokeError).code,
            },
            true,
          );
        data = {
          localDeleted: true,
          serverRevocation: token ? "revoked" : "no-session",
          environmentTokenMustBeUnset: Boolean(env.FRONTIER_TOKEN),
        };
        break;
      }
      case "submit": {
        const p = values.resume ? undefined : await project();
        const manifest = p ? await client.arenas.get(p.project.arenaId) : undefined;
        if (p && manifest) {
          capability(manifest, "submit");
          assertContext(p.lock, manifest);
          if (p.project.arenaId !== "disaster-response")
            throw new CliError("UNSUPPORTED_OPERATION", "Rescue Room supports practice only", 5);
        }
        const session = await authenticate();
        let operation: Operation;
        if (values.resume) {
          // Resume never reads the edited artifact or checks the current manifest before server idempotency lookup.
          operation = await loadOperation(dir, String(values.resume), baseUrl, session.userId);
          progress(`Resuming ${operation.operationId} with its original body and idempotency key.`);
        } else {
          const { artifact } = await checkProject(p!);
          const provenance = p!.project.provenance;
          const body = {
            strategy: artifact,
            sourceMethod: provenance.kind === "human" ? "JSON" : "AGENT_API",
            repositoryUrl: provenance.repositoryUrl ?? null,
            sourceCommit: provenance.sourceCommit ?? null,
            agentEvidence:
              provenance.kind === "agent"
                ? {
                    name: provenance.name!,
                    version: provenance.version!,
                    objective: provenance.objective!,
                  }
                : null,
          };
          submissionBodySchema.parse(body);
          assertNoSecrets(body);
          const history = await client.submissions.list(p!.project.arenaId);
          const remainingRevisions = Math.max(
            0,
            manifest!.limits.maxRevisions - history.submissions.length,
          );
          if (!remainingRevisions)
            throw new CliError("SUBMISSION_LIMIT_REACHED", "No submission revisions remain");
          await confirm({
            action: "submit",
            origin: baseUrl,
            userId: session.userId,
            wallet: session.wallet,
            registrationRequired: !history.participant,
            remainingRevisions,
            storage: manifest!.storage,
            context: p!.lock.context,
            body,
          });
          operation = await createOperation(dir, {
            baseUrl,
            userId: session.userId,
            arenaId: "disaster-response",
            context: p!.lock.context,
            body: JSON.stringify(body),
          });
        }
        progress(`Operation: ${operation.operationId}`);
        try {
          const history = await client.submissions.list(operation.arenaId);
          if (!history.participant) await client.competitions.join(operation.arenaId);
          const result = await client.submissions.create({
            arenaId: operation.arenaId,
            body: JSON.parse(operation.body) as SubmissionBody,
            context: operation.context,
            idempotencyKey: operation.idempotencyKey,
          });
          await completeOperation(dir, operation, redact(result, secrets));
          data = {
            operationId: operation.operationId,
            state: "saved",
            ...result,
          };
        } catch (error) {
          const e = classify(error);
          e.details = {
            cause: e.details,
            operationId: operation.operationId,
            resume: `frontier submit --resume ${operation.operationId}`,
            completion: e.exitCode === 7 ? "unknown" : "not-confirmed",
          };
          throw e;
        }
        break;
      }
      case "submissions list":
        await authenticate();
        data = await client.submissions.list(await selectedArena());
        break;
      case "submissions inspect":
        await authenticate();
        data = await client.submissions.get(argument(0), await selectedArena());
        break;
      case "submissions download": {
        if (!values.output) throw new CliError("INVALID_ARGUMENT", "--output is required");
        await authenticate();
        const result = await client.submissions.get(argument(0), await selectedArena());
        assertNoSecrets(result.artifact.strategy);
        const path = resolve(cwd, String(values.output));
        await atomicJson(path, result.artifact.strategy);
        data = { submissionId: result.submissionId, output: path };
        break;
      }
      case "entry select": {
        const p = await project();
        const manifest = await client.arenas.get(p.project.arenaId);
        capability(manifest, "finalEntry");
        assertContext(p.lock, manifest);
        const session = await authenticate();
        const submission = await client.submissions.get(argument(0), p.project.arenaId);
        await confirm({
          action: "entry select",
          origin: baseUrl,
          userId: session.userId,
          submissionId: submission.submissionId,
          revision: submission.revision,
          context: p.lock.context,
        });
        const result = await client.entries.select(
          submission.submissionId,
          p.lock.context,
          p.project.arenaId,
        );
        const history = await client.submissions.list(p.project.arenaId);
        if (history.finalEntry?.submissionId !== submission.submissionId)
          throw new CliError(
            "ENTRY_STATE_CHANGED",
            "The selected entry could not be confirmed; it may have changed concurrently",
            7,
            { requested: submission.submissionId, actual: history.finalEntry },
          );
        data = { state: "selected", ...result };
        break;
      }
      case "open": {
        const submissionId = argument(0);
        if (submissionId.startsWith("run_"))
          throw new CliError(
            "RESULT_NOT_PERSISTED",
            "Local practice runs have no saved web result; use runs inspect",
          );
        await authenticate();
        const arena = await selectedArena();
        const result = await client.submissions.get(submissionId, arena);
        const url = new URL(`/submissions/${encodeURIComponent(result.submissionId)}`, baseUrl);
        url.searchParams.set("arena", arena);
        if (!values["print-url"]) await browser(url.href, baseUrl);
        data = {
          submissionId: result.submissionId,
          url: url.href,
          opened: !values["print-url"],
        };
        break;
      }
    }
    emit(data);
    return exit;
  } catch (error) {
    const e = classify(error);
    stdout(
      `${JSON.stringify(redact({ schemaVersion: "1", ok: false, error: { code: e.code, message: e.message, details: e.details, retryable: e.retryable } }, secrets), null, json ? undefined : 2)}\n`,
    );
    return e.exitCode;
  }
}
