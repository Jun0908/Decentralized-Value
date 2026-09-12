import { describe, expect, it } from "vitest";
import { arenaRegistry, getArena } from "./arenas";

describe("arena display order", () => {
  it("places Ocean in the first row and Calldata last without reordering the other arenas", () => {
    expect(arenaRegistry.map(({ slug }) => slug)).toEqual([
      "emergency-supply",
      "rescue-room",
      "ocean-commons",
      "secret-gate",
      "microgrid-dispatch",
      "calldata-compression",
    ]);
  });

  it("preserves unique routes and lookup for every arena", () => {
    expect(new Set(arenaRegistry.map(({ slug }) => slug)).size).toBe(6);
    for (const arena of arenaRegistry) expect(getArena(arena.slug)).toBe(arena);
    expect(getArena("unknown-arena")).toBeUndefined();
  });

  it("labels the Microgrid day model separately without changing its reference challenge route", () => {
    const arena = getArena("microgrid-dispatch");
    expect(arena?.challengeId).toBe("microgrid-dispatch-v1");
    expect(arena?.evidenceLabel).toContain("modeled day");
    expect(arena?.metrics.map(({ name, direction }) => [name, direction])).toEqual([
      ["Energy cost", "Minimize"],
      ["Unserved energy", "Minimize"],
      ["Operational carbon", "Minimize"],
    ]);
  });
});
