import { describe, expect, it } from "vitest";
import { defaultDisasterResponseStrategy } from "@frontier/disaster-response";
import { publicRescueRoomScenario } from "@frontier/rescue-room";
import benchmark from "../../../benchmarks/evm-orderbook/results/latest.json";
import { createApi, MemoryPlan6CompetitionStore } from "./index";
import { cliResponseSchemas } from "./cli-response-schemas";

describe("Published CLI response contracts", () => {
  it("validates real practice responses without coercing their evidence states", async () => {
    const api = createApi(benchmark);
    const disaster = await (
      await api.fetch(
        new Request("http://localhost/v1/disaster-response/evaluations", {
          method: "POST",
          body: JSON.stringify(defaultDisasterResponseStrategy),
        }),
      )
    ).json();
    expect(cliResponseSchemas.CliDisasterPracticeResult.parse(disaster).state).toBe("measured");
    const rescue = publicRescueRoomScenario();
    const result = await (
      await api.fetch(
        new Request("http://localhost/v1/rescue-room/doctrine-evaluations", {
          method: "POST",
          body: JSON.stringify({
            episodeId: rescue.episodes[0]!.id,
            doctrine: rescue.doctrineRuntime.presets[0]!.doctrine,
          }),
        }),
      )
    ).json();
    expect(cliResponseSchemas.CliRescuePracticeResult.parse(result).state).toBe("simulated");
    expect(() =>
      cliResponseSchemas.CliRescuePracticeResult.parse({ ...result, state: "measured" }),
    ).toThrow();
  });

  it("validates join, saved submission, owned history and selected entry", async () => {
    const store = new MemoryPlan6CompetitionStore();
    const api = createApi(benchmark, undefined, undefined, undefined, {
      store,
      identity: async () => ({
        userId: "cli-contract-test",
        wallet: "0x1111111111111111111111111111111111111111",
      }),
    });
    const call = async (path: string, method = "GET", body?: object) =>
      (
        await api.fetch(
          new Request(`http://localhost/v1/challenges/disaster-response/${path}`, {
            method,
            headers: { "content-type": "application/json", "idempotency-key": "cli-contract-test" },
            ...(body ? { body: JSON.stringify(body) } : {}),
          }),
        )
      ).json();
    cliResponseSchemas.CliJoinResult.parse(await call("join", "POST"));
    const saved = cliResponseSchemas.CliSubmissionResult.parse(
      await call("submissions", "POST", {
        strategy: defaultDisasterResponseStrategy,
        sourceMethod: "JSON",
      }),
    );
    const mine = cliResponseSchemas.CliMySubmissions.parse(await call("submissions/mine"));
    expect(mine.submissions[0]!.inputHash).toBe(saved.submission.inputHash);
    cliResponseSchemas.CliFinalEntryResult.parse(
      await call("final-entry", "PUT", { submissionId: saved.submission.submissionId }),
    );
  });
});
