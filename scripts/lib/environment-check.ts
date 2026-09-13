import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parse } from "dotenv";

export function loadEnvironmentCheck(options: {
  directory: string;
  exampleOnly?: boolean;
  inherited?: Record<string, string | undefined>;
}) {
  const localFiles = [".env", ".env.local"].filter((name) =>
    existsSync(resolve(options.directory, name)),
  );
  const template = options.exampleOnly || localFiles.length === 0;
  const sources = template ? [".env.example"] : localFiles;
  const values: Record<string, string | undefined> = {};
  for (const name of sources) {
    const path = resolve(options.directory, name);
    if (!existsSync(path)) throw new Error("Environment template is missing.");
    Object.assign(values, parse(readFileSync(path)));
  }
  // Template checks must not be made to pass/fail by private machine settings.
  // For local checks, the process environment wins, including explicit blanks.
  if (!template) {
    for (const [name, value] of Object.entries(options.inherited ?? {})) {
      if (value !== undefined) values[name] = value;
    }
  }
  return { sources, template: Boolean(template), values };
}
