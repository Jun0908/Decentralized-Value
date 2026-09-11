import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { withRescueModelBudget } from "../scripts/lib/rescue-model-budget";
const requestHash = `0x${"1".repeat(64)}`;

describe("Single-operator model budget", () => {
  it("reuses a durable output without calling the provider again", async () => {
    const directory = mkdtempSync(resolve(tmpdir(), "rescue-model-budget-"));
    const model = vi.fn(async () => ({ observed: true }));
    await withRescueModelBudget(directory, "one", requestHash, model);
    expect(await withRescueModelBudget(directory, "one", requestHash, model)).toEqual({
      observed: true,
    });
    await expect(
      withRescueModelBudget(directory, "one", `0x${"2".repeat(64)}`, model),
    ).rejects.toThrow("MODEL_REQUEST_CONFLICT");
    expect(model).toHaveBeenCalledTimes(1);
  });
  it("retains uncertain spending and refuses automatic retry", async () => {
    const directory = mkdtempSync(resolve(tmpdir(), "rescue-model-budget-"));
    await expect(
      withRescueModelBudget(directory, "one", requestHash, async () => {
        throw new Error("provider failed");
      }),
    ).rejects.toThrow();
    const model = vi.fn();
    await expect(withRescueModelBudget(directory, "one", requestHash, model)).rejects.toThrow(
      "MODEL_OUTCOME_UNCERTAIN",
    );
    expect(model).not.toHaveBeenCalled();
  });
  it("stops before the eleventh paid call, regardless of success", async () => {
    const directory = mkdtempSync(resolve(tmpdir(), "rescue-model-budget-"));
    for (let i = 0; i < 10; i++)
      await withRescueModelBudget(directory, `call-${i}`, requestHash, async () => ({
        done: true,
      }));
    const model = vi.fn();
    await expect(withRescueModelBudget(directory, "eleven", requestHash, model)).rejects.toThrow(
      "MODEL_BUDGET_EXHAUSTED",
    );
    expect(model).not.toHaveBeenCalled();
  });
});
