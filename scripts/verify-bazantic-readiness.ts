import { readFileSync } from "node:fs";
import { runRecipeExperiment } from "../bazantic/experiments/ab-harness";
import { localPracticeFixture } from "../bazantic/experiments/local-fixture";

// Fixed public recipe + in-process fixtures only. No environment/key reads, network or output writes.
try {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--full") || args.length > 1) {
    throw new Error("Only the optional --full flag is supported");
  }
  const fixture = localPracticeFixture();
  const recipe = readFileSync(new URL("../bazantic/recipe.md", import.meta.url), "utf8");
  const report = await runRecipeExperiment(fixture.config, recipe, fixture);
  if (report.pairs.some(({ a, b }) => a.status !== "completed" || b.status !== "completed")) {
    throw new Error("Local A/B fixture failed");
  }
  // Summary still includes EVERY declared pair, including failed/equal/worse outcomes.
  // --full additionally emits complete request/response/tool traces, potentially several MB.
  const output = args.includes("--full")
    ? report
    : {
        schemaVersion: report.schemaVersion,
        evidenceClass: report.evidenceClass,
        liveGatewayVerified: report.liveGatewayVerified,
        realModelExecutionVerified: report.realModelExecutionVerified,
        paymentRequested: report.paymentRequested,
        controlsHash: report.controlsHash,
        recipeHash: report.recipeHash,
        reportHash: report.reportHash,
        model: report.controls.model,
        declaredEpisodes: report.controls.episodeIds,
        declaredSeeds: report.controls.seeds,
        fullTraceIncluded: false,
        fullTraceCommand: "pnpm exec tsx scripts/verify-bazantic-readiness.ts --full",
        pairs: report.pairs.map(({ episodeId, seed, a, b, comparison }) => ({
          episodeId,
          seed,
          comparison,
          a: {
            status: a.status,
            failureCode: a.failureCode,
            requestHash: a.requestHash,
            responseHash: a.responseHash,
            resultHash: a.evaluation?.outcome.resultHash ?? null,
          },
          b: {
            status: b.status,
            failureCode: b.failureCode,
            requestHash: b.requestHash,
            responseHash: b.responseHash,
            resultHash: b.evaluation?.outcome.resultHash ?? null,
          },
        })),
      };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
} catch {
  process.stderr.write(
    "Bazantic local readiness verification failed; no live calls were attempted.\n",
  );
  process.exitCode = 1;
}
