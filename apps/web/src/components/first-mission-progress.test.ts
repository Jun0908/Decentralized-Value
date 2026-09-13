import { describe, expect, it } from "vitest";
import { firstMissionProgress, type MissionRun } from "./first-mission-progress";

const initial: MissionRun = { contextHash: "day-a", artifactHash: "rules-a", valid: true };
const revision: MissionRun = { ...initial, artifactHash: "rules-b" };
describe("first mission learning progress", () => {
  it("does not complete from clicks or an unmeasured draft", () => {
    expect(firstMissionProgress(null, null, true)).toEqual([false, false, false]);
    expect(firstMissionProgress(initial, null, false)).toEqual([true, false, false]);
    expect(firstMissionProgress(initial, null, true)).toEqual([true, true, false]);
  });
  it("requires a new artifact and matching context, not a better score", () => {
    expect(firstMissionProgress(initial, initial, false)[2]).toBe(false);
    expect(firstMissionProgress(revision, initial, false)).toEqual([true, true, true]);
    expect(firstMissionProgress({ ...revision, contextHash: "day-b" }, initial, false)[2]).toBe(
      false,
    );
  });
  it("does not bless invalid results or newly edited, unmeasured changes", () => {
    expect(firstMissionProgress({ ...revision, valid: false }, initial, false)[2]).toBe(false);
    expect(firstMissionProgress(revision, { ...initial, valid: false }, false)[2]).toBe(false);
    expect(firstMissionProgress(revision, initial, true)).toEqual([true, true, false]);
  });
});
