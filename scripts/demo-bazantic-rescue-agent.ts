import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { parseEnv } from "node:util";
import { createHash } from "node:crypto";
import { runBazanticRescueAgent } from "../apps/api/src/bazantic-rescue-agent";

async function main() {
  const args = process.argv.slice(2);
  if (args[0] !== "--execute" || args.length > 2) throw new Error("EXPLICIT_EXECUTION_REQUIRED");
  const attempt = args[1] ?? "1";
  if (!["1", "2", "3", "4", "5", "6"].includes(attempt)) throw new Error("ATTEMPT_LIMIT");
  const root = resolve(import.meta.dirname, "..");
  const env = parseEnv(await readFile(join(root, ".env"), "utf8"));
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_KEY_UNAVAILABLE");
  const dir = join(root, ".frontier/bazantic-agent-demo");
  await mkdir(dir, { recursive: true });
  const recipe = JSON.parse(
    await readFile(join(root, "bazantic/rescue-strategy-recipe.json"), "utf8"),
  );
  const journal = join(dir, `attempt-${attempt}.json`);
  // One opt-in attempt, no silent retries after an uncertain inference. All inputs
  // are bounded; GPT-5 nano, six turns × 3,000 output tokens. Reserve $0.10.
  await writeFile(
    journal,
    JSON.stringify({
      state: "reserved",
      maximumReservedUsd: 0.1,
      model: "gpt-5-nano",
      maxTurns: 6,
      maximumOutputTokensPerTurn: 3000,
      startedAt: new Date().toISOString(),
    }),
    { flag: "wx" },
  );
  try {
    const report = await runBazanticRescueAgent({
      apiKey: env.OPENAI_API_KEY,
      recipe: recipe.prompt_template,
      objective:
        "Compare the baseline with one strategy that buys less investigation while retaining patch verification. Keep all three outcomes separate and report tradeoffs or regressions honestly.",
    });
    const evidence = {
      ...report,
      recipePromptSha256: createHash("sha256").update(recipe.prompt_template).digest("hex"),
      recipeDeclaredModel: recipe.model,
      authorModelOverride: "gpt-5-nano",
      maximumReservedUsd: 0.1,
    };
    await writeFile(
      join(root, "Docs/evidence/deployments/bazantic-rescue-agent-demo.json"),
      JSON.stringify(evidence, null, 2) + "\n",
    );
    await writeFile(
      journal,
      JSON.stringify({ state: "complete", usage: report.usage, maximumReservedUsd: 0.1 }, null, 2),
    );
    console.log(
      JSON.stringify(
        {
          verified: true,
          model: report.model,
          events: report.events,
          usage: report.usage,
          comparison: report.comparison,
          evidence: "Docs/evidence/deployments/bazantic-rescue-agent-demo.json",
          hostedRecipeExecuted: false,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    const safeDiagnostic =
      error instanceof Error
        ? error.message
            .split(env.OPENAI_API_KEY)
            .join("[REDACTED]")
            .replace(/https?:\/\/[^\s"']+/g, "[URL]")
            .slice(0, 400)
        : "UNKNOWN_FAILURE";
    await writeFile(
      journal,
      JSON.stringify({
        state: "failed-or-uncertain",
        maximumReservedUsd: 0.1,
        automaticRetryAllowed: false,
        safeDiagnostic,
      }),
    );
    console.error(safeDiagnostic);
    throw new Error("BAZANTIC_AGENT_RUN_NOT_VERIFIED");
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error && /^[A-Z_]+$/.test(error.message)
      ? error.message
      : "BAZANTIC_AGENT_DEMO_STOPPED",
  );
  process.exitCode = 1;
});
