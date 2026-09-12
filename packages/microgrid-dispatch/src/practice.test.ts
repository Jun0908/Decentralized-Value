import { describe, expect, it } from "vitest";
import { microgridContextHash } from "./index";
import {
  compareMicrogridDays,
  microgridDayContext,
  microgridDayFrontier,
  microgridDayPresets,
  microgridDayScenarios,
  parseMicrogridPolicy,
  simulateMicrogridDay,
  verifyMicrogridReplay,
} from "./practice";

const baseline = microgridDayPresets[0]!.policy;

describe("microgrid day strategy practice", () => {
  it("conserves energy across generation, served load, storage, curtailment and losses", () => {
    for (const scenario of microgridDayScenarios)
      for (const preset of microgridDayPresets) {
        const result = simulateMicrogridDay(preset.policy, scenario.id);
        for (const step of result.steps) {
          const incoming =
            step.socStartMwh +
            step.period.solarMwh +
            step.period.windMwh +
            step.gridToLoadMwh +
            step.gridToBatteryMwh;
          const outgoing = step.socEndMwh + step.servedMwh + step.curtailedMwh + step.lossMwh;
          expect(incoming).toBeCloseTo(outgoing, 8);
          expect(step.servedMwh + step.unservedMwh).toBeCloseTo(step.period.demandMwh, 8);
          expect(step.socEndMwh).toBeCloseTo(
            step.socStartMwh + step.batteryStoredMwh - step.batteryWithdrawalMwh,
            8,
          );
        }
      }
  });

  it("enforces SOC, rates and no simultaneous charge/discharge across policy extremes", () => {
    for (const reservePercent of [0, 1, 50, 99, 100])
      for (const maxGridMwh of [0, 1, 2, 20])
        for (const dischargePrice of [1, 90, 250]) {
          const result = simulateMicrogridDay({
            ...baseline,
            reservePercent,
            maxGridMwh,
            dischargePrice,
          });
          for (const step of result.steps) {
            expect(step.socEndMwh).toBeGreaterThanOrEqual(0);
            expect(step.socEndMwh).toBeLessThanOrEqual(20);
            expect(step.batteryToLoadMwh).toBeLessThanOrEqual(8);
            expect(step.renewableToBatteryMwh + step.gridToBatteryMwh).toBeLessThanOrEqual(8);
            expect(step.gridToLoadMwh + step.gridToBatteryMwh).toBeLessThanOrEqual(maxGridMwh);
            expect(
              step.batteryToLoadMwh * (step.gridToBatteryMwh + step.renewableToBatteryMwh),
            ).toBe(0);
            for (const value of Object.values(step))
              if (typeof value === "number") expect(value).toBeGreaterThanOrEqual(0);
          }
        }
  });

  it("releases the normal reserve during an outage and cannot invent grid power", () => {
    const result = simulateMicrogridDay({ ...baseline, reservePercent: 100 });
    const outage = result.steps[4]!;
    expect(outage.period.gridOnline).toBe(false);
    expect(outage.gridToLoadMwh + outage.gridToBatteryMwh).toBe(0);
    expect(outage.batteryToLoadMwh).toBe(8);
    expect(outage.unservedMwh).toBe(5);
    expect(outage.socEndMwh).toBeLessThan(outage.socStartMwh);
  });

  it("applies conversion losses and initial stored energy attribution", () => {
    const result = simulateMicrogridDay(baseline);
    const morning = result.steps[2]!;
    expect(morning.renewableToBatteryMwh).toBe(7);
    expect(morning.batteryStoredMwh).toBe(6.3);
    expect(morning.lossMwh).toBe(0.7);
    expect(result.totals.costUsd).toBeCloseTo(
      result.steps.reduce((sum, step) => sum + step.costUsd, 300),
      3,
    );
    expect(result.totals.carbonKg).toBeCloseTo(
      result.steps.reduce((sum, step) => sum + step.carbonKg, 2100),
      3,
    );
  });

  it("is deterministic and independent of policy key order", () => {
    const first = simulateMicrogridDay(baseline);
    const reversed = Object.fromEntries(Object.entries(baseline).reverse());
    expect(simulateMicrogridDay(reversed)).toEqual(first);
    expect(first.resultHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(verifyMicrogridReplay(JSON.parse(JSON.stringify(first)))).toBe(true);
    expect(first.contextHash).not.toBe(microgridContextHash);
    expect(microgridDayContext("clear-day").contextHash).not.toBe(first.contextHash);
  });

  it("rejects replay tampering and wrong versions", () => {
    const result = simulateMicrogridDay(baseline);
    expect(verifyMicrogridReplay({ ...result, totals: { ...result.totals, costUsd: 0 } })).toBe(
      false,
    );
    expect(verifyMicrogridReplay({ ...result, contextHash: microgridContextHash })).toBe(false);
    expect(verifyMicrogridReplay({ ...result, simulatorVersion: "v0" })).toBe(false);
    expect(verifyMicrogridReplay({ ...result, steps: [...result.steps].reverse() })).toBe(false);
    expect(verifyMicrogridReplay(null)).toBe(false);
  });

  it.each([
    null,
    [],
    {},
    { ...baseline, reservePercent: -1 },
    { ...baseline, reservePercent: 101 },
    { ...baseline, maxGridMwh: 21 },
    { ...baseline, maxGridMwh: 1.5 },
    { ...baseline, dischargePrice: Number.NaN },
    { ...baseline, chargeBelowPrice: 100 },
    { ...baseline, unexpected: 1 },
    { ...baseline, version: "v0" },
  ])("rejects malformed policy %# before measurement", (input) => {
    expect(() => parseMicrogridPolicy(input)).toThrow();
  });

  it("compares the independent axes honestly and rejects mixed contexts", () => {
    const reference = simulateMicrogridDay(baseline);
    const limited = simulateMicrogridDay(microgridDayPresets[2]!.policy);
    expect(compareMicrogridDays(reference, reference).relation).toBe("equal");
    expect(compareMicrogridDays(limited, reference).relation).toBe("tradeoff");
    expect(compareMicrogridDays(limited, reference).deltas.unservedMwh).toBeGreaterThan(0);
    expect(compareMicrogridDays(limited, reference).deltas.carbonKg).toBeLessThan(0);
    expect(() =>
      compareMicrogridDays(reference, simulateMicrogridDay(baseline, "clear-day")),
    ).toThrow(/same/);
    expect(() =>
      compareMicrogridDays(
        { ...reference, totals: { ...reference.totals, costUsd: 0 } },
        reference,
      ),
    ).toThrow(/verified/);
  });

  it.each(["__proto__", "constructor", "toString"])(
    "rejects prototype-name policy key %s",
    (key) => {
      expect(() =>
        parseMicrogridPolicy(JSON.parse(JSON.stringify(baseline).replace(/}$/, `,\"${key}\":0}`))),
      ).toThrow(/Unknown/);
    },
  );

  it("preserves frontier membership under comparison order permutations", () => {
    const entries = microgridDayPresets.map(({ id, policy }) => ({
      id,
      result: simulateMicrogridDay(policy),
    }));
    expect(microgridDayFrontier(entries)).toEqual(microgridDayFrontier([...entries].reverse()));
    expect(() => microgridDayFrontier([entries[0]!, entries[0]!])).toThrow(/unique/);
  });
});
