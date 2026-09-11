// Command responses are validated before rendering and selected by command name.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function table(headers: string[], rows: unknown[][]): string {
  if (!rows.length) return "No records.";
  const cells = rows.map((row) => row.map((value) => String(value ?? "-")));
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...cells.map((row) => (row[index] ?? "").length)),
  );
  const line = (row: string[]) =>
    row
      .map((cell, index) => cell.padEnd(widths[index] ?? cell.length))
      .join("  ")
      .trimEnd();
  return [line(headers), line(widths.map((width) => "-".repeat(width))), ...cells.map(line)].join(
    "\n",
  );
}
const shortened = (value: unknown, length = 34) => {
  const text = String(value ?? "-").replace(/[\r\n\t]/g, " ");
  return text.length > length ? `${text.slice(0, length - 3)}...` : text;
};
const supported = (value: Row) =>
  !value.supported ? "unsupported" : value.available ? "available" : "unavailable";

export function renderHuman(command: string, data: unknown): string {
  const value = data as Row;
  switch (command) {
    case "arenas list": {
      const arenas = value.arenas as Row[];
      const lines = [
        table(
          ["Arena", "Name", "Practice", "Submit"],
          arenas.map((arena) => [
            arena.id,
            shortened(arena.name),
            supported(arena.capabilities.practice),
            supported(arena.capabilities.submit),
          ]),
        ),
      ];
      for (const arena of arenas)
        for (const name of ["practice", "submit"]) {
          const capability = arena.capabilities[name];
          if (!capability.available && capability.reason)
            lines.push(`${arena.id} ${name}: ${capability.reason}`);
        }
      return lines.join("\n");
    }
    case "runs list":
      return table(
        ["Run ID", "Correctness", "Evidence", "Episode", "Created"],
        value.runs.map((run: Row) => [
          run.runId,
          run.correctness ? "passed" : "failed",
          run.context.evidenceState,
          run.episodeId,
          run.createdAt,
        ]),
      );
    case "practice": {
      const lines = [
        `Run: ${value.runId}`,
        `Arena: ${value.arenaId}${value.episodeId ? `  Episode: ${value.episodeId}` : ""}`,
        `Correctness: ${value.correctness ? "passed" : "failed"}  Evidence: ${value.context.evidenceState}`,
        `Input hash: ${value.artifactHash}`,
        `Result hash: ${value.resultHash}`,
      ];
      if (value.raw.paymentState) lines.push(`Payment state: ${value.raw.paymentState}`);
      if (value.raw.rewardEligibility)
        lines.push(`Reward eligible: ${value.raw.rewardEligibility.eligible}`);
      lines.push(
        table(
          ["Metric", "Value", "Unit", "Direction"],
          value.context.metrics.map((metric: Row) => [
            metric.name,
            value.values[metric.key],
            metric.unit,
            metric.direction,
          ]),
        ),
      );
      return lines.join("\n");
    }
    case "compare":
      return [
        `Relation: ${value.relation}`,
        `Eligible: A=${value.eligible.a} B=${value.eligible.b}`,
        table(
          ["Metric", "A", "B", "Delta (B-A)", "Unit", "Direction"],
          value.metrics.map((metric: Row) => [
            metric.name,
            metric.a,
            metric.b,
            metric.delta > 0 ? `+${metric.delta}` : metric.delta,
            metric.unit,
            metric.direction,
          ]),
        ),
      ].join("\n");
    case "submissions list":
      return table(
        ["Submission ID", "Revision", "Correctness", "Source", "Submitted"],
        value.submissions.map((submission: Row) => [
          submission.submissionId,
          submission.revision,
          submission.evaluation.correctness ? "passed" : "failed",
          submission.sourceMethod,
          submission.submittedAt,
        ]),
      );
    case "init":
      return [
        `Project: ${value.directory}`,
        `Arena: ${value.project.arenaId}`,
        `Artifact: ${value.project.artifact}`,
        `Context: ${value.lock.context.contextHash}`,
        ...(value.lock.episodeId ? [`Episode: ${value.lock.episodeId}`] : []),
      ].join("\n");
    case "check":
      return [
        `Schema: ${value.schema}`,
        `Official correctness: ${value.correctness}`,
        ...value.constraints.map(
          (constraint: Row) => `${constraint.status}: ${constraint.constraint}`,
        ),
      ].join("\n");
    case "context update":
      return value.changed
        ? [
            `Context updated: ${value.lock.context.contextHash}`,
            ...value.changes.map((change: Row) => `Changed: ${change.field}`),
          ].join("\n")
        : "Context is current.";
    case "auth login":
    case "auth status":
      return [
        `Authenticated: ${value.userId}`,
        `Origin: ${value.origin}`,
        `Wallet: ${value.wallet}`,
        `Expires: ${value.expiresAt}`,
        `Scopes: ${value.scopes.join(", ")}`,
      ].join("\n");
    case "auth logout":
      return `Local credential deleted. Server revocation: ${value.serverRevocation}.${value.environmentTokenMustBeUnset ? " Unset FRONTIER_TOKEN in the calling environment." : ""}`;
    case "submit":
      return [
        `Submission saved: ${value.submission.submissionId}`,
        `Revision: ${value.submission.revision}`,
        `Operation: ${value.operationId}`,
        `Storage: ${value.storage}`,
      ].join("\n");
    case "submissions download":
      return `Downloaded ${value.submissionId}\n${value.output}`;
    case "entry select":
      return `Selected entry: ${value.finalEntry.submissionId}\nStorage: ${value.storage}`;
    case "open":
      return value.url;
    default:
      return JSON.stringify(data, null, 2);
  }
}
