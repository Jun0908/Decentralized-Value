import { resolve } from "node:path";

import { environmentSchema } from "../packages/shared/src/environment";
import { loadEnvironmentCheck } from "./lib/environment-check";

const args = process.argv.slice(2).filter((argument) => argument !== "--");
if (args.some((argument) => argument !== "--example")) {
  console.error("Usage: pnpm env:check [--example]");
  process.exitCode = 1;
} else {
  try {
    const input = loadEnvironmentCheck({
      directory: resolve(import.meta.dirname, ".."),
      exampleOnly: args.includes("--example"),
      inherited: process.env,
    });
    const result = environmentSchema.safeParse(input.values);
    const source = `${input.sources.join(" + ")} (${input.template ? "template only" : "local files; process environment takes precedence"})`;
    if (result.success) {
      console.log(`Environment formats validated from ${source}.`);
    } else {
      const fields = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
      console.error(
        `Invalid environment formats from ${source}: ${fields.join(", ")}. Values are not displayed.`,
      );
      process.exitCode = 1;
    }
    console.log(
      `OPENAI_API_KEY: ${input.values.OPENAI_API_KEY?.trim() ? "present" : "absent"} (presence only; value not displayed).`,
    );
    console.log(
      "Offline check only: credentials, services, Vercel configuration, and payments are not verified.",
    );
  } catch {
    // Never print parser exceptions: future validators can include input values.
    console.error(
      "Environment validation failed. Check the documented formats in Docs/ENVIRONMENT.md; values are not displayed.",
    );
    process.exitCode = 1;
  }
}
