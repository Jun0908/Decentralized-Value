import { parseArgs } from "node:util";
import { CliError } from "./output.js";

export const version = "0.3.0";
type Option = { type: "boolean" | "string"; description: string };
const boolean = (description: string): Option => ({
  type: "boolean",
  description,
});
const string = (description: string): Option => ({
  type: "string",
  description,
});
export const globalOptions = {
  json: boolean("Emit one JSON envelope"),
  help: boolean("Show command reference"),
  version: boolean("Show version"),
  project: string("Project directory or frontier.json"),
  "base-url": string("API origin"),
  "timeout-ms": string("Request timeout in milliseconds"),
};
export const commands = [
  {
    name: "arenas list",
    args: [],
    summary: "List public arena capabilities",
    options: {},
  },
  {
    name: "arenas inspect",
    args: ["arena"],
    summary: "Inspect an arena manifest",
    options: {},
  },
  {
    name: "init",
    args: ["arena"],
    summary: "Create a verified starter project",
    options: { dir: string("New or empty directory") },
  },
  {
    name: "check",
    args: [],
    summary: "Validate local input without evaluation or network access",
    options: {},
  },
  {
    name: "context inspect",
    args: [],
    summary: "Inspect the pinned context",
    options: {},
  },
  {
    name: "context update",
    args: [],
    summary: "Review and update the pinned context",
    options: { yes: boolean("Confirm context update") },
  },
  {
    name: "practice",
    args: [],
    summary: "Run one synchronous public practice evaluation",
    options: {
      episode: string("Public episode ID"),
      wait: boolean("Wait for the synchronous result (default)"),
    },
  },
  { name: "runs list", args: [], summary: "List local runs", options: {} },
  {
    name: "runs inspect",
    args: ["id"],
    summary: "Inspect a local run and raw result",
    options: {},
  },
  {
    name: "compare",
    args: ["run-a", "run-b"],
    summary: "Compare two compatible local runs by metric",
    options: {},
  },
  {
    name: "auth login",
    args: [],
    summary: "Authorize a device and store its session in the OS keychain",
    options: {
      "no-browser": boolean("Print approval instructions without opening a browser"),
    },
  },
  {
    name: "auth status",
    args: [],
    summary: "Inspect the current server session",
    options: {},
  },
  {
    name: "auth logout",
    args: [],
    summary: "Revoke the session and delete local credentials",
    options: {},
  },
  {
    name: "submit",
    args: [],
    summary: "Confirm participation and save one submission revision",
    options: {
      yes: boolean("Confirm participation and submission"),
      resume: string("Resume a saved operation with its original body and key"),
    },
  },
  {
    name: "submissions list",
    args: [],
    summary: "List your saved submissions",
    options: {},
  },
  {
    name: "submissions inspect",
    args: ["id"],
    summary: "Inspect your saved submission",
    options: {},
  },
  {
    name: "submissions download",
    args: ["id"],
    summary: "Download the saved strategy without overwriting files",
    options: { output: string("Destination JSON file (required)") },
  },
  {
    name: "entry select",
    args: ["id"],
    summary: "Confirm and select your final entry",
    options: { yes: boolean("Confirm final-entry selection") },
  },
  {
    name: "open",
    args: ["submission-id"],
    summary: "Open your saved submission result",
    options: { "print-url": boolean("Return URL without opening a browser") },
  },
] as const;
export const commandReference = {
  schemaVersion: "1",
  version,
  globalOptions,
  commands,
  examples: [
    "frontier arenas list --json",
    "frontier init disaster-response --dir response",
    "frontier check --project response",
    "frontier practice --project response --wait",
    "frontier auth login --no-browser",
    "frontier submit --project response --yes",
    "frontier submit --project response --resume op_<uuid>",
  ],
};

export function parse(argv: string[]) {
  const all: Record<string, Option> = { ...globalOptions };
  for (const command of commands) Object.assign(all, command.options);
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: all,
      allowPositionals: true,
      strict: true,
    });
  } catch {
    throw new CliError("INVALID_ARGUMENT", "Invalid command option; use --help");
  }
  const command = commands.find((c) =>
    c.name.split(" ").every((part, index) => parsed.positionals[index] === part),
  );
  const values = parsed.values;
  if (!command && !values.help && !values.version)
    throw new CliError("INVALID_ARGUMENT", "Unknown command; use --help");
  const args = parsed.positionals.slice(command?.name.split(" ").length ?? 0);
  if (command && !values.help && !values.version) {
    if (args.length !== command.args.length)
      throw new CliError(
        "INVALID_ARGUMENT",
        `Expected: frontier ${command.name} ${command.args.map((a) => `<${a}>`).join(" ")}`,
      );
    for (const key of Object.keys(values))
      if (!(key in globalOptions) && !(key in command.options))
        throw new CliError("INVALID_ARGUMENT", `--${key} is not valid for ${command.name}`);
  }
  return { command, args, values };
}

export function help(name?: string) {
  const selected = commands.filter((c) => !name || c.name === name);
  return [
    `Frontier CLI ${version}`,
    ...selected.map(
      (c) =>
        `  frontier ${c.name} ${c.args.map((a) => `<${a}>`).join(" ")}\n    ${c.summary}${Object.entries(
          c.options,
        )
          .map(
            ([key, value]) =>
              `\n    --${key}${value.type === "string" ? " <value>" : ""}: ${value.description}`,
          )
          .join("")}`,
    ),
    "Global options:",
    ...Object.entries(globalOptions).map(([key, value]) => `  --${key}: ${value.description}`),
  ].join("\n");
}
