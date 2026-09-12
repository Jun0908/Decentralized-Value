import { describe, expect, it } from "vitest";
import { publicRescueRoomScenario } from "../../packages/rescue-room/src/index";
import { rescueServiceExecutionHash } from "../../packages/rescue-room/src/service-execution";
import { prepareRescueInformationStudy } from "./rescue-information-study";

describe("information study preparation, not AI performance evidence", () => {
  it("includes every public Episode once, with the same three arms", () => {
    const plan = prepareRescueInformationStudy();
    expect(plan.episodeIds).toEqual(publicRescueRoomScenario().episodes.map(({ id }) => id));
    expect(plan.cases).toHaveLength(35);
    expect(new Set(plan.cases.map(({ episodeId }) => episodeId)).size).toBe(35);
    for (const trial of plan.cases)
      expect([...trial.armOrder].sort()).toEqual([...plan.protocol.arms].sort());
  });
  it("has a deterministic, tamper-sensitive design hash but no execution authority", () => {
    const plan = prepareRescueInformationStudy();
    const { planHash, ...body } = plan;
    expect(planHash).toBe(rescueServiceExecutionHash(body));
    expect(prepareRescueInformationStudy()).toEqual(plan);
    expect(plan.resourceCeiling).toMatchObject({
      totalCalls: 350,
      approvedLiveCalls: 0,
      approvedSpendUsd: 0,
      chainTransactions: 0,
      automaticRetries: 0,
    });
    expect(plan.boundary).toMatchObject({
      aiUtilityProven: false,
      hiddenFinal: false,
      modelExecuted: false,
      publicTimestampProven: false,
    });
    const changed = structuredClone(body);
    changed.episodeIds.reverse();
    expect(rescueServiceExecutionHash(changed)).not.toBe(planHash);
  });
  it("does not expose hidden Episode definitions or mix aggregation contexts", () => {
    const plan = prepareRescueInformationStudy();
    expect(plan.context.metrics.map(({ key, direction }) => ({ key, direction }))).toEqual([
      { key: "totalUserLossUsd", direction: "MINIMIZE" },
      { key: "servedProtocolDemandPpm", direction: "MAXIMIZE" },
      { key: "netResponseSpendCredits", direction: "MINIMIZE" },
    ]);
    for (const trial of plan.cases)
      expect(Object.keys(trial).sort()).toEqual(["armOrder", "episodeId", "replicate"]);
    expect(plan.population).toBe("all-public-practice-episodes-not-hidden-final");
  });
});
