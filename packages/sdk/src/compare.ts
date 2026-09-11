import { cliContextSchema, cliRunSchema, type CliContext, type CliRun } from "@frontier/shared/cli";
import { canonicalProtocolJson } from "@frontier/shared/manifest";
import { dominatesOutcome, type OutcomeMetric } from "@frontier/shared/multiobjective";
import { FrontierError } from "./errors.js";
import { apiOrigin } from "./transport.js";

export function assertSameContext(left: CliContext, right: CliContext): void {
  const a = cliContextSchema.parse(left);
  const b = cliContextSchema.parse(right);
  if (canonicalProtocolJson(a) !== canonicalProtocolJson(b)) {
    throw new FrontierError(
      "CONTEXT_MISMATCH",
      "Evaluation context, runtime, metrics or evidence class differs",
    );
  }
}

export interface RunComparison {
  relation: "a-dominates" | "b-dominates" | "tradeoff" | "equal";
  eligible: { a: boolean; b: boolean };
  metrics: Array<{
    key: string;
    name: string;
    direction: OutcomeMetric["direction"];
    unit: string;
    a: number;
    b: number;
    delta: number;
  }>;
}

export function compareRuns(a: CliRun, b: CliRun): RunComparison {
  const left = cliRunSchema.parse(a);
  const right = cliRunSchema.parse(b);
  if (
    left.arenaId !== right.arenaId ||
    left.episodeId !== right.episodeId ||
    apiOrigin(left.baseUrl) !== apiOrigin(right.baseUrl)
  ) {
    throw new FrontierError(
      "RUNS_NOT_COMPARABLE",
      "Runs must share the same arena, API origin and Episode",
    );
  }
  assertSameContext(left.context, right.context);
  const keys = left.context.metrics.map(({ key }) => key);
  if (
    new Set(keys).size !== keys.length ||
    keys.some((key) => left.values[key] === undefined || right.values[key] === undefined)
  ) {
    throw new FrontierError(
      "INVALID_RUN",
      "Run metrics are duplicated or required values are missing",
    );
  }
  const point = (run: CliRun) => ({
    id: run.runId,
    name: run.runId,
    correctness: run.correctness,
    baseline: false,
    values: run.values,
  });
  const relation = dominatesOutcome(point(left), point(right), left.context.metrics)
    ? "a-dominates"
    : dominatesOutcome(point(right), point(left), left.context.metrics)
      ? "b-dominates"
      : keys.every((key) => left.values[key] === right.values[key])
        ? "equal"
        : "tradeoff";
  return {
    relation,
    eligible: { a: left.correctness, b: right.correctness },
    metrics: left.context.metrics.map(({ key, name, direction, unit }) => ({
      key,
      name,
      direction,
      unit,
      a: left.values[key]!,
      b: right.values[key]!,
      delta: right.values[key]! - left.values[key]!,
    })),
  };
}
