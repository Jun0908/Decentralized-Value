import { spawnSync } from "node:child_process";
import { join } from "node:path";

/** Never include CLI output, account data or secret inputs in a public error. */
export function creFailureCode(output: string, processError?: string): string {
  if (processError === "ETIMEDOUT") return "CRE_TIMEOUT";
  if (processError === "ENOENT") return "CRE_EXECUTABLE_MISSING";
  if (/no RPC URLs found|RPC health check failed/i.test(output)) return "CRE_RPC_UNAVAILABLE";
  if (/unable to retrieve organization info/i.test(output)) return "CRE_ORGANIZATION_UNAVAILABLE";
  if (
    /not logged in|authentication required|failed to attach credentials|failed to load credentials/i.test(
      output,
    )
  )
    return "CRE_AUTHENTICATION_REQUIRED";
  if (/private beta|not authorized|permission denied|access denied/i.test(output))
    return "CRE_ACCESS_DENIED";
  return "CRE_EXECUTION_FAILED";
}

export function parseCreResult(output: string): Record<string, unknown> {
  const marker = "Workflow Simulation Result:";
  const start = output.indexOf(marker);
  if (start < 0) throw new Error("CRE_RESULT_MISSING");
  const after = output.slice(start + marker.length).trimStart();
  for (let end = after.length; end > 0; end--) {
    if (after[end - 1] !== "}") continue;
    try {
      const result: unknown = JSON.parse(after.slice(0, end));
      if (result && typeof result === "object" && !Array.isArray(result))
        return result as Record<string, unknown>;
    } catch {
      /* The CLI may append non-JSON status messages. */
    }
  }
  throw new Error("CRE_RESULT_INVALID");
}

export function runOfficialCre(input: {
  root: string;
  workflowFolder: string;
  envFile: string;
  rpcUrl: string;
  triggerIndex: number;
}) {
  const project = join(input.root, "workflows", "chainlink-cre");
  const workflow = join(project, input.workflowFolder);
  const childEnv: NodeJS.ProcessEnv = {};
  for (const name of [
    "PATH",
    "Path",
    "SystemRoot",
    "SYSTEMROOT",
    "WINDIR",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "LOCALAPPDATA",
    "APPDATA",
    "HOME",
  ])
    if (process.env[name]) childEnv[name] = process.env[name];
  childEnv.SEPOLIA_RPC_URL = input.rpcUrl;
  const options = {
    env: childEnv,
    encoding: "utf8" as const,
    timeout: 120_000,
    maxBuffer: 4_000_000,
    windowsHide: true,
  };
  const compiled = spawnSync(
    "bun",
    [
      join(project, "rescue-envelope/node_modules/@chainlink/cre-sdk/bin/cre-compile.ts"),
      "main.ts",
      "generated/workflow.wasm",
    ],
    { ...options, cwd: workflow },
  );
  if (compiled.status !== 0) throw new Error("CRE_COMPILATION_FAILED");
  const cli =
    process.env.FRONTIER_CRE_CLI_PATH ??
    (process.platform === "win32"
      ? join(input.root, ".frontier", "tools", "cre-1.33.0", "bin", "cre_v1.33.0_windows_amd64.exe")
      : "cre");
  const executed = spawnSync(
    cli,
    [
      "workflow",
      "simulate",
      input.workflowFolder,
      "--target",
      "local-simulation",
      "--non-interactive",
      "--trigger-index",
      String(input.triggerIndex),
      "--wasm",
      "generated/workflow.wasm",
      "--env",
      input.envFile,
    ],
    { ...options, cwd: project },
  );
  const output = `${executed.stdout ?? ""}\n${executed.stderr ?? ""}`;
  if (executed.status !== 0)
    throw new Error(
      creFailureCode(output, (executed.error as NodeJS.ErrnoException | undefined)?.code),
    );
  return { exitCode: 0 as const, result: parseCreResult(output) };
}
