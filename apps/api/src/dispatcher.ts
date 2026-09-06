import type { EnsRunnerDirectory } from "@frontier/ens-adapter";
import type { EvaluationDispatcher } from "./index";
import type { EvaluationJob } from "./store";

export class EnsEvaluationDispatcher implements EvaluationDispatcher {
  constructor(
    private readonly directory: EnsRunnerDirectory,
    private readonly capability: string,
    private readonly fetcher: typeof fetch = fetch,
    private readonly timeoutMs = 10_000,
    private readonly retries = 2,
  ) {}

  async dispatch(job: EvaluationJob): Promise<void> {
    const [runner] = await this.directory.discover(this.capability);
    if (!runner) throw new Error(`No ENS runner supports ${this.capability}`);
    job.runnerEnsName = runner.ensName;

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      try {
        const response = await this.fetcher(runner.endpoint, {
          method: "POST",
          headers: { "content-type": "application/json", "idempotency-key": job.jobId },
          body: JSON.stringify(job),
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (!response.ok) throw new Error(`Runner returned HTTP ${response.status}`);
        job.state = "running";
        return;
      } catch (error) {
        lastError = error;
        if (attempt < this.retries)
          await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
      }
    }
    throw new Error(`Runner dispatch failed after ${this.retries + 1} attempts`, {
      cause: lastError,
    });
  }
}
